# NTNU Library Bot

NTNU Library Bot is evolving from a CLI and Discord automation project into an online booking service with a Vue frontend and a Node.js API backend.

**🌟 最新功能：** 多人部署 + Discord/Web 雙介面凭證管理系統，所有實例共享 Supabase 凭証存儲。

## Current structure

- `src/usecases`
  Shared business logic for availability lookup and booking
- `src/services/playwright`
  Browser automation and CAPTCHA handling
- `src/server`
  Express API for the web version
- `frontend`
  Vue + Vite web interface
- `src/cli`
  Existing command-line tools
- `src/bot`
  Existing Discord bot

## MVP direction

This version now includes the first online-service scaffolding:

- `GET /api/meta`
  Returns frontend-safe config such as branch options and default branch
- `GET /api/availability`
  Returns structured room availability data for a branch and date
- `POST /api/book/start`
  Starts a booking flow and attempts automatic CAPTCHA solving first
- `POST /api/book/captcha`
  Continues the booking flow when manual CAPTCHA fallback is needed

The availability response is structured around a room list so the frontend can later grow into an all-rooms dashboard instead of forcing one-by-one lookup.

## Environment

Copy `.env.example` to `.env` and fill in the values you need.

Important fields:

- `PORT`
- `LIB_BASE`
- `LIB_SERVICE_BASE`
- `DEFAULT_BRANCH`
- `BRANCH_OPTIONS`
- `AUTO_SOLVE_CAPTCHA`
- `CAPTCHA_SOLVER_TIMEOUT`
- `LIBRARY_USERNAME`
- `LIBRARY_PASSWORD`
- `PYTHON_CMD`
- `DISCORD_SHOW`
- `HERMES_PARSE_URL` (optional)

On Windows, prefer `LIBRARY_USERNAME` and `LIBRARY_PASSWORD` instead of `USERNAME` because `USERNAME` is often already set by the operating system.

## Commands

### Quick Start (一鍵安裝)

**Windows:**
```bash
git clone https://github.com/YOUR_USERNAME/ntnu-lib-bot.git
cd ntnu-lib-bot
.\setup.ps1
```

**macOS/Linux:**
```bash
git clone https://github.com/YOUR_USERNAME/ntnu-lib-bot.git
cd ntnu-lib-bot
chmod +x setup.sh
./setup.sh
```

📖 詳細部署指南，請查看 [DEPLOYMENT.md](./DEPLOYMENT.md)

### Install backend dependencies:

```bash
npm install
```

### Install frontend dependencies:

```bash
npm --prefix frontend install
```

### Run the API server:

```bash
npm run server
```

### Run the Vue frontend in development:

```bash
npm run frontend:dev
```

### Build the Vue frontend:

```bash
npm run frontend:build
```

### Run Discord Bot:

```bash
npm run discord
```

### Existing tools:

```bash
npm run status -- --date 2026-05-22 --branch 總館 --room 304
npm run book -- --branch 公館分館 --room 403 --date 2026-05-22 --start 18:30 --end 20:30 --people 4 --show
```

### For local CAPTCHA OCR, create a project virtual environment and install the Python dependency:

```bash
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Set `PYTHON_CMD=.venv\Scripts\python.exe` in `.env`.

If you want to watch the browser automation locally while testing Discord bookings, set `DISCORD_SHOW=true` in `.env` or pass `show=true` in the `/book` slash command.

## Hermes parser fallback

The Discord bot can optionally call a Hermes HTTP endpoint when the built-in rule parser cannot confidently understand a natural-language message.

- The local parser still runs first.
- Hermes is used only as a fallback for message understanding.
- Booking execution, credentials, CAPTCHA handling, and final confirmation remain inside this project.

Environment variables:

- `HERMES_PARSE_URL`
- `HERMES_PARSE_TOKEN`
- `HERMES_PARSE_TIMEOUT_MS`

Suggested Docker-to-host URL when Hermes runs on the same machine:

```bash
HERMES_PARSE_URL=http://host.docker.internal:8787/parse
```

Expected Hermes request body:

```json
{
  "task": "parse_ntnu_library_message",
  "text": "幫我約明晚總圖403七點到九點四個人",
  "today": "2026-05-29",
  "timezone": "Asia/Taipei",
  "branchOptions": [
    { "canonical": "總館", "aliases": ["總館", "總圖", "本館", "圖書館總館"] },
    { "canonical": "公館分館", "aliases": ["公館分館", "公館", "公館校區", "公館圖書館"] },
    { "canonical": "林口分館", "aliases": ["林口分館", "林口", "林口校區", "林口圖書館"] }
  ]
}
```

Expected Hermes response body:

```json
{
  "parsed": {
    "intent": "book",
    "branch": "總館",
    "room": "403",
    "people": 4,
    "date": "2026-05-30",
    "start": "19:00",
    "end": "21:00"
  }
}
```

## Tuning natural-language parsing

For high-frequency phrases, prefer adding or refining local parser rules before relying on Hermes. This keeps common cases fast and predictable.

- Local parser rules live in `src/bot/naturalLanguage.js`
- Regression cases live in `tests/natural-language-cases.json`
- Run the parser regression suite with `npm test`

Each case entry supports:

- `input`: the user message
- `today`: the reference date used by the parser
- `expected`: only the fields you want to assert
- `expectNull`: use this instead of `expected` for intentionally unsupported or ambiguous inputs

Useful cases to maintain:

- `今天公館` -> status query for today's 公館分館
- `明天總圖403` -> status query for tomorrow's room 403 in 總館
- `公館403 7-9` -> keep ambiguous unless the user explicitly says they want to book

## Parser feedback log

The Discord bot can persist unresolved natural-language inputs so you can periodically review them and add new cases or rules.

- `PARSER_FEEDBACK_ENABLED=true`
- `PARSER_FEEDBACK_LOG_PATH=.local/natural-language-feedback.jsonl`
- Docker now mounts `./.local` into the bot container, so the feedback log survives rebuilds

Messages are logged when:

- no parser can understand the message
- a booking-like message is detected but still misses required fields such as room or time

Review the accumulated cases with:

```bash
npm run review:parser-feedback
```

## 🆕 新功能：凭證管理系統

### Discord 命令

```
/cred-set <username> <password>     # 保存圖書館賬號密碼
/cred-view                          # 查看已保存的賬號（密碼掩蓋）
/cred-delete                        # 刪除已保存的賬號
/book --room 403 ...                # 自動使用保存的賬號進行預約
```

### Web 介面

在 Web 應用中新增「凭證管理」頁面，用戶可以：
- 💾 保存圖書館賬號密碼
- 👁️ 查看已保存的凭證
- 🗑️ 刪除凭證
- 🔄 自動帶入預約表單

### 多人部署

所有運行的 Bot 實例使用同一個 Supabase PostgreSQL 數據庫：
- 👥 多人各自在自己的電腦上運行 Bot 和 Web 服務
- 📦 凭証存儲在 Supabase（免費 1GB）
- 🔄 所有實例自動同步凭證數據
- ✅ 無單點故障，任何實例掉線其他繼續服務

詳細信息見 [DEPLOYMENT.md](./DEPLOYMENT.md)

## Notes

- CAPTCHA is designed to try automatic OCR first, then fall back to manual input.
- If automatic OCR returns a wrong code in Discord mode, the bot keeps the browser session open and asks for a manual CAPTCHA reply.
- Booking sessions are now keyed for web usage so multiple requests can be extended into a session-based flow.
- The frontend is intentionally simple in this phase, but the backend response model already leaves room for a future library-wide room overview.
