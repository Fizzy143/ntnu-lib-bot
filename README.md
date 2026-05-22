# NTNU Library Bot

NTNU Library Bot is evolving from a CLI and Discord automation project into an online booking service with a Vue frontend and a Node.js API backend.

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

On Windows, prefer `LIBRARY_USERNAME` and `LIBRARY_PASSWORD` instead of `USERNAME` because `USERNAME` is often already set by the operating system.

## Commands

Install backend dependencies:

```bash
npm install
```

Install frontend dependencies:

```bash
npm --prefix frontend install
```

Run the API server:

```bash
npm run server
```

Run the Vue frontend in development:

```bash
npm run frontend:dev
```

Build the Vue frontend:

```bash
npm run frontend:build
```

Existing tools:

```bash
npm run status -- --date 2026-05-22 --branch 總館 --room 304
npm run book -- --branch 公館分館 --room 403 --date 2026-05-22 --start 18:30 --end 20:30 --people 4 --show
npm run discord
```

For local CAPTCHA OCR, create a project virtual environment and install the Python dependency:

```bash
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Set `PYTHON_CMD=.venv\Scripts\python.exe` in `.env`.

If you want to watch the browser automation locally while testing Discord bookings, set `DISCORD_SHOW=true` in `.env` or pass `show=true` in the `/book` slash command.

## Notes

- CAPTCHA is designed to try automatic OCR first, then fall back to manual input.
- If automatic OCR returns a wrong code in Discord mode, the bot keeps the browser session open and asks for a manual CAPTCHA reply.
- Booking sessions are now keyed for web usage so multiple requests can be extended into a session-based flow.
- The frontend is intentionally simple in this phase, but the backend response model already leaves room for a future library-wide room overview.
