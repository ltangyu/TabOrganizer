import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

export type LangCode =
  | 'zh-Hant'
  | 'zh-Hans'
  | 'en'
  | 'ja'
  | 'ko'
  | 'es'
  | 'fr'
  | 'de'
  | 'pt'
  | 'vi';

const STORAGE_KEY = 'tabOrganizer.uiPrefs';

interface UiPrefs {
  lang: LangCode;
  darkMode: boolean;
}

export const useUiPrefsStore = defineStore('uiPrefs', () => {
  const lang = ref<LangCode>('zh-Hant');
  const darkMode = ref<boolean>(false);
  const loaded = ref<boolean>(false);

  async function load(): Promise<void> {
    try {
      const stored = (await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY] as
        | Partial<UiPrefs>
        | undefined;
      lang.value = stored?.lang ?? 'zh-Hant';
      darkMode.value = stored?.darkMode ?? false;
    } catch {
      /* preview / first load */
    }
    loaded.value = true;
    applyDarkMode();
  }

  async function save(): Promise<void> {
    try {
      await chrome.storage.local.set({
        [STORAGE_KEY]: { lang: lang.value, darkMode: darkMode.value },
      });
    } catch {
      /* preview */
    }
  }

  function applyDarkMode(): void {
    if (typeof document === 'undefined') return;
    document.body.classList.toggle('dark-mode', darkMode.value);
  }

  async function setLang(l: LangCode): Promise<void> {
    // 動態載入該語言包（如果還沒載入）
    const { ensureLangLoaded } = await import('@/composables/i18n');
    await ensureLangLoaded(l);
    lang.value = l;
    void save();
  }

  function setDarkMode(v: boolean): void {
    darkMode.value = v;
    applyDarkMode();
    void save();
  }

  watch(darkMode, applyDarkMode);

  return { lang, darkMode, loaded, load, setLang, setDarkMode };
});
