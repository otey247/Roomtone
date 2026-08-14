# Roomtone engineering instructions

## Product contract

Roomtone is a local-first mobile meeting intelligence application. Core
recording and meeting workflows must remain usable when generative AI is not
available. Native inference providers are optional capabilities behind stable
interfaces.

## Architecture rules

- Keep raw PCM and model inference outside React render paths.
- Persist final transcript segments and user edits immediately.
- Model live meetings as an event stream and make derived views rebuildable.
- Preserve original transcript text when translation is enabled.
- Never invent speaker identity. Use anonymous clusters until the user names or
  enrolls a speaker.
- Never block audio capture on diarization, translation, analysis, or export.
- Use deterministic extraction before adding model-backed extraction.
- Treat recording consent and visible capture state as product requirements.

## UI rules

- Build production-grade responsive mobile interfaces, not prototype screens.
- Do not use pastel semantic cards, tinted outline buttons, callout boxes,
  colored card-edge accents, status rails, decorative pills, or compliance
  dashboard styling.
- Prefer neutral surfaces, strong typography, clear hierarchy, direct labels,
  and full-width rows.
- Use color sparingly for primary actions and real-time emphasis.
- Support Dynamic Type, screen readers, reduced motion, and 44-point targets.

## Quality gates

1. Run `npm run verify:repo`.
2. Run `npm run typecheck:domain`.
3. Run `npm test`.
4. After installing dependencies, run `npm run typecheck` and `npm run doctor`.
5. Exercise demo and native builds whenever native code changes.
