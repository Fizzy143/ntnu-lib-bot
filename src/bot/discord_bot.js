// src/bot/discord_bot.js
import 'dotenv/config';
import { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, AttachmentBuilder } from 'discord.js';
import { bookRoom } from '../usecases/bookRoom.js';
import { checkAvailability } from '../usecases/checkAvailability.js';
import fs from 'fs';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// === Slash Commands ===
const commands = [
  new SlashCommandBuilder()
    .setName('status')
    .setDescription('查詢討論室可借時段')
    .addStringOption(o => o.setName('date').setDescription('日期 YYYY-MM-DD').setRequired(true))
    .addStringOption(o => o.setName('branch').setDescription('館別').setRequired(false)),

  new SlashCommandBuilder()
    .setName('book')
    .setDescription('預約討論室')
    .addStringOption(o => o.setName('room').setDescription('房號').setRequired(true))
    .addStringOption(o => o.setName('date').setDescription('日期').setRequired(true))
    .addStringOption(o => o.setName('start').setDescription('開始時間').setRequired(true))
    .addStringOption(o => o.setName('end').setDescription('結束時間').setRequired(true))
    .addIntegerOption(o => o.setName('people').setDescription('人數').setRequired(false))
    .addStringOption(o => o.setName('branch').setDescription('館別(選填，未填則用預設)').setRequired(false))
    .addStringOption(o => o.setName('username').setDescription('圖書館帳號（選填，未填則用預設）').setRequired(false))
    .addStringOption(o => o.setName('password').setDescription('圖書館密碼（選填，未填則用預設）').setRequired(false))
    .addBooleanOption(o => o.setName('show').setDescription('顯示瀏覽器視窗（debug 用）').setRequired(false))
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
(async () => {
  await rest.put(
    Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID),
    { body: commands }
  );
  console.log('✅ 指令註冊完成');
})();

client.once('clientReady', () => console.log(`🤖 已登入 ${client.user.tag}`));

// === Slash command handlers ===
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'status') {
    const date = interaction.options.getString('date');
    const branch = interaction.options.getString('branch') || process.env.DISCORD_DEFAULT_BRANCH || '公館分館';
    if (!branch) {
      await interaction.reply('⚠️ 未提供館別，請使用 /status 指令時帶上 --branch 參數，或設定預設館別於環境變數 DISCORD_DEFAULT_BRANCH 中。');
      return;
    }
    await interaction.reply(`📅 正在查詢 ${branch} ${date} ...`);

    const result = await checkAvailability({ date, branch });

    if (!result.ok || !result.results?.length) {
      await interaction.followUp(`⚠️ 查無資料或該時段無開放租借。`);
      return;
    }

    // 把 timeline 字串串起來
    const timelines = result.results.map(r => r.timeline).join('\n\n');

    // 美化輸出
    const output = `=== ${branch} — ${date} ===\n${timelines}`;

    await interaction.followUp(`\`\`\`\n${output}\n\`\`\``);
  }

  if (commandName === 'book') {
    const room = interaction.options.getString('room');
    const date = interaction.options.getString('date');
    const start = interaction.options.getString('start');
    const end = interaction.options.getString('end');
    const people = interaction.options.getInteger('people');
    const branch = interaction.options.getString('branch') || process.env.DISCORD_DEFAULT_BRANCH || '公館分館';
    if (!branch) {
      await interaction.reply('⚠️ 未提供館別，請使用 /book 指令時帶上 --branch 參數，或設定預設館別於環境變數 DISCORD_DEFAULT_BRANCH 中。');
      return;
    }

    // 使用者輸入的帳密（若有）；否則從 .env 讀取預設值
    const username = interaction.options.getString('username') || process.env.USERNAME;
    const password = interaction.options.getString('password') || process.env.PASSWORD;
    
    // 檢查是否有帳密可用
    if (!username || !password) {
      await interaction.reply('⚠️ 未提供帳密，且管理員也未設定預設帳密（USERNAME / PASSWORD）。');
      return;
    }
    const show = interaction.options.getBoolean('show') || process.env.DISCORD_SHOW;


    await interaction.reply(`📝 嘗試預約 ${branch} ${room}，${date} ${start}-${end} ...`);

    // 呼叫核心預約邏輯
    const result = await bookRoom({
      branch,
      roomKeyword: room,
      date,
      start,
      end,
      people,
      username,
      password,
      show
    });

    if (result.captchaPath) {
      const file = new AttachmentBuilder(result.captchaPath);
      await interaction.followUp({
        content: `🧩 請輸入驗證碼（回覆這則訊息即可）`,
        files: [file]
      });

      // 等待使用者輸入
      const channel = interaction.channel || (await client.channels.fetch(interaction.channelId).catch(() => null));
      if (!channel) return interaction.followUp('⚠️ 無法開啟訊息收集器。');

      try {
        const collected = await channel.awaitMessages({
          filter: m => m.author.id === interaction.user.id,
          max: 1,
          time: 60000,
          errors: ['time']
        });

        const msg = collected.first();
        const captchaCode = msg.content.trim();

        // 第二次呼叫時也要帶上帳密
        const retry = await bookRoom({
          ...result.pendingParams,
          username,
          password,
          captchaCode,
          show
        });

        if (retry.ok) await msg.reply('✅ 預約成功！');
        else await msg.reply(`⚠️ 預約失敗：${retry.reason || retry.message}`);
      } catch {
        await channel.send('⌛ 驗證碼等待逾時，請重新輸入 `/book` 指令再試。');
      }
    } else if (result.ok) {
      await interaction.followUp('✅ 預約成功！');
    } else {
      await interaction.followUp(`⚠️ 結果：${JSON.stringify(result, null, 2)}`);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);