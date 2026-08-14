# Local Model Runtime

## Model profiles

Roomtone ships only a manifest. Model binaries are not committed to Git and are downloaded explicitly by the user.

| Profile | Role | Approximate size | Language | Speaker turns |
| --- | --- | ---: | --- | --- |
| Whisper tiny English q5_1 | Speech | 32 MB | English | No |
| Whisper tiny multilingual q5_1 | Speech | 32 MB | Multilingual | No |
| Whisper small English TinyDiarize | Speech | 488 MB | English | Anonymous changes |
| Silero VAD 6.2 | VAD | 865 KB | None | Not applicable |

The manifest includes expected SHA-256 values where they were available during implementation. The current download adapter does not yet enforce SHA-256 verification on-device. Release hardening should add a streaming hash implementation before the model is moved from a temporary download path into the active model directory.

## Native build requirement

`whisper.rn` contains native code. Expo Go can run the guided demo, persistence, analysis, search, clipboard, and PDF flows, but it cannot load the Whisper native module.

Create a development build with:

```bash
npm run prebuild
npm run ios
# or
npm run android
```

## Model selection rules

- English-only models are valid for English or explicitly constrained auto-detect sessions.
- English translation requires the multilingual model.
- TinyDiarize is experimental and emits speaker-change markers rather than verified identities.
- VAD must be installed for the native runtime.

## Resource behavior

The first production device matrix should define at least three profiles:

| Device profile | Speech model | Translation | Speaker turns |
| --- | --- | --- | --- |
| Constrained | tiny English | Off | Off |
| Standard | tiny multilingual | Optional | Off |
| High-resource | benchmark-selected | Optional | Optional |

The app should pause secondary translation or speaker processing before compromising capture continuity.

## Distribution guidance

Do not bundle large models in the application package by default. Runtime download keeps the binary size manageable and allows users to remove models they do not need. Enterprise distribution may host approved model binaries in a controlled artifact repository, but the manifest and verification process must remain auditable.
