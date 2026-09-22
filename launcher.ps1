param(
  [switch]$CheckOnly
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$DefaultDataRoot = if ($env:LOCALAPPDATA) { Join-Path $env:LOCALAPPDATA '速成你画我猜' } else { Join-Path $Root 'cache' }
$DataRoot = if ($env:DRAW_GUESS_DATA_DIR) { $env:DRAW_GUESS_DATA_DIR } else { $DefaultDataRoot }
New-Item -ItemType Directory -Path $DataRoot -Force | Out-Null
$PidFile = Join-Path $DataRoot '.game-server.pid.json'
$OutputLog = Join-Path $DataRoot 'server-launcher.log'
$ErrorLog = Join-Path $DataRoot 'server-launcher-error.log'
$RuntimeNode = Join-Path $Root 'runtime\node.exe'
$BundledToolDir = Join-Path $Root 'runtime\tools'

function Get-NodePath {
  if (Test-Path -LiteralPath $RuntimeNode) { return $RuntimeNode }
  $node = Get-Command node.exe -ErrorAction SilentlyContinue
  if ($node) { return $node.Source }
  throw '未找到内置 Node.js 运行时。请重新安装完整发布包。'
}

function Read-LauncherState {
  if (-not (Test-Path -LiteralPath $PidFile)) { return $null }
  try {
    return Get-Content -LiteralPath $PidFile -Raw | ConvertFrom-Json
  } catch {
    Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
    return $null
  }
}

function Save-LauncherState([int]$ProcessId, [int]$Port) {
  @{ pid = $ProcessId; port = $Port; startedAt = (Get-Date).ToString('o') } |
    ConvertTo-Json | Set-Content -LiteralPath $PidFile -Encoding UTF8
}

function Get-TrackedServer {
  $state = Read-LauncherState
  if (-not $state -or -not $state.pid) { return $null }
  try {
    $process = Get-Process -Id ([int]$state.pid) -ErrorAction Stop
  } catch {
    Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
    return $null
  }

  # PID 文件可能在进程重启后复用；只认命令行里确实运行 server.js 的 Node 进程。
  try {
    $info = Get-CimInstance Win32_Process -Filter "ProcessId=$([int]$state.pid)" -ErrorAction Stop
    if ($info.CommandLine -and $info.CommandLine -notmatch 'server\.js') { return $null }
  } catch {
    # 某些精简 Windows 环境没有 CIM 查询权限，仍允许按 PID 管理本启动器创建的进程。
  }
  return [pscustomobject]@{ Process = $process; Port = [int]$state.port; Pid = [int]$state.pid }
}

function Test-PortUsed([int]$Port) {
  try {
    return @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue).Count -gt 0
  } catch {
    return $false
  }
}

function ConvertTo-Port([string]$Text) {
  $port = 0
  if (-not [int]::TryParse($Text, [ref]$port) -or $port -lt 1 -or $port -gt 65535) {
    throw '端口必须是 1 到 65535 之间的数字。'
  }
  return $port
}

function Start-GameServer([int]$Port) {
  $existing = Get-TrackedServer
  if ($existing) { return $existing }
  if (Test-PortUsed $Port) { throw "端口 $Port 已被其他程序占用，请选择其他端口。" }

  $nodePath = Get-NodePath
  $oldPort = $env:PORT
  $oldDataDir = $env:DRAW_GUESS_DATA_DIR
  $oldFfmpegPath = $env:FFMPEG_PATH
  $oldPath = $env:PATH
  try {
    $env:PORT = [string]$Port
    $env:DRAW_GUESS_DATA_DIR = $DataRoot
    if (Test-Path -LiteralPath (Join-Path $BundledToolDir 'ffmpeg.exe')) {
      $env:FFMPEG_PATH = $BundledToolDir
    }
    if (Test-Path -LiteralPath $BundledToolDir) {
      $env:PATH = "$BundledToolDir$([IO.Path]::PathSeparator)$oldPath"
    }
    $process = Start-Process -FilePath $nodePath -ArgumentList @('server.js') `
      -WorkingDirectory $Root -WindowStyle Hidden -PassThru `
      -RedirectStandardOutput $OutputLog -RedirectStandardError $ErrorLog
  } finally {
    if ($null -eq $oldPort) { Remove-Item Env:PORT -ErrorAction SilentlyContinue }
    else { $env:PORT = $oldPort }
    if ($null -eq $oldDataDir) { Remove-Item Env:DRAW_GUESS_DATA_DIR -ErrorAction SilentlyContinue }
    else { $env:DRAW_GUESS_DATA_DIR = $oldDataDir }
    if ($null -eq $oldFfmpegPath) { Remove-Item Env:FFMPEG_PATH -ErrorAction SilentlyContinue }
    else { $env:FFMPEG_PATH = $oldFfmpegPath }
    $env:PATH = $oldPath
  }
  Save-LauncherState $process.Id $Port
  Start-Sleep -Milliseconds 350
  if ($process.HasExited) {
    Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
    throw "服务启动失败，请查看 $ErrorLog。"
  }
  return [pscustomobject]@{ Process = $process; Port = $Port; Pid = $process.Id }
}

