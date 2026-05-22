import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { CredentialsManager } from '../../services/credentials/credentialsManager.js';

export async function setupCredCommands(credentialsManager) {
  const commands = [
    new SlashCommandBuilder()
      .setName('cred-set')
      .setDescription('💾 保存圖書館帳號密碼')
      .addStringOption(option =>
        option.setName('username').setDescription('圖書館帳號').setRequired(true)
      )
      .addStringOption(option =>
        option.setName('password').setDescription('圖書館密碼').setRequired(true)
      ),
    
    new SlashCommandBuilder()
      .setName('cred-view')
      .setDescription('👁️ 查看已保存的圖書館帳號'),
    
    new SlashCommandBuilder()
      .setName('cred-delete')
      .setDescription('🗑️ 刪除已保存的圖書館帳號'),
  ];

  return commands.map(cmd => cmd.toJSON());
}

export async function handleCredSet(interaction, credentialsManager) {
  const username = interaction.options.getString('username');
  const password = interaction.options.getString('password');
  const discordId = interaction.user.id;

  try {
    await interaction.deferReply({ ephemeral: true });

    await credentialsManager.setCredential(discordId, username, password);

    const embed = new EmbedBuilder()
      .setColor('#00aa00')
      .setTitle('✅ 帳號已保存')
      .setDescription(`圖書館帳號已加密保存。今後使用 \`/book\` 時會自動帶入此帳號。`)
      .addFields(
        { name: '帳號', value: username, inline: true },
        { name: '加密狀態', value: '已使用 AES-256 加密', inline: true }
      )
      .setFooter({ text: '使用 /cred-delete 刪除帳號' });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error saving credentials:', error);
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('❌ 保存失敗')
          .setDescription(`${error.message || '未知錯誤'}`)
      ]
    });
  }
}

export async function handleCredView(interaction, credentialsManager) {
  const discordId = interaction.user.id;

  try {
    await interaction.deferReply({ ephemeral: true });

    const credential = await credentialsManager.getCredential(discordId);

    if (!credential) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor('#ffaa00')
            .setTitle('⚠️ 未保存帳號')
            .setDescription('你還沒有保存圖書館帳號。使用 `/cred-set` 保存。')
        ]
      });
      return;
    }

    const savedDate = new Date(credential.createdAt).toLocaleString('zh-TW');
    const updatedDate = new Date(credential.updatedAt).toLocaleString('zh-TW');

    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('📋 已保存的帳號')
      .addFields(
        { name: '帳號', value: credential.libraryUsername, inline: true },
        { name: '密碼', value: '●'.repeat(credential.plainPassword.length), inline: true },
        { name: '保存時間', value: savedDate },
        { name: '更新時間', value: updatedDate }
      )
      .setFooter({ text: '密碼已加密存儲' });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error viewing credentials:', error);
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('❌ 查詢失敗')
          .setDescription(`${error.message || '未知錯誤'}`)
      ]
    });
  }
}

export async function handleCredDelete(interaction, credentialsManager) {
  const discordId = interaction.user.id;

  try {
    await interaction.deferReply({ ephemeral: true });

    const hasCredential = await credentialsManager.hasCredential(discordId);

    if (!hasCredential) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor('#ffaa00')
            .setTitle('⚠️ 沒有保存的帳號')
            .setDescription('你還沒有保存圖書館帳號。')
        ]
      });
      return;
    }

    await credentialsManager.deleteCredential(discordId);

    const embed = new EmbedBuilder()
      .setColor('#ff6600')
      .setTitle('🗑️ 帳號已刪除')
      .setDescription('圖書館帳號已從數據庫中刪除。');

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error deleting credentials:', error);
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('❌ 刪除失敗')
          .setDescription(`${error.message || '未知錯誤'}`)
      ]
    });
  }
}
