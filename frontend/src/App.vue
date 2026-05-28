<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { fetchAvailability, fetchMeta } from './api';

const TAIPEI_TIME_ZONE = 'Asia/Taipei';
const DAY_START_MINUTES = 8 * 60;
const DAY_END_MINUTES = 22 * 60;
const DAY_TOTAL_MINUTES = DAY_END_MINUTES - DAY_START_MINUTES;
const MOBILE_QUERY = '(max-width: 720px)';

const roomPalette = [
  '#7a2f32',
  '#85853e',
  '#00f51c',
  '#0f6b69',
  '#0f4c81',
  '#f21f2e',
  '#7b8ff7',
  '#f065e8',
  '#ff7a18',
  '#3b82f6'
];

const viewModes = [
  { label: '日', value: 'day' },
  { label: '週', value: 'week' },
  { label: '月', value: 'month' }
];

const branchOptions = ref([]);
const configLoaded = ref(false);
const availabilityByDate = ref(new Map());
const loading = ref(false);
const errorMessage = ref('');
const lastUpdatedAt = ref(0);
const autoRefreshSeconds = ref(60);
const refreshCountdown = ref(0);
const viewMode = ref('week');
const currentDate = ref(todayInTaipei());
const currentRequestKey = ref('');

const filters = reactive({
  branch: '',
  room: ''
});

let refreshTimer = null;
let countdownTimer = null;
let nextRefreshAt = 0;

const timeMarks = computed(() => {
  const marks = [];
  for (let hour = DAY_START_MINUTES / 60; hour < DAY_END_MINUTES / 60; hour += 1) {
    marks.push(`${String(hour).padStart(2, '0')}:00`);
  }
  return marks;
});

const activeDates = computed(() => {
  if (viewMode.value === 'day') {
    return [currentDate.value];
  }

  if (viewMode.value === 'week') {
    return getWeekDates(currentDate.value);
  }

  return getMonthDates(currentDate.value);
});

const visibleTimelineDates = computed(() =>
  viewMode.value === 'day' ? [currentDate.value] : getWeekDates(currentDate.value)
);

const calendarGridDates = computed(() => getMonthGridDates(currentDate.value));

