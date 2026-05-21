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
const scanning = ref(false);
const reopening = ref(false);
const lastOpenedCount = ref<number | null>(null);
const lastSkippedCount = ref<number>(0);

async function scan(): Promise<void> {
  scanning.value = true;
  lastOpenedCount.value = null;
  try {
    const resp = (await chrome.runtime.sendMessage({
      type: 'recover/scan',
    } satisfies RuntimeMessage)) as RuntimeMessage | undefined;
    if (resp?.type === 'recover/scan-response') {
      missing.value = resp.missing;
    }
  } finally {
    scanning.value = false;
  }
}

async function restoreAll(): Promise<void> {
  if (missing.value.length === 0) return;
  reopening.value = true;
  try {
    const urls = missing.value.map((m) => m.url);
    const resp = (await chrome.runtime.sendMessage({
      type: 'recover/reopen',
      urls,
    } satisfies RuntimeMessage)) as RuntimeMessage | undefined;
    if (resp?.type === 'recover/reopen-response') {
      lastOpenedCount.value = resp.opened;
      lastSkippedCount.value = resp.skipped;
      // 開完重新掃，已開的 URL 應該消失
      await scan();
    }
  } finally {
    reopening.value = false;
  }
}

watch(
  () => props.open,
  (v) => {
    if (v) {
      scan(); // 開啟視窗就自動掃
    } else {
      missing.value = [];
      lastOpenedCount.value = null;
    }
  },
);

function sourceLabel(source: MissingTab['source']): string {
  return source === 'organize-snapshot'
    ? t('recover.source.snapshot')
    : t('recover.source.session');
}

const snapshotCount = computed(
  () => missing.value.filter((m) => m.source === 'organize-snapshot').length,
);
const sessionCount = computed(
  () => missing.value.filter((m) => m.source === 'session').length,
);
</script>

<template>
  <ModalShell :open="open" :title="t('recover.title')" @close="emit('close')" solid>
    <div class="recover">
      <p class="intro text-muted">{{ t('recover.intro') }}</p>

      <!-- 結果區：載入中 / 找到 N / 空 -->
      <div v-if="scanning" class="loading-row">
        <span class="text-muted">{{ t('recover.scanning') }}</span>
      </div>

      <div v-else-if="missing.length === 0" class="empty-row">
        <span class="text-muted">{{ t('recover.empty') }}</span>
        <button class="btn btn-sm" @click="scan">{{ t('recover.scan') }}</button>
      </div>

      <div v-else class="summary-row">
        <div class="counts">
          <span class="big-count">{{ missing.length }}</span>
          <span class="text-muted">{{ t('recover.found.suffix') }}</span>
        </div>
        <div class="breakdown text-muted label-micro">
          <span v-if="snapshotCount > 0">
            {{ t('recover.breakdown.snapshot', { n: snapshotCount }) }}
          </span>
          <span v-if="sessionCount > 0">
            {{ t('recover.breakdown.session', { n: sessionCount }) }}
          </span>
        </div>
      </div>

      <div v-if="lastOpenedCount !== null" class="opened-toast">
        {{ t('recover.reopened', { n: lastOpenedCount }) }}
        <span v-if="lastSkippedCount > 0" class="text-muted">
          ｜ {{ t('recover.skipped', { n: lastSkippedCount }) }}
        </span>
      </div>

      <table v-if="missing.length > 0" class="recover-table">
        <thead>
          <tr>
            <th>{{ t('recover.col.title') }}</th>
            <th>{{ t('recover.col.domain') }}</th>
            <th>{{ t('recover.col.source') }}</th>
            <th>{{ t('recover.col.time') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in missing" :key="m.url">
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
      <button class="btn" @click="scan" :disabled="scanning || reopening">
        {{ scanning ? t('recover.scanning') : t('recover.rescan') }}
      </button>
      <div class="footer-spacer" />
      <button
        class="btn btn-primary"
        @click="restoreAll"
        :disabled="missing.length === 0 || reopening || scanning"
      >
        {{
          reopening
            ? t('recover.reopening')
            : t('recover.restoreAll', { n: missing.length })
        }}
      </button>
    </template>
  </ModalShell>
</template>

<style scoped>
.recover {
  min-width: 760px;
  max-width: 1100px;
}
.intro {
  font-size: var(--text-sm);
  margin-bottom: var(--gap-4);
  line-height: 1.5;
}
.loading-row,
.empty-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--gap-3);
  padding: var(--gap-5);
  font-size: var(--text-sm);
}
.summary-row {
  display: flex;
  align-items: baseline;
  gap: var(--gap-4);
  margin-bottom: var(--gap-3);
  padding: var(--gap-3);
  background: var(--bg-surface);
  border: 0.5px solid var(--border-subtle);
  border-radius: var(--radius);
}
.counts {
  display: flex;
  align-items: baseline;
  gap: var(--gap-2);
}
.big-count {
  font-size: 28px;
  font-weight: 600;
  font-family: var(--font-mono);
  color: var(--text-primary);
  line-height: 1;
}
.breakdown {
  display: flex;
  gap: var(--gap-3);
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
.source-pill.organize-snapshot {
  border-color: var(--status-ok);
  font-weight: 600;
}
.source-pill.session {
  color: var(--text-muted);
}
.footer-spacer {
  flex: 1;
}
</style>
