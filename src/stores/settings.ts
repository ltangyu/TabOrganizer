import { defineStore } from 'pinia';
import { ref } from 'vue';
import { DEFAULT_INTERVAL_MIN } from '@/modules/periodic-revalidator';

const SETTINGS_KEY = 'tabOrganizer.settings';

export interface SettingsShape {
  revalidateIntervalMinutes: number;
  organizeInProgress: boolean;
}

export const useSettingsStore = defineStore('settings', () => {
  const revalidateIntervalMinutes = ref<number>(DEFAULT_INTERVAL_MIN);
  const organizeInProgress = ref<boolean>(false);
  const loaded = ref<boolean>(false);

  async function load(): Promise<void> {
    const stored = (await chrome.storage.local.get(SETTINGS_KEY))[SETTINGS_KEY] as
      | Partial<SettingsShape>
      | undefined;
    revalidateIntervalMinutes.value = stored?.revalidateIntervalMinutes ?? DEFAULT_INTERVAL_MIN;
    organizeInProgress.value = stored?.organizeInProgress ?? false;
    loaded.value = true;
  }

  async function save(patch: Partial<SettingsShape>): Promise<void> {
    const current: SettingsShape = {
      revalidateIntervalMinutes: revalidateIntervalMinutes.value,
      organizeInProgress: organizeInProgress.value,
    };
    const next = { ...current, ...patch };
    await chrome.storage.local.set({ [SETTINGS_KEY]: next });
    revalidateIntervalMinutes.value = next.revalidateIntervalMinutes;
    organizeInProgress.value = next.organizeInProgress;
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[SETTINGS_KEY]) return;
    const v = changes[SETTINGS_KEY].newValue as Partial<SettingsShape> | undefined;
    if (!v) return;
    if (v.revalidateIntervalMinutes !== undefined)
      revalidateIntervalMinutes.value = v.revalidateIntervalMinutes;
    if (v.organizeInProgress !== undefined) organizeInProgress.value = v.organizeInProgress;
  });

  return { revalidateIntervalMinutes, organizeInProgress, loaded, load, save };
});
