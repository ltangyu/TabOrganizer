<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import ShellHeader from '@/components/layout/ShellHeader.vue';
import CategoryStrip from '@/components/layout/CategoryStrip.vue';
import ArchiveFilters from '@/components/archive/ArchiveFilters.vue';
import ThumbnailGrid from '@/components/archive/ThumbnailGrid.vue';
import SnapshotDetailModal from '@/components/archive/SnapshotDetailModal.vue';
import ExcludedListPanel from '@/components/archive/ExcludedListPanel.vue';
import CategoryEditor from '@/components/category/CategoryEditor.vue';
import CategoryPicker from '@/components/category/CategoryPicker.vue';
import OrganizeProgressOverlay from '@/components/progress/OrganizeProgressOverlay.vue';
import ControlPanel from '@/components/control/ControlPanel.vue';
import { useArchiveStore } from '@/stores/archive';
import { useCategoriesStore } from '@/stores/categories';
import { useSettingsStore } from '@/stores/settings';
import { useProgressStore } from '@/stores/progress';
import { useUiPrefsStore } from '@/stores/ui-prefs';
import { useI18n } from '@/composables/i18n';
import { searchArchives } from '@/modules/search-engine';
import type { ArchivedTab } from '@/types/archive';
import type { RuntimeMessage } from '@/types/messages';

const archive = useArchiveStore();
const categories = useCategoriesStore();
const settings = useSettingsStore();
const progress = useProgressStore();
const prefs = useUiPrefsStore();
const { t } = useI18n();

const detailItem = ref<ArchivedTab | null>(null);
const pickerItem = ref<ArchivedTab | null>(null);
const showCategoryEditor = ref(false);
const showExcluded = ref(false);
const showControl = ref(false);

const filteredAndSearched = computed(() =>
  searchArchives(archive.filtered, categories.categories, archive.searchQuery),
);

const readyCount = computed(() => archive.items.length);

async function onOrganize(): Promise<void> {
  await chrome.runtime.sendMessage({ type: 'organize/start' } satisfies RuntimeMessage);
}

async function openItem(item: ArchivedTab): Promise<void> {
  await chrome.tabs.create({ url: item.url });
}

async function removeItem(item: ArchivedTab): Promise<void> {
  if (item.id == null) return;
  if (!confirm(t('confirm.delete'))) return;
  await archive.remove(item.id);
  if (detailItem.value?.id === item.id) detailItem.value = null;
}

function openPicker(item: ArchivedTab): void {
  pickerItem.value = item;
}

async function pickCategory(id: number | null): Promise<void> {
  if (pickerItem.value?.id == null) return;
  await archive.recategorize(pickerItem.value.id, id);
  pickerItem.value = null;
}

async function reopenCategory(categoryId: number): Promise<void> {
  await chrome.runtime.sendMessage({
    type: 'reopen/category',
    categoryId,
  } satisfies RuntimeMessage);
}

let detach: (() => void) | null = null;

function handleHash(): void {
  const h = window.location.hash;
  if (h === '#categories') showCategoryEditor.value = true;
  if (h === '#control' || h === '#settings' || h === '#popup') showControl.value = true;
  if (h === '#excluded') showExcluded.value = true;
}

const lastRevalidate = ref<{ checked: number; gone: number; at: number } | null>(null);

const messageHandler = (msg: RuntimeMessage): void => {
  if (msg.type === 'archive/changed') {
    archive.refresh();
  } else if (msg.type === 'revalidate/done') {
    lastRevalidate.value = { checked: msg.checked, gone: msg.gone, at: Date.now() };
    archive.refresh();
    // 5 秒後自動清除提示
    setTimeout(() => {
      if (lastRevalidate.value && Date.now() - lastRevalidate.value.at >= 5000) {
        lastRevalidate.value = null;
      }
    }, 5500);
  }
};

onMounted(async () => {
  await prefs.load();
  await settings.load();
  await categories.refresh();
  await archive.refresh();
  detach = progress.attachListener();
  chrome.runtime.onMessage.addListener(messageHandler);
  handleHash();
  window.addEventListener('hashchange', handleHash);
});

onBeforeUnmount(() => {
  detach?.();
  chrome.runtime.onMessage.removeListener(messageHandler);
  window.removeEventListener('hashchange', handleHash);
});
</script>

<template>
  <div class="app">
    <ShellHeader
      :ready-count="readyCount"
      @organize="onOrganize"
      @open-excluded="showExcluded = true"
      @open-control="showControl = true"
    />
    <CategoryStrip
      @manage-categories="showCategoryEditor = true"
      @reopen-category="reopenCategory"
    />
    <ArchiveFilters />

    <main class="archive-main">
      <ThumbnailGrid
        :items="filteredAndSearched"
        :mode="archive.viewMode"
        @open="openItem"
        @detail="(i) => (detailItem = i)"
        @recategorize="openPicker"
        @remove="removeItem"
      />
    </main>

    <SnapshotDetailModal
      :item="detailItem"
      @close="detailItem = null"
      @open="openItem"
      @remove="removeItem"
      @recategorize="openPicker"
    />
    <CategoryPicker :item="pickerItem" @close="pickerItem = null" @pick="pickCategory" />
    <CategoryEditor :open="showCategoryEditor" @close="showCategoryEditor = false" />
    <ExcludedListPanel :open="showExcluded" @close="showExcluded = false" />
    <ControlPanel
      :open="showControl"
      @close="showControl = false"
      @organize="onOrganize"
      @manage-categories="showCategoryEditor = true"
    />
    <OrganizeProgressOverlay />

    <Transition name="toast">
      <div v-if="lastRevalidate" class="revalidate-toast glass-box">
        <span class="label-micro">{{ t('toast.revalidate.done') }}</span>
        <span class="text-mono">
          {{ t('toast.revalidate.format', lastRevalidate) }}
        </span>
        <button class="btn-ghost-x" @click="lastRevalidate = null" :aria-label="t('modal.close')">×</button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-shell);
}
.archive-main {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.revalidate-toast {
  position: fixed;
  bottom: 16px;
  right: 16px;
  z-index: 900;
  display: inline-flex;
  align-items: center;
  gap: var(--gap-3);
  padding: 10px 14px;
  font-size: var(--text-sm);
  box-shadow: var(--shadow-modal);
}
.btn-ghost-x {
  appearance: none;
  border: none;
  background: transparent;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background var(--t-fast), color var(--t-fast);
}
.btn-ghost-x:hover {
  background: rgba(0, 0, 0, 0.06);
  color: var(--text-primary);
}
.toast-enter-active,
.toast-leave-active {
  transition: opacity var(--t-base), transform var(--t-base);
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
