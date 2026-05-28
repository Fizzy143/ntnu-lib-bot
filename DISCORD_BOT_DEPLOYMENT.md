# Discord Bot Deployment

This guide is for deploying the Discord bot on a computer that stays online for long periods.

For a shared or public computer, prefer Docker Compose. It keeps Node.js, Python, Playwright, and Chromium isolated from the host system.

## Recommended: Docker Compose

Install Docker Desktop or Docker Engine first.

1. Clone the repository.
2. Copy the environment template:

```powershell
copy .env.discord.example .env
```

3. Fill the required values in `.env`:

```env
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_GUILD_ID=
```

4. Optional: fill these if you want `/cred-set`, `/cred-view`, and `/cred-delete`:

```env
DATABASE_URL=
CREDENTIALS_ENCRYPTION_KEY=
```

5. Build and start the bot:

```powershell
docker compose -f docker-compose.discord.yml up -d --build
```

Useful commands:

```powershell
docker compose -f docker-compose.discord.yml logs -f discord-bot
docker compose -f docker-compose.discord.yml restart discord-bot
docker compose -f docker-compose.discord.yml down
```

Equivalent npm shortcuts:

```bash
npm run discord:docker:build
npm run discord:docker:up
npm run discord:docker:logs
npm run discord:docker:down
```

## Updating Docker Deployment

```powershell
git pull
docker compose -f docker-compose.discord.yml up -d --build
```

Docker uses `restart: unless-stopped`, so the bot will restart after failures and after Docker starts again.

## Security Notes For Shared Computers

- `.env` is ignored by Git and must never be committed.
- Anyone with administrator access, filesystem access to `.env`, or Docker access may be able to read secrets.
- Store the project in a user-owned folder when possible.
- Restrict `.env` file permissions if the machine is shared.
- Rotate `DISCORD_TOKEN` if it was ever pasted into chat, committed, or exposed.
- `DISCORD_CLIENT_ID` and `DISCORD_GUILD_ID` must be numeric Discord snowflake IDs, not app names.

## Fallback: One-click Windows Install

Use this only when Docker is not available.

1. Install Node.js 20+ or 24+.
2. Clone the repository.
3. Double-click `install-discord-bot-windows.cmd`.
4. Paste the required Discord values when prompted.

The Windows installer will:

- Create `.env` from `.env.discord.example` if needed.
- Install Node dependencies.
- Install Playwright Chromium for booking automation.
- Create a Python virtual environment for optional CAPTCHA solving when Python is available.
- Validate Discord environment variables.
- Register a Windows Scheduled Task named `NTNU Library Discord Bot`.
- Start the bot immediately.

Windows runtime logs are written to:

```text
logs\discord-bot.log
```

Manual Windows start:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\run-discord-forever.ps1
```

Validate `.env` only:

```bash
npm run discord:validate
```
