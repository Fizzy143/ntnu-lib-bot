import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 創建 components 目錄
const componentsDir = path.join(__dirname, 'frontend', 'src', 'components');
if (!fs.existsSync(componentsDir)) {
  fs.mkdirSync(componentsDir, { recursive: true });
  console.log('✅ Created components directory');
}

// 創建 CredentialsManager.vue 組件
const credentialsManagerContent = `<template>
  <div class="credentials-container">
    <h2>💾 圖書館帳號管理</h2>
    
    <div class="credentials-status">
      <div v-if="hasCredential" class="credential-info">
        <p>✅ 已保存的帳號：<strong>{{ credential.username }}</strong></p>
        <p class="small-text">更新時間：{{ formatDate(credential.updatedAt) }}</p>
      </div>
      <div v-else class="no-credential">
        <p>❌ 未保存任何帳號</p>
      </div>
    </div>

    <div class="credentials-form">
      <h3>{{ hasCredential ? '更新帳號' : '保存新帳號' }}</h3>
      
      <div class="form-group">
        <label for="username">圖書館帳號</label>
        <input
          id="username"
          v-model="form.username"
          type="text"
          placeholder="例如：41347033S"
          :disabled="loading"
        />
      </div>

      <div class="form-group">
        <label for="password">圖書館密碼</label>
        <input
          id="password"
          v-model="form.password"
          type="password"
          placeholder="密碼"
          :disabled="loading"
        />
      </div>

      <div class="button-group">
        <button @click="saveCredential" :disabled="loading || !form.username || !form.password">
          {{ loading ? '處理中...' : '保存帳號' }}
        </button>
        <button 
          v-if="hasCredential"
          @click="deleteCredential" 
          :disabled="loading" 
          class="delete-btn"
        >
          {{ loading ? '處理中...' : '刪除帳號' }}
        </button>
      </div>

      <div v-if="message" :class="['message', messageType]">
        {{ message }}
      </div>
    </div>

    <div class="credentials-note">
      <p>🔒 <strong>安全提示：</strong></p>
      <ul>
        <li>您的密碼使用 AES-256 加密存儲在服務器上</li>
        <li>建議使用專用帳號，不要使用高價值帳戶</li>
        <li>刪除帳號後無法恢復，請謹慎操作</li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { getCredential, saveCredential as apiSaveCredential, deleteCredential as apiDeleteCredential } from '../api';

const loading = ref(false);
const message = ref('');
const messageType = ref('');
const hasCredential = ref(false);
const credential = ref({ username: '', updatedAt: '' });

const form = reactive({
  username: '',
  password: ''
});

const formatDate = (timestamp) => {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleString('zh-TW');
};

const showMessage = (msg, type = 'success', duration = 3000) => {
  message.value = msg;
  messageType.value = type;
  if (duration > 0) {
    setTimeout(() => {
      message.value = '';
    }, duration);
  }
};

const loadCredential = async () => {
  try {
    const data = await getCredential();
    if (data) {
      hasCredential.value = true;
      credential.value = data;
      form.username = data.username;
      form.password = '';
    } else {
      hasCredential.value = false;
    }
  } catch (error) {
    console.error('Error loading credential:', error);
  }
};

const saveCredential = async () => {
  if (!form.username || !form.password) {
    showMessage('帳號和密碼不能為空', 'error');
    return;
  }

  loading.value = true;
  try {
    await apiSaveCredential(form.username, form.password);
    showMessage('✅ 帳號已保存', 'success');
    form.password = '';
    await loadCredential();
  } catch (error) {
    showMessage(\`❌ 保存失敗：\${error.message}\`, 'error', 5000);
  } finally {
    loading.value = false;
  }
};

const deleteCredential = async () => {
  if (!confirm('確定要刪除帳號嗎？此操作無法撤銷。')) {
    return;
  }

  loading.value = true;
  try {
    await apiDeleteCredential();
    showMessage('✅ 帳號已刪除', 'success');
    hasCredential.value = false;
    credential.value = { username: '', updatedAt: '' };
    form.username = '';
    form.password = '';
  } catch (error) {
    showMessage(\`❌ 刪除失敗：\${error.message}\`, 'error', 5000);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadCredential();
});
</script>

<style scoped>
.credentials-container {
  background: #f5f5f5;
  border-radius: 8px;
  padding: 20px;
  margin: 20px 0;
}

h2 {
  margin: 0 0 15px 0;
  color: #333;
  font-size: 1.3em;
}

h3 {
  margin: 0 0 10px 0;
  color: #555;
  font-size: 1.1em;
}

.credentials-status {
  background: white;
  border-radius: 6px;
  padding: 15px;
  margin-bottom: 15px;
}

.credential-info {
  color: #2e7d32;
}

.credential-info p {
  margin: 5px 0;
}

.small-text {
  font-size: 0.9em;
  color: #999;
}

.no-credential {
  color: #d32f2f;
}

.credentials-form {
  background: white;
  border-radius: 6px;
  padding: 15px;
  margin-bottom: 15px;
}

.form-group {
  margin-bottom: 12px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: 500;
  color: #555;
}

.form-group input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1em;
  box-sizing: border-box;
}

.form-group input:disabled {
  background-color: #f0f0f0;
  cursor: not-allowed;
}

.button-group {
  display: flex;
  gap: 10px;
  margin: 15px 0;
}

button {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  background: #1976d2;
  color: white;
  cursor: pointer;
  font-size: 1em;
  flex: 1;
}

button:hover:not(:disabled) {
  background: #1565c0;
}

button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

button.delete-btn {
  background: #d32f2f;
  flex: 0 1 auto;
}

button.delete-btn:hover:not(:disabled) {
  background: #c62828;
}

.message {
  padding: 10px;
  border-radius: 4px;
  margin-top: 10px;
}

.message.success {
  background: #e8f5e9;
  color: #2e7d32;
  border: 1px solid #c8e6c9;
}

.message.error {
  background: #ffebee;
  color: #d32f2f;
  border: 1px solid #ffcdd2;
}

.credentials-note {
  background: #fff3cd;
  border-radius: 6px;
  padding: 15px;
  border-left: 4px solid #ffc107;
}

.credentials-note p {
  margin: 0 0 10px 0;
  font-weight: 500;
}

.credentials-note ul {
  margin: 0;
  padding-left: 20px;
}

.credentials-note li {
  margin: 5px 0;
  color: #555;
}
</style>
`;

