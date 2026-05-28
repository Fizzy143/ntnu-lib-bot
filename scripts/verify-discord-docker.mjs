import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const composeArgs = ['compose', '-f', 'docker-compose.discord.yml'];
const readyPattern = /Discord bot ready:/;
const requiredEnvNames = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID', 'DISCORD_GUILD_ID'];
const snowflakePattern = /^\d{15,25}$/;
const knownFailures = [
  {
    pattern: /Missing required variables:/,
    message: 'Discord required variables are missing from .env. Fill DISCORD_TOKEN, DISCORD_CLIENT_ID, and DISCORD_GUILD_ID first.'
  },
  {
    pattern: /bash\r/,
    message: 'The container is using a CRLF shell script. Rebuild with the latest Dockerfile so docker/discord-entrypoint.sh is normalized to LF.'
  },
  {
    pattern: /The virtual environment was not created successfully/,
    message: 'The image is missing python3-venv. Rebuild with the latest Dockerfile so the OCR virtualenv can be created.'
  }
];

function run(command, args, label) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8'
  });

  if (result.error) {
    console.error(`[fail] ${label}`);
    console.error(result.error.message);
    process.exit(1);
  }

  return {
    status: result.status ?? 1,
    stdout: result.stdout || '',
    stderr: result.stderr || ''
  };
}

function printStreams(result) {
  if (result.stdout.trim()) {
    process.stdout.write(result.stdout);
    if (!result.stdout.endsWith('\n')) {
      process.stdout.write('\n');
    }
  }

  if (result.stderr.trim()) {
    process.stderr.write(result.stderr);
    if (!result.stderr.endsWith('\n')) {
      process.stderr.write('\n');
    }
  }
}

function assertSuccess(result, label) {
  if (result.status === 0) {
    return;
  }

  console.error(`[fail] ${label}`);
  printStreams(result);
  process.exit(result.status || 1);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseDotEnv(path) {
  if (!existsSync(path)) {
    console.error(`[fail] Missing ${path}. Copy .env.discord.example to .env first.`);
    process.exit(1);
  }

  const content = readFileSync(path, 'utf8');
  const values = new Map();

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const index = rawLine.indexOf('=');
    if (index <= 0) {
      continue;
    }

    const key = rawLine.slice(0, index).trim();
    let value = rawLine.slice(index + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values.set(key, value);
  }

  return values;
}

console.log('1. Validating Discord environment...');
const envValues = parseDotEnv('.env');
const missing = requiredEnvNames.filter(name => !String(envValues.get(name) || '').trim());

if (missing.length) {
  console.error(`[fail] Missing required variables: ${missing.join(', ')}`);
  process.exit(1);
}

if (!snowflakePattern.test(String(envValues.get('DISCORD_CLIENT_ID')))) {
  console.error('[fail] DISCORD_CLIENT_ID must be a Discord snowflake numeric ID.');
  process.exit(1);
}

if (!snowflakePattern.test(String(envValues.get('DISCORD_GUILD_ID')))) {
  console.error('[fail] DISCORD_GUILD_ID must be a Discord server snowflake numeric ID.');
  process.exit(1);
}

if (envValues.get('DATABASE_URL') && !envValues.get('CREDENTIALS_ENCRYPTION_KEY')) {
  console.warn('[warn] DATABASE_URL is set but CREDENTIALS_ENCRYPTION_KEY is missing; credential commands may fail.');
}

if (!envValues.get('DATABASE_URL')) {
  console.warn('[warn] DATABASE_URL is not set; credential commands will be unavailable.');
}

console.log('Discord environment looks ready.');

console.log('2. Validating docker compose config...');
const configResult = run('docker', [...composeArgs, 'config', '--quiet'], 'validate docker compose config');
assertSuccess(configResult, 'Docker Compose config is invalid');
console.log('docker compose config looks valid.');

console.log('3. Looking up discord-bot container...');
const containerResult = run('docker', [...composeArgs, 'ps', '-q', 'discord-bot'], 'find discord-bot container');
assertSuccess(containerResult, 'Could not query docker compose containers');

const containerId = containerResult.stdout.trim();
if (!containerId) {
  console.error('[fail] discord-bot container is not running.');
  console.error('Run `npm run discord:docker:up` first, then rerun this verification.');
  process.exit(1);
}

console.log(`Container: ${containerId}`);
console.log('4. Waiting for ready log...');

const deadline = Date.now() + 30000;
let lastLogs = '';

while (Date.now() < deadline) {
  const stateResult = run(
    'docker',
    ['inspect', '-f', '{{.State.Status}}|{{.State.Running}}|{{.State.Restarting}}|{{.RestartCount}}', containerId],
    'inspect container state'
  );
  assertSuccess(stateResult, 'Could not inspect container state');

  const [status, running, restarting, restartCount] = stateResult.stdout.trim().split('|');
  const logsResult = run('docker', ['logs', '--tail', '200', containerId], 'read container logs');
  lastLogs = `${logsResult.stdout}${logsResult.stderr}`;

  for (const failure of knownFailures) {
    if (failure.pattern.test(lastLogs)) {
      console.error(`[fail] ${failure.message}`);
      process.stderr.write(lastLogs);
      process.exit(1);
    }
  }

  if (readyPattern.test(lastLogs)) {
    console.log(`Container state: ${status} (restart count: ${restartCount})`);
    console.log('Discord Docker deployment looks healthy.');
    process.exit(0);
  }

  if (running !== 'true' || restarting === 'true' || status === 'exited' || status === 'dead') {
    console.error(`[fail] Container is not healthy yet: status=${status}, running=${running}, restarting=${restarting}, restartCount=${restartCount}`);
    process.stderr.write(lastLogs);
    process.exit(1);
  }

  await sleep(1500);
}

console.error('[fail] Timed out waiting for `Discord bot ready:` in container logs.');
if (lastLogs.trim()) {
  process.stderr.write(lastLogs);
}
process.exit(1);
