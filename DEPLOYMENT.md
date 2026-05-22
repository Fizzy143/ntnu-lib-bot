# NTNU Library Bot 部署指南

## 📋 目錄
- [快速開始](#快速開始)
- [系統需求](#系統需求)
- [部署步驟](#部署步驟)
- [Supabase 設定](#supabase-設定)
- [Discord Bot 配置](#discord-bot-配置)
- [多人部署](#多人部署)
- [常見問題](#常見問題)

---

## 🚀 快速開始

### Windows
```bash
git clone https://github.com/YOUR_USERNAME/ntnu-lib-bot.git
cd ntnu-lib-bot
.\setup.ps1
# 編輯 .env 文件
npm run discord
```

### macOS / Linux
```bash
git clone https://github.com/YOUR_USERNAME/ntnu-lib-bot.git
cd ntnu-lib-bot
chmod +x setup.sh
./setup.sh
# 編輯 .env 文件
npm run discord
```

---

## 📦 系統需求

### 必需
- **Node.js** 18.0 或更高版本 ([下載](https://nodejs.org/))
- **npm** 9.0 或更高版本 (通常隨 Node.js 安裝)
- **Git** (用於克隆項目) ([下載](https://git-scm.com/))

### 可選
- **Python 3.8+** (用於本地 CAPTCHA 解析)
- **Visual Studio Code** (推薦編輯 .env 文件)

---

## 🔧 部署步驟

### 1️⃣ 克隆項目

```bash
git clone https://github.com/YOUR_USERNAME/ntnu-lib-bot.git
cd ntnu-lib-bot
```

### 2️⃣ 運行自動化安裝腳本

**Windows:**
```bash
.\setup.ps1
```

**macOS/Linux:**
```bash
chmod +x setup.sh
./setup.sh
```

腳本會自動：
- ✅ 檢查 Node.js 和 Python
- ✅ 安裝 npm 依賴
- ✅ 創建 .env 文件
- ✅ 建立 Python 虛擬環境（如果需要）

### 3️⃣ 配置環境變量

編輯 `.env` 文件，填入以下信息：

```env
# ========== 必填項 ==========

# Supabase 連接字符串
DATABASE_URL=postgresql://user:password@db.supabase.co:5432/postgres

# 加密密鑰（256-bit hex，32 字節）
# Windows 生成方式: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# macOS/Linux: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
CREDENTIALS_ENCRYPTION_KEY=your_32byte_hex_key_here

# Discord Bot 配置
DISCORD_TOKEN=your_discord_token_here
DISCORD_CLIENT_ID=your_client_id_here
DISCORD_GUILD_ID=your_guild_id_here

# ========== 可選項 ==========

# 伺服器配置
PORT=3000

# 圖書館網站
LIB_BASE=https://www.lib.ntnu.edu.tw
LIB_SERVICE_BASE=https://www.lib.ntnu.edu.tw/service

# 預設值
DEFAULT_BRANCH=公館分館
BRANCH_OPTIONS=總館,公館分館,林口分館

# CAPTCHA
AUTO_SOLVE_CAPTCHA=true
CAPTCHA_SOLVER_TIMEOUT=10000
PYTHON_CMD=.venv\Scripts\python.exe

# Discord
DISCORD_SHOW=false
```

### 4️⃣ 測試連接

確保數據庫連接正確：
```bash
# 測試 Node.js 環境
node -e "console.log('✅ Node.js 正常')"

# 測試 npm
npm --version
```

### 5️⃣ 啟動服務

**運行 Discord Bot：**
```bash
npm run discord
```

**運行 Web 服務器：**
```bash
npm run server
# 訪問 http://localhost:3000
```

**運行前端開發服務器：**
```bash
npm run frontend:dev
# 訪問 http://localhost:5173
```

---

## ☁️ Supabase 設定

### 1️⃣ 創建免費 Supabase 項目

1. 前往 [Supabase](https://supabase.com/)
2. 點擊「Create a new project」
3. 選擇「Free」方案（免費 1GB 存儲）
4. 選擇區域（推薦選擇亞洲区域以獲得更好的性能）

### 2️⃣ 獲取連接字符串

1. 在 Supabase 項目中，點擊「Settings」→「Database」
2. 複製 「Connection string」（PostgreSQL）
3. 替換密碼和數據庫名稱

**格式：**
```
postgresql://user:password@db.supabase.co:5432/postgres
```

### 3️⃣ 創建凭証表

在 Supabase SQL Editor 中執行以下 SQL：

```sql
CREATE TABLE IF NOT EXISTS user_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    discord_id TEXT NOT NULL UNIQUE,
    library_username TEXT NOT NULL,
    encrypted_password TEXT NOT NULL,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

-- 添加索引以加速查詢
CREATE INDEX idx_discord_id ON user_credentials(discord_id);

-- 添加行級安全性（RLS）
ALTER TABLE user_credentials ENABLE ROW LEVEL SECURITY;

-- 創建安全策略（用戶只能看自己的凭証）
CREATE POLICY "Users can only access their own credentials"
  ON user_credentials
  FOR ALL
  USING (auth.uid()::text = discord_id)
  WITH CHECK (auth.uid()::text = discord_id);
```

### 4️⃣ 複製連接字符串到 .env

```env
DATABASE_URL=postgresql://user:password@db.supabase.co:5432/postgres
```

---

## 🤖 Discord Bot 配置

### 1️⃣ 創建 Discord 應用

1. 前往 [Discord Developer Portal](https://discord.com/developers/applications)
2. 點擊「New Application」
3. 輸入應用名稱（如 "NTNU Library Bot"）

### 2️⃣ 獲取 Token

1. 在應用中，點擊「Bot」→「Add Bot」
2. 點擊「Copy」複製 Token
3. 放入 `.env` 的 `DISCORD_TOKEN`

**⚠️ 保護你的 Token！不要提交到 Git 或分享給任何人**

### 3️⃣ 設定權限

1. 在「OAuth2」→「URL Generator」中
2. 選擇 Scopes: `bot`
3. 選擇 Permissions:
   - ✅ Read Messages/View Channels
   - ✅ Send Messages
   - ✅ Embed Links
   - ✅ Read Message History
   - ✅ Use Slash Commands
4. 複製生成的 URL 並在瀏覽器中訪問以邀請 Bot 到你的 Discord 伺服器

### 4️⃣ 獲取 Guild ID

1. 在 Discord 設置中啟用「Developer Mode」
2. 右擊你的伺服器名稱
3. 點擊「Copy Server ID」
4. 放入 `.env` 的 `DISCORD_GUILD_ID`

### 5️⃣ 在 .env 中填寫

```env
DISCORD_TOKEN=your_token_here
DISCORD_CLIENT_ID=your_client_id_here  # 來自 General Information
DISCORD_GUILD_ID=your_guild_id_here
```

---

## 👥 多人部署

NTNU Library Bot 支持多人在各自的電腦上運行，所有 Bot 實例通過 Supabase 共享凭証數據庫。

### 架構

```
Bot 實例 1 (家裡)    Bot 實例 2 (公司)    Bot 實例 3 (VPS)
        ↓                    ↓                    ↓
    Supabase PostgreSQL (共享凭証)
        ↑
    所有用戶共享存儲
```

### 部署流程

#### 維護者（第一個部署）：
1. 遵循上述步驟完成部署
2. 推送到 GitHub

#### 其他人（第二個及以後）：
1. 克隆 GitHub 項目
2. 運行 `setup.ps1` 或 `setup.sh`
3. 從 GitHub 共享同一個 `DATABASE_URL`
4. 使用各自的 Discord Token（或共享）
5. 運行 Bot

### 優勢

✅ **無單點故障**: 任何 Bot 掉線，其他還在運行
✅ **容量分散**: 多個實例提高可靠性
✅ **數據同步**: 凭証在所有實例間實時同步
✅ **成本最低**: 只需一個 Supabase 免費項目

### 注意事項

- 不要在不同實例上使用相同的 `DISCORD_TOKEN`（每個應該有自己的 Bot Token）
- 或者使用同一個 Token 和 Guild ID，讓多個實例共享（會收到重複消息）
- 推薦做法：**每個部署用自己的 Discord Bot Token**

---

## ❓ 常見問題

### Q1: 我不想使用 Supabase，能用本地 SQLite 嗎？
**目前版本設計為 PostgreSQL 專用。** 本地 SQLite 不支持多人共享。如需本地開發，請聯繫維護者。

### Q2: Supabase 免費層足夠嗎？
**完全足夠！** 免費層提供：
- 💾 1GB 存儲（足以存儲數百萬用戶凭証）
- 🚀 無限 API 調用
- 🔄 自動備份

### Q3: 密鑰丟失了怎麼辦？
**密鑰用於加密凭証。丟失密鑰意味著已保存的凭証無法解密。**
- 生成新密鑰
- 所有用戶需要重新保存凭証
- 推薦定期備份 `.env` 文件

### Q4: 如何重置所有凭証？
在 Supabase SQL Editor 執行：
```sql
DELETE FROM user_credentials;
```

### Q5: Bot 無法連接到 Supabase？
檢查：
- ✅ `DATABASE_URL` 是否正確複製
- ✅ Supabase 項目是否仍然活躍
- ✅ 網絡連接是否正常
- ✅ 防火牆是否阻止了 PostgreSQL 端口（5432）

### Q6: 如何在後台持續運行 Bot？

**Windows (使用 PM2):**
```bash
npm install -g pm2
pm2 start npm -- run discord --name "ntnu-bot"
pm2 save
```

**Linux/macOS (使用 screen):**
```bash
screen -S ntnu-bot npm run discord
# 按 Ctrl+A+D 離開 screen
# 查看運行: screen -ls
# 重新進入: screen -r ntnu-bot
```

**Linux (使用 systemd):**
見文檔末尾的 systemd 配置示例。

### Q7: 可以同時運行 Web 服務器和 Discord Bot 嗎？
可以，使用不同的終端窗口或進程管理器（PM2）：
```bash
# 終端 1
npm run discord

# 終端 2
npm run server

# 或使用 PM2
pm2 start npm --name "bot" -- run discord
pm2 start npm --name "server" -- run server
```

---

## 📚 後續步驟

1. ✅ [基本部署完成]
2. 📖 閱讀 [README.md](./README.md) 了解功能
3. 🔧 嘗試命令：`/cred-set myusername mypassword`
4. 📋 測試預約流程
5. 📞 如有問題，提交 Issue 到 GitHub

---

## 🆘 需要幫助？

- 📖 查看 [README.md](./README.md)
- 🐛 提交 Bug Report: [GitHub Issues](https://github.com/YOUR_USERNAME/ntnu-lib-bot/issues)
- 💬 加入 Discord 社群討論

---

## 📄 附錄：Systemd 服務配置（Linux）

如果你想在 Linux 伺服器上以服務形式運行 Bot，創建 `/etc/systemd/system/ntnu-bot.service`：

```ini
[Unit]
Description=NTNU Library Bot
After=network.target

[Service]
Type=simple
User=your_username
WorkingDirectory=/home/your_username/ntnu-lib-bot
ExecStart=/usr/bin/npm run discord
Restart=on-failure
RestartSec=10

Environment="NODE_ENV=production"

[Install]
WantedBy=multi-user.target
```

然後啟用和啟動服務：
```bash
sudo systemctl daemon-reload
sudo systemctl enable ntnu-bot
sudo systemctl start ntnu-bot
sudo systemctl status ntnu-bot
```

查看日誌：
```bash
sudo journalctl -u ntnu-bot -f
```
