$ErrorActionPreference = 'Continue'
$pass = 0
$fail = 0

function DoPass {
    param([string]$msg)
    $script:pass++
    Write-Host "  PASS  $msg" -ForegroundColor Green
}

function DoFail {
    param([string]$msg)
    $script:fail++
    Write-Host "  FAIL  $msg" -ForegroundColor Red
}

Write-Host ''
Write-Host '========================================'
Write-Host '  LocalSeat Sync Check'
Write-Host '========================================'

# 1. Local repo
Write-Host ''
Write-Host '--- 1. Local repo ---' -ForegroundColor Cyan

$dirty = git status --porcelain 2>&1
if ($dirty) { DoFail 'Uncommitted changes found' } else { DoPass 'Working tree is clean' }

$branch = git rev-parse --abbrev-ref HEAD 2>&1
if ($branch -eq 'main') { DoPass 'On branch main' } else { DoFail "On branch $branch, expected main" }

# 2. Git remotes
Write-Host ''
Write-Host '--- 2. Git remotes ---' -ForegroundColor Cyan

Write-Host '  Fetching...' -ForegroundColor Gray
git fetch origin 2>&1 | Out-Null
git fetch staging 2>&1 | Out-Null

$localHash = git rev-parse HEAD 2>&1
$originHash = git rev-parse origin/main 2>&1
$stagingHash = git rev-parse staging/main 2>&1

if ($localHash -eq $originHash) { DoPass 'Local = origin/main' } else { DoFail 'Local differs from origin/main' }
if ($originHash -eq $stagingHash) { DoPass 'origin/main = staging/main' } else { DoFail 'origin/main differs from staging/main' }

# 3. Local dev database
Write-Host ''
Write-Host '--- 3. Local dev database ---' -ForegroundColor Cyan

$localMigrate = npx prisma migrate status 2>&1 | Out-String
if ($localMigrate -match 'Database schema is up to date') { DoPass 'Local dev DB up to date' } else { DoFail 'Local dev DB has pending migrations' }

# 4+5. VPS
Write-Host ''
Write-Host '--- 4. VPS production + demo ---' -ForegroundColor Cyan
Write-Host '  SSHing into VPS...' -ForegroundColor Gray

$vpsCmd = 'echo PROD_GIT; cd /var/www/localseat; git rev-parse HEAD; echo PROD_MIG; npx prisma migrate status 2>&1; echo DEMO_GIT; cd /var/www/demo; git rev-parse HEAD; echo DEMO_MIG; npx prisma migrate status 2>&1; echo DONE'
$vpsOut = ssh root@2.24.212.25 $vpsCmd 2>&1 | Out-String

if ($vpsOut.Length -lt 10) {
    DoFail 'Could not SSH into VPS'
} else {
    $lines = $vpsOut -split "`n"

    $prodGitIdx = -1
    $prodMigIdx = -1
    $demoGitIdx = -1
    $demoMigIdx = -1
    $doneIdx = -1

    for ($i = 0; $i -lt $lines.Count; $i++) {
        $l = $lines[$i].Trim()
        if ($l -eq 'PROD_GIT') { $prodGitIdx = $i }
        if ($l -eq 'PROD_MIG') { $prodMigIdx = $i }
        if ($l -eq 'DEMO_GIT') { $demoGitIdx = $i }
        if ($l -eq 'DEMO_MIG') { $demoMigIdx = $i }
        if ($l -eq 'DONE') { $doneIdx = $i }
    }

    # Production git
    if ($prodGitIdx -ge 0 -and $prodMigIdx -ge 0) {
        $prodHash = $lines[$prodGitIdx + 1].Trim()
        if ($prodHash -eq $originHash) { DoPass 'Production code matches origin/main' } else { DoFail "Production code mismatch: $prodHash" }
    } else { DoFail 'Could not parse production git hash' }

    # Production DB
    if ($prodMigIdx -ge 0 -and $demoGitIdx -ge 0) {
        $prodMigText = ($lines[($prodMigIdx+1)..($demoGitIdx-1)]) -join ' '
        if ($prodMigText -match 'Database schema is up to date') { DoPass 'Production DB up to date' } else { DoFail 'Production DB has pending migrations' }
    }

    # Demo git
    Write-Host ''
    Write-Host '--- 5. VPS demo ---' -ForegroundColor Cyan
    if ($demoGitIdx -ge 0 -and $demoMigIdx -ge 0) {
        $demoHash = $lines[$demoGitIdx + 1].Trim()
        if ($demoHash -eq $originHash) { DoPass 'Demo code matches origin/main' } else { DoFail "Demo code mismatch: $demoHash" }
    } else { DoFail 'Could not parse demo git hash' }

    # Demo DB
    if ($demoMigIdx -ge 0 -and $doneIdx -ge 0) {
        $demoMigText = ($lines[($demoMigIdx+1)..($doneIdx-1)]) -join ' '
        if ($demoMigText -match 'Database schema is up to date') { DoPass 'Demo DB up to date' } else { DoFail 'Demo DB has pending migrations' }
    }
}

# 6. Neon staging DB
Write-Host ''
Write-Host '--- 6. Staging database [Neon] ---' -ForegroundColor Cyan

$savedUrl = $env:DATABASE_URL
$env:DATABASE_URL = 'postgresql://neondb_owner:npg_Kk5To2NVXfJh@ep-withered-wave-am85yzwb-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
$neonMigrate = npx prisma migrate status 2>&1 | Out-String
if ($neonMigrate -match 'Database schema is up to date') { DoPass 'Neon staging DB up to date' } else { DoFail 'Neon staging DB has pending migrations' }
$env:DATABASE_URL = $savedUrl

# Summary
Write-Host ''
Write-Host '========================================'
if ($fail -eq 0) {
    Write-Host "  ALL CLEAR - $pass checks passed" -ForegroundColor Green
} else {
    Write-Host "  $fail FAILED, $pass passed" -ForegroundColor Red
}
Write-Host '========================================'
Write-Host ''
