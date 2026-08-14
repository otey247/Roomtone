# Contributing to Roomtone

## Before coding

1. Read `AGENTS.md`.
2. Read `docs/architecture.md`.
3. Keep the local-first product contract intact.
4. Do not add a required hosted service to the core meeting path.
5. Do not infer speaker identity without explicit enrollment and a reviewed provider.

## Local checks

```bash
npm install
npm run verify:repo
npm run typecheck:domain
npm test
npm run typecheck
npm run typecheck:test
npm run doctor
```

Native inference changes also require a custom iOS and Android build plus physical-device tests.

## Pull requests

A pull request should explain:

- user impact
- architecture impact
- privacy and consent impact
- data migration impact
- validation performed
- physical-device coverage
- known limitations

Keep commits scoped and do not commit downloaded model binaries, recordings, transcripts, credentials, generated native projects, or client data.
