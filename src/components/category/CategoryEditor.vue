<script setup lang="ts">
import { ref } from 'vue';
import ModalShell from '@/components/ui/ModalShell.vue';
import DomainRuleList from './DomainRuleList.vue';
import { useCategoriesStore } from '@/stores/categories';
import { useI18n } from '@/composables/i18n';

const { t } = useI18n();

defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const categories = useCategoriesStore();
const newName = ref('');
const newColor = ref('#000000');

const PRESET_COLORS = [
  '#000000',
  '#6b6b6b',
  '#9c9c9c',
  '#00ff41',
  '#facc15',
  '#e53935',
  '#c8c6c6',
];

async function add(): Promise<void> {
  const name = newName.value.trim();
  if (!name) return;
  await categories.create(name, newColor.value);
  newName.value = '';
}

async function rename(id: number, name: string): Promise<void> {
  await categories.update(id, { name });
}

async function recolor(id: number, color: string): Promise<void> {
  await categories.update(id, { color });
}

async function remove(id: number): Promise<void> {
  if (!confirm(t('editor.confirm.delete'))) return;
  await categories.remove(id);
}
</script>

<template>
  <ModalShell :open="open" :title="t('editor.title')" @close="emit('close')">
    <div class="editor">
      <section class="add-section">
        <span class="label-micro">{{ t('editor.new') }}</span>
        <div class="add-row">
          <input class="input" :placeholder="t('editor.name.placeholder')" v-model="newName" @keyup.enter="add" />
          <div class="color-picker">
            <button
              v-for="c in PRESET_COLORS"
              :key="c"
              class="color-swatch"
              :class="{ active: newColor === c }"
              :style="{ background: c }"
              @click="newColor = c"
            ></button>
          </div>
          <button class="btn btn-primary" @click="add" :disabled="!newName.trim()">{{ t('editor.add') }}</button>
        </div>
      </section>

      <section class="list-section">
        <span class="label-micro">{{ t('editor.existing') }} · {{ categories.categories.length }}</span>
        <ul class="cat-table">
          <li v-for="c in categories.categories" :key="c.id" class="cat-row">
            <div class="row-line">
              <input
                class="input cat-name-input"
                :value="categories.displayName(c)"
                @change="(e) => c.id != null && rename(c.id, (e.target as HTMLInputElement).value)"
              />
              <span v-if="c.builtinKey" class="builtin-tag tag">
                {{ t('editor.builtin') }}
              </span>
              <div class="color-picker small">
                <button
                  v-for="color in PRESET_COLORS"
                  :key="color"
                  class="color-swatch"
                  :class="{ active: c.color === color }"
                  :style="{ background: color }"
                  @click="c.id != null && recolor(c.id, color)"
                ></button>
              </div>
              <button class="btn btn-danger btn-sm" @click="c.id != null && remove(c.id)">
                {{ t('editor.delete') }}
              </button>
            </div>
            <DomainRuleList
              v-if="c.id != null"
              :category-id="c.id"
              :rules="categories.rules.filter((r) => r.categoryId === c.id)"
            />
          </li>
          <li v-if="categories.categories.length === 0" class="cat-empty text-muted">
            {{ t('editor.empty') }}
          </li>
        </ul>
      </section>
    </div>
  </ModalShell>
</template>

<style scoped>
.editor {
  display: flex;
  flex-direction: column;
  gap: var(--gap-5);
  min-width: 560px;
}
.add-section,
.list-section {
  display: flex;
  flex-direction: column;
  gap: var(--gap-2);
}
.add-row {
  display: flex;
  gap: var(--gap-2);
  align-items: center;
}
.add-row .input {
  flex: 1 1 auto;
}
.color-picker {
  display: flex;
  gap: var(--gap-1);
}
.color-picker.small .color-swatch {
  width: 16px;
  height: 16px;
}
.color-swatch {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 0.5px solid var(--border-medium);
  cursor: pointer;
  padding: 0;
}
.color-swatch.active {
  outline: 2px solid var(--border-focus);
  outline-offset: 2px;
}
.cat-table {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--gap-3);
}
.cat-row {
  background: var(--bg-surface);
  border: 0.5px solid var(--border-subtle);
  border-radius: var(--radius);
  padding: var(--gap-3);
  display: flex;
  flex-direction: column;
  gap: var(--gap-2);
}
.row-line {
  display: flex;
  align-items: center;
  gap: var(--gap-2);
}
.cat-name-input {
  flex: 1 1 auto;
  font-weight: 500;
}
.builtin-tag {
  background: var(--bg-surface-2);
  color: var(--text-secondary);
  flex-shrink: 0;
}
.cat-empty {
  padding: var(--gap-3);
  text-align: center;
  font-size: var(--text-sm);
}
</style>
