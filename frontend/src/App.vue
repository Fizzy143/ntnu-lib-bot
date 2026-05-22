<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { fetchAvailability, fetchMeta, startBooking, submitCaptcha } from './api';

const defaultDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Taipei'
}).format(new Date());

const branchOptions = ref([]);
const configLoaded = ref(false);
const selectedRoom = ref('');
const availability = ref([]);
const roomCount = ref(0);
const loadingAvailability = ref(false);
const loadingBooking = ref(false);
const bookingResult = ref(null);

const availabilityForm = reactive({
  branch: '',
  date: defaultDate,
  room: ''
});

const bookingForm = reactive({
  branch: '',
  roomKeyword: '',
  date: defaultDate,
  start: '18:30',
  end: '20:30',
  people: 2,
  username: '',
  password: ''
});

const bookingState = reactive({
  sessionId: '',
  captchaCode: '',
  captchaUrl: '',
  message: '',
  status: 'idle'
});

const hasAvailability = computed(() => availability.value.length > 0);
const availableNow = computed(() =>
  availability.value.filter(room => room.blocks.some(block => block.type === 'FREE'))
);
const fullyFreeRooms = computed(() =>
  availability.value.filter(room => room.blocks.some(block => block.type === 'FREE') && room.events.length === 0)
);

function syncBranch(branch) {
  availabilityForm.branch = branch;
  bookingForm.branch = branch;
}

function selectRoom(roomName) {
  selectedRoom.value = roomName;
  availabilityForm.room = roomName;
  bookingForm.roomKeyword = roomName;
}

async function loadMeta() {
  const result = await fetchMeta();
  branchOptions.value = result.branches || [];
  syncBranch(result.defaultBranch || branchOptions.value[0] || '');
  configLoaded.value = true;
}

async function handleAvailabilitySubmit() {
  loadingAvailability.value = true;
  bookingState.message = '';

  try {
    const result = await fetchAvailability(availabilityForm);
    availability.value = result.rooms || [];
    roomCount.value = result.roomCount || 0;

    if (selectedRoom.value && !availability.value.some(room => room.room === selectedRoom.value)) {
      selectedRoom.value = '';
    }
  } catch (error) {
    bookingState.message = error.message;
  } finally {
    loadingAvailability.value = false;
  }
}

async function handleBookingSubmit() {
  loadingBooking.value = true;
  bookingState.message = '';
  bookingState.status = 'idle';
  bookingState.captchaCode = '';
  bookingState.captchaUrl = '';
  bookingState.sessionId = '';

  try {
    const result = await startBooking(bookingForm);
    if (result.status === 'captcha_required') {
      bookingState.status = 'captcha_required';
      bookingState.sessionId = result.sessionId;
      bookingState.captchaUrl = result.captchaUrl;
      bookingState.message = '自動辨識未完成，請手動輸入驗證碼後再送出。';
      bookingResult.value = null;
      return;
    }

    bookingState.status = result.status || 'success';
    bookingState.message = result.message || '預約流程已完成。';
    bookingResult.value = result;
    await handleAvailabilitySubmit();
  } catch (error) {
    bookingState.status = 'failed';
    bookingState.message = error.message;
  } finally {
    loadingBooking.value = false;
  }
}

async function handleCaptchaSubmit() {
  if (!bookingState.sessionId || !bookingState.captchaCode) {
    bookingState.message = '請先輸入驗證碼。';
    return;
  }

  loadingBooking.value = true;

  try {
    const result = await submitCaptcha({
      sessionId: bookingState.sessionId,
      captchaCode: bookingState.captchaCode,
      username: bookingForm.username,
      password: bookingForm.password
    });

    bookingState.status = result.status || 'success';
    bookingState.message = result.message || '預約流程已完成。';
    bookingResult.value = result;
    bookingState.captchaUrl = '';
    bookingState.captchaCode = '';
    bookingState.sessionId = '';
    await handleAvailabilitySubmit();
  } catch (error) {
    bookingState.status = 'failed';
    bookingState.message = error.message;
  } finally {
    loadingBooking.value = false;
  }
}

onMounted(async () => {
  try {
    await loadMeta();
    await handleAvailabilitySubmit();
  } catch (error) {
    bookingState.message = error.message;
  }
});
</script>

