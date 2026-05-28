<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import { getAuthDisplayName, isSupabaseAuthConfigured, supabase } from '../auth';

const emit = defineEmits(['session-change']);

const session = ref(null);
const loading = ref(false);
const message = ref('');
let subscription = null;

function emitSession(nextSession) {
  session.value = nextSession;
  emit('session-change', nextSession);
}

async function loadSession() {
  if (!supabase) {
    emitSession(null);
    return;
  }

  const { data } = await supabase.auth.getSession();
  emitSession(data.session || null);
}

async function signIn(provider) {
  if (!supabase) {
    message.value = '尚未設定 Supabase Auth。';
    return;
  }

  loading.value = true;
  message.value = '';

  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: window.location.origin
    }
  });

  if (error) {
    message.value = error.message;
    loading.value = false;
  }
}

async function signOut() {
  if (!supabase) {
    return;
  }

  loading.value = true;
  message.value = '';
  const { error } = await supabase.auth.signOut();
  if (error) {
    message.value = error.message;
  }
  loading.value = false;
}

onMounted(async () => {
  await loadSession();

  if (supabase) {
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      emitSession(nextSession);
      loading.value = false;
    });
    subscription = data.subscription;
  }
});

onUnmounted(() => {
  subscription?.unsubscribe();
});
</script>

<template>
  <article class="panel auth-panel">
    <div class="panel-head auth-head">
      <div>
        <h2>登入</h2>
        <p>使用 Supabase Auth 登入後，Web 會以登入身份保存與讀取憑證。</p>
      </div>
      <span class="status-chip" :class="{ active: session }">
        {{ session ? '已登入' : '未登入' }}
      </span>
    </div>

    <div v-if="!isSupabaseAuthConfigured" class="auth-warning">
      需要設定 VITE_SUPABASE_URL 與 VITE_SUPABASE_ANON_KEY 才能啟用 OAuth。
    </div>

    <div v-else-if="session" class="auth-session">
      <div>
        <span>目前身份</span>
        <strong>{{ getAuthDisplayName(session.user) }}</strong>
      </div>
      <button class="secondary-button" type="button" :disabled="loading" @click="signOut">
        登出
      </button>
    </div>

    <div v-else class="auth-actions">
      <button class="primary-button" type="button" :disabled="loading" @click="signIn('discord')">
        使用 Discord 登入
      </button>
      <button class="secondary-button" type="button" :disabled="loading" @click="signIn('google')">
        使用 Google 登入
      </button>
    </div>

    <p v-if="message" class="feedback failed">{{ message }}</p>
  </article>
</template>
