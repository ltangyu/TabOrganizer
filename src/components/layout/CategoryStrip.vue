<script setup lang="ts">
import { computed } from 'vue';
import { useCategoriesStore } from '@/stores/categories';
import { useArchiveStore } from '@/stores/archive';
import { useI18n } from '@/composables/i18n';

const categories = useCategoriesStore();
const archive = useArchiveStore();
const { t } = useI18n();

const emit = defineEmits<{
  'manage-categories': [];
  'reopen-category': [id: number];
}>();

const counts = computed(() => {
  const m = new Map<number | null, number>();
  for (const a of archive.items) m.set(a.categoryId, (m.get(a.categoryId) ?? 0) + 1);
  return m;
});

function select(id: number | null | 'all'): void {
  archive.filterCategoryId = id;
}

function isActive(id: number | null | 'all'): boolean {
  return archive.filterCategoryId === id;
}
</script>

<template>
  <nav class="category-strip">
    <button
      class="cat-chip"
      :class="{ active: isActive('all') }"
      @click="select('all')"
    >
      <span class="cat-name">{{ t('category.all') }}</span>
      <span class="cat-count text-mono">{{ archive.items.length }}</span>
    </button>

    <button
      v-for="c in categories.categories"
      :key="c.id"
      class="cat-chip"
      :class="{ active: isActive(c.id ?? null) }"
      @click="select(c.id ?? null)"
    >
      <span class="cat-name">{{ categories.displayName(c) }}</span>
      <span class="cat-count text-mono">{{ counts.get(c.id ?? -1) ?? 0 }}</span>
      <span
        v-if="(counts.get(c.id ?? -1) ?? 0) > 0 && !isActive(c.id ?? null)"
        class="cat-reopen"
        @click.stop="c.id != null && emit('reopen-category', c.id)"
      >
        {{ t('category.reopen') }}
      </span>
    </button>

    <button
      class="cat-chip"
      :class="{ active: isActive(null) }"
      @click="select(null)"
    >
      <span class="cat-name">{{ t('category.uncategorized') }}</span>
      <span class="cat-count text-mono">{{ counts.get(null) ?? 0 }}</span>
    </button>

    <div class="cat-strip-end">
      <button class="btn btn-sm btn-ghost" @click="emit('manage-categories')">
        {{ t('category.manage') }}
      </button>
    </div>
  </nav>
</template>

<style scoped>
.category-strip {
  display: flex;
  align-items: stretch;
  gap: var(--gap-1);
  padding: 10px 24px;
  background: var(--bg-block);
  border-bottom: 0.5px solid var(--border-medium);
  overflow-x: auto;
  flex-shrink: 0;
}
.cat-chip {
  appearance: none;
  display: flex;
  align-items: center;
  gap: var(--gap-2);
  height: 32px;
  padding: 0 12px;
  border-radius: var(--radius);
  border: 0.5px solid var(--border-medium);
  background: var(--bg-block);
  color: var(--text-primary);
  font-family: var(--font-sans);
  cursor: pointer;
  transition: background var(--t-fast), border-color var(--t-fast), color var(--t-fast);
  position: relative;
  white-space: nowrap;
  flex-shrink: 0;
}
.cat-chip:hover {
  background: var(--bg-surface);
  border-color: var(--border-strong);
}
.cat-chip.active {
  background: var(--text-primary);
  color: var(--text-on-dark);
  border-color: var(--text-primary);
}
.cat-chip.active .cat-count {
  color: rgba(255, 255, 255, 0.6);
}
.cat-name {
  font-size: var(--text-base);
  font-weight: 500;
}
.cat-count {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.cat-reopen {
  position: absolute;
  inset: 0;
  background: var(--text-primary);
  color: var(--text-on-dark);
  border-radius: inherit;
  display: none;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.06em;
}
.cat-chip:not(.active):hover .cat-reopen {
  display: flex;
}

.cat-strip-end {
  display: flex;
  gap: var(--gap-1);
  margin-left: auto;
  flex-shrink: 0;
  padding-left: var(--gap-3);
}
</style>
