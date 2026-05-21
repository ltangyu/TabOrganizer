<script setup lang="ts">
import type { ArchivedTab } from '@/types/archive';
import { useCategoriesStore } from '@/stores/categories';
import { useTweaksStore } from '@/stores/tweaks';
import { useI18n } from '@/composables/i18n';
import { formatRelative } from '@/utils/time';
import ThumbnailCard from './ThumbnailCard.vue';
import { computed } from 'vue';

import { ref, onBeforeUnmount, onMounted } from 'vue';

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

// 回到最上面按鈕：scroll > 400px 顯示。
// 注意：manager 的 layout（.app min-height:100vh + .archive-main flex:1 auto）
// 讓內容超過視窗高度時是 window/body 在 scroll，不是 .thumb-grid。
// 所以監聽 window.scroll、用 window.scrollTo 回頂。
const showScrollTop = ref(false);
const SCROLL_THRESHOLD = 400;

function handleWindowScroll(): void {
  // 同時偵測 documentElement 跟 window.scrollY，兼容不同瀏覽器/layout
  const sy = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
  showScrollTop.value = sy > SCROLL_THRESHOLD;
}

function scrollToTop(): void {
  // 平滑 scroll 回頂；同時對 documentElement 跟 body 操作以兼容
  window.scrollTo({ top: 0, behavior: 'smooth' });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

onMounted(() => {
  window.addEventListener('scroll', handleWindowScroll, { passive: true });
  handleWindowScroll();
});
onBeforeUnmount(() => {
  window.removeEventListener('scroll', handleWindowScroll);
});
</script>

<template>
  <div v-if="items.length === 0" class="empty">
    <span class="label-micro">EMPTY</span>
    <p class="text-secondary">{{ t('empty.archive') }}</p>
  </div>
  <div
    v-else-if="isGrid"
    class="thumb-grid scroll-y"
    :style="gridStyle"
  >
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
  <div
    v-else
    class="list-wrap scroll-y"
  >
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

  <!-- 回到最上面浮動按鈕：scroll > 400px 才出現 -->
  <Transition name="scroll-top-fade">
    <button
      v-show="showScrollTop"
      class="scroll-to-top"
      @click="scrollToTop"
      :aria-label="t('scrollTop.aria')"
      :title="t('scrollTop.aria')"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <line x1="12" y1="19" x2="12" y2="5" />
        <polyline points="5 12 12 5 19 12" />
      </svg>
    </button>
  </Transition>
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

/* 回到最上面浮動按鈕：右下角，固定於 viewport */
.scroll-to-top {
  appearance: none;
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 800;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-pill);
  border: 0.5px solid var(--border-medium);
  background: var(--text-primary);
  color: var(--text-on-dark);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: var(--shadow-card);
  transition: transform var(--t-fast), background var(--t-fast), box-shadow var(--t-fast);
}
.scroll-to-top:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-modal);
}
.scroll-to-top:active {
  transform: translateY(0);
}
.scroll-top-fade-enter-active,
.scroll-top-fade-leave-active {
  transition: opacity var(--t-base), transform var(--t-base);
}
.scroll-top-fade-enter-from,
.scroll-top-fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
