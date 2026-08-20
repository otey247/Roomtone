package expo.modules.roomtonemedianormalizer

import android.content.Context
import android.media.AudioFormat
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.RandomAccessFile
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.roundToInt

class RoomtoneMediaNormalizerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("RoomtoneMediaNormalizer")

    AsyncFunction("normalizeToWav") { sourceUri: String, outputUri: String ->
      val context = appContext.reactContext
        ?: throw IllegalStateException("Android application context is unavailable.")
      normalize(context, sourceUri, outputUri)
    }
  }

  private fun normalize(context: Context, sourceUri: String, outputUri: String): Map<String, Any> {
    val extractor = MediaExtractor()
    val outputFile = File(uriToPath(outputUri))
    outputFile.parentFile?.mkdirs()

    try {
      if (sourceUri.startsWith("content://")) {
        extractor.setDataSource(context, Uri.parse(sourceUri), null)
      } else {
        extractor.setDataSource(uriToPath(sourceUri))
      }

      var audioTrack = -1
      var inputFormat: MediaFormat? = null
      for (index in 0 until extractor.trackCount) {
        val candidate = extractor.getTrackFormat(index)
        val mime = candidate.getString(MediaFormat.KEY_MIME) ?: continue
        if (mime.startsWith("audio/")) {
          audioTrack = index
          inputFormat = candidate
          break
        }
      }
      if (audioTrack < 0 || inputFormat == null) throw IllegalArgumentException("The selected file does not contain a decodable audio track.")

      extractor.selectTrack(audioTrack)
      val mime = inputFormat.getString(MediaFormat.KEY_MIME)
        ?: throw IllegalArgumentException("The audio track does not declare a MIME type.")
      val codec = MediaCodec.createDecoderByType(mime)
      val writer = WavWriter(outputFile, 16_000)
      var sourceRate = inputFormat.integerOr(MediaFormat.KEY_SAMPLE_RATE, 48_000)
      var sourceChannels = inputFormat.integerOr(MediaFormat.KEY_CHANNEL_COUNT, 1)
      var pcmEncoding = AudioFormat.ENCODING_PCM_16BIT
      var converter = PcmConverter(writer, sourceRate, sourceChannels, pcmEncoding)

      try {
        codec.configure(inputFormat, null, null, 0)
        codec.start()
        val info = MediaCodec.BufferInfo()
        var inputDone = false
        var outputDone = false
        var idleIterations = 0

        while (!outputDone) {
          if (!inputDone) {
            val inputIndex = codec.dequeueInputBuffer(10_000)
            if (inputIndex >= 0) {
              val inputBuffer = codec.getInputBuffer(inputIndex)
                ?: throw IllegalStateException("The decoder did not provide an input buffer.")
              val sampleSize = extractor.readSampleData(inputBuffer, 0)
              if (sampleSize < 0) {
                codec.queueInputBuffer(inputIndex, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                inputDone = true
              } else {
                codec.queueInputBuffer(inputIndex, 0, sampleSize, extractor.sampleTime, 0)
                extractor.advance()
              }
            }
          }

          when (val outputIndex = codec.dequeueOutputBuffer(info, 10_000)) {
            MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
              val format = codec.outputFormat
              sourceRate = format.integerOr(MediaFormat.KEY_SAMPLE_RATE, sourceRate)
              sourceChannels = format.integerOr(MediaFormat.KEY_CHANNEL_COUNT, sourceChannels)
              pcmEncoding = format.integerOr(MediaFormat.KEY_PCM_ENCODING, AudioFormat.ENCODING_PCM_16BIT)
              converter = PcmConverter(writer, sourceRate, sourceChannels, pcmEncoding)
              idleIterations = 0
            }
            MediaCodec.INFO_TRY_AGAIN_LATER -> {
              idleIterations += 1
              if (inputDone && idleIterations > 600) throw IllegalStateException("The media decoder did not finish within the expected time.")
            }
            else -> if (outputIndex >= 0) {
              idleIterations = 0
              val outputBuffer = codec.getOutputBuffer(outputIndex)
              if (outputBuffer != null && info.size > 0) {
                outputBuffer.position(info.offset)
                outputBuffer.limit(info.offset + info.size)
                converter.consume(outputBuffer.slice().order(ByteOrder.LITTLE_ENDIAN))
              }
              outputDone = info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0
              codec.releaseOutputBuffer(outputIndex, false)
            }
          }
        }
        converter.finish()
      } finally {
        runCatching { codec.stop() }
        codec.release()
        writer.close()
      }

      return mapOf(
        "outputUri" to outputUri,
        "durationMs" to writer.durationMs(),
        "sourceSampleRate" to sourceRate,
        "sourceChannels" to sourceChannels,
        "outputSampleRate" to 16_000,
        "outputChannels" to 1,
        "pcmBytes" to writer.pcmBytes()
      )
    } finally {
      extractor.release()
    }
  }

  private fun uriToPath(uri: String): String {
    return if (uri.startsWith("file://")) Uri.parse(uri).path
      ?: throw IllegalArgumentException("The file URI does not contain a path.")
    else uri
  }
}

private fun MediaFormat.integerOr(key: String, fallback: Int): Int {
  return if (containsKey(key)) getInteger(key) else fallback
}

