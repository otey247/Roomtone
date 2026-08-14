[CmdletBinding()]
param(
  [string]$Serial = '',
  [string]$PackageName = 'com.otey247.roomtone.preview',
  [string]$OutputDirectory = 'dist'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if (-not (Get-Command adb -ErrorAction SilentlyContinue)) {
  throw "Required command 'adb' was not found on PATH."
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$deviceOutput = @(& adb devices -l)
$authorized = @(
  $deviceOutput |
    Select-Object -Skip 1 |
    Where-Object { $_ -match '^\S+\s+device(?:\s|$)' } |
    ForEach-Object { ($_ -split '\s+')[0] }
)

if (-not $Serial) {
  if ($authorized.Count -ne 1) {
    throw "Exactly one authorized Android device is required, or pass -Serial. Found: $($authorized -join ', ')"
  }
  $Serial = $authorized[0]
} elseif ($authorized -notcontains $Serial) {
  throw "Device '$Serial' is not authorized."
}

$resolvedOutput = if ([IO.Path]::IsPathRooted($OutputDirectory)) {
  $OutputDirectory
} else {
  Join-Path $repoRoot $OutputDirectory
}
$timestamp = [DateTimeOffset]::UtcNow.ToString('yyyyMMdd-HHmmss')
$bundleDirectory = Join-Path $resolvedOutput "s24-diagnostics-$timestamp"
New-Item -ItemType Directory -Path $bundleDirectory -Force | Out-Null

function Save-AdbOutput {
  param(
    [Parameter(Mandatory = $true)][string]$FileName,
    [Parameter(Mandatory = $true)][string[]]$Arguments
  )
  try {
    & adb -s $Serial @Arguments 2>&1 |
      Set-Content -Encoding utf8 (Join-Path $bundleDirectory $FileName)
  } catch {
    "Command failed: adb -s $Serial $($Arguments -join ' ')`n$($_.Exception.Message)" |
      Set-Content -Encoding utf8 (Join-Path $bundleDirectory $FileName)
  }
}

Save-AdbOutput -FileName 'device-properties.txt' -Arguments @('shell', 'getprop')
Save-AdbOutput -FileName 'package.txt' -Arguments @('shell', 'dumpsys', 'package', $PackageName)
Save-AdbOutput -FileName 'permissions.txt' -Arguments @('shell', 'appops', 'get', $PackageName)
Save-AdbOutput -FileName 'memory.txt' -Arguments @('shell', 'dumpsys', 'meminfo', $PackageName)
Save-AdbOutput -FileName 'battery.txt' -Arguments @('shell', 'dumpsys', 'battery')
Save-AdbOutput -FileName 'device-idle.txt' -Arguments @('shell', 'dumpsys', 'deviceidle')
Save-AdbOutput -FileName 'recording-service.txt' -Arguments @('shell', 'dumpsys', 'activity', 'services', 'expo.modules.audio.service.AudioRecordingService')

$pidValue = ((& adb -s $Serial shell pidof $PackageName) -join '').Trim()
if ($pidValue) {
  Save-AdbOutput -FileName 'roomtone-logcat.txt' -Arguments @('logcat', '-d', '-v', 'threadtime', "--pid=$pidValue")
} else {
  'Roomtone was not running when diagnostics were collected.' |
    Set-Content -Encoding utf8 (Join-Path $bundleDirectory 'roomtone-logcat.txt')
}

$summary = [ordered]@{
  collectedAt = [DateTimeOffset]::UtcNow.ToString('o')
  serial = $Serial
  packageName = $PackageName
  manufacturer = ((& adb -s $Serial shell getprop ro.product.manufacturer) -join '').Trim()
  model = ((& adb -s $Serial shell getprop ro.product.model) -join '').Trim()
  product = ((& adb -s $Serial shell getprop ro.product.name) -join '').Trim()
  androidVersion = ((& adb -s $Serial shell getprop ro.build.version.release) -join '').Trim()
  apiLevel = ((& adb -s $Serial shell getprop ro.build.version.sdk) -join '').Trim()
  abi = ((& adb -s $Serial shell getprop ro.product.cpu.abi) -join '').Trim()
  appPid = $pidValue
}
$summary | ConvertTo-Json -Depth 4 | Set-Content -Encoding utf8 (Join-Path $bundleDirectory 'summary.json')

$archive = "$bundleDirectory.zip"
Compress-Archive -Path (Join-Path $bundleDirectory '*') -DestinationPath $archive -Force
Write-Host "Roomtone diagnostics created: $archive"
Write-Host 'Review the archive before sharing because logs may contain meeting titles or transcribed text.'
