param(
  [switch]$SkipInstaller,
  [switch]$KeepStage
)

$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$Package = Get-Content (Join-Path $Root 'package.json') -Raw | ConvertFrom-Json
$Version = [string]$Package.version
$ProductName = '速成你画我猜'
$ReleaseDir = Join-Path $Root 'release'
$StageDir = Join-Path $ReleaseDir "stage-$Version"
$PayloadDir = Join-Path $StageDir 'app'
$PortableDir = Join-Path $ReleaseDir "$ProductName-$Version-portable"

function Write-Step([string]$Text) {
  Write-Host "`n==> $Text" -ForegroundColor Cyan
}

function Copy-Required([string]$RelativePath) {
  $source = Join-Path $Root $RelativePath
  $target = Join-Path $PayloadDir $RelativePath
  if (-not (Test-Path -LiteralPath $source)) {
    throw "发布所需文件不存在：$RelativePath"
  }
  $parent = Split-Path -Parent $target
  New-Item -ItemType Directory -Path $parent -Force | Out-Null
  Copy-Item -LiteralPath $source -Destination $target -Recurse -Force
}

function Find-CommandPath([string]$Name) {
  $command = Get-Command $Name -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($command) { return $command.Source }
  return $null
}

Write-Step "准备 $ProductName $Version 发布目录"
New-Item -ItemType Directory -Path $ReleaseDir -Force | Out-Null
foreach ($path in @($StageDir, $PortableDir)) {
  if (Test-Path -LiteralPath $path) {
    Remove-Item -LiteralPath $path -Recurse -Force
  }
}
New-Item -ItemType Directory -Path $PayloadDir -Force | Out-Null

Write-Step '复制游戏文件和生产依赖'
foreach ($file in @(
  'server.js',
  'words.js',
  'word-packs.js',
  'package.json',
  'package-lock.json',
  'launcher.ps1',
  'start.bat',
  'LICENSE',
  'README.md'
)) {
  Copy-Required $file
}
Copy-Required 'public'
Copy-Required 'data'
Copy-Required 'node_modules'

Write-Step '嵌入 Node.js 运行时'
$nodePath = Find-CommandPath 'node.exe'
if (-not $nodePath) { throw '当前构建机没有找到 node.exe，无法制作免环境发布包。' }
$runtimeDir = Join-Path $PayloadDir 'runtime'
$toolsDir = Join-Path $runtimeDir 'tools'
New-Item -ItemType Directory -Path $toolsDir -Force | Out-Null
Copy-Item -LiteralPath $nodePath -Destination (Join-Path $runtimeDir 'node.exe') -Force
$nodeVersion = (& $nodePath --version).Trim()

Write-Step '嵌入点歌工具（可选功能也保持开箱即用）'
$toolFiles = @{
  'yt-dlp.exe' = (Find-CommandPath 'yt-dlp.exe')
  'ffmpeg.exe' = (Find-CommandPath 'ffmpeg.exe')
  'ffprobe.exe' = (Find-CommandPath 'ffprobe.exe')
}
$toolReport = @()
foreach ($entry in $toolFiles.GetEnumerator()) {
  if ($entry.Value -and (Test-Path -LiteralPath $entry.Value)) {
    Copy-Item -LiteralPath $entry.Value -Destination (Join-Path $toolsDir $entry.Key) -Force
    $toolReport += "$($entry.Key)：已内置"
  } else {
    $toolReport += "$($entry.Key)：未找到（点歌部分功能需要用户自行安装）"
    Write-Warning "未找到 $($entry.Key)，将跳过该工具。"
  }
}

New-Item -ItemType Directory -Path (Join-Path $PayloadDir 'licenses') -Force | Out-Null
$nodeLicenseText = @"
Node.js runtime bundled with this release: $nodeVersion

Node.js is distributed under the Node.js license. The upstream license is available at:
https://github.com/nodejs/node/blob/$($nodeVersion.TrimStart('v'))/LICENSE

This release bundles the official node.exe already installed on the build machine.
"@
$nodeLicenseText | Set-Content -LiteralPath (Join-Path $PayloadDir 'licenses\NODE-RUNTIME.txt') -Encoding UTF8

$mediaLicenseText = @"
Optional bundled tools in this release:
$($toolReport -join [Environment]::NewLine)

