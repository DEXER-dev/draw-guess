param(
  [string]$AppDir = (Join-Path (Split-Path -Parent $PSScriptRoot) 'release\stage-0.1.0\app'),
  [int]$Port = 3311
)

$ErrorActionPreference = 'Stop'
$AppDir = (Resolve-Path $AppDir).Path
$TestData = Join-Path (Split-Path -Parent $PSScriptRoot) 'release-test-data'
if (Test-Path -LiteralPath $TestData) { Remove-Item -LiteralPath $TestData -Recurse -Force }
New-Item -ItemType Directory -Path $TestData -Force | Out-Null
$stdout = Join-Path $TestData 'server.out.log'
$stderr = Join-Path $TestData 'server.err.log'
$node = Join-Path $AppDir 'runtime\node.exe'
$tools = Join-Path $AppDir 'runtime\tools'
$oldPort = $env:PORT
$oldData = $env:DRAW_GUESS_DATA_DIR
$oldPath = $env:PATH
$oldFfmpeg = $env:FFMPEG_PATH
$process = $null

function Show-OptionalToolVersion([string]$Label, [string]$Path, [string[]]$Arguments) {
  if (-not (Test-Path -LiteralPath $Path)) {
    Write-Output "$Label：未内置，跳过检查"
    return
  }
  $version = & $Path @Arguments 2>&1 | Select-Object -First 1
  Write-Output "$Label：$version"
}

try {
  $env:PORT = [string]$Port
  $env:DRAW_GUESS_DATA_DIR = $TestData
  $env:PATH = "$tools$([IO.Path]::PathSeparator)$oldPath"
  $env:FFMPEG_PATH = $tools
  $process = Start-Process -FilePath $node -ArgumentList @('server.js') -WorkingDirectory $AppDir `
    -WindowStyle Hidden -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
  Start-Sleep -Seconds 2
  if ($process.HasExited) { throw "内置服务进程提前退出：$([string]::Join([Environment]::NewLine, (Get-Content $stderr -ErrorAction SilentlyContinue)))" }
  $homeResponse = Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:$Port/"
  if ([int]$homeResponse.StatusCode -ne 200 -or $homeResponse.Content -notmatch '你画我猜') { throw '首页响应检查失败。' }
  $rooms = Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:$Port/api/rooms"
  if ([int]$rooms.StatusCode -ne 200) { throw '房间 API 响应检查失败。' }
  Write-Output "首页：HTTP $([int]$homeResponse.StatusCode)，$($homeResponse.RawContentLength) bytes"
  Write-Output "房间 API：HTTP $([int]$rooms.StatusCode)"
  Write-Output "Node：$((& $node --version).Trim())"
  Show-OptionalToolVersion 'yt-dlp' (Join-Path $tools 'yt-dlp.exe') @('--version')
  Show-OptionalToolVersion 'FFmpeg' (Join-Path $tools 'ffmpeg.exe') @('-version')
  Write-Output '发布包冒烟测试通过。'
}
finally {
  if ($process -and -not $process.HasExited) { Stop-Process -Id $process.Id -Force }
  if ($null -eq $oldPort) { Remove-Item Env:PORT -ErrorAction SilentlyContinue } else { $env:PORT = $oldPort }
  if ($null -eq $oldData) { Remove-Item Env:DRAW_GUESS_DATA_DIR -ErrorAction SilentlyContinue } else { $env:DRAW_GUESS_DATA_DIR = $oldData }
  $env:PATH = $oldPath
  if ($null -eq $oldFfmpeg) { Remove-Item Env:FFMPEG_PATH -ErrorAction SilentlyContinue } else { $env:FFMPEG_PATH = $oldFfmpeg }
  if (Test-Path -LiteralPath $TestData) { Remove-Item -LiteralPath $TestData -Recurse -Force }
}
