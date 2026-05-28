import 'dotenv/config';
import {
  AttachmentBuilder,
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder
} from 'discord.js';
import { randomUUID } from 'crypto';
import { bookRoom } from '../usecases/bookRoom.js';
import { checkAvailability } from '../usecases/checkAvailability.js';
import { normalizeBranchName } from '../shared/branches.js';
import {
  buildIntentSummary,
  getTaipeiToday,
  parseLibraryMessage
} from './naturalLanguage.js';
import { CredentialsManager } from '../services/credentials/credentialsManager.js';
import {
  setupCredCommands,
  handleCredSet,
  handleCredView,
  handleCredDelete
} from './commands/credentialCommands.js';

const defaultBranch = normalizeBranchName(process.env.DISCORD_DEFAULT_BRANCH)
  || normalizeBranchName(process.env.DEFAULT_BRANCH)
  || '總館';
const pendingActions = new Map();
const pendingCaptchas = new Map();

let credentialsManager = null;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const baseCommands = [
  new SlashCommandBuilder()
    .setName('status')
    .setDescription('查詢圖書館討論室房況')
    .addStringOption(option => option.setName('date').setDescription('日期 YYYY-MM-DD').setRequired(false))
    .addStringOption(option => option.setName('branch').setDescription('館別').setRequired(false))
    .addStringOption(option => option.setName('room').setDescription('房間關鍵字').setRequired(false)),
  new SlashCommandBuilder()
    .setName('book')
    .setDescription('預約圖書館討論室')
    .addStringOption(option => option.setName('room').setDescription('房間，例如 403').setRequired(true))
    .addStringOption(option => option.setName('start').setDescription('開始時間，例如 18:30').setRequired(true))
    .addStringOption(option => option.setName('end').setDescription('結束時間，例如 20:30').setRequired(true))
    .addStringOption(option => option.setName('date').setDescription('日期 YYYY-MM-DD').setRequired(false))
    .addIntegerOption(option => option.setName('people').setDescription('人數').setRequired(false))
    .addStringOption(option => option.setName('branch').setDescription('館別').setRequired(false))
    .addStringOption(option => option.setName('username').setDescription('圖書館帳號').setRequired(false))
    .addStringOption(option => option.setName('password').setDescription('圖書館密碼').setRequired(false))
    .addBooleanOption(option => option.setName('show').setDescription('顯示瀏覽器視窗').setRequired(false))
].map(command => command.toJSON());

let credCommands = [];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

async function registerCommands() {
  if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_GUILD_ID) {
    console.warn('Discord command registration skipped: missing DISCORD_CLIENT_ID or DISCORD_GUILD_ID');
    return;
  }

  const allCommands = [...baseCommands, ...credCommands];
  await rest.put(
    Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID),
    { body: allCommands }
  );
  console.log('Discord slash commands registered');
}

function formatAvailability(result) {
  if (!result.ok) {
    return `查詢失敗：${result.error || '未知錯誤'}`;
  }

  if (!result.results?.length) {
    return `${result.branch} ${result.date} 沒有符合條件的房間資料。`;
  }

  const lines = [`${result.branch} ${result.date}`];
  for (const room of result.results) {
    const free = room.blocks
      .filter(block => block.type === 'FREE')
      .map(block => `${block.start}-${block.end}`);
    const busy = room.blocks
      .filter(block => block.type === 'BUSY')
      .map(block => `${block.start}-${block.end}`);

    lines.push('');
    lines.push(room.room);
    if (free.length) {
      lines.push(`可用：${free.join('、')}`);
    }
    if (busy.length) {
      lines.push(`已預約：${busy.join('、')}`);
    }
  }

  return lines.join('\n');
}

function requireCredentials() {
  return {
    username: process.env.LIBRARY_USERNAME || process.env.LIB_USERNAME || process.env.NTNU_USERNAME || process.env.USERNAME || '',
    password: process.env.LIBRARY_PASSWORD || process.env.LIB_PASSWORD || process.env.NTNU_PASSWORD || process.env.PASSWORD || ''
  };
}

function getDiscordShowDefault() {
  return String(process.env.DISCORD_SHOW || '').toLowerCase() === 'true';
}

