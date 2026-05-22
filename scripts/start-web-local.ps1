$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $projectRoot ".local"

Set-Location $projectRoot

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$serverOut = Join-Path $logDir "server.log"
$serverErr = Join-Path $logDir "server.err.log"
$frontendOut = Join-Path $logDir "frontend.log"
$frontendErr = Join-Path $logDir "frontend.err.log"

Write-Host "Starting API server on http://127.0.0.1:3000"
Start-Process cmd.exe -ArgumentList "/c", "npm run server 1>`"$serverOut`" 2>`"$serverErr`"" -WorkingDirectory $projectRoot -WindowStyle Hidden | Out-Null

Write-Host "Starting frontend on http://127.0.0.1:5173"
Start-Process cmd.exe -ArgumentList "/c", "npm run frontend:dev 1>`"$frontendOut`" 2>`"$frontendErr`"" -WorkingDirectory $projectRoot -WindowStyle Hidden | Out-Null

Write-Host "Logs:"
Write-Host "  $serverOut"
Write-Host "  $serverErr"
Write-Host "  $frontendOut"
Write-Host "  $frontendErr"
