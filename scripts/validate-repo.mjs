import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import process from 'node:process';

const requiredFiles = [
  'README.md',
  'SECURITY.md',
  'CONTRIBUTING.md',
  'AGENTS.md',
  'App.tsx',
  'index.ts',
  'app.config.ts',
  'package.json',
  'src/app/RoomtoneApp.tsx',
  'src/app/RoomtoneContext.tsx',
  'src/domain/types.ts',
  'src/inference/whisper-provider.ts',
  'src/infrastructure/meeting-repository.ts',
  'docs/architecture.md',
  'docs/privacy-and-security.md',
  'docs/model-runtime.md',
  'docs/evaluation.md',
  '.github/workflows/ci.yml',
  'assets/icon.png',
  'assets/adaptive-icon.png',
  'assets/splash.png',
  'assets/favicon.png'
];

const failures = [];
for (const file of requiredFiles) {
  if (!existsSync(file)) failures.push(`Missing required file: ${file}`);
}

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
if (packageJson.private !== true) failures.push('package.json must remain private until release automation is defined.');
if (packageJson.main !== 'index.ts') failures.push('package.json main must point to index.ts.');
if (!packageJson.scripts?.check) failures.push('package.json must expose the full check script.');
if (!packageJson.dependencies?.['expo-audio']) failures.push('expo-audio is required for the native PCM stream.');
if (!packageJson.dependencies?.['whisper.rn']) failures.push('whisper.rn is required for the native speech provider.');

for (const asset of ['assets/icon.png', 'assets/adaptive-icon.png', 'assets/splash.png', 'assets/favicon.png']) {
  if (!existsSync(asset)) continue;
  if (extname(asset) !== '.png') failures.push(`${asset} must be PNG.`);
  if (statSync(asset).size < 200) failures.push(`${asset} appears to be empty or invalid.`);
}

const sourceFiles = [
  'src/app/RoomtoneApp.tsx',
  'src/app/RoomtoneContext.tsx',
  'src/hooks/useMeetingSession.ts',
  'src/inference/whisper-provider.ts'
];
for (const file of sourceFiles) {
  const content = readFileSync(join(process.cwd(), file), 'utf8');
  if (/\b(?:TODO|FIXME)\b/.test(content)) failures.push(`${file} contains unresolved TODO or FIXME markers.`);
  if (/console\.log\(/.test(content)) failures.push(`${file} contains console.log.`);
}

if (failures.length) {
  console.error(`Repository validation failed with ${failures.length} issue(s):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Repository validation passed: ${requiredFiles.length} required files and core package contracts verified.`);
