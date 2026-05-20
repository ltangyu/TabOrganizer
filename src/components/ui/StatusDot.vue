<script setup lang="ts">
defineProps<{ state?: 'ok' | 'warn' | 'err' | 'idle' }>();
</script>

<template>
  <span class="status-dot" :class="state ?? 'idle'" />
</template>