<template>
  <main class="page-shell">
    <section class="hero-panel">
      <p class="eyebrow">NTNU Library Booking</p>
      <h1>把討論室查詢與預約，整理成一個更輕鬆的操作介面。</h1>
      <p class="hero-copy">
        這個版本把館別資料改成由後端提供，查詢後的房間卡片也能直接帶入預約，
        讓後續擴充成整館總覽看板時不需要再拆掉重做。
      </p>
      <div class="hero-stats">
        <div>
          <span>目前館別</span>
          <strong>{{ availabilityForm.branch || '載入中' }}</strong>
        </div>
        <div>
          <span>可顯示房間數</span>
          <strong>{{ roomCount }}</strong>
        </div>
        <div>
          <span>目前有可用時段</span>
          <strong>{{ availableNow.length }}</strong>
        </div>
        <div>
          <span>全天未被預約</span>
          <strong>{{ fullyFreeRooms.length }}</strong>
        </div>
      </div>
    </section>

    <section class="workspace-grid">
      <article class="panel">
        <div class="panel-head">
          <h2>館藏總覽</h2>
          <p>查的是整館資料，房間卡片可以直接帶到右側預約表單，不需要再手動重打一次房號。</p>
        </div>

        <form class="form-grid" @submit.prevent="handleAvailabilitySubmit">
          <label>
            <span>館別</span>
            <select
              v-model="availabilityForm.branch"
              :disabled="!configLoaded"
              @change="syncBranch(availabilityForm.branch)"
            >
              <option v-for="branch in branchOptions" :key="branch" :value="branch">{{ branch }}</option>
            </select>
          </label>
          <label>
            <span>日期</span>
            <input v-model="availabilityForm.date" type="date" />
          </label>
          <label class="wide">
            <span>房間關鍵字</span>
            <input v-model="availabilityForm.room" type="text" placeholder="例如 401、403、Room 4" />
          </label>
          <button class="primary-button wide" type="submit" :disabled="loadingAvailability || !availabilityForm.branch">
            {{ loadingAvailability ? '查詢中...' : '查詢房況' }}
          </button>
        </form>

        <div v-if="hasAvailability" class="summary-strip">
          <button
            type="button"
            class="summary-pill"
            :class="{ active: !selectedRoom }"
            @click="selectedRoom = ''"
          >
            顯示全部
          </button>
          <button
            v-for="room in availableNow.slice(0, 8)"
            :key="`pill-${room.room}`"
            type="button"
            class="summary-pill"
            :class="{ active: selectedRoom === room.room }"
            @click="selectRoom(room.room)"
          >
            {{ room.room }}
          </button>
        </div>

        <div class="room-list">
          <article
            v-for="room in availability.filter(item => !selectedRoom || item.room === selectedRoom)"
            :key="room.room"
            class="room-card"
            :class="{ selected: selectedRoom === room.room }"
          >
            <header>
              <div>
                <h3>{{ room.room }}</h3>
                <span>{{ room.events.length }} 筆預約</span>
              </div>
              <button type="button" class="ghost-button" @click="selectRoom(room.room)">
                帶入預約
              </button>
            </header>

            <div class="block-list">
              <div
                v-for="block in room.blocks"
                :key="`${room.room}-${block.start}-${block.end}-${block.type}`"
                class="time-block"
                :class="block.type.toLowerCase()"
              >
                <strong>{{ block.start }} - {{ block.end }}</strong>
                <span>{{ block.type === 'FREE' ? '可用' : '已預約' }}</span>
              </div>
            </div>
          </article>

          <p v-if="!availability.length && !loadingAvailability" class="empty-state">
            查詢後，這裡會顯示整館房況與未來可擴充的總覽資料。
          </p>
        </div>
      </article>

      <article class="panel">
        <div class="panel-head">
          <h2>快速預約</h2>
          <p>預設先嘗試自動辨識 CAPTCHA，失敗時才顯示人工補碼。從左側點選房間後，房號會直接帶過來。</p>
        </div>

        <form class="form-grid" @submit.prevent="handleBookingSubmit">
          <label>
            <span>館別</span>
            <select v-model="bookingForm.branch" :disabled="!configLoaded">
              <option v-for="branch in branchOptions" :key="branch" :value="branch">{{ branch }}</option>
            </select>
          </label>
          <label>
            <span>房間</span>
            <input v-model="bookingForm.roomKeyword" type="text" placeholder="例如 403" />
          </label>
          <label>
            <span>日期</span>
            <input v-model="bookingForm.date" type="date" />
          </label>
          <label>
            <span>開始時間</span>
            <input v-model="bookingForm.start" type="time" />
          </label>
          <label>
            <span>結束時間</span>
            <input v-model="bookingForm.end" type="time" />
          </label>
          <label>
            <span>人數</span>
            <input v-model.number="bookingForm.people" type="number" min="1" max="12" />
          </label>
          <label class="wide">
            <span>圖書館帳號</span>
            <input v-model="bookingForm.username" type="text" autocomplete="username" />
          </label>
          <label class="wide">
            <span>圖書館密碼</span>
            <input v-model="bookingForm.password" type="password" autocomplete="current-password" />
          </label>
          <button class="primary-button wide" type="submit" :disabled="loadingBooking || !bookingForm.branch">
            {{ loadingBooking ? '送出中...' : '開始預約' }}
          </button>
        </form>

        <section v-if="bookingState.status === 'captcha_required'" class="captcha-panel">
          <img :src="bookingState.captchaUrl" alt="CAPTCHA" class="captcha-image" />
          <label>
            <span>驗證碼</span>
            <input v-model="bookingState.captchaCode" type="text" placeholder="輸入圖片中的文字" />
          </label>
          <button class="secondary-button" type="button" :disabled="loadingBooking" @click="handleCaptchaSubmit">
            {{ loadingBooking ? '驗證中...' : '送出驗證碼' }}
          </button>
        </section>

        <p v-if="bookingState.message" class="feedback" :class="bookingState.status">
          {{ bookingState.message }}
        </p>

        <pre v-if="bookingResult" class="result-box">{{ JSON.stringify(bookingResult, null, 2) }}</pre>
      </article>
    </section>
  </main>
</template>
