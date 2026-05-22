$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot

Set-Location $projectRoot

if (-not (Test-Path ".env")) {
  Write-Host "Missing .env. Copy .env.example to .env and fill in Discord + library credentials first." -ForegroundColor Yellow
  exit 1
}

Write-Host "Starting Discord bot..." -ForegroundColor Cyan
npm run discord
