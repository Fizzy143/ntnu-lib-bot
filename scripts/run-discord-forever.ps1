$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $projectRoot "logs"
$logFile = Join-Path $logDir "discord-bot.log"

Set-Location $projectRoot

if (-not (Test-Path ".env")) {
  Write-Host "Missing .env. Run install-discord-bot-windows.cmd first." -ForegroundColor Red
  exit 1
}

if (-not (Test-Path $logDir)) {
  New-Item -ItemType Directory -Path $logDir | Out-Null
}

while ($true) {
  $startedAt = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  "[$startedAt] Starting Discord bot..." | Tee-Object -FilePath $logFile -Append

  & npm run discord 2>&1 | Tee-Object -FilePath $logFile -Append
  $exitCode = $LASTEXITCODE

  $stoppedAt = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  "[$stoppedAt] Discord bot exited with code $exitCode. Restarting in 10 seconds..." | Tee-Object -FilePath $logFile -Append
  Start-Sleep -Seconds 10
}
