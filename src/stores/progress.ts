import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { ProgressStage, OrganizeSummary, RuntimeMessage } from '@/types/messages';

export const useProgressStore = defineStore('progress', () => {
  const active = ref(false);
  const current = ref(0);
  const total = ref(0);
  const stage = ref<ProgressStage>('done');
  const currentTitle = ref<string>('');
  const lastSummary = ref<OrganizeSummary | null>(null);
  const lastError = ref<string | null>(null);

  function reset(): void {
    active.value = false;
    current.value = 0;
    total.value = 0;
    stage.value = 'done';
    currentTitle.value = '';
  }

  function attachListener(): () => void {
    const handler = (msg: RuntimeMessage): void => {
      if (msg.type === 'organize/progress') {
        active.value = true;
        current.value = msg.current;
        total.value = msg.total;
        stage.value = msg.stage;
        currentTitle.value = msg.currentTitle ?? '';
      } else if (msg.type === 'organize/done') {
        active.value = false;
        stage.value = 'done';
        lastSummary.value = msg.summary;
        lastError.value = null;
      } else if (msg.type === 'organize/error') {
        active.value = false;
        // 優先用 i18nKey 翻譯；fallback 到 raw error
        if (msg.i18nKey) {
          import('@/composables/i18n').then(({ useI18n }) => {
            try {
              lastError.value = useI18n().t(msg.i18nKey!);
            } catch {
              lastError.value = msg.error;
            }
          }).catch(() => {
            lastError.value = msg.error;
          });
        } else {
          lastError.value = msg.error;
        }
      }
    };
    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }

  return {
    active,
    current,
    total,
    stage,
    currentTitle,
    lastSummary,
    lastError,
    reset,
    attachListener,
  };
});
