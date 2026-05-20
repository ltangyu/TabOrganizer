import { defineStore } from 'pinia';
import { ref } from 'vue';

export type ThumbAspect = '16/9' | '4/3' | 'square';
export type ActionsPlacement = 'overlay' | 'footer' | 'corner';
export type BadgePlacement = 'top' | 'inline' | 'footer' | 'none';
export type Density = 'compact' | 'regular' | 'spacious';

export const useTweaksStore = defineStore('tweaks', () => {
  const cols = ref<number>(5);
  const gap = ref<number>(16);
  const density = ref<Density>('regular');
  const aspect = ref<ThumbAspect>('4/3');
  const actions = ref<ActionsPlacement>('overlay');
  const badgePlacement = ref<BadgePlacement>('top');
  const showFavicon = ref<boolean>(true);

  return { cols, gap, density, aspect, actions, badgePlacement, showFavicon };
});
