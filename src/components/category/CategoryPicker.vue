<script setup lang="ts">
import ModalShell from '@/components/ui/ModalShell.vue';
import { useCategoriesStore } from '@/stores/categories';
import { useI18n } from '@/composables/i18n';
import type { ArchivedTab } from '@/types/archive';

defineProps<{ item: ArchivedTab | null }>();
const emit = defineEmits<{ close: []; pick: [id: number | null] }>();

const categories = useCategoriesStore();
const { t } = useI18n();
</script>

<template>
  <ModalShell :open="item != null" :title="t('picker.title')" @close="emit('close')">
    <div v-if="item" class="picker">
      <p class="text-secondary subj">
        {{ item.title }}
      </p>
      <ul class="cat-options">
        <li
          v-for="c in categories.categories"
          :key="c.id"
          class="opt"
          :class="{ active: item.categoryId === c.id }"
          @click="emit('pick', c.id ?? null)"
        >
          <span class="cat-dot" :style="{ background: c.color }"></span>
          <span>{{ categories.displayName(c) }}</span>
        </li>
        <li
          class="opt"
          :class="{ active: item.categoryId === null }"
          @click="emit('pick', null)"
        >
          <span class="cat-dot" style="background: var(--status-idle)"></span>
          <span>{{ t('category.uncategorized') }}</span>
        </li>
      </ul>
    </div>
  </ModalShell>
</template>

<style scoped>
.picker {
  min-width: 360px;
}
.subj {
  margin: 0 0 var(--gap-3);
  font-size: var(--text-sm);
}
.cat-options {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--gap-1);
}
.opt {
  display: flex;
  align-items: center;
  gap: var(--gap-2);
  padding: 8px 12px;
  border-radius: var(--radius);
  cursor: pointer;
  transition: background-color var(--t-fast);
}
.opt:hover {
  background: var(--bg-hover);
}
.opt.active {
  background: var(--bg-active);
}
.cat-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
</style>
