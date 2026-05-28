import { existsSync, readFileSync } from 'node:fs';

function loadDotEnv(path = '.env') {
  if (!existsSync(path)) {
    return;
  }

  const content = readFileSync(path, 'utf8');

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
    if (process.env[key]) {
      continue;
    }

    let value = rawLine.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadDotEnv();

const required = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID', 'DISCORD_GUILD_ID'];
const missing = required.filter(name => !String(process.env[name] || '').trim());
const errors = [];
const warnings = [];
const snowflakePattern = /^\d{15,25}$/;

if (missing.length) {
  errors.push(`Missing required variables: ${missing.join(', ')}`);
}

if (process.env.DISCORD_CLIENT_ID && !snowflakePattern.test(process.env.DISCORD_CLIENT_ID)) {
  errors.push('DISCORD_CLIENT_ID must be a Discord snowflake numeric ID.');
}

if (process.env.DISCORD_GUILD_ID && !snowflakePattern.test(process.env.DISCORD_GUILD_ID)) {
  errors.push('DISCORD_GUILD_ID must be a Discord server snowflake numeric ID.');
}

if (process.env.DATABASE_URL && !process.env.CREDENTIALS_ENCRYPTION_KEY) {
  warnings.push('DATABASE_URL is set but CREDENTIALS_ENCRYPTION_KEY is missing; credential commands will be disabled or fail.');
}

if (!process.env.DATABASE_URL) {
  warnings.push('DATABASE_URL is not set; /cred-set, /cred-view, and /cred-delete will be unavailable.');
}

for (const warning of warnings) {
  console.warn(`[warn] ${warning}`);
}

if (errors.length) {
  for (const error of errors) {
    console.error(`[error] ${error}`);
  }
  process.exit(1);
}

console.log('Discord environment looks ready.');
