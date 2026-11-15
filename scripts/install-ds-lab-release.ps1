[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repo = 'D:\10_PROJECTS\ds-lab-publish'
$sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$taskName = "DS LAB Auto Release ($sid)"
$service = Join-Path $env:LOCALAPPDATA 'DSLabRelease'
if ((Split-Path -Parent $PSScriptRoot) -ne $repo) { throw "Run from $repo." }
if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
    throw "The task already exists: $taskName"
}
if (Test-Path -LiteralPath (Join-Path $repo '.ds-lab-release\ready.json')) {
    throw 'Finish installation with an empty release queue.'
}

$node = (Get-Command node.exe -CommandType Application).Source
$git = (Get-Command git.exe -CommandType Application).Source
$gh = (Get-Command gh.exe -CommandType Application).Source
$npmCli = $env:DS_LAB_NPM_CLI
if (-not $npmCli) { $npmCli = Join-Path (Split-Path -Parent $node) 'node_modules\npm\bin\npm-cli.js' }
if (-not (Test-Path -LiteralPath $npmCli -PathType Leaf)) {
    throw 'Install Node.js with npm or set DS_LAB_NPM_CLI to the absolute npm-cli.js path.'
}
$version = & $node -p 'process.versions.node.match(/^[0-9]+/)[0]'
if ($LASTEXITCODE -or [int]$version -lt 24) { throw 'Node.js 24 or later is required.' }

New-Item -ItemType Directory -Force -Path $service | Out-Null
foreach ($file in 'release-manifest.mjs', 'release-service.mjs') {
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot $file) -Destination $service -Force
}
$toolDirectories = @($node, $git, $gh) | ForEach-Object { Split-Path -Parent $_ } | Select-Object -Unique
$config = @{
    path = (@($toolDirectories) + $env:Path) -join ';'
    npmCli = (Resolve-Path -LiteralPath $npmCli).Path
    gitExe = $git
    ghExe = $gh
} | ConvertTo-Json
[IO.File]::WriteAllText((Join-Path $service 'host-config.json'), $config)
$worker = Join-Path $service 'release-service.mjs'
& $node $worker --check-host
if ($LASTEXITCODE) { throw 'Host preflight failed. Check GitHub CLI authentication and Git connectivity.' }

$probe = Join-Path $service 'verify-install'
$resultPath = Join-Path $service 'install-result.json'
$verifiedPath = Join-Path $repo '.ds-lab-release\host-verified.json'
if (Test-Path -LiteralPath $resultPath) { Remove-Item -LiteralPath $resultPath }
if (Test-Path -LiteralPath $verifiedPath) { Remove-Item -LiteralPath $verifiedPath }
[IO.File]::WriteAllText($probe, 'Verify under Task Scheduler before consuming any manifest.')
$command = [Security.SecurityElement]::Escape($node)
$arguments = [Security.SecurityElement]::Escape('"' + $worker + '"')
$working = [Security.SecurityElement]::Escape($service)
$start = (Get-Date).AddMinutes(2).ToString('yyyy-MM-ddTHH:mm:ss')
$xml = @"
<?xml version="1.0"?>
<Task version="1.3" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <Triggers>
    <TimeTrigger>
      <Repetition><Interval>PT1M</Interval></Repetition>
      <StartBoundary>$start</StartBoundary>
      <Enabled>true</Enabled>
    </TimeTrigger>
    <LogonTrigger><Enabled>true</Enabled><UserId>$sid</UserId></LogonTrigger>
  </Triggers>
  <Principals>
    <Principal id="Owner">
      <UserId>$sid</UserId>
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <StartWhenAvailable>true</StartWhenAvailable>
    <ExecutionTimeLimit>PT45M</ExecutionTimeLimit>
  </Settings>
  <Actions Context="Owner">
    <Exec><Command>$command</Command><Arguments>$arguments</Arguments><WorkingDirectory>$working</WorkingDirectory></Exec>
  </Actions>
</Task>
"@

$registered = $false
try {
    Register-ScheduledTask -TaskName $taskName -Xml $xml | Out-Null
    $registered = $true
    Start-ScheduledTask -TaskName $taskName
    $deadline = (Get-Date).AddSeconds(75)
    while (-not (Test-Path -LiteralPath $resultPath) -and (Get-Date) -lt $deadline) {
        Start-Sleep -Seconds 1
    }
    if (-not (Test-Path -LiteralPath $resultPath)) { throw 'The scheduled verification did not return a result.' }
    $result = Get-Content -LiteralPath $resultPath -Raw | ConvertFrom-Json
    if (-not $result.ok) { throw "Scheduled verification failed. $($result.error)" }
    Write-Output "Installed and verified $taskName. Release records are in $service."
}
catch {
    if ($registered) {
        Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
        if (Test-Path -LiteralPath $verifiedPath) { Remove-Item -LiteralPath $verifiedPath }
    }
    throw
}
