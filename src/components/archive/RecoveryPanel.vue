<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import ModalShell from '@/components/ui/ModalShell.vue';
import { useI18n } from '@/composables/i18n';
import { formatTimestamp } from '@/utils/time';
import type { MissingTab } from '@/modules/recovery';
import type { RuntimeMessage } from '@/types/messages';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const { t } = useI18n();

const missing = ref<MissingTab[]>([]);
const selected = ref<Set<string>>(new Set());
const scanning = ref(false);
const reopening = ref(false);
const hoursBack = ref<number>(4);
const lastOpenedCount = ref<number | null>(null);

const hoursOptions = [
  { value: 1, label: t('recover.range.hours', { n: 1 }) },
  { value: 4, label: t('recover.range.hours', { n: 4 }) },
  { value: 12, label: t('recover.range.hours', { n: 12 }) },
  { value: 24, label: t('recover.range.day') },
  { value: 72, label: t('recover.range.days', { n: 3 }) },
  { value: 168, label: t('recover.range.days', { n: 7 }) },
];

async function scan(): Promise<void> {
  scanning.value = true;
  lastOpenedCount.value = null;
  try {
    const resp = (await chrome.runtime.sendMessage({
      type: 'recover/scan',
      historyHoursAgo: hoursBack.value,
    } satisfies RuntimeMessage)) as RuntimeMessage | undefined;
    if (resp?.type === 'recover/scan-response') {
      missing.value = resp.missing;
      // 預設全選 session 來源（精準），不選 history（噪音多）
      selected.value = new Set(
        resp.missing.filter((m: MissingTab) => m.source === 'session').map((m: MissingTab) => m.url),
      );
    }
  } finally {
    scanning.value = false;
  }
}

function toggle(url: string): void {
  if (selected.value.has(url)) {
    selected.value.delete(url);
  } else {
    selected.value.add(url);
  }
  // trigger reactivity
  selected.value = new Set(selected.value);
}

function selectAll(): void {
  selected.value = new Set(missing.value.map((m) => m.url));
}

function clearSelection(): void {
  selected.value = new Set();
}

async function reopen(): Promise<void> {
  if (selected.value.size === 0) return;
  reopening.value = true;
  try {
    const urls = Array.from(selected.value);
    const resp = (await chrome.runtime.sendMessage({
      type: 'recover/reopen',
      urls,
    } satisfies RuntimeMessage)) as RuntimeMessage | undefined;
    if (resp?.type === 'recover/reopen-response') {
      lastOpenedCount.value = resp.opened;
      // 已開啟的從 selected 移除
      selected.value = new Set();
      // 重新掃描，已開的 URL 應該從清單消失（因為現在 known 集合包含它了）
      await scan();
    }
  } finally {
    reopening.value = false;
  }
}

watch(
  () => props.open,
  (v) => {
    if (v) scan();
    else {
      missing.value = [];
      selected.value = new Set();
      lastOpenedCount.value = null;
    }
  },
);

const summary = computed(() =>
  missing.value.length === 0
    ? null
    : t('recover.found', { n: missing.value.length }),
);

const selectedSummary = computed(() =>
  selected.value.size > 0 ? t('recover.selected', { n: selected.value.size }) : '',
);

function sourceLabel(source: MissingTab['source']): string {
  return source === 'session' ? t('recover.source.session') : t('recover.source.history');
}
</script>

