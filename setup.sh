#!/bin/bash

# NTNU Library Bot 快速部署腳本 (Linux/macOS)
# 用法: chmod +x setup.sh && ./setup.sh

set -e

echo "🚀 NTNU Library Bot 部署腳本"
echo "================================"
echo ""

# 檢查 Node.js
echo "📦 檢查 Node.js..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安裝，請先安裝 (https://nodejs.org/)"
    exit 1
fi
NODE_VERSION=$(node --version)
echo "✅ 找到 Node.js $NODE_VERSION"
echo ""

# 檢查 Git
echo "🔍 檢查 Git..."
if ! command -v git &> /dev/null; then
    echo "⚠️  Git 未安裝（可選，但推薦安裝以便版本控制）"
else
    GIT_VERSION=$(git --version)
    echo "✅ 找到 $GIT_VERSION"
fi
echo ""

# 安裝後端依賴
echo "📥 安裝後端依賴..."
npm install
echo "✅ 後端依賴安裝完成"
echo ""

# 安裝前端依賴
echo "📥 安裝前端依賴..."
npm --prefix frontend install
echo "✅ 前端依賴安裝完成"
echo ""

# 複製環境配置
echo "⚙️  設定環境變量..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "✅ .env 已創建（模板複製自 .env.example）"
    echo "⚠️  請編輯 .env 文件並填入以下必需項目："
    echo "   - DISCORD_TOKEN"
    echo "   - DISCORD_CLIENT_ID"
    echo "   - DISCORD_GUILD_ID"
    echo "   - DATABASE_URL (Supabase)"
    echo "   - CREDENTIALS_ENCRYPTION_KEY"
else
    echo "✅ .env 已存在（跳過複製）"
fi
echo ""

# 檢查 Python（可選）
echo "🐍 檢查 Python（可選）..."
if ! command -v python3 &> /dev/null; then
    echo "⚠️  Python 未安裝（可選，若要本地 CAPTCHA 解析建議安裝）"
else
    PYTHON_VERSION=$(python3 --version)
    echo "✅ 找到 $PYTHON_VERSION"
    
    # 建立 Python 虛擬環境
    if [ ! -d ".venv" ]; then
        echo ""
        echo "📦 建立 Python 虛擬環境..."
        python3 -m venv .venv
        echo "✅ 虛擬環境已建立"
        
        # 啟用虛擬環境
        source .venv/bin/activate
        
        # 安裝 Python 依賴
        echo "📥 安裝 Python 依賴..."
        pip install -r requirements.txt || {
            echo "❌ Python 依賴安裝失敗（非致命，可稍後手動安裝）"
        }
        echo "✅ Python 依賴安裝完成"
        
        # 停用虛擬環境
        deactivate
    else
        echo "✅ Python 虛擬環境已存在（跳過）"
    fi
fi
echo ""

# 完成
echo "========================================"
echo "✅ 部署完成！"
echo "========================================"
echo ""

echo "下一步："
echo "1. 編輯 .env 文件，填入必需的配置項目"
echo "2. 運行 Discord Bot: npm run discord"
echo "3. 或運行 Web 服務器: npm run server"
echo "4. 或運行前端開發: npm run frontend:dev"
echo ""
echo "更多信息，請查看 DEPLOYMENT.md"