fs.writeFileSync(path.join(componentsDir, 'CredentialsManager.vue'), credentialsManagerContent);
console.log('✅ Created CredentialsManager.vue');

// 更新 api.js 添加凭証 API 調用
const apiJsPath = path.join(__dirname, 'frontend', 'src', 'api.js');
if (fs.existsSync(apiJsPath)) {
  const apiContent = fs.readFileSync(apiJsPath, 'utf8');
  
  if (!apiContent.includes('getCredential')) {
    const credentialAPIs = \`

// Credentials API
export async function getCredential() {
  const response = await fetch('/api/credentials');
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error('Failed to get credential');
  }
  const data = await response.json();
  return data.data;
}

export async function saveCredential(username, password) {
  const response = await fetch('/api/credentials', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  if (!response.ok) {
    throw new Error('Failed to save credential');
  }
  return await response.json();
}

export async function deleteCredential() {
  const response = await fetch('/api/credentials', {
    method: 'DELETE'
  });
  if (!response.ok) {
    throw new Error('Failed to delete credential');
  }
  return await response.json();
}\`;
    
    fs.writeFileSync(apiJsPath, apiContent + credentialAPIs);
    console.log('✅ Updated api.js with credential functions');
  }
}

console.log('\\n✅ All Vue components and API ready!');
