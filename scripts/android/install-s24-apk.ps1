[CmdletBinding()]
param(
  [string]$ApkPath = '',
  [string]$Serial = '',
  [string]$PackageName = 'com.otey247.roomtone.preview',
  [switch]$AllowDowngrade,
  [switch]$ClearData,
  [switch]$GrantRuntimePermissions
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Require-Command {
  param([Parameter(Mandatory = $true)][string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command '$Name' was not found on PATH."
  }
}

function Get-DeviceProperty {
  param(
    [Parameter(Mandatory = $true)][string]$TargetSerial,
    [Parameter(Mandatory = $true)][string]$Property
  )
  return ((& adb -s $TargetSerial shell getprop $Property) -join '').Trim()
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Require-Command adb

if (-not $ApkPath) {
  $latest = Get-ChildItem (Join-Path $repoRoot 'dist') -Filter 'roomtone-s24-ultra-preview-*.apk' -File -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
  if (-not $latest) {
    throw 'No Roomtone S24 APK was found in dist. Pass -ApkPath or build the APK first.'
  }
  $ApkPath = $latest.FullName
}

$resolvedApk = (Resolve-Path $ApkPath).Path
$deviceOutput = @(& adb devices -l)
$authorized = @(
  $deviceOutput |
    Select-Object -Skip 1 |
    Where-Object { $_ -match '^\S+\s+device(?:\s|$)' } |
    ForEach-Object { ($_ -split '\s+')[0] }
)

if (-not $Serial) {
  if ($authorized.Count -eq 0) {
    throw "No authorized Android device was found.`n$($deviceOutput -join [Environment]::NewLine)"
  }
  if ($authorized.Count -gt 1) {
    throw "More than one Android device is connected. Pass -Serial with one of: $($authorized -join ', ')"
  }
  $Serial = $authorized[0]
} elseif ($authorized -notcontains $Serial) {
  throw "Device '$Serial' is not authorized. Connected authorized devices: $($authorized -join ', ')"
}

$manufacturer = Get-DeviceProperty -TargetSerial $Serial -Property 'ro.product.manufacturer'
$model = Get-DeviceProperty -TargetSerial $Serial -Property 'ro.product.model'
$product = Get-DeviceProperty -TargetSerial $Serial -Property 'ro.product.name'
$androidVersion = Get-DeviceProperty -TargetSerial $Serial -Property 'ro.build.version.release'
$apiLevel = Get-DeviceProperty -TargetSerial $Serial -Property 'ro.build.version.sdk'
$abi = Get-DeviceProperty -TargetSerial $Serial -Property 'ro.product.cpu.abi'

Write-Host "Target: $manufacturer $model ($product)"
Write-Host "Android: $androidVersion / API $apiLevel"
Write-Host "ABI: $abi"
if ($manufacturer -notmatch '(?i)samsung' -or ($model -notmatch '(?i)SM-S928' -and $model -notmatch '(?i)S24 Ultra')) {
  Write-Warning 'The connected device was not recognized as a Samsung Galaxy S24 Ultra. Installation will continue.'
}
if ($abi -notmatch 'arm64-v8a') {
  throw "The APK is built for arm64-v8a, but the device reports '$abi'."
}

$installArguments = @('-s', $Serial, 'install', '-r')
if ($AllowDowngrade) { $installArguments += '-d' }
$installArguments += $resolvedApk

Write-Host "Installing $resolvedApk"
& adb @installArguments
if ($LASTEXITCODE -ne 0) {
  throw 'adb install failed. See docs/samsung-s24-ultra-apk-testing.md for troubleshooting.'
}

if ($ClearData) {
  & adb -s $Serial shell pm clear $PackageName | Out-Host
}

if ($GrantRuntimePermissions) {
  & adb -s $Serial shell pm grant $PackageName android.permission.RECORD_AUDIO 2>$null
  if ([int]$apiLevel -ge 33) {
    & adb -s $Serial shell pm grant $PackageName android.permission.POST_NOTIFICATIONS 2>$null
  }
}

& adb -s $Serial shell monkey -p $PackageName -c android.intent.category.LAUNCHER 1 | Out-Host
Start-Sleep -Seconds 2

$installedVersion = (& adb -s $Serial shell dumpsys package $PackageName |
  Select-String -Pattern 'versionName=|versionCode=' |
  ForEach-Object { $_.Line.Trim() }) -join '; '

Write-Host ''
Write-Host "Installed: $PackageName"
Write-Host $installedVersion
Write-Host ''
Write-Host 'Open Roomtone Settings, then review APK and device diagnostics before starting native capture.'
Write-Host "Collect a support bundle with:"
Write-Host "  npm run apk:diagnostics:s24 -- -Serial $Serial"
