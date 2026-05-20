<script setup lang="ts">
import { ref } from 'vue';
import type { DomainRule } from '@/types/archive';
import { useCategoriesStore } from '@/stores/categories';
import { useI18n } from '@/composables/i18n';

const props = defineProps<{ categoryId: number; rules: DomainRule[] }>();
const categories = useCategoriesStore();
const { t } = useI18n();
const newDomain = ref('');

async function add(): Promise<void> {
  const d = newDomain.value.trim();
  if (!d) return;
  await categories.addRule(d, props.categoryId);
  newDomain.value = '';
}

async function remove(id: number | undefined): Promise<void> {
  if (id == null) return;
  await categories.removeRule(id);
}
</script>

<template>
  <div class="rule-list">
    <span class="label-micro">{{ t('rule.title') }}</span>
    <div class="rules-row">
      <span v-for="r in rules" :key="r.id" class="rule-tag tag">
        <span class="text-mono">{{ r.domain }}</span>
        <button class="rule-remove" :title="t('editor.delete')" @click="remove(r.id)">×</button>
      </span>
      <span v-if="rules.length === 0" class="text-muted no-rules">{{ t('rule.empty') }}</span>
    </div>
    <div class="rule-add">
      <input
        class="input"
        v-model="newDomain"
        :placeholder="t('rule.placeholder')"
        @keyup.enter="add"
      />
      <button class="btn btn-sm" @click="add" :disabled="!newDomain.trim()">{{ t('rule.add') }}</button>
    </div>
  </div>
</template>

<style scoped>
.rule-list {
  display: flex;
  flex-direction: column;
  gap: var(--gap-2);
}
.rules-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--gap-1);
}
.rule-tag {
  display: inline-flex;
  align-items: center;
  gap: var(--gap-1);
  padding: 2px 6px 2px 8px;
}
.rule-remove {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: var(--text-md);
  line-height: 1;
  padding: 0 2px;
}
.rule-remove:hover {
  color: var(--bg-danger-btn);
}
.no-rules {
  font-size: var(--text-sm);
}
.rule-add {
  display: flex;
  gap: var(--gap-2);
}
.rule-add .input {
  flex: 1 1 auto;
  font-size: var(--text-sm);
  padding: 4px 8px;
}
</style>
