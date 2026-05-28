import pg from 'pg';
import { CredentialsEncryption } from './encryption.js';

const { Client } = pg;

function normalizeTimestamp(value) {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp)) {
    throw new Error('Invalid credential timestamp from database');
  }

  return timestamp;
}

export class PostgresDriver {
  constructor(databaseUrl, encryptionKey) {
    this.databaseUrl = databaseUrl;
    this.encryption = new CredentialsEncryption(encryptionKey);
    this.client = null;
  }

  async connect() {
    this.client = new Client({
      connectionString: this.databaseUrl,
    });
    await this.client.connect();
    console.log('Connected to Supabase PostgreSQL');
  }

  async disconnect() {
    if (this.client) {
      await this.client.end();
      console.log('Disconnected from Supabase PostgreSQL');
    }
  }

  async saveCredential(discordId, libraryUsername, plainPassword) {
    if (!this.client) throw new Error('Database not connected');

    const encryptedPassword = this.encryption.encrypt(plainPassword);
    const now = Date.now();

    const result = await this.client.query(
      `INSERT INTO user_credentials (discord_id, library_username, encrypted_password, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (discord_id) 
       DO UPDATE SET library_username = $2, encrypted_password = $3, updated_at = $5
       RETURNING *`,
      [discordId, libraryUsername, encryptedPassword, now, now]
    );

    return result.rows[0];
  }

  async getCredential(discordId) {
    if (!this.client) throw new Error('Database not connected');

    const result = await this.client.query(
      'SELECT * FROM user_credentials WHERE discord_id = $1',
      [discordId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      discordId: row.discord_id,
      libraryUsername: row.library_username,
      plainPassword: this.encryption.decrypt(row.encrypted_password),
      createdAt: normalizeTimestamp(row.created_at),
      updatedAt: normalizeTimestamp(row.updated_at),
    };
  }

  async deleteCredential(discordId) {
    if (!this.client) throw new Error('Database not connected');

    const result = await this.client.query(
      'DELETE FROM user_credentials WHERE discord_id = $1 RETURNING *',
      [discordId]
    );

    return result.rowCount > 0;
  }

  async getAllCredentials() {
    if (!this.client) throw new Error('Database not connected');

    const result = await this.client.query(
      'SELECT discord_id, library_username, created_at, updated_at FROM user_credentials ORDER BY updated_at DESC'
    );

    return result.rows.map(row => ({
      discordId: row.discord_id,
      libraryUsername: row.library_username,
      createdAt: normalizeTimestamp(row.created_at),
      updatedAt: normalizeTimestamp(row.updated_at),
    }));
  }
}
