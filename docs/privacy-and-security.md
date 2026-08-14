# Privacy and Security

## Data boundary

Roomtone's default data boundary is the application sandbox on the user's device.

Stored data may include:

- meeting title and timestamps
- participant-created anonymous or named speaker labels
- transcript and translation text
- derived meeting outcomes and metrics
- keyword definitions and occurrences
- bookmarks
- local audio files
- downloaded model binaries
- application settings

Roomtone does not require a user account or Roomtone-hosted service for its core workflow.

## Consent and visible recording

Participant notification is a product requirement. The default policy requires an explicit confirmation before each meeting starts. Organizations that govern consent outside Roomtone may disable the repeated prompt, but the live capture indicator remains visible.

Legal recording requirements vary by jurisdiction and context. Product teams deploying Roomtone must validate the consent language, retention settings, and distribution policy with qualified counsel.

## Identity and diarization

Speaker-change detection is anonymous. Roomtone does not claim that an anonymous turn label is a verified individual. User-entered names are local annotations.

A future voice-enrollment feature would process biometric-like representations and requires:

- explicit opt-in enrollment
- local protected storage
- revocation and deletion
- false-match and false-nonmatch evaluation
- jurisdiction-specific legal review
- clear separation between meeting dynamics and employee evaluation

## Storage controls

- SQLite and files are stored in the application sandbox.
- Audio and meeting retention are user-configurable.
- Deleting a meeting removes its aggregate, events, and referenced local audio.
- Removing a model deletes its local binary.
- Roomtone does not currently add application-level SQLCipher encryption.
- Device encryption, passcode policy, backup policy, and mobile-device management remain deployment responsibilities.

## Sharing

PDF and clipboard actions are explicit user actions. Once data is copied or shared to another application, the destination's privacy and retention controls apply.

## Network behavior

The guided demo and installed native inference path do not require a Roomtone backend. Network access is used when the user downloads a model. Operating-system services, app-store telemetry, fonts, keyboards, backups, or selected share targets may independently use a network.

## Threat considerations

Primary threats include:

- recording without adequate participant notification
- lost or compromised devices
- cloud or device backups containing meeting data
- malicious or replaced model binaries
- inaccurate speaker labels or outcomes treated as facts
- exported data copied into uncontrolled destinations
- denial of service through storage exhaustion, thermal pressure, or very long meetings
- another application capturing clipboard contents

## Required production hardening

Before external production distribution:

1. Add streamed model hash verification and approved model provenance.
2. Complete iOS privacy manifest and Android data-safety declarations.
3. Validate backup exclusions for audio and model directories where required.
4. Add optional application lock and protected-data availability handling.
5. Complete mobile application security testing.
6. Test retention deletion and uninstall behavior on physical devices.
7. Define enterprise MDM and managed-app configuration policies.
8. Review recording consent and privacy text for target jurisdictions.
