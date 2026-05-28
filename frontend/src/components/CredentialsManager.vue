<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { deleteCredential, getCredential, saveCredential } from '../api';

const props = defineProps({
  authUser: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['credential-loaded']);

const STORAGE_KEY = 'ntnu-lib-bot:credential-user-id';

const form = reactive({
  userId: '',
  username: '',
  password: ''
});

const credential = ref(null);
const loading = ref(false);
const saving = ref(false);
const deleting = ref(false);
const message = ref('');
const status = ref('idle');

const activeUserId = computed(() => props.authUser?.id || form.userId.trim());
const hasUserId = computed(() => activeUserId.value.length > 0);
const hasCredential = computed(() => Boolean(credential.value));
const maskedPassword = computed(() => (hasCredential.value ? '已加密保存' : '尚未保存'));

function apiUserId() {
  return props.authUser ? '' : activeUserId.value;
}

function rememberUserId() {
  if (props.authUser) {
    return;
  }

  const userId = form.userId.trim();
  if (userId) {
    localStorage.setItem(STORAGE_KEY, userId);
  }
}

function formatDate(value) {
  if (!value) {
    return '尚未同步';
  }

  return new Date(value).toLocaleString('zh-TW', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

function clearCredential({ keepMessage = false } = {}) {
  credential.value = null;
  if (!keepMessage) {
    message.value = '';
    status.value = 'idle';
  }
  emit('credential-loaded', null);
}

async function loadCredential({ quiet = false } = {}) {
  if (!hasUserId.value) {
    status.value = 'failed';
    message.value = props.authUser ? '尚未取得登入身份。' : '請先輸入 Discord 使用者 ID。';
    return;
  }

  loading.value = true;
  if (!quiet) {
    message.value = '';
    status.value = 'idle';
  }

  try {
    rememberUserId();
    const result = await getCredential(apiUserId());
    credential.value = {
      ...result.data,
      userId: activeUserId.value
    };
    form.username = result.data?.username || form.username;
    status.value = 'success';
    message.value = quiet ? message.value : '已載入保存的帳號。';
    emit('credential-loaded', credential.value);
  } catch (error) {
    clearCredential({ keepMessage: true });
    if (error.status === 404) {
      status.value = 'idle';
      message.value = quiet ? '' : '目前尚未保存圖書館帳號。';
      return;
    }

    status.value = 'failed';
    message.value = error.message;
  } finally {
    loading.value = false;
  }
}

async function handleSave() {
  if (!hasUserId.value || !form.username.trim() || !form.password) {
    status.value = 'failed';
    message.value = props.authUser
      ? '圖書館帳號與密碼都需要填寫。'
      : 'Discord ID、圖書館帳號與密碼都需要填寫。';
    return;
  }

  saving.value = true;
  message.value = '';

  try {
    rememberUserId();
    await saveCredential(apiUserId(), form.username.trim(), form.password);
    form.password = '';
    status.value = 'success';
    message.value = '帳號已加密保存。';
    await loadCredential({ quiet: true });
  } catch (error) {
    status.value = 'failed';
    message.value = error.message;
  } finally {
    saving.value = false;
  }
}

async function handleDelete() {
  if (!hasUserId.value) {
    status.value = 'failed';
    message.value = props.authUser ? '尚未取得登入身份。' : '請先輸入 Discord 使用者 ID。';
    return;
  }

  deleting.value = true;
  message.value = '';

  try {
    rememberUserId();
    await deleteCredential(apiUserId());
    credential.value = null;
    form.password = '';
    emit('credential-loaded', null);
    status.value = 'success';
    message.value = '保存的帳號已刪除。';
  } catch (error) {
    if (error.status === 404) {
      clearCredential({ keepMessage: true });
      status.value = 'idle';
      message.value = '目前沒有可刪除的帳號。';
      return;
    }

    status.value = 'failed';
    message.value = error.message;
  } finally {
    deleting.value = false;
  }
}

function initializeManualUser() {
  const savedUserId = localStorage.getItem(STORAGE_KEY);
  if (savedUserId) {
    form.userId = savedUserId;
    loadCredential({ quiet: true });
  }
}

onMounted(() => {
  if (props.authUser) {
    loadCredential({ quiet: true });
    return;
  }

  initializeManualUser();
});

watch(
  () => props.authUser?.id || '',
  (nextId, previousId) => {
    if (nextId === previousId) {
      return;
    }

    form.password = '';
    if (nextId) {
      loadCredential({ quiet: true });
    } else {
      clearCredential();
      initializeManualUser();
    }
  }
);
</script>

<template>
  <article class="panel credentials-panel">
    <div class="panel-head credentials-head">
      <div>
        <h2>憑證管理</h2>
        <p>保存後會用 AES-256-GCM 加密存入 Supabase，Discord 指令與 Web 預約都能共用同一份資料。</p>
      </div>
      <span class="status-chip" :class="{ active: hasCredential }">
        {{ hasCredential ? '已保存' : '未保存' }}
      </span>
    </div>

    <form class="form-grid credentials-form" @submit.prevent="handleSave">
      <label v-if="!authUser" class="wide">
        <span>Discord 使用者 ID</span>
        <input
          v-model="form.userId"
          type="text"
          inputmode="numeric"
          autocomplete="off"
          placeholder="例如 123456789012345678"
        />
      </label>
      <div v-else class="wide auth-linked-id">
        <span>登入身份</span>
        <strong>{{ authUser.email || authUser.id }}</strong>
      </div>
      <label>
        <span>圖書館帳號</span>
        <input v-model="form.username" type="text" autocomplete="username" />
      </label>
      <label>
        <span>圖書館密碼</span>
        <input v-model="form.password" type="password" autocomplete="current-password" />
      </label>

      <div class="credential-actions wide">
        <button class="primary-button" type="submit" :disabled="saving || loading">
          {{ saving ? '保存中...' : '保存憑證' }}
        </button>
        <button class="secondary-button" type="button" :disabled="loading || !hasUserId" @click="loadCredential()">
          {{ loading ? '查詢中...' : '查詢狀態' }}
        </button>
        <button class="danger-button" type="button" :disabled="deleting || !hasUserId" @click="handleDelete">
          {{ deleting ? '刪除中...' : '刪除' }}
        </button>
      </div>
    </form>

    <dl class="credential-summary">
      <div>
        <dt>保存帳號</dt>
        <dd>{{ credential?.username || form.username || '尚未保存' }}</dd>
      </div>
      <div>
        <dt>密碼狀態</dt>
        <dd>{{ maskedPassword }}</dd>
      </div>
      <div>
        <dt>最近更新</dt>
        <dd>{{ formatDate(credential?.updatedAt) }}</dd>
      </div>
    </dl>

    <p v-if="message" class="feedback" :class="status">
      {{ message }}
    </p>
  </article>
</template>
