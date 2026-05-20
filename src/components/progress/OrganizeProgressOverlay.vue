<script setup lang="ts">
import { computed } from 'vue';
import { useProgressStore } from '@/stores/progress';
import { useI18n } from '@/composables/i18n';
import LabelMicro from '@/components/ui/LabelMicro.vue';

const progress = useProgressStore();
const { t } = useI18n();

const visible = computed(
  () => progress.active || (progress.lastSummary != null && progress.stage === 'done'),
);

const stageLabel = computed(() => {
  switch (progress.stage) {
    case 'scanning':
      return t('progress.stage.scanning');
    case 'checking':
      return t('progress.stage.checking');
    case 'snapshotting':
      return t('progress.stage.snapshotting');
    case 'closing':
      return t('progress.stage.closing');
    case 'done':
      return t('progress.stage.done');
    default:
      return '';
  }
});

const pct = computed(() => {
  if (progress.total === 0) return 0;
  return Math.round((progress.current / progress.total) * 100);
});

function dismiss(): void {
  progress.reset();
  progress.lastSummary = null;
}
</script>

<template>
  <div v-if="visible" class="overlay">
    <div class="dialog ii-card">
      <header class="head">
        <LabelMicro text="ORGANIZE" />
        <span class="stage">{{ stageLabel }}</span>
      </header>

      <div class="bar">
        <div class="bar-fill" :style="{ width: pct + '%' }"></div>
      </div>

      <div class="counter">
        <span class="text-mono">{{ progress.current }} / {{ progress.total }}</span>
        <span class="text-mono text-muted">{{ pct }}%</span>
      </div>

      <div v-if="progress.currentTitle" class="current text-truncate text-secondary">
        {{ progress.currentTitle }}
      </div>

      <div v-if="!progress.active && progress.lastSummary" class="summary">
        <dl>
          <dt>{{ t('progress.summary.scanned') }}</dt>
          <dd class="text-mono">{{ progress.lastSummary.scanned }}</dd>
          <dt>{{ t('progress.summary.snapshotted') }}</dt>
          <dd class="text-mono">{{ progress.lastSummary.snapshotted }}</dd>
          <dt>{{ t('progress.summary.excluded') }}</dt>
          <dd class="text-mono">{{ progress.lastSummary.excluded }}</dd>
          <dt>{{ t('progress.summary.closed') }}</dt>
          <dd class="text-mono">{{ progress.lastSummary.closed }}</dd>
          <dt>{{ t('progress.summary.duration') }}</dt>
          <dd class="text-mono">
            {{ (progress.lastSummary.durationMs / 1000).toFixed(1) }} {{ t('progress.summary.seconds') }}
          </dd>
        </dl>
        <button class="btn btn-primary close-btn" @click="dismiss">{{ t('progress.close') }}</button>
      </div>

      <div v-if="progress.lastError" class="error">
        <span class="status-dot err"></span>
        {{ progress.lastError }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: var(--bg-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 900;
}
.dialog {
  width: 440px;
  padding: var(--gap-5);
  display: flex;
  flex-direction: column;
  gap: var(--gap-3);
  box-shadow: var(--shadow-modal);
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.stage {
  font-size: var(--text-md);
  font-weight: 500;
}
.bar {
  background: var(--bg-surface-2);
  height: 6px;
  border-radius: var(--radius-pill);
  overflow: hidden;
}
.bar-fill {
  background: var(--bg-primary-btn);
  height: 100%;
  transition: width var(--t-base);
}
.counter {
  display: flex;
  justify-content: space-between;
  font-size: var(--text-sm);
}
.current {
  font-size: var(--text-sm);
}
.summary {
  display: flex;
  flex-direction: column;
  gap: var(--gap-3);
  padding-top: var(--gap-2);
  border-top: 0.5px solid var(--border-subtle);
}
.summary dl {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--gap-1) var(--gap-3);
  margin: 0;
}
.summary dt {
  color: var(--text-secondary);
  font-size: var(--text-sm);
}
.summary dd {
  margin: 0;
  font-weight: 600;
}
.close-btn {
  align-self: flex-end;
}
.error {
  display: flex;
  align-items: center;
  gap: var(--gap-2);
  padding: var(--gap-2);
  background: var(--bg-surface);
  border-radius: var(--radius);
  font-size: var(--text-sm);
  color: var(--bg-danger-btn);
}
</style>