function Stop-GameServer {
  $server = Get-TrackedServer
  if (-not $server) {
    Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
    return $false
  }
  Stop-Process -Id $server.Pid -ErrorAction SilentlyContinue
  try { Wait-Process -Id $server.Pid -Timeout 3 -ErrorAction SilentlyContinue } catch { }
  if (-not (Get-Process -Id $server.Pid -ErrorAction SilentlyContinue)) {
    Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
  } else {
    Stop-Process -Id $server.Pid -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
  }
  return $true
}

if ($CheckOnly) {
  Write-Output 'launcher.ps1 syntax and helper functions loaded'
  exit 0
}

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$form = New-Object System.Windows.Forms.Form
$form.Text = '你画我猜 · 服务启动器'
$form.StartPosition = 'CenterScreen'
$form.ClientSize = New-Object System.Drawing.Size(560, 360)
$form.MinimumSize = New-Object System.Drawing.Size(560, 360)
$form.Font = New-Object System.Drawing.Font('Microsoft YaHei UI', 10)

$title = New-Object System.Windows.Forms.Label
$title.Text = '你画我猜服务控制台'
$title.Font = New-Object System.Drawing.Font('Microsoft YaHei UI', 16, [System.Drawing.FontStyle]::Bold)
$title.Location = New-Object System.Drawing.Point(24, 20)
$title.AutoSize = $true
$form.Controls.Add($title)

$portLabel = New-Object System.Windows.Forms.Label
$portLabel.Text = '服务端口'
$portLabel.Location = New-Object System.Drawing.Point(28, 72)
$portLabel.AutoSize = $true
$form.Controls.Add($portLabel)

$portBox = New-Object System.Windows.Forms.ComboBox
$portBox.Location = New-Object System.Drawing.Point(112, 68)
$portBox.Size = New-Object System.Drawing.Size(150, 30)
$portBox.DropDownStyle = 'DropDown'
[void]$portBox.Items.AddRange([object[]]@('3000', '3180', '3100', '8080', '8081'))
$portBox.Text = '3000'
$form.Controls.Add($portBox)

$selectButton = New-Object System.Windows.Forms.Button
$selectButton.Text = '选择端口'
$selectButton.Location = New-Object System.Drawing.Point(278, 66)
$selectButton.Size = New-Object System.Drawing.Size(100, 32)
$form.Controls.Add($selectButton)

$status = New-Object System.Windows.Forms.Label
$status.Text = '状态：服务未启动'
$status.Location = New-Object System.Drawing.Point(28, 112)
$status.AutoSize = $true
$form.Controls.Add($status)

$startButton = New-Object System.Windows.Forms.Button
$startButton.Text = '启动服务'
$startButton.Location = New-Object System.Drawing.Point(28, 150)
$startButton.Size = New-Object System.Drawing.Size(150, 42)
$startButton.BackColor = [System.Drawing.Color]::FromArgb(220, 252, 231)
$form.Controls.Add($startButton)

$stopButton = New-Object System.Windows.Forms.Button
$stopButton.Text = '关闭服务'
$stopButton.Location = New-Object System.Drawing.Point(194, 150)
$stopButton.Size = New-Object System.Drawing.Size(150, 42)
$stopButton.BackColor = [System.Drawing.Color]::FromArgb(254, 226, 226)
$form.Controls.Add($stopButton)

