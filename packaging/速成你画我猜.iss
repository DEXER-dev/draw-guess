#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif
#ifndef ReleaseDir
  #define ReleaseDir "."
#endif
#ifndef StageDir
  #define StageDir "."
#endif

[Setup]
AppId={{B9E8D1D4-0C1B-4AE5-9B9A-6F0B5E6C1D41}
AppName=速成你画我猜
AppVersion={#AppVersion}
AppVerName=速成你画我猜 {#AppVersion}
AppPublisher=速成你画我猜
AppPublisherURL=https://github.com/
DefaultDirName={localappdata}\Programs\速成你画我猜
DefaultGroupName=速成你画我猜
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir={#ReleaseDir}
OutputBaseFilename=速成你画我猜-Setup-{#AppVersion}
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64
UninstallDisplayName=速成你画我猜
Uninstallable=yes
SetupLogging=yes

[Languages]
Name: "chinesesimplified"; MessagesFile: "{#SourcePath}\ChineseSimplified.isl"

[Files]
Source: "{#StageDir}\app\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\速成你画我猜服务启动器"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -STA -File ""{app}\launcher.ps1"""; WorkingDir: "{app}"
Name: "{autodesktop}\速成你画我猜"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -STA -File ""{app}\launcher.ps1"""; WorkingDir: "{app}"

[Run]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -STA -File ""{app}\launcher.ps1"""; WorkingDir: "{app}"; Description: "启动速成你画我猜服务启动器"; Flags: postinstall nowait skipifsilent
