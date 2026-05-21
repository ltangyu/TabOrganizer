<script setup lang="ts">
import { computed, ref } from 'vue';
import { useArchiveStore, type SortKey } from '@/stores/archive';
import { useI18n } from '@/composables/i18n';

const archive = useArchiveStore();
const { t } = useI18n();

const showDomain = ref(false);
const showStatus = ref(false);
const showSort = ref(false);

const domainLabel = computed(() => archive.filterDomain || t('filter.all'));
const statusLabel = computed(() =>
  archive.filterStatus === 'all'
    ? t('filter.all')
    : archive.filterStatus === 'ok'
      ? t('filter.alive')
      : t('filter.gone'),
);
const sortLabel = computed(() => t(`sort.${archive.sortBy}`));

const SORT_OPTIONS: SortKey[] = ['time-desc', 'time-asc', 'title-asc', 'title-desc'];

function pickSort(s: SortKey): void {
  archive.sortBy = s;
  showSort.value = false;
}

const fromLabel = computed(() => formatDateShort(archive.filterDateFrom) || t('filter.any'));
const toLabel = computed(() => formatDateShort(archive.filterDateTo) || t('filter.now'));

function formatDateShort(ms: number | null): string {
  if (ms == null) return '';
  const d = new Date(ms);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${m}/${day}`;
}

function toIso(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function reset(): void {
  archive.filterDomain = '';
  archive.filterStatus = 'all';
  archive.filterDateFrom = null;
  archive.filterDateTo = null;
  archive.sortBy = 'time-desc';
}

function pickDomain(d: string): void {
  archive.filterDomain = d;
  showDomain.value = false;
}

function pickStatus(s: 'all' | 'ok' | 'gone'): void {
  archive.filterStatus = s;
  showStatus.value = false;
}

function onDate(which: 'from' | 'to', e: Event): void {
  const v = (e.target as HTMLInputElement).value;
  const ms = v ? new Date(v).getTime() : null;
  if (which === 'from') archive.filterDateFrom = ms;
  else archive.filterDateTo = ms == null ? null : ms + 24 * 60 * 60 * 1000 - 1;
}
</script>

<template>
  <div class="filter-bar">
    <span class="label-micro">{{ t('filter.label') }}</span>

    <div class="pill-wrap">
      <button
        class="filter-pill"
        :class="{ active: archive.filterDomain !== '' }"
        @click="showDomain = !showDomain; showStatus = false; showSort = false"
      >
        <span class="lbl">{{ t('filter.domain') }}</span>
        <span class="val">{{ domainLabel }}</span>
        <span class="caret">▼</span>
      </button>
      <div v-if="showDomain" class="pill-menu">
        <button class="menu-item" @click="pickDomain('')">{{ t('filter.all') }}</button>
        <button
          v-for="d in archive.domains"
          :key="d"
          class="menu-item"
          @click="pickDomain(d)"
        >
          {{ d }}
        </button>
      </div>
    </div>

    <div class="pill-wrap">
      <button
        class="filter-pill"
        :class="{ active: archive.filterStatus !== 'all' }"
        @click="showStatus = !showStatus; showDomain = false; showSort = false"
      >
        <span class="lbl">{{ t('filter.status') }}</span>
        <span class="val">{{ statusLabel }}</span>
        <span class="caret">▼</span>
      </button>
      <div v-if="showStatus" class="pill-menu">
        <button class="menu-item" @click="pickStatus('all')">{{ t('filter.all') }}</button>
        <button class="menu-item" @click="pickStatus('ok')">{{ t('filter.alive') }}</button>
        <button class="menu-item" @click="pickStatus('gone')">{{ t('filter.gone') }}</button>
      </div>
    </div>

    <div class="pill-wrap">
      <button
        class="filter-pill"
        :class="{ active: archive.sortBy !== 'time-desc' }"
        @click="showSort = !showSort; showDomain = false; showStatus = false"
      >
        <span class="lbl">{{ t('filter.sort') }}</span>
        <span class="val">{{ sortLabel }}</span>
        <span class="caret">▼</span>
      </button>
      <div v-if="showSort" class="pill-menu">
        <button
          v-for="s in SORT_OPTIONS"
          :key="s"
          class="menu-item"
          :class="{ 'menu-item-active': archive.sortBy === s }"
          @click="pickSort(s)"
        >
          {{ t(`sort.${s}`) }}
        </button>
      </div>
    </div>

    <label class="pill-wrap">
      <button class="filter-pill" :class="{ active: archive.filterDateFrom != null }">
        <span class="lbl">{{ t('filter.from') }}</span>
        <span class="val">{{ fromLabel }}</span>
      </button>
      <input
        type="date"
        class="hidden-date"
        :value="archive.filterDateFrom ? toIso(archive.filterDateFrom) : ''"
        @change="(e) => onDate('from', e)"
      />
    </label>

    <label class="pill-wrap">
      <button class="filter-pill" :class="{ active: archive.filterDateTo != null }">
        <span class="lbl">{{ t('filter.to') }}</span>
        <span class="val">{{ toLabel }}</span>
      </button>
      <input
        type="date"
        class="hidden-date"
        :value="archive.filterDateTo ? toIso(archive.filterDateTo) : ''"
        @change="(e) => onDate('to', e)"
      />
    </label>

    <button class="btn btn-sm btn-ghost reset-btn" @click="reset">{{ t('filter.reset') }}</button>

    <span class="results-count text-mono text-secondary">
      {{ archive.filtered.length }} {{ t('filter.items') }}
    </span>
  </div>
</template>

<style scoped>
.filter-bar {
  display: flex;
  align-items: center;
  gap: var(--gap-3);
  padding: 10px 24px;
  background: var(--bg-shell);
  border-bottom: 0.5px solid var(--border-medium);
  font-size: var(--text-sm);
  flex-shrink: 0;
  flex-wrap: wrap;
}
.pill-wrap {
  position: relative;
  display: inline-flex;
}
.pill-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 20;
  min-width: 160px;
  max-height: 280px;
  overflow-y: auto;
  background: var(--bg-block);
  border: 0.5px solid var(--border-medium);
  border-radius: var(--radius);
  box-shadow: var(--shadow-modal);
  padding: 4px;
  display: flex;
  flex-direction: column;
}
.menu-item {
  appearance: none;
  text-align: left;
  padding: 6px 10px;
  border: none;
  background: transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  color: var(--text-primary);
  transition: background var(--t-fast);
}
.menu-item:hover {
  background: var(--bg-hover);
}
.menu-item-active {
  background: var(--bg-active, var(--bg-surface));
  font-weight: 600;
}
.hidden-date {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
  border: none;
  background: transparent;
  width: 100%;
  height: 100%;
}
.reset-btn {
  height: 22px;
}
.results-count {
  margin-left: auto;
  font-variant-numeric: tabular-nums;
}
</style>
