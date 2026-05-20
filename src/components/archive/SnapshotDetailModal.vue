<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import ModalShell from '@/components/ui/ModalShell.vue';
import type { ArchivedTab } from '@/types/archive';
import { useCategoriesStore } from '@/stores/categories';
import { useI18n } from '@/composables/i18n';
import { formatTimestamp } from '@/utils/time';

const props = defineProps<{ item: ArchivedTab | null }>();
const emit = defineEmits<{
  close: [];
  open: [item: ArchivedTab];
  remove: [item: ArchivedTab];
  recategorize: [item: ArchivedTab];
}>();

const categories = useCategoriesStore();
const { t } = useI18n();
const open = computed(() => props.item != null);
const imgUrl = ref('');

watch(
  () => props.item,
  (it) => {
    if (imgUrl.value) {
      URL.revokeObjectURL(imgUrl.value);
      imgUrl.value = '';
    }
    if (it?.thumbBlob) imgUrl.value = URL.createObjectURL(it.thumbBlob);
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (imgUrl.value) URL.revokeObjectURL(imgUrl.value);
});

function statusLabel(s: string): string {
  if (s === 'gone') return t('detail.status.gone');
  if (s === 'unchecked') return t('detail.status.unchecked');
  return t('detail.status.ok');
}
</script>

<template>
  <ModalShell :open="open" :title="t('detail.title')" solid @close="emit('close')">
    <div v-if="item" class="detail-body">
      <div class="detail-img-wrap">
        <img v-if="imgUrl" :src="imgUrl" :alt="item.title" class="detail-img" />
        <div v-else class="detail-img-empty text-muted">{{ t('loading') }}</div>
      </div>
      <dl class="detail-meta">
        <dt>{{ t('detail.label.title') }}</dt>
        <dd>{{ item.title }}</dd>
        <dt>{{ t('detail.label.url') }}</dt>
        <dd>
          <a :href="item.url" target="_blank" rel="noopener noreferrer" class="text-mono">
            {{ item.url }}
          </a>
        </dd>
        <dt>{{ t('detail.label.domain') }}</dt>
        <dd class="text-mono">{{ item.domain }}</dd>
        <dt>{{ t('detail.label.category') }}</dt>
        <dd>
          <span class="cat-tag tag">
            <span class="cat-dot" :style="{ background: categories.colorOf(item.categoryId) }"></span>
            {{ categories.nameOf(item.categoryId, t('category.uncategorized')) }}
          </span>
        </dd>
        <dt>{{ t('detail.label.archivedAt') }}</dt>
        <dd class="text-mono">{{ formatTimestamp(item.archivedAt) }}</dd>
        <dt>{{ t('detail.label.status') }}</dt>
        <dd>
          <span
            class="status-dot"
            :class="item.status === 'gone' ? 'err' : item.status === 'unchecked' ? 'warn' : 'ok'"
            style="margin-right: 6px"
          ></span>
          {{ statusLabel(item.status) }}
          <span v-if="item.lastCheckedAt" class="text-muted">
            （{{ formatTimestamp(item.lastCheckedAt) }} {{ t('detail.checked.suffix') }}）
          </span>
        </dd>
        <dt v-if="item.downloadPath">{{ t('detail.label.path') }}</dt>
        <dd v-if="item.downloadPath" class="text-mono text-muted">{{ item.downloadPath }}</dd>
      </dl>
    </div>
    <template #footer>
      <button v-if="item" class="btn btn-danger" @click="emit('remove', item)">
        {{ t('detail.delete') }}
      </button>
      <button v-if="item" class="btn" @click="emit('recategorize', item)">
        {{ t('detail.recategorize') }}
      </button>
      <button v-if="item" class="btn btn-primary" @click="emit('open', item)">
        {{ t('detail.reopen') }}
      </button>
    </template>
  </ModalShell>
</template>

<style scoped>
.detail-body {
  display: flex;
  flex-direction: column;
  gap: var(--gap-4);
  min-width: 520px;
}
.detail-img-wrap {
  background: var(--bg-surface);
  border-radius: var(--radius);
  overflow: hidden;
  max-height: 60vh;
}
.detail-img {
  width: 100%;
  display: block;
  object-fit: contain;
}
.detail-img-empty {
  padding: var(--gap-7);
  text-align: center;
  font-size: var(--text-md);
}
.detail-meta {
  display: grid;
  grid-template-columns: 100px 1fr;
  gap: var(--gap-2) var(--gap-3);
  margin: 0;
  font-size: var(--text-md);
}
.detail-meta dt {
  color: var(--text-secondary);
  font-size: var(--text-sm);
  text-transform: uppercase;
  letter-spacing: var(--letter-uppercase);
  font-family: var(--font-mono);
}
.detail-meta dd {
  margin: 0;
  word-break: break-all;
}
a {
  color: var(--text-primary);
  text-decoration: underline;
}
.cat-tag {
  display: inline-flex;
  align-items: center;
  gap: var(--gap-1);
}
.cat-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
</style>
