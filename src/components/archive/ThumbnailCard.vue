<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch, computed } from 'vue';
import type { ArchivedTab } from '@/types/archive';
import { useCategoriesStore } from '@/stores/categories';
import { useTweaksStore } from '@/stores/tweaks';
import { useI18n } from '@/composables/i18n';
import { formatRelative } from '@/utils/time';

const props = defineProps<{ item: ArchivedTab }>();
const emit = defineEmits<{
  open: [item: ArchivedTab];
  detail: [item: ArchivedTab];
  recategorize: [item: ArchivedTab];
  remove: [item: ArchivedTab];
}>();

const categories = useCategoriesStore();
const tweaks = useTweaksStore();
const { t } = useI18n();
const thumbUrl = ref<string>('');

const statusKind = computed<'ok' | 'warn' | 'err'>(() => {
  if (props.item.status === 'gone') return 'err';
  if (props.item.status === 'unchecked') return 'warn';
  return 'ok';
});

const catName = computed(() =>
  categories.nameOf(props.item.categoryId, t('category.uncategorized')),
);

const aspectStyle = computed(() => ({
  '--thumb-aspect':
    tweaks.aspect === '16/9' ? '16 / 9' : tweaks.aspect === 'square' ? '1 / 1' : '4 / 3',
}));

const cardClasses = computed(() => [
  'thumb-card',
  `density-${tweaks.density}`,
  `actions-${tweaks.actions}`,
]);

const faviconColor = computed(() => {
  let h = 0;
  const d = props.item.domain || '';
  for (let i = 0; i < d.length; i++) h = (h * 31 + d.charCodeAt(i)) >>> 0;
  const grays = ['#dadce0', '#c8c8c8', '#bdbdbd', '#a8a8a8', '#929292'];
  return grays[h % grays.length];
});

function buildThumb(): void {
  if (thumbUrl.value) {
    URL.revokeObjectURL(thumbUrl.value);
    thumbUrl.value = '';
  }
  if (props.item.thumbBlob) {
    thumbUrl.value = URL.createObjectURL(props.item.thumbBlob);
  }
}

onMounted(buildThumb);
watch(() => props.item.id, buildThumb);
onBeforeUnmount(() => {
  if (thumbUrl.value) URL.revokeObjectURL(thumbUrl.value);
});
</script>

<template>
  <article :class="cardClasses" :style="aspectStyle">
    <div class="thumb-image" @click="emit('detail', item)">
      <div class="thumb-image-inner">
        <img v-if="thumbUrl" :src="thumbUrl" :alt="item.title" class="thumb-img" />
        <div v-else class="thumb-image-fallback">{{ item.domain }}</div>
      </div>

      <!-- 卡片狀態：頂部位置 = 純圓點，無玻璃膠囊、無文字 -->
      <div
        v-if="tweaks.badgePlacement === 'top'"
        class="thumb-status-dot"
      >
        <span class="status-dot" :class="statusKind"></span>
      </div>

      <div class="thumb-actions" @click.stop>
        <button class="action-btn" @click="emit('open', item)">{{ t('card.open') }}</button>
        <button class="action-btn" @click="emit('recategorize', item)">{{ t('card.categorize') }}</button>
        <button class="action-btn danger" @click="emit('remove', item)">{{ t('card.delete') }}</button>
      </div>
    </div>

    <div class="thumb-meta">
      <div class="thumb-title">{{ item.title }}</div>
      <div class="thumb-domain">
        <div
          v-if="tweaks.showFavicon"
          class="thumb-favicon"
          :style="{ background: faviconColor }"
        ></div>
        <span class="text-truncate">{{ item.domain }}</span>
        <span
          v-if="tweaks.badgePlacement === 'inline'"
          class="inline-dot"
        >
          <span class="status-dot" :class="statusKind"></span>
        </span>
      </div>
      <div class="thumb-footer">
        <span class="thumb-cat-tag">{{ catName }}</span>
        <span class="thumb-time text-mono">{{ formatRelative(item.archivedAt) }}</span>
      </div>
      <div
        v-if="tweaks.badgePlacement === 'footer'"
        class="thumb-status-footer"
      >
        <span class="tag tag-strong">
          <span class="status-dot" :class="statusKind"></span>
          <span>{{ t(`card.status.${statusKind}`) }}</span>
        </span>
      </div>
    </div>

    <div
      v-if="tweaks.actions === 'footer'"
      class="thumb-footer-actions"
      @click.stop
    >
      <button class="action-btn" @click="emit('open', item)">{{ t('card.open') }}</button>
      <button class="action-btn" @click="emit('recategorize', item)">{{ t('card.categorize') }}</button>
      <button class="action-btn" @click="emit('remove', item)">{{ t('card.delete') }}</button>
    </div>
  </article>
