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

/**
 * 排序規則：
 * 1. 一般分類（非內建）在前：按項目數量多到少排序，多的更顯眼。
 * 2. 內建分類（收件匣 等）排在後面，跟「未分類」一樣放在最右邊，
 *    因為通常為空 / 是 fallback 容器，不該佔前排好位置。
 */
const regularCategories = computed(() =>
  categories.categories
    .filter((c) => !c.builtinKey)
    .slice()
    .sort((a, b) => {
      const ca = counts.value.get(a.id ?? -1) ?? 0;
      const cb = counts.value.get(b.id ?? -1) ?? 0;
      return cb - ca;
    }),
);

const builtinCategories = computed(() =>
  categories.categories.filter((c) => !!c.builtinKey),
);

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

    <!--
      之前：cat-reopen 是 cat-chip <button> 內的 <span>，@click.stop 無效因為
      HTML 規範下 button 把整塊視為單一可點區，內層 span 的 click handler
      不被瀏覽器一致認可 → 永遠觸發外層 button 的 select() 切換過濾。
      改：chip 跟 reopen-btn 並排成兄弟元素，用 wrapper 偵測 hover 切換顯示。

      排序：一般分類（user/auto）依數量多到少在前；
      內建（收件匣）+ 未分類 一起排在最後面。
    -->
    <div
      v-for="c in regularCategories"
      :key="c.id"
      class="cat-chip-wrap"
    >
      <button
        class="cat-chip"
        :class="{ active: isActive(c.id ?? null) }"
        @click="select(c.id ?? null)"
      >
        <span class="cat-name">{{ categories.displayName(c) }}</span>
        <span class="cat-count text-mono">{{ counts.get(c.id ?? -1) ?? 0 }}</span>
      </button>
      <button
        v-if="(counts.get(c.id ?? -1) ?? 0) > 0 && !isActive(c.id ?? null)"
        class="cat-reopen-btn"
        @click="c.id != null && emit('reopen-category', c.id)"
      >
        {{ t('category.reopen') }}
      </button>
    </div>

    <!-- 內建分類（收件匣 等）— 跟「未分類」一樣排最後 -->
    <div
      v-for="c in builtinCategories"
      :key="c.id"
      class="cat-chip-wrap"
    >
      <button
        class="cat-chip"
        :class="{ active: isActive(c.id ?? null) }"
        @click="select(c.id ?? null)"
      >
        <span class="cat-name">{{ categories.displayName(c) }}</span>
        <span class="cat-count text-mono">{{ counts.get(c.id ?? -1) ?? 0 }}</span>
      </button>
      <button
        v-if="(counts.get(c.id ?? -1) ?? 0) > 0 && !isActive(c.id ?? null)"
        class="cat-reopen-btn"
        @click="c.id != null && emit('reopen-category', c.id)"
      >
        {{ t('category.reopen') }}
      </button>
    </div>

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

/* chip + reopen-btn 並排為兄弟元素的 wrapper */
.cat-chip-wrap {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
}
.cat-chip-wrap .cat-chip {
  width: 100%;
}
.cat-reopen-btn {
  appearance: none;
  position: absolute;
  inset: 0;
  z-index: 2;
  background: var(--text-primary);
  color: var(--text-on-dark);
  border: 0.5px solid var(--text-primary);
  border-radius: var(--radius);
  display: none;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.06em;
  cursor: pointer;
  padding: 0;
  white-space: nowrap;
}
.cat-chip-wrap:hover .cat-reopen-btn {
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
