import app, { initializeCredentialsAPI } from './app.js';
import { CredentialsManager } from '../services/credentials/credentialsManager.js';

const port = Number(process.env.PORT || 3000);

// 初始化 CredentialsManager
let credentialsManager = null;

if (process.env.DATABASE_URL && process.env.CREDENTIALS_ENCRYPTION_KEY) {
  try {
    credentialsManager = new CredentialsManager(
      process.env.DATABASE_URL,
      process.env.CREDENTIALS_ENCRYPTION_KEY
    );
    await credentialsManager.initialize();
    console.log('✅ CredentialsManager initialized with Supabase PostgreSQL');
    initializeCredentialsAPI(app, credentialsManager);
    console.log('✅ Credentials API endpoints registered');
  } catch (error) {
    console.warn('⚠️  CredentialsManager initialization failed:', error.message);
    console.warn('   Credentials API will not be available.');
  }
} else {
  console.warn('⚠️  DATABASE_URL or CREDENTIALS_ENCRYPTION_KEY not set');
  console.warn('   Credentials API will not be available.');
}

app.listen(port, () => {
  console.log(`API server listening on http://localhost:${port}`);
});
