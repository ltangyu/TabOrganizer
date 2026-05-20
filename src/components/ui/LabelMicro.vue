<script setup lang="ts">
defineProps<{ text: string }>();
</script>

<template>
  <span class="label-micro">{{ text }}</span>
</template>
