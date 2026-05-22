# NTNU Library Bot 快速部署腳本 (Windows PowerShell)
# 用法: .\setup.ps1

Write-Host "🚀 NTNU Library Bot 部署腳本" -ForegroundColor Cyan
Write-Host "================================`n" -ForegroundColor Cyan

# 檢查 Node.js
Write-Host "📦 檢查 Node.js..." -ForegroundColor Yellow
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js 未安裝，請先安裝 (https://nodejs.org/)" -ForegroundColor Red
    exit 1
}
$nodeVersion = node --version
Write-Host "✅ 找到 Node.js $nodeVersion`n" -ForegroundColor Green

# 檢查 Git
Write-Host "🔍 檢查 Git..." -ForegroundColor Yellow
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "⚠️  Git 未安裝（可選，但推薦安裝以便版本控制）`n" -ForegroundColor Yellow
} else {
    $gitVersion = git --version
    Write-Host "✅ 找到 $gitVersion`n" -ForegroundColor Green
}

# 安裝後端依賴
Write-Host "📥 安裝後端依賴..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 後端依賴安裝失敗" -ForegroundColor Red
    exit 1
}
Write-Host "✅ 後端依賴安裝完成`n" -ForegroundColor Green

# 安裝前端依賴
Write-Host "📥 安裝前端依賴..." -ForegroundColor Yellow
npm --prefix frontend install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 前端依賴安裝失敗" -ForegroundColor Red
    exit 1
}
Write-Host "✅ 前端依賴安裝完成`n" -ForegroundColor Green

# 複製環境配置
Write-Host "⚙️  設定環境變量..." -ForegroundColor Yellow
if (-not (Test-Path .env)) {
    Copy-Item .env.example .env
    Write-Host "✅ .env 已創建（模板複製自 .env.example）" -ForegroundColor Green
    Write-Host "⚠️  請編輯 .env 文件並填入以下必需項目：" -ForegroundColor Yellow
    Write-Host "   - DISCORD_TOKEN" -ForegroundColor Yellow
    Write-Host "   - DISCORD_CLIENT_ID" -ForegroundColor Yellow
    Write-Host "   - DISCORD_GUILD_ID" -ForegroundColor Yellow
    Write-Host "   - DATABASE_URL (Supabase)" -ForegroundColor Yellow
    Write-Host "   - CREDENTIALS_ENCRYPTION_KEY" -ForegroundColor Yellow
} else {
    Write-Host "✅ .env 已存在（跳過複製）`n" -ForegroundColor Green
}

# 檢查 Python（可選，用於本地 CAPTCHA）
Write-Host "🐍 檢查 Python（可選）..." -ForegroundColor Yellow
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "⚠️  Python 未安裝（可選，若要本地 CAPTCHA 解析建議安裝）" -ForegroundColor Yellow
} else {
    $pythonVersion = python --version
    Write-Host "✅ 找到 $pythonVersion`n" -ForegroundColor Green
    
    # 建立 Python 虛擬環境
    if (-not (Test-Path .venv)) {
        Write-Host "📦 建立 Python 虛擬環境..." -ForegroundColor Yellow
        python -m venv .venv
        Write-Host "✅ 虛擬環境已建立`n" -ForegroundColor Green
        
        # 安裝 Python 依賴
        Write-Host "📥 安裝 Python 依賴..." -ForegroundColor Yellow
        .\.venv\Scripts\python -m pip install -r requirements.txt
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Python 依賴安裝完成`n" -ForegroundColor Green
        } else {
            Write-Host "❌ Python 依賴安裝失敗（非致命，可稍後手動安裝）`n" -ForegroundColor Yellow
        }
    } else {
        Write-Host "✅ Python 虛擬環境已存在（跳過）`n" -ForegroundColor Green
    }
}

# 完成
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "✅ 部署完成！" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "下一步："
Write-Host "1. 編輯 .env 文件，填入必需的配置項目" -ForegroundColor Cyan
Write-Host "2. 運行 Discord Bot: npm run discord" -ForegroundColor Cyan
Write-Host "3. 或運行 Web 服務器: npm run server" -ForegroundColor Cyan
Write-Host "4. 或運行前端開發: npm run frontend:dev" -ForegroundColor Cyan
Write-Host "`n更多信息，請查看 DEPLOYMENT.md"
