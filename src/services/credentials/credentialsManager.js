import { PostgresDriver } from './postgresDriver.js';

export class CredentialsManager {
  constructor(databaseUrl, encryptionKey) {
    this.driver = new PostgresDriver(databaseUrl, encryptionKey);
  }

  async initialize() {
    await this.driver.connect();
  }

  async shutdown() {
    await this.driver.disconnect();
  }

  async setCredential(discordId, libraryUsername, plainPassword) {
    if (!discordId || !libraryUsername || !plainPassword) {
      throw new Error('discordId, libraryUsername, and plainPassword are required');
    }

    return await this.driver.saveCredential(discordId, libraryUsername, plainPassword);
  }

  async getCredential(discordId) {
    if (!discordId) {
      throw new Error('discordId is required');
    }

    return await this.driver.getCredential(discordId);
  }

  async deleteCredential(discordId) {
    if (!discordId) {
      throw new Error('discordId is required');
    }

    return await this.driver.deleteCredential(discordId);
  }

  async getAllCredentials() {
    return await this.driver.getAllCredentials();
  }

  async hasCredential(discordId) {
    const cred = await this.getCredential(discordId);
    return cred !== null;
  }
}