<template>
  <ModalShell :open="open" :title="t('recover.title')" @close="emit('close')" solid>
    <div class="recover">
      <p class="intro text-muted">{{ t('recover.intro') }}</p>

      <div class="controls">
        <div class="range">
          <label class="label-micro">{{ t('recover.range') }}</label>
          <select v-model.number="hoursBack" class="select" @change="scan">
            <option v-for="o in hoursOptions" :key="o.value" :value="o.value">
              {{ o.label }}
            </option>
          </select>
        </div>
        <button class="btn" @click="scan" :disabled="scanning">
          {{ scanning ? t('recover.scanning') : t('recover.scan') }}
        </button>
        <div class="spacer" />
        <span v-if="summary" class="text-mono summary">{{ summary }}</span>
      </div>

      <div v-if="lastOpenedCount !== null" class="opened-toast">
        {{ t('recover.reopened', { n: lastOpenedCount }) }}
      </div>

      <p v-if="missing.length > 0" class="warning text-muted label-micro">
        {{ t('recover.warning') }}
      </p>

      <div v-if="missing.length === 0 && !scanning" class="empty text-muted">
        {{ t('recover.empty') }}
      </div>

      <table v-else-if="missing.length > 0" class="recover-table">
        <thead>
          <tr>
            <th class="col-check">
              <input
                type="checkbox"
                :checked="selected.size === missing.length && missing.length > 0"
                @change="selected.size === missing.length ? clearSelection() : selectAll()"
              />
            </th>
            <th>{{ t('recover.col.title') }}</th>
            <th>{{ t('recover.col.domain') }}</th>
            <th>{{ t('recover.col.source') }}</th>
            <th>{{ t('recover.col.time') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="m in missing"
            :key="m.url"
            :class="{ selected: selected.has(m.url) }"
            @click="toggle(m.url)"
          >
            <td class="col-check">
              <input
                type="checkbox"
                :checked="selected.has(m.url)"
                @click.stop="toggle(m.url)"
              />
            </td>
            <td class="text-truncate">
              <div class="title-line">
                <img v-if="m.favIconUrl" :src="m.favIconUrl" class="favicon" alt="" />
                <span class="title-text">{{ m.title }}</span>
              </div>
              <div class="url-line text-mono text-muted">{{ m.url }}</div>
            </td>
            <td class="text-mono text-truncate">{{ m.domain }}</td>
            <td>
              <span class="source-pill" :class="m.source">{{ sourceLabel(m.source) }}</span>
            </td>
            <td class="text-muted text-mono">
              {{ m.lastVisitTime ? formatTimestamp(m.lastVisitTime) : '—' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <template #footer>
      <span class="text-mono text-muted">{{ selectedSummary }}</span>
      <div class="footer-spacer" />
      <button class="btn" @click="clearSelection" :disabled="selected.size === 0">
        {{ t('recover.clearSelection') }}
      </button>
      <button class="btn" @click="selectAll" :disabled="missing.length === 0">
        {{ t('recover.selectAll') }}
      </button>
      <button
        class="btn btn-primary"
        @click="reopen"
        :disabled="selected.size === 0 || reopening"
      >
        {{ reopening ? t('recover.reopening') : t('recover.reopen') }}
      </button>
    </template>
  </ModalShell>
</template>

<style scoped>
.recover {
  min-width: 820px;
  max-width: 1100px;
}
.intro {
  font-size: var(--text-sm);
  margin-bottom: var(--gap-4);
}
.controls {
  display: flex;
  align-items: center;
  gap: var(--gap-3);
  margin-bottom: var(--gap-4);
}
.controls .range {
  display: flex;
  align-items: center;
  gap: var(--gap-2);
}
.controls .select {
  font-size: var(--text-sm);
  padding: 4px 8px;
  background: var(--bg-surface);
  border: 0.5px solid var(--border-medium);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
}
.controls .spacer {
  flex: 1;
}
.controls .summary {
  font-size: var(--text-sm);
}
.opened-toast {
  font-size: var(--text-sm);
  padding: 8px 12px;
  border-radius: var(--radius);
  background: var(--bg-surface);
  border: 0.5px solid var(--status-ok);
  color: var(--text-primary);
  margin-bottom: var(--gap-3);
}
.warning {
  margin-bottom: var(--gap-3);
}
.empty {
  padding: var(--gap-5);
  text-align: center;
}
.recover-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-sm);
}
.recover-table th {
  text-align: left;
  padding: 8px 12px;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: var(--letter-uppercase);
  color: var(--text-secondary);
  border-bottom: 0.5px solid var(--border-subtle);
  background: var(--bg-surface);
  position: sticky;
  top: 0;
}
.recover-table td {
  padding: 8px 12px;
  border-bottom: 0.5px solid var(--border-subtle);
  max-width: 320px;
  vertical-align: top;
  cursor: pointer;
}
.recover-table tr:hover td {
  background: var(--bg-hover);
}
.recover-table tr.selected td {
  background: var(--bg-surface);
}
.col-check {
  width: 32px;
  text-align: center;
}
.title-line {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 2px;
}
.favicon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}
.title-text {
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.url-line {
  font-size: var(--text-xs);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.source-pill {
  display: inline-block;
  padding: 2px 6px;
  border-radius: var(--radius-pill);
  font-size: var(--text-xs);
  border: 0.5px solid var(--border-subtle);
  background: var(--bg-surface);
}
.source-pill.session {
  border-color: var(--status-ok);
}
.source-pill.history {
  color: var(--text-muted);
}
.footer-spacer {
  flex: 1;
}
</style>
