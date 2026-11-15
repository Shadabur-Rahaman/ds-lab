[CmdletBinding()]
param(
    [Parameter(Mandatory)][ValidateNotNullOrEmpty()][string]$Message,
    [Parameter(Mandatory)][ValidateNotNullOrEmpty()][string[]]$Files
)

$ErrorActionPreference = 'Stop'
$repo = 'D:\10_PROJECTS\ds-lab-publish'
$origin = 'https://github.com/Shadabur-Rahaman/ds-lab.git'
$slug = 'Shadabur-Rahaman/ds-lab'
$liveUrl = 'https://shadabur-rahaman.github.io/ds-lab/'

function Invoke-Checked {
    param([string]$Program, [string[]]$Arguments)
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Program $($Arguments[0]) exited with code $LASTEXITCODE."
    }
}

$releaseEnvironment = @{
    GIT_TERMINAL_PROMPT = '0'
    GCM_INTERACTIVE = 'Never'
    GH_PROMPT_DISABLED = '1'
    DS_LAB_BASE = '/ds-lab/'
    DS_TEST_STATIC = '1'
}
$previousEnvironment = @{}
Push-Location -LiteralPath $repo
try {
    foreach ($name in $releaseEnvironment.Keys) {
        $previousEnvironment[$name] = [Environment]::GetEnvironmentVariable($name)
        [Environment]::SetEnvironmentVariable($name, $releaseEnvironment[$name])
    }
    Get-Command git, npm.cmd, gh -ErrorAction Stop | Out-Null
    $root = Invoke-Checked git @('rev-parse', '--show-toplevel')
    $branch = Invoke-Checked git @('branch', '--show-current')
    $fetchUrl = Invoke-Checked git @('remote', 'get-url', '--all', 'origin')
    $pushUrl = Invoke-Checked git @('remote', 'get-url', '--push', '--all', 'origin')
    if (($root -replace '/', '\') -ne $repo -or $branch -cne 'main' -or
        @($fetchUrl).Count -ne 1 -or $fetchUrl -cne $origin -or
        @($pushUrl).Count -ne 1 -or $pushUrl -cne $origin) {
        throw 'Expected the canonical DS LAB root, main, and a single matching origin for fetch and push.'
    }

    if (Invoke-Checked git @('diff', '--cached', '--name-only')) {
        throw 'The index already contains staged changes. Review and clear them before starting a release.'
    }
    if (Invoke-Checked git @('ls-files', '--unmerged')) {
        throw 'Resolve the unmerged files before releasing.'
    }
    foreach ($state in 'MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-apply', 'rebase-merge', 'sequencer') {
        if (Test-Path -LiteralPath (Invoke-Checked git @('rev-parse', '--git-path', $state))) {
            throw "A Git operation is in progress ($state). Finish it before releasing."
        }
    }

    $trackedChanges = @(Invoke-Checked git @('-c', 'core.quotePath=false', 'status', '--porcelain=v1', '--untracked-files=no', '--no-renames'))
    foreach ($file in $Files) {
        if ($file -notmatch '^[A-Za-z0-9_@.+ -]+(?:/[A-Za-z0-9_@.+ -]+)*$' -or
            ($file -split '/') -contains '..' -or ($file -split '/') -contains '.') {
            throw "Expected a changed, repository-relative file path using forward slashes: $file"
        }
        $fileStatus = @(Invoke-Checked git @('--literal-pathspecs', 'status', '--porcelain=v1',
            '--untracked-files=all', '--no-renames', '--', $file))
        if ($fileStatus.Count -ne 1 -or $fileStatus[0].Substring(3) -cne $file) {
            throw "Expected exactly one changed file at $file."
        }
    }
    $otherTrackedChanges = @($trackedChanges | Where-Object { $Files -cnotcontains $_.Substring(3) })
    if ($otherTrackedChanges.Count) {
        $otherTrackedChanges | Out-Host
        throw 'Include or set aside the tracked changes above so the local checks test what you intend to release.'
    }

    $remote = Invoke-Checked git @('ls-remote', '--exit-code', 'origin', 'refs/heads/main')
    $base = Invoke-Checked git @('rev-parse', 'HEAD')
    if (($remote -split '\s+')[0] -cne $base) {
        throw 'Local HEAD differs from origin/main. Reconcile Git history before starting this release.'
    }
    Invoke-Checked gh @('workflow', 'view', 'pages.yml', '--repo', $slug) | Out-Null

    Invoke-Checked npm.cmd @('run', 'build')
    Invoke-Checked npm.cmd @('run', 'test:e2e')

    if (Invoke-Checked git @('diff', '--cached', '--name-only')) {
        throw 'The index changed during verification. Review the staged changes before continuing.'
    }
    Invoke-Checked git (@('--literal-pathspecs', 'add', '--') + $Files)
    Invoke-Checked git @('--no-pager', 'diff', '--cached', '--check')
    Invoke-Checked git @('--no-pager', 'diff', '--cached')
    if ((Read-Host 'Type RELEASE to commit the staged diff and push it to main') -cne 'RELEASE') {
        throw 'Release cancelled. The selected changes are staged for review.'
    }

    Invoke-Checked git @('commit', '-m', $Message)
    $commit = Invoke-Checked git @('rev-parse', 'HEAD')
    Invoke-Checked git @('push', 'origin', "${commit}:refs/heads/main")
    Write-Host "Pushed $commit. Monitoring the Pages workflow for that commit."

    $run = $null
    for ($attempt = 0; $attempt -lt 24 -and -not $run; $attempt++) {
        $runsJson = Invoke-Checked gh @('run', 'list', '--repo', $slug, '--workflow', 'pages.yml',
            '--branch', 'main', '--event', 'push', '--commit', $commit, '--limit', '1', '--json', 'databaseId,url')
        $run = ($runsJson | ConvertFrom-Json) | Select-Object -First 1
        if (-not $run) { Start-Sleep -Seconds 5 }
    }
    if (-not $run) {
        throw "Commit $commit was pushed, but its Pages workflow has not appeared."
    }
    Write-Host $run.url
    Invoke-Checked gh @('run', 'watch', "$($run.databaseId)", '--repo', $slug, '--exit-status')

    $page = Invoke-WebRequest -Uri $liveUrl -UseBasicParsing -TimeoutSec 30
    if ($page.StatusCode -ne 200 -or $page.Content -notmatch '<title>[^<]*DS LAB') {
        throw "Pages reported success for $commit, but the live DS LAB homepage could not be confirmed."
    }
    Write-Host "Pages workflow succeeded for $commit. Live DS LAB homepage returned HTTP 200 at $liveUrl"
}
finally {
    foreach ($name in $previousEnvironment.Keys) {
        [Environment]::SetEnvironmentVariable($name, $previousEnvironment[$name])
    }
    Pop-Location
}
