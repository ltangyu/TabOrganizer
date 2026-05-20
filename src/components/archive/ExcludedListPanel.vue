<script setup lang="ts">
import ModalShell from '@/components/ui/ModalShell.vue';
import { useArchiveStore } from '@/stores/archive';
import { useI18n } from '@/composables/i18n';
import { formatTimestamp } from '@/utils/time';

defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const archive = useArchiveStore();
const { t } = useI18n();

function reasonLabel(reason: string): string {
  switch (reason) {
    case 'http-error':
      return t('excluded.reason.http');
    case 'timeout':
      return t('excluded.reason.timeout');
    case 'network-error':
      return t('excluded.reason.network');
    default:
      return reason;
  }
}
</script>

<template>
  <ModalShell :open="open" :title="t('excluded.title')" @close="emit('close')">
    <div class="excluded">
      <p v-if="archive.excluded.length === 0" class="text-muted empty">
        {{ t('excluded.empty') }}
      </p>
      <table v-else class="excluded-table">
        <thead>
          <tr>
            <th>{{ t('excluded.col.title') }}</th>
            <th>{{ t('excluded.col.url') }}</th>
            <th>{{ t('excluded.col.reason') }}</th>
            <th>{{ t('excluded.col.code') }}</th>
            <th>{{ t('excluded.col.time') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in archive.excluded" :key="r.id">
            <td class="text-truncate">{{ r.title }}</td>
            <td class="text-mono text-truncate">{{ r.url }}</td>
            <td>{{ reasonLabel(r.reason) }}</td>
            <td class="text-mono">{{ r.statusCode ?? '—' }}</td>
            <td class="text-muted">{{ formatTimestamp(r.excludedAt) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </ModalShell>
</template>

<style scoped>
.excluded {
  min-width: 720px;
}
.excluded-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-sm);
}
.excluded-table th {
  text-align: left;
  padding: 8px 12px;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: var(--letter-uppercase);
  color: var(--text-secondary);
  border-bottom: 0.5px solid var(--border-subtle);
  background: var(--bg-surface);
}
.excluded-table td {
  padding: 8px 12px;
  border-bottom: 0.5px solid var(--border-subtle);
  max-width: 240px;
}
.empty {
  padding: var(--gap-5);
  text-align: center;
}
</style>