yt-dlp: https://github.com/yt-dlp/yt-dlp
FFmpeg: https://ffmpeg.org/

Please review the upstream licenses before redistributing a modified package.
"@
$mediaLicenseText | Set-Content -LiteralPath (Join-Path $PayloadDir 'licenses\MEDIA-TOOLS.txt') -Encoding UTF8

$releaseNotes = @"
$ProductName $Version · Windows 完整发布版

安装版：运行“$ProductName-Setup-$Version.exe”，安装后从开始菜单或桌面打开“$ProductName 服务启动器”。
便携版：解压同目录后双击 start.bat，或者运行 launcher.ps1。

此发布版已经内置：
- Node.js $nodeVersion
- npm 生产依赖（qrcode、ws 及其依赖）
- yt-dlp、ffmpeg、ffprobe（如果构建环境提供）

用户不需要安装 Node.js、npm 或执行 npm install。
服务启动后，启动器中的“打开游戏页面”会打开本机页面；同一 Wi-Fi 下的朋友可以访问显示的局域网地址。

运行日志和点歌缓存：%LOCALAPPDATA%\速成你画我猜
源码项目仍然支持通过环境变量配置公网地址、B 站 Cookie 等高级选项；发布包不包含任何个人凭据。
"@
$releaseNotes | Set-Content -LiteralPath (Join-Path $PayloadDir '发布版说明.txt') -Encoding UTF8

Write-Step '生成便携 ZIP'
Copy-Item -LiteralPath $PayloadDir -Destination $PortableDir -Recurse -Force
$portableZip = Join-Path $ReleaseDir "$ProductName-$Version-portable.zip"
if (Test-Path -LiteralPath $portableZip) { Remove-Item -LiteralPath $portableZip -Force }
& 7z.exe a -tzip -mx=5 $portableZip (Join-Path $PortableDir '*') | Out-Host
if ($LASTEXITCODE -ne 0) { throw "便携 ZIP 生成失败，7z 退出码：$LASTEXITCODE" }

if (-not $SkipInstaller) {
  Write-Step '查找 Inno Setup 编译器'
  $iscc = Find-CommandPath 'ISCC.exe'
  if (-not $iscc) {
    $candidates = @(
      (Join-Path ${env:ProgramFiles(x86)} 'Inno Setup 6\ISCC.exe'),
      (Join-Path $env:ProgramFiles 'Inno Setup 6\ISCC.exe'),
      (Join-Path $env:LOCALAPPDATA 'Programs\Inno Setup 6\ISCC.exe')
    )
    $iscc = $candidates | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
  }
  if (-not $iscc) {
    throw '没有找到 Inno Setup 6 的 ISCC.exe。先安装 Inno Setup 6，或使用 -SkipInstaller 只生成便携 ZIP。'
  }

  Write-Step '编译 Windows 安装器'
  $iss = Join-Path $PSScriptRoot '速成你画我猜.iss'
  & $iscc "/DAppVersion=$Version" "/DReleaseDir=$ReleaseDir" "/DStageDir=$StageDir" $iss | Out-Host
  if ($LASTEXITCODE -ne 0) { throw "安装器编译失败，ISCC 退出码：$LASTEXITCODE" }
}

Write-Step '生成 SHA-256 校验文件'
$artifacts = Get-ChildItem -LiteralPath $ReleaseDir -File | Where-Object {
  $_.Name -like "$ProductName-$Version-*" -and $_.Extension -in @('.zip', '.exe')
}
$hashLines = foreach ($artifact in $artifacts) {
  $hash = (Get-FileHash -LiteralPath $artifact.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
  "$hash  $($artifact.Name)"
}
$hashLines | Set-Content -LiteralPath (Join-Path $ReleaseDir "$ProductName-$Version-SHA256SUMS.txt") -Encoding ASCII

if (-not $KeepStage) {
  Remove-Item -LiteralPath $StageDir -Recurse -Force
  Remove-Item -LiteralPath $PortableDir -Recurse -Force
}

Write-Host "`n发布完成，文件位于：$ReleaseDir" -ForegroundColor Green
Get-ChildItem -LiteralPath $ReleaseDir -File | Where-Object { $_.Name -like "$ProductName-$Version-*" } |
  Select-Object Name, @{Name='MB'; Expression={[math]::Round($_.Length / 1MB, 2)}} |
  Format-Table -AutoSize
