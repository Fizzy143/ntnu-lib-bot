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

6. Verify the deployment:

```powershell
npm run discord:docker:verify
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
npm run discord:docker:verify
npm run discord:docker:logs
npm run discord:docker:down
```

## Updating Docker Deployment

```powershell
git pull
npm run discord:docker:up
npm run discord:docker:verify
```

Docker uses `restart: unless-stopped`, so the bot will restart after failures and after Docker starts again.

## What Verify Checks

`npm run discord:docker:verify` runs four checks:

1. Validates required Discord variables from `.env`
2. Validates `docker-compose.discord.yml`
3. Confirms the `discord-bot` container exists
4. Waits for the `Discord bot ready:` log line and fails fast on common Docker startup errors

This makes it easier to distinguish between "container exists" and "bot is actually connected to Discord".

## Troubleshooting Docker Startup

- If Docker build fails at `python3 -m venv .venv`, rebuild with the latest `Dockerfile.discord`. The image now installs `python3-venv` before creating the OCR virtualenv.
- If logs show `/usr/bin/env: 'bash\r': No such file or directory`, rebuild with the latest files. The Docker image now normalizes `docker/discord-entrypoint.sh` to LF during build, and `.gitattributes` keeps `.sh` files on LF in Git.
- If verify says required variables are missing, run `npm run discord:validate` and fill `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, and `DISCORD_GUILD_ID` in `.env`.

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
