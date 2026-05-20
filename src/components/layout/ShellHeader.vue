<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useArchiveStore } from '@/stores/archive';
import { useSettingsStore } from '@/stores/settings';
import { useI18n } from '@/composables/i18n';

const archive = useArchiveStore();
const settings = useSettingsStore();
const { t } = useI18n();
const searchRef = ref<HTMLInputElement | null>(null);

const emit = defineEmits<{
  organize: [];
  'open-excluded': [];
  'open-control': [];
}>();

defineProps<{ readyCount: number }>();

function focusSearch(): void {
  searchRef.value?.focus();
}

function handleKey(e: KeyboardEvent): void {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    focusSearch();
  }
}

onMounted(() => window.addEventListener('keydown', handleKey));
onBeforeUnmount(() => window.removeEventListener('keydown', handleKey));
</script>

<template>
  <header class="shell-header">
    <div class="brand">
      <div class="brand-mark"><i /></div>
      <span class="brand-name">TabOrganizer</span>
      <span class="brand-section">{{ t('header.brand.section') }}</span>
    </div>

    <div class="ready-state">
      <span class="label-micro">
        {{ settings.organizeInProgress ? t('header.organizing') : `${t('header.ready')} · ${readyCount}` }}
      </span>
    </div>

    <div class="search-input">
      <span class="search-icon" />
      <input
        ref="searchRef"
        class="input"
        type="text"
        :placeholder="t('header.search.placeholder')"
        v-model="archive.searchQuery"
      />
      <span class="kbd">⌘K</span>
    </div>

    <div class="header-spacer" />

    <div class="header-actions">
      <div class="view-toggle">
        <button
          :class="{ active: archive.viewMode === 'grid' }"
          @click="archive.viewMode = 'grid'"
        >
          {{ t('header.view.grid') }}
        </button>
        <button
          :class="{ active: archive.viewMode === 'list' }"
          @click="archive.viewMode = 'list'"
        >
          {{ t('header.view.list') }}
        </button>
      </div>
      <button class="btn" @click="emit('open-excluded')">
        {{ t('header.excluded') }} · {{ archive.excluded.length }}
      </button>
      <button class="btn" @click="emit('open-control')">{{ t('header.control') }}</button>
      <button
        class="btn btn-primary"
        :disabled="settings.organizeInProgress"
        @click="emit('organize')"
      >
        {{ settings.organizeInProgress ? t('header.organize.busy') : t('header.organize') }}
      </button>
    </div>
  </header>
</template>

<style scoped>
.shell-header {
  display: flex;
  align-items: center;
  gap: var(--gap-3);
  padding: 14px 24px;
  background: var(--bg-block);
  border-bottom: 0.5px solid var(--border-medium);
  position: sticky;
  top: 0;
  z-index: 10;
}
.brand {
  display: flex;
  align-items: center;
  gap: var(--gap-2);
  flex-shrink: 0;
}
.ready-state {
  display: flex;
  align-items: center;
  gap: var(--gap-2);
  margin-left: 4px;
  flex-shrink: 0;
}
.search-input {
  margin-left: var(--gap-6);
}
.header-spacer {
  flex: 1;
}
.header-actions {
  display: flex;
  gap: var(--gap-2);
  align-items: center;
  flex-shrink: 0;
}
</style>
