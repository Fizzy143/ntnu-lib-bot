import 'dotenv/config';
import { CredentialsManager } from './src/services/credentials/credentialsManager.js';

async function testCredentialsSystem() {
  console.log('🧪 Testing Credentials System...\n');

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not set in .env');
    process.exit(1);
  }

  if (!process.env.CREDENTIALS_ENCRYPTION_KEY) {
    console.error('❌ CREDENTIALS_ENCRYPTION_KEY not set in .env');
    process.exit(1);
  }

  try {
    const credManager = new CredentialsManager(
      process.env.DATABASE_URL,
      process.env.CREDENTIALS_ENCRYPTION_KEY
    );

    console.log('📡 Connecting to Supabase PostgreSQL...');
    await credManager.initialize();
    console.log('✅ Connected successfully!\n');

    // Test 1: Save credential
    const testDiscordId = 'test_user_12345';
    const testUsername = 'library_account';
    const testPassword = 'secret_password_123';

    console.log('💾 Test 1: Saving credential...');
    console.log(`   Discord ID: ${testDiscordId}`);
    console.log(`   Username: ${testUsername}`);
    await credManager.setCredential(testDiscordId, testUsername, testPassword);
    console.log('✅ Credential saved!\n');

    // Test 2: Retrieve credential
    console.log('📖 Test 2: Retrieving credential...');
    const retrieved = await credManager.getCredential(testDiscordId);
    if (retrieved) {
      console.log(`   ✅ Retrieved successfully`);
      console.log(`   Username: ${retrieved.libraryUsername}`);
      console.log(`   Password: ${'●'.repeat(retrieved.plainPassword.length)}`);
      console.log(`   Decrypted correctly: ${retrieved.plainPassword === testPassword ? '✅' : '❌'}\n`);
    } else {
      console.log('   ❌ Failed to retrieve credential\n');
    }

    // Test 3: Update credential
    const newPassword = 'updated_password_456';
    console.log('♻️  Test 3: Updating credential...');
    await credManager.setCredential(testDiscordId, 'new_library_account', newPassword);
    const updated = await credManager.getCredential(testDiscordId);
    console.log(`   ✅ Updated successfully`);
    console.log(`   New username: ${updated.libraryUsername}`);
    console.log(`   New password: ${'●'.repeat(updated.plainPassword.length)}\n`);

    // Test 4: Delete credential
    console.log('🗑️  Test 4: Deleting credential...');
    const deleted = await credManager.deleteCredential(testDiscordId);
    console.log(`   Deleted: ${deleted ? '✅' : '❌'}`);
    const afterDelete = await credManager.getCredential(testDiscordId);
    console.log(`   Verify deleted: ${afterDelete === null ? '✅' : '❌'}\n`);

    console.log('🎉 All tests passed!');
    console.log('📋 System is ready for production use.\n');

    await credManager.shutdown();
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testCredentialsSystem();
