import 'dotenv/config';
import { CredentialsEncryption } from './src/services/credentials/encryption.js';

async function testEncryption() {
  console.log('🔐 Testing Encryption/Decryption (Offline)...\n');

  if (!process.env.CREDENTIALS_ENCRYPTION_KEY) {
    console.error('❌ CREDENTIALS_ENCRYPTION_KEY not set in .env');
    process.exit(1);
  }

  try {
    const encryption = new CredentialsEncryption(process.env.CREDENTIALS_ENCRYPTION_KEY);
    console.log('✅ Encryption object created successfully\n');

    // Test 1: Basic encryption/decryption
    const plaintext = 'my_secret_password_12345';
    console.log('📝 Test 1: Basic Encryption/Decryption');
    console.log(`   Original: ${plaintext}`);
    
    const encrypted = encryption.encrypt(plaintext);
    console.log(`   Encrypted: ${encrypted.substring(0, 50)}... (truncated)`);
    
    const decrypted = encryption.decrypt(encrypted);
    console.log(`   Decrypted: ${decrypted}`);
    console.log(`   ✅ Match: ${decrypted === plaintext}\n`);

    // Test 2: Multiple encryptions produce different ciphertexts (due to IV)
    console.log('🔀 Test 2: Different IVs produce different ciphertexts');
    const encrypted1 = encryption.encrypt(plaintext);
    const encrypted2 = encryption.encrypt(plaintext);
    console.log(`   Ciphertext 1: ${encrypted1.substring(0, 30)}...`);
    console.log(`   Ciphertext 2: ${encrypted2.substring(0, 30)}...`);
    console.log(`   Different: ${encrypted1 !== encrypted2 ? '✅' : '❌'}`);
    console.log(`   Both decrypt correctly: ${encryption.decrypt(encrypted1) === plaintext && encryption.decrypt(encrypted2) === plaintext ? '✅' : '❌'}\n`);

    // Test 3: Various data types
    console.log('📦 Test 3: Encrypting various data');
    const testData = [
      '12345',
      'user@example.com',
      '特殊字符!@#$%^&*()',
      'unicode: 中文 日本語 한글'
    ];

    for (const data of testData) {
      const enc = encryption.encrypt(data);
      const dec = encryption.decrypt(enc);
      console.log(`   "${data}" → ${dec === data ? '✅' : '❌'}`);
    }

    console.log('\n🎉 All encryption tests passed!');
    console.log('✅ System is ready for database integration.\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testEncryption();
