# Security Policy

## Reporting a vulnerability

Do not disclose a vulnerability through a public GitHub issue.

Use GitHub's private vulnerability reporting feature for this repository when available. Include:

- affected version or commit
- device and operating-system version
- reproduction steps
- expected and observed behavior
- impact on audio, transcript, identity, model, storage, or export data
- suggested remediation when known

Do not attach real client meeting audio or transcripts. Use synthetic test data.

## Supported versions

The project is pre-release. Security fixes are applied to the latest `main` branch until a formal release-support policy is published.

## Security-sensitive areas

Changes to the following require focused review:

- recording consent and indicators
- microphone and background permissions
- audio and transcript storage
- deletion and retention
- model download URLs and integrity
- speaker enrollment or embeddings
- clipboard and share workflows
- future synchronization, authentication, or organization policy
