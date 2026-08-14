[CmdletBinding()]
param(
  [string]$OutputDirectory = 'dist',
  [int]$VersionCode = 0,
  [switch]$SkipDependencyInstall,
  [switch]$SkipChecks
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Require-Command {
  param([Parameter(Mandatory = $true)][string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command '$Name' was not found on PATH."
  }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Push-Location $repoRoot
try {
  Require-Command node
  Require-Command npm
  Require-Command npx
  Require-Command java

  if (-not $env:ANDROID_HOME -and -not $env:ANDROID_SDK_ROOT) {
    throw 'ANDROID_HOME or ANDROID_SDK_ROOT must point to the installed Android SDK.'
  }

  if ($VersionCode -le 0) {
    $VersionCode = [Math]::Floor([DateTimeOffset]::UtcNow.ToUnixTimeSeconds() / 60)
  }
  if ($VersionCode -gt 2100000000) {
    throw 'Android versionCode must be less than or equal to 2,100,000,000.'
  }

  $gitSha = 'local'
  if (Get-Command git -ErrorAction SilentlyContinue) {
    $candidateSha = (& git rev-parse HEAD 2>$null)
    if ($LASTEXITCODE -eq 0 -and $candidateSha) {
      $gitSha = ($candidateSha | Select-Object -First 1).Trim()
    }
  }

  $env:NODE_ENV = 'production'
  $env:ROOMTONE_APP_VARIANT = 'preview'
  $env:ROOMTONE_ANDROID_VERSION_CODE = [string]$VersionCode
  $env:EXPO_PUBLIC_BUILD_SHA = $gitSha
  $env:EXPO_PUBLIC_BUILD_CHANNEL = 'local-s24-apk'
  $env:EXPO_PUBLIC_BUILD_TIME = [DateTimeOffset]::UtcNow.ToString('o')
  $env:EXPO_PUBLIC_BUILD_ARCHITECTURE = 'arm64-v8a'
  $env:CI = 'true'

  if (-not $SkipDependencyInstall) {
    & npm install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'npm install failed.' }
  }

  if (-not $SkipChecks) {
    & npm run check
    if ($LASTEXITCODE -ne 0) { throw 'Roomtone source validation failed.' }
  }

  & npx expo prebuild --clean --platform android --no-install
  if ($LASTEXITCODE -ne 0) { throw 'Expo prebuild failed.' }

  Push-Location (Join-Path $repoRoot 'android')
  try {
    & .\gradlew.bat ':app:assembleRelease' '-PreactNativeArchitectures=arm64-v8a' '--no-daemon' '--stacktrace'
    if ($LASTEXITCODE -ne 0) { throw 'Gradle APK build failed.' }
  } finally {
    Pop-Location
  }

  $sourceApk = Join-Path $repoRoot 'android\app\build\outputs\apk\release\app-release.apk'
  if (-not (Test-Path $sourceApk)) {
    throw "Expected APK was not created at $sourceApk"
  }

  $resolvedOutput = if ([IO.Path]::IsPathRooted($OutputDirectory)) {
    $OutputDirectory
  } else {
    Join-Path $repoRoot $OutputDirectory
  }
  New-Item -ItemType Directory -Path $resolvedOutput -Force | Out-Null

  $apkName = "roomtone-s24-ultra-preview-$VersionCode.apk"
  $targetApk = Join-Path $resolvedOutput $apkName
  Copy-Item $sourceApk $targetApk -Force

  $hash = Get-FileHash -Algorithm SHA256 $targetApk
  "$($hash.Hash.ToLowerInvariant())  $apkName" | Set-Content -Encoding utf8 (Join-Path $resolvedOutput "$apkName.sha256")

  $metadata = [ordered]@{
    artifact = $apkName
    packageName = 'com.otey247.roomtone.preview'
    commit = $gitSha
    versionCode = $VersionCode
    architecture = 'arm64-v8a'
    buildVariant = 'release'
    signing = 'debug key for internal device testing only'
    builtAt = $env:EXPO_PUBLIC_BUILD_TIME
    sha256 = $hash.Hash.ToLowerInvariant()
  }
  $metadata | ConvertTo-Json -Depth 4 | Set-Content -Encoding utf8 (Join-Path $resolvedOutput 'build-metadata.json')

  $sdkRoot = if ($env:ANDROID_SDK_ROOT) { $env:ANDROID_SDK_ROOT } else { $env:ANDROID_HOME }
  $apkSigner = Get-ChildItem (Join-Path $sdkRoot 'build-tools') -Recurse -Filter 'apksigner.bat' -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending |
    Select-Object -First 1
  if ($apkSigner) {
    & $apkSigner.FullName verify --verbose --print-certs $targetApk |
      Set-Content -Encoding utf8 (Join-Path $resolvedOutput "$apkName.signature.txt")
    if ($LASTEXITCODE -ne 0) { throw 'APK signature verification failed.' }
  } else {
    Write-Warning 'apksigner.bat was not found; signature verification was skipped.'
  }

  Write-Host ''
  Write-Host 'Roomtone Samsung S24 Ultra APK created successfully.'
  Write-Host "APK: $targetApk"
  Write-Host "SHA-256: $($hash.Hash.ToLowerInvariant())"
  Write-Host ''
  Write-Host 'Install with:'
  Write-Host "  npm run apk:install:s24 -- -ApkPath `"$targetApk`""
} finally {
  Pop-Location
}
