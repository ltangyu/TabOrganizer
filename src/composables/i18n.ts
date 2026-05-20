import { computed, reactive } from 'vue';
import { useUiPrefsStore, type LangCode } from '@/stores/ui-prefs';

type Dict = Record<string, string>;

// 內建語言（zip 進主 bundle）
import zhHant from '@/locales/zh-Hant.json';
import en from '@/locales/en.json';

// 其他語言用 Vite glob，回傳 () => Promise<{ default: Dict }>，按需載入
const lazyLoaders = import.meta.glob<{ default: Dict }>([
  '@/locales/*.json',
  '!@/locales/zh-Hant.json',
  '!@/locales/en.json',
]);

const dicts = reactive<Record<string, Dict>>({
  'zh-Hant': zhHant,
  en,
});

const loading = reactive<Record<string, boolean>>({});

export interface SupportedLang {
  code: LangCode;
  label: string; // 用該語言本身寫的名稱（不會被翻譯）
}

export const SUPPORTED_LANGS: SupportedLang[] = [
  { code: 'zh-Hant', label: '繁體中文' },
  { code: 'zh-Hans', label: '简体中文' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'pt', label: 'Português' },
  { code: 'vi', label: 'Tiếng Việt' },
];

/**
 * 按需載入語言包。如果已載入或正在載入，回 Promise resolved。
 */
export async function ensureLangLoaded(code: LangCode): Promise<void> {
  if (dicts[code] || loading[code]) return;
  // 找符合的 loader（key 是 '/src/locales/<code>.json' 或 '@/locales/<code>.json' 依 Vite 版本）
  const key = Object.keys(lazyLoaders).find((k) => k.endsWith(`/${code}.json`));
  if (!key) {
    console.warn(`[i18n] 找不到語言包：${code}`);
    return;
  }
  loading[code] = true;
  try {
    const mod = await lazyLoaders[key]!();
    dicts[code] = mod.default;
  } catch (e) {
    console.warn(`[i18n] 載入失敗 ${code}:`, e);
  } finally {
    loading[code] = false;
  }
}

export function useI18n() {
  const prefs = useUiPrefsStore();

  function tRaw(key: string): string {
    const cur = dicts[prefs.lang];
    if (cur && cur[key] != null) return cur[key];
    // fallback 順序：英文 → 繁中 → key 原文
    return dicts['en']?.[key] ?? dicts['zh-Hant']?.[key] ?? key;
  }

  function format(template: string, params?: Record<string, string | number>): string {
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (_, k) =>
      params[k] !== undefined ? String(params[k]) : `{${k}}`,
    );
  }

  const t = (key: string, params?: Record<string, string | number>): string =>
    format(tRaw(key), params);

  const lang = computed(() => prefs.lang);
  const isLoading = computed(() => loading[prefs.lang] === true);

  return { t, lang, isLoading };
}