async function resolveDiscordBookingCredentials(userId, optionUsername, optionPassword) {
  const explicitUsername = optionUsername || '';
  const explicitPassword = optionPassword || '';

  if (explicitUsername && explicitPassword) {
    return { username: explicitUsername, password: explicitPassword };
  }

  if (explicitUsername || explicitPassword) {
    return { username: explicitUsername, password: explicitPassword };
  }

  if (credentialsManager) {
    try {
      const saved = await credentialsManager.getCredential(userId);
      if (saved) {
        return {
          username: saved.libraryUsername,
          password: saved.plainPassword
        };
      }
    } catch (error) {
      console.warn('[discord credentials] Failed to load saved credentials:', error.message);
    }
  }

  return requireCredentials();
}

async function sendCaptchaChallenge(channel, userId, result, { username, password, sessionKey }) {
  pendingCaptchas.set(userId, { username, password, sessionKey });
  const file = new AttachmentBuilder(result.captchaPath);
  await channel.send({
    content: result.reason
      ? `驗證碼需要手動確認：${result.reason}\n請直接回覆這張圖片的驗證碼。`
      : '自動辨識未完成，請直接回覆這張圖片的驗證碼。',
    files: [file]
  });
}

async function performBooking({
  channel,
  reply,
  userId,
  branch,
  room,
  date,
  start,
  end,
  people,
  username,
  password,
  show = false,
  sessionKey
}) {
  await reply(`開始預約：${branch} ${room} ${date} ${start}-${end}`);

  const result = await bookRoom({
    branch,
    roomKeyword: room,
    date,
    start,
    end,
    people,
    username,
    password,
    show,
    manualCaptchaFallback: true,
    sessionKey
  });

  if (result.code === 'captcha_needed' && result.captchaPath) {
    await sendCaptchaChallenge(channel, userId, result, { username, password, sessionKey });
    return;
  }

  if (result.ok) {
    await reply('預約成功。');
  } else {
    await reply(`預約失敗：${result.reason || result.message || '未知錯誤'}`);
  }
}

async function handleSlashStatus(interaction) {
  const date = interaction.options.getString('date') || getTaipeiToday();
  const branch = normalizeBranchName(interaction.options.getString('branch')) || defaultBranch;
  const room = interaction.options.getString('room') || '';

  await interaction.reply(`查詢中：${branch} ${date}`);
  const result = await checkAvailability({ date, branch, room });
  await interaction.followUp(`\`\`\`\n${formatAvailability(result)}\n\`\`\``);
}

async function handleSlashBook(interaction) {
  const { username: account, password: secret } = await resolveDiscordBookingCredentials(
    interaction.user.id,
    interaction.options.getString('username'),
    interaction.options.getString('password')
  );

  if (!account || !secret) {
    await interaction.followUp('缺少圖書館帳號或密碼。請先使用 /cred-set 保存，或在 /book 指令中提供 username 與 password。');
    return;
  }

  const booking = {
    branch: normalizeBranchName(interaction.options.getString('branch')) || defaultBranch,
    room: interaction.options.getString('room'),
    date: interaction.options.getString('date') || getTaipeiToday(),
    start: interaction.options.getString('start'),
    end: interaction.options.getString('end'),
    people: interaction.options.getInteger('people') || 2,
    username: account,
    password: secret,
    show: interaction.options.getBoolean('show') ?? getDiscordShowDefault(),
    sessionKey: `slash:${interaction.user.id}:${randomUUID()}`
  };

  await performBooking({
    channel: interaction.channel,
    reply: message => interaction.followUp(message),
    userId: interaction.user.id,
    ...booking
  });
}

