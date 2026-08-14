import type { ModelDescriptor } from '../domain/types.ts';

export const modelManifest: ModelDescriptor[] = [
  {
    id: 'whisper-tiny-english-q5-1',
    title: 'English · Fast',
    description: 'Compact English speech model for lower memory use and fast local transcription.',
    filename: 'ggml-tiny.en-q5_1.bin',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en-q5_1.bin',
    approximateBytes: 32_200_000,
    sha256: 'c77c576b83e239c7d44c979f21caeaabcadd7a291c4047f2e2b019fc43a3f211',
    role: 'speech',
    language: 'english',
    supportsSpeakerTurns: false,
    resourceClass: 'light'
  },
  {
    id: 'whisper-tiny-multilingual-q5-1',
    title: 'Multilingual · Fast',
    description: 'Compact multilingual model for transcription, language detection, and English translation.',
    filename: 'ggml-tiny-q5_1.bin',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny-q5_1.bin',
    approximateBytes: 32_200_000,
    sha256: '8187105682788143523a47222e75297188b54537a6b18a3a5916e9c701e7c95f',
    role: 'speech',
    language: 'multilingual',
    supportsSpeakerTurns: false,
    resourceClass: 'light'
  },
  {
    id: 'whisper-small-english-tdrz',
    title: 'English · Speaker turns',
    description: 'Experimental English model that emits anonymous speaker-change markers. It does not identify people.',
    filename: 'ggml-small.en-tdrz.bin',
    url: 'https://huggingface.co/akashmjn/tinydiarize-whisper.cpp/resolve/main/ggml-small.en-tdrz.bin',
    approximateBytes: 488_000_000,
    sha256: 'ceac28a247ea0b6bd1fa1cbd1dce9a7804c563b8f520037b537e8cc5a5a0b391',
    role: 'speech',
    language: 'english',
    supportsSpeakerTurns: true,
    resourceClass: 'heavy'
  },
  {
    id: 'silero-vad-6-2',
    title: 'Voice activity detection',
    description: 'Local voice activity model used to isolate speech and reduce unnecessary inference.',
    filename: 'ggml-silero-v6.2.0.bin',
    url: 'https://huggingface.co/ggml-org/whisper-vad/resolve/main/ggml-silero-v6.2.0.bin',
    approximateBytes: 865_000,
    role: 'vad',
    language: 'none',
    supportsSpeakerTurns: false,
    resourceClass: 'light'
  }
];