$openButton = New-Object System.Windows.Forms.Button
$openButton.Text = '打开游戏页面'
$openButton.Location = New-Object System.Drawing.Point(360, 150)
$openButton.Size = New-Object System.Drawing.Size(150, 42)
$form.Controls.Add($openButton)

$logLabel = New-Object System.Windows.Forms.Label
$logLabel.Text = '最近日志'
$logLabel.Location = New-Object System.Drawing.Point(28, 212)
$logLabel.AutoSize = $true
$form.Controls.Add($logLabel)

$logBox = New-Object System.Windows.Forms.TextBox
$logBox.Location = New-Object System.Drawing.Point(28, 236)
$logBox.Size = New-Object System.Drawing.Size(482, 95)
$logBox.Multiline = $true
$logBox.ReadOnly = $true
$logBox.ScrollBars = 'Vertical'
$logBox.BackColor = [System.Drawing.Color]::White
$form.Controls.Add($logBox)

function Refresh-LauncherUi {
  $server = Get-TrackedServer
  if ($server) {
    $status.Text = "状态：运行中 · 端口 $($server.Port) · PID $($server.Pid)"
    $status.ForeColor = [System.Drawing.Color]::DarkGreen
    $startButton.Enabled = $false
    $stopButton.Enabled = $true
    $selectButton.Enabled = $false
    $openButton.Enabled = $true
    $portBox.Text = [string]$server.Port
  } else {
    $status.Text = '状态：服务未启动'
    $status.ForeColor = [System.Drawing.Color]::DarkRed
    $startButton.Enabled = $true
    $stopButton.Enabled = $false
    $selectButton.Enabled = $true
    $openButton.Enabled = $false
  }
  if (Test-Path -LiteralPath $OutputLog) {
    $logBox.Text = ((Get-Content -LiteralPath $OutputLog -Encoding UTF8 -Tail 8 -ErrorAction SilentlyContinue) -join [Environment]::NewLine)
  }
  if (Test-Path -LiteralPath $ErrorLog) {
    $errors = Get-Content -LiteralPath $ErrorLog -Encoding UTF8 -Tail 4 -ErrorAction SilentlyContinue
    if ($errors) { $logBox.Text += [Environment]::NewLine + ($errors -join [Environment]::NewLine) }
  }
}

function Show-LauncherError($ErrorRecord) {
  try {
    $message = if ($ErrorRecord.Exception) { $ErrorRecord.Exception.Message } else { [string]$ErrorRecord }
    if ($status) {
      $status.Text = '状态：启动器出现错误'
      $status.ForeColor = [System.Drawing.Color]::DarkRed
    }
    if ($logBox) {
      $logBox.Text = "启动器错误：$message"
    }
  } catch {
    # UI 已经关闭或控件不可用时，避免错误处理再次抛出异常。
  }
}

function Refresh-LauncherUiSafe {
  try { Refresh-LauncherUi } catch { Show-LauncherError $_ }
}

$selectButton.Add_Click({
  try {
    $portBox.Text = [string](ConvertTo-Port $portBox.Text)
    $status.Text = "状态：已选择端口 $($portBox.Text)，等待启动"
  } catch { [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, '端口无效', 'OK', 'Warning') | Out-Null }
})

$startButton.Add_Click({
  try {
    $port = ConvertTo-Port $portBox.Text
    Start-GameServer $port | Out-Null
    Refresh-LauncherUi
  } catch { [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, '启动失败', 'OK', 'Error') | Out-Null }
})

$stopButton.Add_Click({
  try {
    if ([System.Windows.Forms.MessageBox]::Show('确定要关闭游戏服务吗？', '关闭服务', 'YesNo', 'Question') -eq 'Yes') {
      Stop-GameServer | Out-Null
      Refresh-LauncherUiSafe
    }
  } catch {
    Show-LauncherError $_
  }
})

$openButton.Add_Click({
  try {
    $server = Get-TrackedServer
    if ($server) { Start-Process "http://127.0.0.1:$($server.Port)" | Out-Null }
  } catch {
    Show-LauncherError $_
  }
})

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 1000
$timer.Add_Tick({ Refresh-LauncherUiSafe })
$form.Add_Shown({ try { Refresh-LauncherUiSafe; $timer.Start() } catch { Show-LauncherError $_ } })
$form.Add_FormClosed({ try { $timer.Stop() } catch { } })
[void]$form.ShowDialog()
