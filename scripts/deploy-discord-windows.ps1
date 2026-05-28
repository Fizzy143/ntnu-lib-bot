param(
  [switch]$InstallStartupTask,
  [switch]$StartNow,
  [switch]$SkipDependencyInstall,
  [switch]$SkipPlaywright,
  [switch]$SkipPython,
  [switch]$NoPrompt
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $projectRoot ".env"
$discordEnvExamplePath = Join-Path $projectRoot ".env.discord.example"
$defaultEnvExamplePath = Join-Path $projectRoot ".env.example"
$taskName = "NTNU Library Discord Bot"

Set-Location $projectRoot

function Write-Step($message) {
  Write-Host ""
  Write-Host "==> $message" -ForegroundColor Cyan
}

function Assert-Command($name, $installHint) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    Write-Host "Missing required command: $name" -ForegroundColor Red
    Write-Host $installHint -ForegroundColor Yellow
    exit 1
  }
}

function Read-DotEnv($path) {
  $values = @{}
  if (-not (Test-Path $path)) {
    return $values
  }

  foreach ($line in Get-Content $path) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#") -or -not $trimmed.Contains("=")) {
      continue
    }

    $parts = $trimmed.Split("=", 2)
    $values[$parts[0]] = $parts[1]
  }

  return $values
}

function Set-DotEnvValue($path, $key, $value) {
  $escapedKey = [regex]::Escape($key)
  $line = "$key=$value"

  if (-not (Test-Path $path)) {
    Set-Content -Path $path -Value $line -Encoding UTF8
    return
  }

  $content = Get-Content $path
  $found = $false
  $updated = foreach ($existingLine in $content) {
    if ($existingLine -match "^\s*$escapedKey\s*=") {
      $found = $true
      $line
    } else {
      $existingLine
    }
  }

  if ($found) {
    Set-Content -Path $path -Value $updated -Encoding UTF8
  } else {
    Add-Content -Path $path -Value $line -Encoding UTF8
  }
}

function Ensure-EnvValue($values, $key, $prompt, [switch]$Required) {
  $current = ""
  if ($values.ContainsKey($key)) {
    $current = StringOrEmpty $values[$key]
  }

  if ($current) {
    return $current
  }

  if ($NoPrompt) {
    if ($Required) {
      throw "Missing required environment variable: $key"
    }
    return ""
  }

  $answer = Read-Host $prompt
  if (-not $answer -and $Required) {
    throw "Missing required environment variable: $key"
  }

  if ($answer) {
    Set-DotEnvValue $envPath $key $answer
    $values[$key] = $answer
  }

  return $answer
}

function StringOrEmpty($value) {
  return ([string]$value).Trim()
}

function New-HexKey() {
  return node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
}

Write-Host "NTNU Library Discord Bot deployment" -ForegroundColor Green
Write-Host "Project: $projectRoot"

Write-Step "Checking required tools"
Assert-Command "node" "Install Node.js 20+ or 24+ from https://nodejs.org/"
Assert-Command "npm" "npm is bundled with Node.js. Reinstall Node.js if npm is missing."

$nodeVersion = node --version
Write-Host "Node.js $nodeVersion"

if (-not (Test-Path $envPath)) {
  Write-Step "Creating .env"
  if (Test-Path $discordEnvExamplePath) {
    Copy-Item $discordEnvExamplePath $envPath
  } elseif (Test-Path $defaultEnvExamplePath) {
    Copy-Item $defaultEnvExamplePath $envPath
  } else {
    New-Item -ItemType File -Path $envPath | Out-Null
  }
  Write-Host ".env created. Secrets are stored only on this machine." -ForegroundColor Yellow
}

$envValues = Read-DotEnv $envPath

Write-Step "Checking Discord settings"
Ensure-EnvValue $envValues "DISCORD_TOKEN" "Paste DISCORD_TOKEN" -Required | Out-Null
Ensure-EnvValue $envValues "DISCORD_CLIENT_ID" "Paste DISCORD_CLIENT_ID numeric snowflake" -Required | Out-Null
Ensure-EnvValue $envValues "DISCORD_GUILD_ID" "Paste DISCORD_GUILD_ID numeric snowflake" -Required | Out-Null