const rangeTitle = computed(() => {
  if (viewMode.value === 'day') {
    return formatFullDate(currentDate.value);
  }

  if (viewMode.value === 'week') {
    const dates = getWeekDates(currentDate.value);
    return `${formatShortDate(dates[0])} - ${formatShortDate(dates[6])}`;
  }

  const date = parseDate(currentDate.value);
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月`;
});

const visibleEvents = computed(() =>
  activeDates.value.flatMap(dateKey => eventsForDate(dateKey))
);

const selectedDayRooms = computed(() =>
  availabilityByDate.value.get(currentDate.value)?.rooms || []
);

const selectedDayAvailableRooms = computed(() =>
  selectedDayRooms.value.filter(room => room.blocks?.some(block => block.type === 'FREE'))
);

const totalReservations = computed(() => visibleEvents.value.length);

const roomLegend = computed(() => {
  const roomNames = new Set();

  for (const day of availabilityByDate.value.values()) {
    for (const room of day.rooms || []) {
      if (!matchesRoomFilter(room.room)) {
        continue;
      }
      roomNames.add(room.room);
    }
  }

  return [...roomNames].map(room => ({
    room,
    color: colorForRoom(room)
  }));
});

const refreshStatus = computed(() => {
  if (loading.value) {
    return '更新中';
  }

  if (!lastUpdatedAt.value) {
    return '等待更新';
  }

  refreshCountdown.value;
  const secondsAgo = Math.max(0, Math.floor((Date.now() - lastUpdatedAt.value) / 1000));
  return secondsAgo <= 0 ? '剛剛更新' : `${secondsAgo} 秒前更新`;
});

function todayInTaipei() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TAIPEI_TIME_ZONE
  }).format(new Date());
}

function parseDate(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(dateKey, amount) {
  const date = parseDate(dateKey);
  date.setDate(date.getDate() + amount);
  return toDateKey(date);
}

function getWeekDates(dateKey) {
  const date = parseDate(dateKey);
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = parseDate(dateKey);
  monday.setDate(monday.getDate() + mondayOffset);

  return Array.from({ length: 7 }, (_, index) => {
    const next = new Date(monday);
    next.setDate(monday.getDate() + index);
    return toDateKey(next);
  });
}

function getMonthDates(dateKey) {
  const date = parseDate(dateKey);
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const dates = [];

  for (let next = new Date(first); next.getMonth() === first.getMonth(); next.setDate(next.getDate() + 1)) {
    dates.push(toDateKey(next));
  }

  return dates;
}

function getMonthGridDates(dateKey) {
  const monthDates = getMonthDates(dateKey);
  const firstWeek = getWeekDates(monthDates[0]);
  const lastWeek = getWeekDates(monthDates[monthDates.length - 1]);
  const start = firstWeek[0];
  const end = lastWeek[6];
  const dates = [];

  for (let date = start; date <= end; date = addDays(date, 1)) {
    dates.push(date);
  }

  return dates;
}

function formatFullDate(dateKey) {
  return parseDate(dateKey).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });
}

function formatShortDate(dateKey) {
  return parseDate(dateKey).toLocaleDateString('zh-TW', {
    month: 'long',
    day: 'numeric'
  });
}

function formatColumnDate(dateKey) {
  return parseDate(dateKey).toLocaleDateString('zh-TW', {
    weekday: 'short',
    month: 'numeric',
    day: 'numeric'
  });
}

function formatMonthCellDate(dateKey) {
  return parseDate(dateKey).toLocaleDateString('zh-TW', {
    day: 'numeric'
  });
}

function minutesFromTime(value) {
  const [hour, minute] = String(value || '').split(':').map(Number);
  return hour * 60 + (minute || 0);
}

function eventStyle(event) {
  const start = Math.max(minutesFromTime(event.start), DAY_START_MINUTES);
  const end = Math.min(minutesFromTime(event.end), DAY_END_MINUTES);
  const top = ((start - DAY_START_MINUTES) / DAY_TOTAL_MINUTES) * 100;
  const height = Math.max(((end - start) / DAY_TOTAL_MINUTES) * 100, 2.8);
  const overlapColumns = event.overlapColumns || 1;
  const overlapColumn = event.overlapColumn || 0;
  const width = 100 / overlapColumns;

  const style = {
    '--event-color': event.color,
    top: `${top}%`,
    height: `${height}%`
  };

  if (overlapColumns > 1) {
    style.left = `calc(${overlapColumn * width}% + 5px)`;
    style.width = `calc(${width}% - 10px)`;
    style.right = 'auto';
    style.zIndex = String(10 + overlapColumn);
  }

  return style;
}

function colorForRoom(room) {
  let hash = 0;
  for (const char of room) {
    hash = (hash + char.charCodeAt(0)) % roomPalette.length;
  }
  return roomPalette[hash];
}

function matchesRoomFilter(room) {
  const keyword = filters.room.trim().toLowerCase();
  return !keyword || room.toLowerCase().includes(keyword);
}

function eventsForDate(dateKey) {
  const day = availabilityByDate.value.get(dateKey);
  if (!day?.rooms?.length) {
    return [];
  }

  return day.rooms
    .filter(room => matchesRoomFilter(room.room))
    .flatMap(room => {
      const sourceEvents = room.events?.length
        ? room.events
        : room.blocks?.filter(block => block.type === 'BUSY') || [];

      return sourceEvents.map((event, index) => ({
        id: `${dateKey}-${room.room}-${event.id || index}-${event.start}-${event.end}`,
        date: dateKey,
        room: room.room,
        title: event.text || room.room,
        start: event.start,
        end: event.end,
        color: colorForRoom(room.room)
      }));
    });
}

function layoutEventsForDate(dateKey) {
  const events = eventsForDate(dateKey)
    .map(event => ({
      ...event,
      startMinutes: minutesFromTime(event.start),
      endMinutes: minutesFromTime(event.end)
    }))
    .sort((a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes);

  const laidOutEvents = [];
  let cluster = [];
  let clusterEnd = -Infinity;

  function flushCluster() {
    if (!cluster.length) {
      return;
    }

    const columnEnds = [];
    const clusterEvents = cluster.map(event => {
      const column = columnEnds.findIndex(end => event.startMinutes >= end);
      const overlapColumn = column === -1 ? columnEnds.length : column;
      columnEnds[overlapColumn] = event.endMinutes;

      return {
        ...event,
        overlapColumn
      };
    });

    const overlapColumns = columnEnds.length;
    laidOutEvents.push(
      ...clusterEvents.map(event => ({
        ...event,
        overlapColumns
      }))
    );

    cluster = [];
    clusterEnd = -Infinity;
  }

  for (const event of events) {
    if (!cluster.length || event.startMinutes < clusterEnd) {
      cluster.push(event);
      clusterEnd = Math.max(clusterEnd, event.endMinutes);
      continue;
    }

    flushCluster();
    cluster.push(event);
    clusterEnd = event.endMinutes;
  }

  flushCluster();
  return laidOutEvents;
}

function monthCellSummary(dateKey) {
  const events = eventsForDate(dateKey);
  const rooms = availabilityByDate.value.get(dateKey)?.rooms || [];
  const available = rooms.filter(room => room.blocks?.some(block => block.type === 'FREE')).length;

  return {
    events,
    available
  };
}

function isToday(dateKey) {
  return dateKey === todayInTaipei();
}

function isOutsideCurrentMonth(dateKey) {
  const current = parseDate(currentDate.value);
  const date = parseDate(dateKey);
  return current.getMonth() !== date.getMonth() || current.getFullYear() !== date.getFullYear();
}

function setViewMode(mode) {
  viewMode.value = mode;
}

function moveDate(direction) {
  if (viewMode.value === 'day') {
    currentDate.value = addDays(currentDate.value, direction);
    return;
  }

  if (viewMode.value === 'week') {
    currentDate.value = addDays(currentDate.value, direction * 7);
    return;
  }

  const date = parseDate(currentDate.value);
  date.setMonth(date.getMonth() + direction);
  currentDate.value = toDateKey(date);
}

function goToday() {
  currentDate.value = todayInTaipei();
}

function updateRefreshCountdown() {
  if (!nextRefreshAt) {
    refreshCountdown.value = 0;
    return;
  }

  refreshCountdown.value = Math.max(0, Math.ceil((nextRefreshAt - Date.now()) / 1000));
}

function stopAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }

  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }

  nextRefreshAt = 0;
  refreshCountdown.value = 0;
}

function startAutoRefresh() {
  stopAutoRefresh();

  const intervalMs = Number(autoRefreshSeconds.value) * 1000;
  nextRefreshAt = Date.now() + intervalMs;
  updateRefreshCountdown();

  refreshTimer = setInterval(async () => {
    await loadAvailability({ silent: true, resetTimer: false });
    nextRefreshAt = Date.now() + intervalMs;
    updateRefreshCountdown();
  }, intervalMs);

  countdownTimer = setInterval(updateRefreshCountdown, 1000);
}

async function loadMeta() {
  const result = await fetchMeta();
  branchOptions.value = result.branches || [];
  filters.branch = result.defaultBranch || branchOptions.value[0] || '';
  configLoaded.value = true;
}

async function fetchDateAvailability(dateKey) {
  const result = await fetchAvailability({
    branch: filters.branch,
    date: dateKey,
    room: ''
  });

  return {
    date: dateKey,
    rooms: result.rooms || [],
    roomCount: result.roomCount || result.rooms?.length || 0
  };
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function loadAvailability({ silent = false, resetTimer = true } = {}) {
  if (loading.value || !filters.branch) {
    return;
  }

  const dates = [...activeDates.value];
  const requestKey = `${filters.branch}:${viewMode.value}:${dates.join(',')}`;
  currentRequestKey.value = requestKey;
  loading.value = true;

  if (!silent) {
    errorMessage.value = '';
  }

  try {
    const results = await mapWithConcurrency(dates, viewMode.value === 'month' ? 4 : 7, fetchDateAvailability);

    if (currentRequestKey.value !== requestKey) {
      return;
    }

    availabilityByDate.value = new Map(results.map(day => [day.date, day]));
    lastUpdatedAt.value = Date.now();
  } catch (error) {
    if (!silent) {
      errorMessage.value = error.message;
    }
  } finally {
    loading.value = false;
    if (resetTimer) {
      startAutoRefresh();
    }
  }
}

onMounted(async () => {
  viewMode.value = window.matchMedia(MOBILE_QUERY).matches ? 'day' : 'week';

  try {
    await loadMeta();
    await loadAvailability();
  } catch (error) {
    errorMessage.value = error.message;
  }
});

onUnmounted(stopAutoRefresh);

watch(autoRefreshSeconds, startAutoRefresh);

watch(
  () => [filters.branch, currentDate.value, viewMode.value],
  () => {
    loadAvailability({ silent: true });
  }
);
</script>

<template>
  <main class="page-shell">
    <header class="status-header">
      <div>
        <p class="eyebrow">NTNU Library Rooms</p>
        <h1>圖書館空間預約狀態</h1>
        <p class="header-note">快速查看各分館討論室、觀賞室與練習室的占用時段。</p>
      </div>
      <div class="live-indicator" :class="{ loading }">
        <span></span>
        {{ refreshStatus }}
      </div>
    </header>

    <section class="scheduler-shell">
      <div class="scheduler-toolbar">
        <div class="branch-group" aria-label="位置">
          <span>位置</span>
          <label v-for="branch in branchOptions" :key="branch">
            <input v-model="filters.branch" type="radio" :value="branch" :disabled="!configLoaded" />
            {{ branch }}
          </label>
        </div>

        <div class="toolbar-grid">
          <label class="room-search">
            <span>房間篩選</span>
            <input v-model="filters.room" type="search" placeholder="輸入 201、Room 203..." />
          </label>

          <button class="refresh-now" type="button" :disabled="loading" @click="loadAvailability()">
            {{ loading ? '更新中' : '立即刷新' }}
          </button>
        </div>

        <div class="mode-row">
          <div class="segmented-control" aria-label="切換顯示模式">
            <button
              v-for="mode in viewModes"
              :key="mode.value"
              type="button"
              :class="{ active: viewMode === mode.value }"
              @click="setViewMode(mode.value)"
            >
              {{ mode.label }}
            </button>
          </div>

          <div class="date-navigation">
            <button type="button" aria-label="上一段" @click="moveDate(-1)">‹</button>
            <strong>{{ rangeTitle }}</strong>
            <button type="button" @click="goToday">本日</button>
            <button type="button" aria-label="下一段" @click="moveDate(1)">›</button>
          </div>
        </div>
      </div>

      <p v-if="errorMessage" class="feedback failed">{{ errorMessage }}</p>

      <section v-if="viewMode !== 'month'" class="timeline-card" aria-label="時間表">
        <div class="timeline-header" :style="{ '--day-count': visibleTimelineDates.length }">
          <div class="time-corner"></div>
          <div
            v-for="dateKey in visibleTimelineDates"
            :key="dateKey"
            class="day-heading"
            :class="{ today: isToday(dateKey) }"
          >
            {{ formatColumnDate(dateKey) }}
          </div>
        </div>

        <div class="timeline-body" :style="{ '--day-count': visibleTimelineDates.length }">
          <div class="time-axis">
            <span v-for="mark in timeMarks" :key="mark">{{ mark }}</span>
          </div>

          <div class="timeline-grid">
            <div
              v-for="dateKey in visibleTimelineDates"
              :key="dateKey"
              class="day-column"
              :class="{ today: isToday(dateKey) }"
            >
              <article
                v-for="event in layoutEventsForDate(dateKey)"
                :key="event.id"
                class="reservation-block"
                :style="eventStyle(event)"
                :title="`${event.room} ${event.start}-${event.end}`"
              >
                <strong>{{ event.room }}</strong>
                <span>{{ event.start }} - {{ event.end }}</span>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section v-else class="month-card" aria-label="月曆">
        <div class="month-weekdays">
          <span v-for="day in ['一', '二', '三', '四', '五', '六', '日']" :key="day">{{ day }}</span>
        </div>
        <div class="month-grid">
          <article
            v-for="dateKey in calendarGridDates"
            :key="dateKey"
            class="month-cell"
            :class="{ today: isToday(dateKey), muted: isOutsideCurrentMonth(dateKey) }"
          >
            <header>
              <strong>{{ formatMonthCellDate(dateKey) }}</strong>
              <span>{{ monthCellSummary(dateKey).events.length }} 筆</span>
            </header>
            <p>{{ monthCellSummary(dateKey).available }} 間可用</p>
            <div class="month-events">
              <span
                v-for="event in monthCellSummary(dateKey).events.slice(0, 3)"
                :key="event.id"
                :style="{ '--event-color': event.color }"
              >
                {{ event.start }} {{ event.room }}
              </span>
              <small v-if="monthCellSummary(dateKey).events.length > 3">
                +{{ monthCellSummary(dateKey).events.length - 3 }} more
              </small>
            </div>
          </article>
        </div>
      </section>

      <footer class="legend-row" aria-label="房間圖例">
        <span>圖例:</span>
        <template v-if="roomLegend.length">
          <span v-for="item in roomLegend" :key="item.room" class="legend-item">
            <i :style="{ background: item.color }"></i>
            {{ item.room }}
          </span>
        </template>
        <span v-else class="legend-empty">目前沒有符合篩選的房間</span>
      </footer>
    </section>
  </main>
</template>
