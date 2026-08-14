# Evaluation and Release Gates

Roomtone must be evaluated as a real-time mobile system, not only as a transcript UI.

## 1. Speech quality

Measure word error rate by:

- device tier
- distance from the phone
- room noise
- speaker accent
- language
- overlapping speech
- model profile

Maintain a fixed, consented evaluation corpus and record the model checksum used for every run.

## 2. Speaker quality

For anonymous speaker-change models, report:

- speaker-change precision and recall
- false turn splits
- missed turn changes
- number of anonymous labels created
- human correction time

Do not report full diarization error rate until a clustering provider reconnects recurring turns to the same anonymous speaker.

## 3. Latency

Capture at least:

- microphone buffer to partial transcript p50 and p95
- microphone buffer to final transcript p50 and p95
- final transcript to keyword highlight
- final transcript to deterministic outcome
- stop action to finalized meeting
- PDF generation time

## 4. Reliability

Required continuous-session tests:

| Duration | Minimum devices | Required repetitions |
| ---: | ---: | ---: |
| 30 minutes | 6 | 5 per device |
| 60 minutes | 6 | 3 per device |
| 120 minutes | 3 | 2 per device |

Exercise:

- screen lock and unlock
- application background and foreground
- Bluetooth route changes
- wired headset changes where supported
- phone calls and audio interruptions
- low battery mode
- low storage
- permission denial and later grant
- process termination and recovery

No transcript, translation, or analytics task may silently stop audio capture.

## 5. Resource use

Record:

- battery percentage consumed per hour
- average and peak resident memory
- sustained CPU
- thermal state transitions
- audio storage per hour
- transcript database growth
- model storage

Define automatic degradation thresholds before public release.

## 6. Deterministic intelligence

Build labeled datasets for:

- decisions
- action items
- owner attribution
- due-text extraction
- questions
- risks
- commitments
- keyword boundaries and aliases

Report precision and recall. Every false positive and false negative should retain the source transcript segment.

## 7. Multilingual evaluation

For every supported language pair:

- verify language labels
- verify original text is never overwritten
- score source transcription separately from English translation
- evaluate named entities, dates, amounts, and commitments
- test language switching within one meeting

## 8. Export and accessibility

Validate:

- internal PDF evidence anchors
- long tables and page breaks
- right-to-left and CJK transcript rendering
- large dynamic text
- VoiceOver and TalkBack navigation
- 44-point targets
- keyboard avoidance
- high contrast
- reduced motion

## 9. Release decision

A release candidate is acceptable only when:

- no severity-1 capture-loss defect remains
- no known silent data-loss path remains
- consent and visible recording requirements are verified
- model provenance and integrity controls are approved
- the physical-device matrix passes
- privacy and store disclosures are complete
- deterministic analysis quality is published with known limitations