if (-not (StringOrEmpty $envValues["DISCORD_MODE"])) {
  Set-DotEnvValue $envPath "DISCORD_MODE" "true"
}

if (-not (StringOrEmpty $envValues["DISCORD_SHOW"])) {
  Set-DotEnvValue $envPath "DISCORD_SHOW" "false"
}

if (-not (StringOrEmpty $envValues["PYTHON_CMD"])) {
  Set-DotEnvValue $envPath "PYTHON_CMD" ".venv\Scripts\python.exe"
}

$envValues = Read-DotEnv $envPath

if (-not (StringOrEmpty $envValues["DATABASE_URL"]) -and -not $NoPrompt) {
  $enableCredentials = Read-Host "Enable Supabase credential commands? y/N"
  if ($enableCredentials -match "^(y|yes)$") {
    Ensure-EnvValue $envValues "DATABASE_URL" "Paste Supabase DATABASE_URL" -Required | Out-Null
  }
}

$envValues = Read-DotEnv $envPath
if ((StringOrEmpty $envValues["DATABASE_URL"]) -and -not (StringOrEmpty $envValues["CREDENTIALS_ENCRYPTION_KEY"])) {
  Write-Host "Generating CREDENTIALS_ENCRYPTION_KEY for saved credential encryption." -ForegroundColor Yellow
  Set-DotEnvValue $envPath "CREDENTIALS_ENCRYPTION_KEY" (New-HexKey)
}

if (-not $SkipDependencyInstall) {
  Write-Step "Installing Node dependencies"
  if (Test-Path (Join-Path $projectRoot "package-lock.json")) {
    npm ci
  } else {
    npm install
  }
}

if (-not $SkipPlaywright) {
  Write-Step "Installing Playwright Chromium"
  npx playwright install chromium
}

if (-not $SkipPython) {
  Write-Step "Preparing optional Python CAPTCHA environment"
  $pythonCommand = Get-Command python -ErrorAction SilentlyContinue
  if (-not $pythonCommand) {
    $pythonCommand = Get-Command py -ErrorAction SilentlyContinue
  }

  if ($pythonCommand) {
    if (-not (Test-Path ".venv")) {
      if ($pythonCommand.Name -eq "py.exe") {
        py -3 -m venv .venv
      } else {
        python -m venv .venv
      }
    }

    if (Test-Path "requirements.txt") {
      .\.venv\Scripts\python.exe -m pip install -r requirements.txt
    }
  } else {
    Write-Host "Python not found. CAPTCHA auto-solving may be unavailable, but manual fallback can still work." -ForegroundColor Yellow
  }
}

Write-Step "Validating Discord environment"
node scripts/validate-discord-env.mjs

if ($InstallStartupTask) {
  Write-Step "Registering Windows startup task"
  $runnerPath = Join-Path $projectRoot "scripts\run-discord-forever.ps1"
  $argument = "-NoProfile -ExecutionPolicy Bypass -File `"$runnerPath`""
  $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $argument -WorkingDirectory $projectRoot
  $trigger = New-ScheduledTaskTrigger -AtLogOn
  $settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -MultipleInstances IgnoreNew `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1)

  Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description "Runs NTNU Library Discord Bot and restarts it on failure." `
    -Force | Out-Null

  Write-Host "Startup task registered: $taskName" -ForegroundColor Green
}

if ($StartNow) {
  Write-Step "Starting Discord bot"
  if ($InstallStartupTask) {
    Start-ScheduledTask -TaskName $taskName
    Write-Host "Bot started through Windows Task Scheduler." -ForegroundColor Green
    Write-Host "Log file: logs\discord-bot.log"
  } else {
    Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$projectRoot\scripts\run-discord-forever.ps1`"" -WorkingDirectory $projectRoot -WindowStyle Hidden
    Write-Host "Bot started in a hidden PowerShell window." -ForegroundColor Green
    Write-Host "Log file: logs\discord-bot.log"
  }
}

Write-Host ""
Write-Host "Deployment ready." -ForegroundColor Green
Write-Host "Manual start: .\scripts\run-discord-forever.ps1"
Write-Host "One-click installer: .\install-discord-bot-windows.cmd"
