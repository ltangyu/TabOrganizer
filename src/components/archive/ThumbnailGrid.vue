<script setup lang="ts">
import type { ArchivedTab } from '@/types/archive';
import { useCategoriesStore } from '@/stores/categories';
import { useTweaksStore } from '@/stores/tweaks';
import { useI18n } from '@/composables/i18n';
import { formatRelative } from '@/utils/time';
import ThumbnailCard from './ThumbnailCard.vue';
import { computed } from 'vue';

const props = defineProps<{ items: ArchivedTab[]; mode: 'grid' | 'list' }>();
const emit = defineEmits<{
  open: [item: ArchivedTab];
  detail: [item: ArchivedTab];
  recategorize: [item: ArchivedTab];
  remove: [item: ArchivedTab];
}>();

const categories = useCategoriesStore();
const tweaks = useTweaksStore();
const { t } = useI18n();
const isGrid = computed(() => props.mode === 'grid');

const gridStyle = computed(() => ({
  '--cols': String(tweaks.cols),
  '--card-gap': `${tweaks.gap}px`,
}));
</script>

<template>
  <div v-if="items.length === 0" class="empty">
    <span class="label-micro">EMPTY</span>
    <p class="text-secondary">{{ t('empty.archive') }}</p>
  </div>
  <div v-else-if="isGrid" class="thumb-grid scroll-y" :style="gridStyle">
    <ThumbnailCard
      v-for="item in items"
      :key="item.id"
      :item="item"
      @open="(i) => emit('open', i)"
      @detail="(i) => emit('detail', i)"
      @recategorize="(i) => emit('recategorize', i)"
      @remove="(i) => emit('remove', i)"
    />
  </div>
  <div v-else class="list-wrap scroll-y">
    <table class="list-table">
      <thead>
        <tr>
          <th></th>
          <th>{{ t('detail.label.title') }}</th>
          <th>{{ t('detail.label.domain') }}</th>
          <th>{{ t('detail.label.category') }}</th>
          <th>{{ t('excluded.col.time') }}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in items" :key="item.id" class="list-row" @click="emit('detail', item)">
          <td>
            <span
              class="status-dot"
              :class="item.status === 'gone' ? 'err' : item.status === 'unchecked' ? 'warn' : 'ok'"
            ></span>
          </td>
          <td class="cell-title text-truncate">{{ item.title }}</td>
          <td class="text-mono text-muted text-truncate">{{ item.domain }}</td>
          <td>
            <span class="thumb-cat-tag">
              {{ categories.nameOf(item.categoryId, t('category.uncategorized')) }}
            </span>
          </td>
          <td class="text-muted">{{ formatRelative(item.archivedAt) }}</td>
          <td class="cell-actions">
            <button class="btn btn-sm" @click.stop="emit('open', item)">{{ t('card.open') }}</button>
            <button class="btn btn-sm btn-ghost" @click.stop="emit('recategorize', item)">{{ t('card.categorize') }}</button>
            <button class="btn btn-sm btn-danger" @click.stop="emit('remove', item)">{{ t('card.delete') }}</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--gap-2);
  padding: var(--gap-7);
  flex: 1 1 auto;
  color: var(--text-secondary);
}
.thumb-grid {
  display: grid;
  grid-template-columns: repeat(var(--cols, 5), minmax(0, 1fr));
  gap: var(--card-gap, 16px);
  padding: 20px 24px 40px;
  flex: 1 1 auto;
  align-content: start;
}
@media (max-width: 1280px) {
  .thumb-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
@media (max-width: 960px) {
  .thumb-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 720px) {
  .thumb-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

.list-wrap {
  flex: 1 1 auto;
  padding: 20px 24px 40px;
}
.list-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--bg-block);
  border: 0.5px solid var(--border-medium);
  border-radius: var(--radius);
  overflow: hidden;
}
.list-table th {
  text-align: left;
  padding: 10px 12px;
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-family: var(--font-mono);
  color: var(--text-secondary);
  border-bottom: 0.5px solid var(--border-subtle);
  background: var(--bg-surface);
  font-weight: 600;
}
.list-row {
  cursor: pointer;
  transition: background-color var(--t-fast);
}
.list-row:hover {
  background: var(--bg-hover);
}
.list-row td {
  padding: 8px 12px;
  font-size: var(--text-sm);
  border-bottom: 0.5px solid var(--border-subtle);
}
.list-row:last-child td {
  border-bottom: none;
}
.cell-title {
  font-weight: 500;
  max-width: 360px;
}
.cell-actions {
  display: flex;
  gap: var(--gap-1);
  justify-content: flex-end;
}
.thumb-cat-tag {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 600;
  color: var(--text-secondary);
}
</style>