</template>

<style scoped>
.thumb-card {
  background: var(--bg-block);
  border: 0.5px solid var(--border-medium);
  border-radius: var(--radius);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  position: relative;
  transition: border-color var(--t-fast), transform var(--t-fast), box-shadow var(--t-fast);
}
.thumb-card:hover {
  border-color: var(--border-strong);
  box-shadow: var(--shadow-card);
}
.thumb-card.density-compact .thumb-meta { padding: 8px 10px; }
.thumb-card.density-spacious .thumb-meta { padding: 14px 14px; }

.thumb-image {
  width: 100%;
  aspect-ratio: var(--thumb-aspect, 4 / 3);
  position: relative;
  overflow: hidden;
  border-bottom: 0.5px solid var(--border-medium);
  background: var(--bg-surface);
  cursor: pointer;
}
.thumb-image-inner {
  position: absolute;
  inset: 0;
}
.thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.thumb-image-fallback {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: repeating-linear-gradient(
    45deg,
    var(--bg-surface) 0 8px,
    var(--bg-surface-2) 8px 9px
  );
  color: var(--text-dim);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

/* 卡片狀態 dot：純圓點，無膠囊 */
.thumb-status-dot {
  position: absolute;
  top: 8px;
  left: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  pointer-events: none;
}
/* thumb 卡片左上的 status dot — 沿用全域 2×2 px（無需覆寫） */

/* Hover overlay actions */
.thumb-actions {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: var(--gap-1);
  padding: 10px;
  opacity: 0;
  transition: opacity var(--t-base), background var(--t-base);
  pointer-events: none;
}
.thumb-image:hover .thumb-actions {
  opacity: 1;
  background: rgba(0, 0, 0, 0.35);
  pointer-events: auto;
}

/* actions-corner 變體：永遠顯示在右上 */
.thumb-card.actions-corner .thumb-actions {
  background: transparent;
  pointer-events: none;
  align-items: flex-start;
  justify-content: flex-end;
  padding: 6px;
  opacity: 1;
}
.thumb-card.actions-corner .thumb-image:hover .thumb-actions {
  background: transparent;
}
.thumb-card.actions-corner .thumb-actions > * {
  pointer-events: auto;
}

/* actions-footer 變體：縮圖內部不顯示 actions */
.thumb-card.actions-footer .thumb-actions {
  display: none;
}
.thumb-footer-actions {
  display: flex;
  gap: var(--gap-1);
  padding: 8px 10px;
  border-top: 0.5px solid var(--border-medium);
  background: var(--bg-surface);
}
.thumb-footer-actions .action-btn {
  background: var(--bg-block);
  height: 22px;
  flex: 1;
  justify-content: center;
  display: inline-flex;
  align-items: center;
}

.thumb-meta {
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.thumb-title {
  font-size: var(--text-base);
  font-weight: 500;
  color: var(--text-primary);
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.thumb-domain {
  display: flex;
  align-items: center;
  gap: var(--gap-1);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-muted);
  letter-spacing: 0.02em;
  min-width: 0;
}
.thumb-favicon {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  flex-shrink: 0;
}
.inline-dot {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}
.thumb-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 2px;
}
.thumb-cat-tag {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 600;
  color: var(--text-secondary);
}
.thumb-time {
  font-size: var(--text-xs);
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.thumb-status-footer {
  display: flex;
  gap: 6px;
  margin-top: 6px;
}
</style>
