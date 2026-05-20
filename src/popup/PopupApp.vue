<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useCategoriesStore } from '@/stores/categories';
import { useSettingsStore } from '@/stores/settings';
import { useUiPrefsStore } from '@/stores/ui-prefs';
import { useI18n } from '@/composables/i18n';
import StatusDot from '@/components/ui/StatusDot.vue';
import LabelMicro from '@/components/ui/LabelMicro.vue';
import type { RuntimeMessage } from '@/types/messages';
import type { TabCandidate } from '@/types/archive';

const categories = useCategoriesStore();
const settings = useSettingsStore();
const prefs = useUiPrefsStore();
const { t } = useI18n();
const loading = ref(true);
const candidates = ref<TabCandidate[]>([]);
const total = ref(0);
const suggested = ref(0);
const unassigned = ref(0);

const dotState = computed<'ok' | 'warn' | 'idle'>(() => {
  if (settings.organizeInProgress) return 'warn';
  if (total.value === 0) return 'idle';
  return 'ok';
});

const topDomains = computed(() => {
  const counts = new Map<string, number>();
  for (const c of candidates.value) {
    counts.set(c.domain, (counts.get(c.domain) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
});

async function scan(): Promise<void> {
  loading.value = true;
  try {
    const res = (await chrome.runtime.sendMessage({
      type: 'scan/request',
    } satisfies RuntimeMessage)) as
      | {
          type: 'scan/response';
          candidates: TabCandidate[];
          total: number;
          suggested: number;
          unassigned: number;
        }
      | undefined;
    if (res) {
      candidates.value = res.candidates;
      total.value = res.total;
      suggested.value = res.suggested;
      unassigned.value = res.unassigned;
    }
  } finally {
    loading.value = false;
  }
}

async function organize(): Promise<void> {
  await chrome.runtime.sendMessage({ type: 'organize/start' } satisfies RuntimeMessage);
  window.close();
}

async function openManager(): Promise<void> {
  await chrome.runtime.sendMessage({ type: 'manager/open' } satisfies RuntimeMessage);
  window.close();
}

async function openCategorySettings(): Promise<void> {
  await chrome.tabs.create({
    url: chrome.runtime.getURL('src/manager/manager.html') + '#categories',
  });
  window.close();
}

onMounted(async () => {
  await prefs.load();
  await settings.load();
  await categories.refresh();
  await scan();
});
</script>

<template>
  <div class="popup">
    <header class="popup-header">
      <div class="brand">
        <StatusDot :state="dotState" />
        <span class="brand-name">TabOrganizer</span>
      </div>
      <LabelMicro text="v0.1" />
    </header>

    <section class="popup-stats">
      <div class="stat-row">
        <span class="stat-label">{{ t('ctrl.organize.candidates') }}</span>
        <span class="stat-value text-mono">{{ loading ? '—' : total }}</span>
      </div>
      <div class="stat-row sub">
        <span class="stat-label">{{ t('ctrl.organize.suggested') }}</span>
        <span class="stat-value text-mono">{{ loading ? '—' : suggested }}</span>
      </div>
      <div class="stat-row sub">
        <span class="stat-label">{{ t('category.uncategorized') }}</span>
        <span class="stat-value text-mono">{{ loading ? '—' : unassigned }}</span>
      </div>
    </section>

    <section class="popup-actions">
      <button
        class="btn btn-primary"
        :disabled="loading || total === 0 || settings.organizeInProgress"
        @click="organize"
      >
        {{ settings.organizeInProgress ? t('header.organize.busy') : t('header.organize') }}
      </button>
      <button class="btn" @click="openManager">{{ t('header.control') }}</button>
      <button class="btn btn-ghost" @click="openCategorySettings">
        {{ t('ctrl.organize.categories') }}
      </button>
    </section>

    <footer class="popup-footer">
      <LabelMicro text="DOMAINS" />
      <ul class="domain-list scroll-y">
        <li v-for="d in topDomains" :key="d.domain" class="domain-item">
          <span class="text-truncate">{{ d.domain }}</span>
          <span class="text-mono text-muted">{{ d.count }}</span>
        </li>
        <li v-if="!loading && total === 0" class="domain-empty text-muted">
          {{ t('ctrl.organize.noTabs') }}
        </li>
      </ul>
    </footer>
  </div>
</template>

<style scoped>
.popup {
  width: 360px;
  min-height: 420px;
  background: var(--bg-shell);
  padding: var(--gap-4);
  display: flex;
  flex-direction: column;
  gap: var(--gap-3);
}
.popup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.brand {
  display: flex;
  align-items: center;
  gap: var(--gap-2);
}
.brand-name {
  font-size: var(--text-lg);
  font-weight: 600;
}
.popup-stats {
  background: var(--bg-block);
  border: 0.5px solid var(--border-medium);
  border-radius: var(--radius);
  padding: var(--gap-3) var(--gap-4);
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.stat-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--text-md);
}
.stat-row.sub {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}
.stat-value {
  font-weight: 600;
}
.popup-actions {
  display: flex;
  flex-direction: column;
  gap: var(--gap-2);
}
.popup-footer {
  background: var(--bg-block);
  border: 0.5px solid var(--border-medium);
  border-radius: var(--radius);
  padding: var(--gap-3) var(--gap-4);
  display: flex;
  flex-direction: column;
  gap: var(--gap-2);
  flex: 1 1 auto;
  min-height: 0;
}
.domain-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 140px;
}
.domain-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--text-sm);
  padding: 4px 0;
  border-bottom: 0.5px solid var(--border-subtle);
}
.domain-item:last-child {
  border-bottom: none;
}
.domain-empty {
  font-size: var(--text-sm);
  padding: var(--gap-2) 0;
}
</style>