async function handleNaturalLanguageMessage(message) {
  if (message.author.bot) {
    return;
  }

  const content = message.content.trim();
  const confirmKey = `confirm:${message.author.id}`;
  const captchaState = pendingCaptchas.get(message.author.id);

  if (captchaState) {
    pendingCaptchas.delete(message.author.id);
    const result = await bookRoom({
      captchaCode: content,
      username: captchaState.username,
      password: captchaState.password,
      sessionKey: captchaState.sessionKey
    });

    if (result.code === 'captcha_needed' && result.captchaPath) {
      await sendCaptchaChallenge(message.channel, message.author.id, result, captchaState);
      return;
    }

    await message.reply(result.ok
      ? '驗證碼送出成功，預約已完成。'
      : `驗證碼送出後仍失敗：${result.reason || result.message || '未知錯誤'}`
    );
    return;
  }

  if (isConfirmationMessage(content) && pendingActions.has(confirmKey)) {
    const pending = pendingActions.get(confirmKey);
    pendingActions.delete(confirmKey);
    await performBooking({
      channel: message.channel,
      reply: text => message.reply(text),
      userId: message.author.id,
      ...pending
    });
    return;
  }

  const parsed = parseLibraryMessage(content);
  if (!parsed) {
    return;
  }

  if (parsed.intent === 'status') {
    const result = await checkAvailability({
      date: parsed.date || getTaipeiToday(),
      branch: normalizeBranchName(parsed.branch) || defaultBranch,
      room: parsed.room || ''
    });
    await message.reply(`\`\`\`\n${formatAvailability(result)}\n\`\`\``);
    return;
  }

  const { username, password } = await resolveDiscordBookingCredentials(message.author.id);
  if (!username || !password) {
    await message.reply('缺少圖書館帳號或密碼。請先使用 /cred-set 保存，再重新送出預約訊息。');
    return;
  }

  if (!parsed.room || !parsed.start || !parsed.end) {
    await message.reply(`我目前理解成：${buildIntentSummary(parsed)}。\n但預約還缺少房間或時間，請補充後再試一次。`);
    return;
  }

  const booking = {
    branch: normalizeBranchName(parsed.branch) || defaultBranch,
    room: parsed.room,
    date: parsed.date || getTaipeiToday(),
    start: parsed.start,
    end: parsed.end,
    people: parsed.people || 2,
    username,
    password,
    show: getDiscordShowDefault(),
    sessionKey: message.author.id
  };

  pendingActions.set(confirmKey, booking);
  await message.reply(
    `我理解成：${buildIntentSummary({
      ...parsed,
      branch: booking.branch,
      date: booking.date,
      people: booking.people
    })}。\n如果要送出預約，請直接回覆「確認」。`
  );
}

function isConfirmationMessage(content) {
  return /^(確認|確定|好|可以|送出|ok|okay|yes|y)$/i.test(String(content || '').trim());
}

client.once('clientReady', () => {
  console.log(`Discord bot ready: ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) {
    return;
  }

  try {
    if (interaction.commandName === 'status') {
      await handleSlashStatus(interaction);
      return;
    }

    if (interaction.commandName === 'book') {
      await interaction.reply('收到預約指令，準備處理...');
      await handleSlashBook(interaction);
      return;
    }

    if (credentialsManager) {
      if (interaction.commandName === 'cred-set') {
        await handleCredSet(interaction, credentialsManager);
        return;
      }

      if (interaction.commandName === 'cred-view') {
        await handleCredView(interaction, credentialsManager);
        return;
      }

      if (interaction.commandName === 'cred-delete') {
        await handleCredDelete(interaction, credentialsManager);
        return;
      }
    }
  } catch (error) {
    console.error('[discord interaction error]', error);
    const text = '處理指令時發生錯誤。';
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(text);
    } else {
      await interaction.reply(text);
    }
  }
});

client.on('messageCreate', async message => {
  try {
    await handleNaturalLanguageMessage(message);
  } catch (error) {
    console.error('[discord message error]', error);
    await message.reply('處理訊息時發生錯誤，請再試一次。');
  }
});

if (!process.env.DISCORD_TOKEN) {
  console.warn('Discord bot not started: missing DISCORD_TOKEN');
} else {
  // 初始化 CredentialsManager
  if (process.env.DATABASE_URL && process.env.CREDENTIALS_ENCRYPTION_KEY) {
    try {
      const manager = new CredentialsManager(
        process.env.DATABASE_URL,
        process.env.CREDENTIALS_ENCRYPTION_KEY
      );
      await manager.initialize();
      credentialsManager = manager;
      console.log('✅ CredentialsManager initialized with Supabase PostgreSQL');
      
      credCommands = await setupCredCommands(credentialsManager);
    } catch (error) {
      credentialsManager = null;
      credCommands = [];
      console.warn('⚠️  CredentialsManager initialization failed:', error.message);
      console.warn('   Credential commands will not be available. Falling back to .env booking credentials.');
    }
  } else {
    console.warn('⚠️  DATABASE_URL or CREDENTIALS_ENCRYPTION_KEY not set');
    console.warn('   Credential commands will not be available. Falling back to .env booking credentials.');
  }

  await registerCommands();
  await client.login(process.env.DISCORD_TOKEN);
}
