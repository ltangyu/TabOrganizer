<script setup lang="ts">
withDefaults(
  defineProps<{ title: string; open: boolean; solid?: boolean }>(),
  { solid: false },
);
const emit = defineEmits<{ close: [] }>();
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="modal-overlay" @click.self="emit('close')">
        <div class="modal-shell" :class="{ 'modal-glass': !solid, 'modal-solid': solid }">
          <div class="modal-header">
            <span class="modal-title">{{ title }}</span>
            <button class="modal-close" @click="emit('close')" aria-label="關閉">×</button>
          </div>
          <div class="modal-body">
            <slot />
          </div>
          <div v-if="$slots.footer" class="modal-footer">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--bg-overlay);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fade-in var(--t-base) ease-out;
}
.modal-shell {
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-modal);
  border: 0.5px solid var(--border-medium);
  min-width: 420px;
  max-width: 92vw;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: slide-up var(--t-base) ease-out;
}
.modal-solid {
  background: var(--bg-block);
}
.modal-header {
  display: flex;
  align-items: center;
  padding: 14px 20px;
  border-bottom: 0.5px solid var(--border-medium);
  gap: var(--gap-3);
}
.modal-title {
  font-size: var(--text-lg);
  font-weight: 600;
}
.modal-close {
  appearance: none;
  border: none;
  background: transparent;
  width: 28px;
  height: 28px;
  margin-left: auto;
  border-radius: var(--radius);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  transition: background var(--t-fast), color var(--t-fast);
}
.modal-close:hover {
  background: var(--bg-surface);
  color: var(--text-primary);
}
.modal-body {
  flex: 1 1 auto;
  padding: 18px 20px;
  overflow: auto;
  min-height: 0;
}
.modal-footer {
  padding: 12px 20px;
  border-top: 0.5px solid var(--border-medium);
  display: flex;
  gap: var(--gap-2);
  justify-content: flex-end;
}
.modal-enter-active,
.modal-leave-active {
  transition: opacity var(--t-fast);
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
