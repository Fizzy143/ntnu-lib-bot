import 'dotenv/config';
import { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, EmbedBuilder } from 'discord.js';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// --- 定義 Slash 指令 ---
const commands = [
  new SlashCommandBuilder()
    .setName('status')
    .setDescription('查詢討論室可借時段')
    .addStringOption(o => o.setName('date').setDescription('日期 (YYYY-MM-DD)').setRequired(true))
    .addStringOption(o => o.setName('branch').setDescription('館別').setRequired(true)),

  new SlashCommandBuilder()
    .setName('book')
    .setDescription('預約討論室')
    .addStringOption(o => o.setName('branch').setDescription('館別').setRequired(true))
    .addStringOption(o => o.setName('room').setDescription('房間編號').setRequired(true))
    .addStringOption(o => o.setName('date').setDescription('日期 (YYYY-MM-DD)').setRequired(true))
    .addStringOption(o => o.setName('start').setDescription('開始時間').setRequired(true))
    .addStringOption(o => o.setName('end').setDescription('結束時間').setRequired(true))
    .addStringOption(o => o.setName('people').setDescription('人數').setRequired(true))
];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 載入正確路徑的 .env 檔案
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

// --- 註冊 Slash Commands ---
(async () => {
  try {
    console.log('🌀 正在註冊 Discord 指令...');
    await rest.put(
      Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID),
      { body: commands }
    );
    console.log('✅ 指令註冊完成');
  } catch (error) {
    console.error(error);
  }
})();

// --- Bot 啟動 ---
client.once('ready', () => {
  console.log(`🤖 已登入：${client.user.tag}`);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'status') {
    const date = interaction.options.getString('date');
    const branch = interaction.options.getString('branch');
    await interaction.reply(`📅 正在查詢 ${branch} ${date} 的可借時段...`);

    exec(`node status_cli.js --date ${date} --branch ${branch}`, (err, stdout, stderr) => {
      if (err) {
        interaction.followUp('❌ 查詢失敗，請稍後再試。');
        return;
      }
      interaction.followUp(`\`\`\`\n${stdout}\n\`\`\``);
    });
  }

  if (commandName === 'book') {
    const branch = interaction.options.getString('branch');
    const room = interaction.options.getString('room');
    const date = interaction.options.getString('date');
    const start = interaction.options.getString('start');
    const end = interaction.options.getString('end');
    const people = interaction.options.getString('people');

    await interaction.reply(`📝 開始預約 ${branch} ${room}，${date} ${start}-${end} (${people}人)...`);

    const processCmd = `node book_cli.js --branch ${branch} --room ${room} --date ${date} --start ${start} --end ${end} --people ${people}`;
    exec(processCmd, async (err, stdout, stderr) => {
      if (fs.existsSync('captcha.png')) {
        await interaction.followUp({
          content: '🧩 這是驗證碼，請在10秒內輸入：',
          files: ['captcha.png']
        });
      }
      if (stdout.includes('Booking success')) {
        await interaction.followUp('✅ 預約成功！');
      } else {
        await interaction.followUp(`⚠️ 結果：\n\`\`\`\n${stdout}\n\`\`\``);
      }
    });
  }
});

client.login(process.env.DISCORD_TOKEN);