private class PcmConverter(
  private val writer: WavWriter,
  private val sourceRate: Int,
  private val channels: Int,
  private val encoding: Int
) {
  private val resampler = LinearResampler(writer, sourceRate, 16_000)

  fun consume(buffer: ByteBuffer) {
    when (encoding) {
      AudioFormat.ENCODING_PCM_FLOAT -> consumeFloat(buffer)
      AudioFormat.ENCODING_PCM_8BIT -> consume8Bit(buffer)
      AudioFormat.ENCODING_PCM_32BIT -> consume32Bit(buffer)
      else -> consume16Bit(buffer)
    }
  }

  private fun consume16Bit(buffer: ByteBuffer) {
    val frameBytes = 2 * channels.coerceAtLeast(1)
    while (buffer.remaining() >= frameBytes) {
      var sum = 0.0
      repeat(channels.coerceAtLeast(1)) { sum += buffer.short / 32768.0 }
      resampler.accept((sum / channels.coerceAtLeast(1)).toFloat())
    }
  }

  private fun consumeFloat(buffer: ByteBuffer) {
    val frameBytes = 4 * channels.coerceAtLeast(1)
    while (buffer.remaining() >= frameBytes) {
      var sum = 0.0
      repeat(channels.coerceAtLeast(1)) { sum += buffer.float.coerceIn(-1f, 1f) }
      resampler.accept((sum / channels.coerceAtLeast(1)).toFloat())
    }
  }

  private fun consume8Bit(buffer: ByteBuffer) {
    val frameBytes = channels.coerceAtLeast(1)
    while (buffer.remaining() >= frameBytes) {
      var sum = 0.0
      repeat(channels.coerceAtLeast(1)) { sum += ((buffer.get().toInt() and 0xff) - 128) / 128.0 }
      resampler.accept((sum / channels.coerceAtLeast(1)).toFloat())
    }
  }

  private fun consume32Bit(buffer: ByteBuffer) {
    val frameBytes = 4 * channels.coerceAtLeast(1)
    while (buffer.remaining() >= frameBytes) {
      var sum = 0.0
      repeat(channels.coerceAtLeast(1)) { sum += buffer.int / 2147483648.0 }
      resampler.accept((sum / channels.coerceAtLeast(1)).toFloat())
    }
  }

  fun finish() = resampler.finish()
}

private class LinearResampler(
  private val writer: WavWriter,
  sourceRate: Int,
  targetRate: Int
) {
  private val step = sourceRate.toDouble() / targetRate.toDouble()
  private var previous: Float? = null
  private var previousIndex = 0L
  private var nextOutputPosition = 0.0

  fun accept(sample: Float) {
    val prior = previous
    if (prior == null) {
      previous = sample
      writer.writeSample(sample)
      nextOutputPosition = step
      return
    }
    val currentIndex = previousIndex + 1
    while (nextOutputPosition <= currentIndex.toDouble()) {
      val ratio = (nextOutputPosition - previousIndex.toDouble()).coerceIn(0.0, 1.0)
      writer.writeSample((prior + (sample - prior) * ratio.toFloat()).coerceIn(-1f, 1f))
      nextOutputPosition += step
    }
    previous = sample
    previousIndex = currentIndex
  }

  fun finish() {
    if (writer.pcmBytes() == 0L && previous != null) writer.writeSample(previous!!)
  }
}

private class WavWriter(file: File, private val sampleRate: Int) {
  private val output = RandomAccessFile(file, "rw")
  private var bytesWritten = 0L

  init {
    output.setLength(0)
    repeat(44) { output.write(0) }
  }

  fun writeSample(sample: Float) {
    val value = (sample.coerceIn(-1f, 1f) * Short.MAX_VALUE).roundToInt().coerceIn(Short.MIN_VALUE.toInt(), Short.MAX_VALUE.toInt())
    output.write(value and 0xff)
    output.write((value shr 8) and 0xff)
    bytesWritten += 2
  }

  fun pcmBytes(): Long = bytesWritten
  fun durationMs(): Long = if (sampleRate > 0) bytesWritten * 1000L / (sampleRate * 2L) else 0L

  fun close() {
    val riffSize = (36L + bytesWritten).coerceAtMost(0xffffffffL)
    val dataSize = bytesWritten.coerceAtMost(0xffffffffL)
    output.seek(0)
    output.writeBytes("RIFF")
    output.writeLittleEndianInt(riffSize)
    output.writeBytes("WAVE")
    output.writeBytes("fmt ")
    output.writeLittleEndianInt(16)
    output.writeLittleEndianShort(1)
    output.writeLittleEndianShort(1)
    output.writeLittleEndianInt(sampleRate.toLong())
    output.writeLittleEndianInt(sampleRate * 2L)
    output.writeLittleEndianShort(2)
    output.writeLittleEndianShort(16)
    output.writeBytes("data")
    output.writeLittleEndianInt(dataSize)
    output.close()
  }
}

private fun RandomAccessFile.writeLittleEndianShort(value: Int) {
  write(value and 0xff)
  write((value shr 8) and 0xff)
}

private fun RandomAccessFile.writeLittleEndianInt(value: Long) {
  write((value and 0xff).toInt())
  write(((value shr 8) and 0xff).toInt())
  write(((value shr 16) and 0xff).toInt())
  write(((value shr 24) and 0xff).toInt())
}
