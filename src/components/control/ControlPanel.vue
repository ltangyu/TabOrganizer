<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useSettingsStore } from '@/stores/settings';
import { useTweaksStore } from '@/stores/tweaks';
import { useUiPrefsStore, type LangCode } from '@/stores/ui-prefs';
import { useI18n, SUPPORTED_LANGS } from '@/composables/i18n';
import type { RuntimeMessage } from '@/types/messages';
import type { TabCandidate } from '@/types/archive';

type Tab = 'settings' | 'layout' | 'organize';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{
  close: [];
  organize: [];
  'manage-categories': [];
}>();

const settings = useSettingsStore();
const tweaks = useTweaksStore();
const prefs = useUiPrefsStore();
const { t } = useI18n();

const tab = ref<Tab>('settings');
const panelRef = ref<HTMLDivElement | null>(null);
const pos = ref<{ left: number; top: number } | null>(null);

let dragState: { dx: number; dy: number } | null = null;

function onMove(e: MouseEvent): void {
  if (!dragState) return;
  const x = e.clientX - dragState.dx;
  const y = e.clientY - dragState.dy;
  const w = panelRef.value?.offsetWidth ?? 380;
  const h = panelRef.value?.offsetHeight ?? 460;
  const maxX = window.innerWidth - w - 8;
  const maxY = window.innerHeight - h - 8;
  pos.value = {
    left: Math.max(8, Math.min(maxX, x)),
    top: Math.max(8, Math.min(maxY, y)),
  };
}

function onUp(): void {
  dragState = null;
  document.body.style.userSelect = '';
}

function onDragStart(e: MouseEvent): void {
  if (!panelRef.value) return;
  const r = panelRef.value.getBoundingClientRect();
  dragState = { dx: e.clientX - r.left, dy: e.clientY - r.top };
  pos.value = { left: r.left, top: r.top };
  document.body.style.userSelect = 'none';
}

onMounted(() => {
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
});

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onMove);
  window.removeEventListener('mouseup', onUp);
});

const panelStyle = computed(() =>
  pos.value
    ? { left: pos.value.left + 'px', top: pos.value.top + 'px', right: 'auto', bottom: 'auto' }
    : { right: '24px', top: '80px' },
);

// 整理 tab — scan 結果
const scanCandidates = ref<TabCandidate[]>([]);
const scanTotal = ref(0);
const scanSuggested = ref(0);
const scanUnassigned = ref(0);
const scanLoading = ref(false);

async function fetchScan(): Promise<void> {
  scanLoading.value = true;
  try {
    const res = (await chrome.runtime.sendMessage({
      type: 'scan/request',
    } satisfies RuntimeMessage)) as
      | {
          type: 'scan/response';
          candidates: TabCandidate[];
          total: number;
          suggested: number;
          unassigned: number;
        }
      | undefined;
    if (res) {
      scanCandidates.value = res.candidates;
      scanTotal.value = res.total;
      scanSuggested.value = res.suggested;
      scanUnassigned.value = res.unassigned;
    }
  } finally {
    scanLoading.value = false;
  }
}

watch(
  () => [props.open, tab.value] as const,
  ([isOpen, t]) => {
    if (isOpen && t === 'organize') fetchScan();
  },
);

const topDomains = computed(() => {
  const counts = new Map<string, number>();
  for (const c of scanCandidates.value) counts.set(c.domain, (counts.get(c.domain) ?? 0) + 1);
  return Array.from(counts.entries())
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);
});

// 設定 tab — UI 偏好 + 整理流程設定
const delayMs = ref<150 | 250 | 500 | 1000>(250);
const thumbW = ref<256 | 384 | 512 | 768>(512);
const autoClose = ref<'on' | 'off'>('on');

const freqValue = computed(() => {
  const m = settings.revalidateIntervalMinutes;
  if (m === 0) return 'off';
  if (m === 60) return 'hourly';
  if (m === 1440) return 'daily';
  if (m === 10080) return 'weekly';
  if (m === 43200) return 'monthly';
  return 'weekly';
});

async function setFreq(v: string): Promise<void> {
  const map: Record<string, number> = {
    off: 0,
    hourly: 60,
    daily: 1440,
    weekly: 10080,
    monthly: 43200,
  };
  await settings.save({ revalidateIntervalMinutes: map[v] ?? 10080 });
}

const revalidating = ref(false);
const revalidateResult = ref<{ checked: number; gone: number } | null>(null);

async function runRevalidateNow(): Promise<void> {
  revalidating.value = true;
  revalidateResult.value = null;
  try {
    const res = (await chrome.runtime.sendMessage({
      type: 'revalidate/run',
    } satisfies RuntimeMessage)) as { ok: boolean; checked?: number; gone?: number } | undefined;
    if (res && res.ok) {
      revalidateResult.value = { checked: res.checked ?? 0, gone: res.gone ?? 0 };
    }
  } finally {
    revalidating.value = false;
  }
}

// 立即去重 — 手動觸發 dedupeArchives，顯示移除多少筆
const deduping = ref(false);
const dedupeResult = ref<{ before: number; removed: number; after: number } | null>(null);

async function runDedupeNow(): Promise<void> {
  deduping.value = true;
  dedupeResult.value = null;
  try {
    const { db, dedupeArchives } = await import('@/modules/archive-store');
    const before = await db.archives.count();
    const removed = await dedupeArchives();
    const after = await db.archives.count();
    dedupeResult.value = { before, removed, after };
    console.log('[TabOrganizer] manual dedupe', { before, removed, after });
    // Broadcast 讓 manager 重新整理顯示
    try {
      await chrome.runtime.sendMessage({ type: 'archive/changed' } satisfies RuntimeMessage);
    } catch {
      /* no receiver — fine */
    }
  } finally {
    deduping.value = false;
  }
}

// 排版 tab helpers
function setDensity(v: typeof tweaks.density): void {
  tweaks.density = v;
}
function setAspect(v: typeof tweaks.aspect): void {
  tweaks.aspect = v;
}
function setActions(v: typeof tweaks.actions): void {
  tweaks.actions = v;
}
function setBadgePlacement(v: typeof tweaks.badgePlacement): void {
  tweaks.badgePlacement = v;
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" ref="panelRef" class="ctrl-panel" :style="panelStyle">
      <div class="ctrl-head" @mousedown="onDragStart">
        <div class="ctrl-title">{{ t('ctrl.title') }}</div>
        <button class="ctrl-close" :aria-label="t('modal.close')" @click="emit('close')">×</button>
      </div>

      <div class="ctrl-tabs">
        <button :class="{ active: tab === 'settings' }" @click="tab = 'settings'">
          {{ t('ctrl.tab.settings') }}
        </button>
        <button :class="{ active: tab === 'layout' }" @click="tab = 'layout'">
          {{ t('ctrl.tab.layout') }}
        </button>
        <button :class="{ active: tab === 'organize' }" @click="tab = 'organize'">
          {{ t('ctrl.tab.organize') }}
        </button>
      </div>

      <div class="ctrl-body">
        <!-- ── 設定 tab ───────────────────────────── -->
        <div v-if="tab === 'settings'" class="ctrl-section">
          <div class="ctrl-section-h">
            <span class="label-micro">{{ t('ctrl.section.appearance') }}</span>
          </div>

          <div class="ctrl-field">
            <div class="ctrl-field-lbl">
              <span class="lbl">{{ t('ctrl.dark.label') }}</span>
              <span class="hint">{{ t('ctrl.dark.hint') }}</span>
            </div>
            <button
              class="ctrl-toggle"
              :class="{ on: prefs.darkMode }"
              :aria-pressed="prefs.darkMode"
              @click="prefs.setDarkMode(!prefs.darkMode)"
            ></button>
          </div>

          <div class="ctrl-field">
            <div class="ctrl-field-lbl">
              <span class="lbl">{{ t('ctrl.lang.label') }}</span>
              <span class="hint">{{ t('ctrl.lang.hint') }}</span>
            </div>
            <select
              class="ctrl-select"
              :value="prefs.lang"
              @change="(e) => prefs.setLang((e.target as HTMLSelectElement).value as LangCode)"
            >
              <option v-for="l in SUPPORTED_LANGS" :key="l.code" :value="l.code">
                {{ l.label }}
              </option>
            </select>
          </div>

          <div class="ctrl-section-h" style="margin-top: 14px">
            <span class="label-micro">{{ t('ctrl.section.flow') }}</span>
          </div>

          <div class="ctrl-field">
            <div class="ctrl-field-lbl">
              <span class="lbl">{{ t('ctrl.revalidate.label') }}</span>
              <span class="hint">{{ t('ctrl.revalidate.hint') }}</span>
            </div>
            <div class="ctrl-seg">
              <button :class="{ active: freqValue === 'off' }" @click="setFreq('off')">
                {{ t('ctrl.revalidate.off') }}
              </button>
              <button :class="{ active: freqValue === 'hourly' }" @click="setFreq('hourly')">
                {{ t('ctrl.revalidate.hourly') }}
              </button>
              <button :class="{ active: freqValue === 'daily' }" @click="setFreq('daily')">
                {{ t('ctrl.revalidate.daily') }}
              </button>
              <button :class="{ active: freqValue === 'weekly' }" @click="setFreq('weekly')">
                {{ t('ctrl.revalidate.weekly') }}
              </button>
              <button :class="{ active: freqValue === 'monthly' }" @click="setFreq('monthly')">
                {{ t('ctrl.revalidate.monthly') }}
              </button>
            </div>
            <div class="revalidate-row">
              <button class="btn btn-sm" :disabled="revalidating" @click="runRevalidateNow">
                {{ revalidating ? t('ctrl.revalidate.busy') : t('ctrl.revalidate.now') }}
              </button>
              <span v-if="revalidateResult" class="text-mono text-secondary revalidate-result">
                {{ t('ctrl.revalidate.result', revalidateResult) }}
              </span>
            </div>
          </div>

          <div class="ctrl-field">
            <div class="ctrl-field-lbl">
              <span class="lbl">{{ t('ctrl.dedupe.label') }}</span>
              <span class="hint">{{ t('ctrl.dedupe.hint') }}</span>
            </div>
            <div class="revalidate-row">
              <button class="btn btn-sm" :disabled="deduping" @click="runDedupeNow">
                {{ deduping ? t('ctrl.dedupe.busy') : t('ctrl.dedupe.now') }}
              </button>
              <span v-if="dedupeResult" class="text-mono text-secondary revalidate-result">
                {{ t('ctrl.dedupe.result', dedupeResult) }}
              </span>
            </div>
          </div>

          <div class="ctrl-field">
            <div class="ctrl-field-lbl">
              <span class="lbl">{{ t('ctrl.delay.label') }}</span>
              <span class="hint">{{ t('ctrl.delay.hint') }}</span>
            </div>
            <div class="ctrl-seg">
              <button :class="{ active: delayMs === 150 }" @click="delayMs = 150">150 ms</button>
              <button :class="{ active: delayMs === 250 }" @click="delayMs = 250">250 ms</button>
              <button :class="{ active: delayMs === 500 }" @click="delayMs = 500">500 ms</button>
              <button :class="{ active: delayMs === 1000 }" @click="delayMs = 1000">1000 ms</button>
            </div>
          </div>

          <div class="ctrl-field">
            <div class="ctrl-field-lbl">
              <span class="lbl">{{ t('ctrl.thumb.label') }}</span>
              <span class="hint">{{ t('ctrl.thumb.hint') }}</span>
            </div>
            <div class="ctrl-seg">
              <button :class="{ active: thumbW === 256 }" @click="thumbW = 256">256</button>
              <button :class="{ active: thumbW === 384 }" @click="thumbW = 384">384</button>
              <button :class="{ active: thumbW === 512 }" @click="thumbW = 512">512</button>
              <button :class="{ active: thumbW === 768 }" @click="thumbW = 768">768</button>
            </div>
          </div>

          <div class="ctrl-field">
            <div class="ctrl-field-lbl">
              <span class="lbl">{{ t('ctrl.autoclose.label') }}</span>
              <span class="hint">{{ t('ctrl.autoclose.hint') }}</span>
            </div>
            <div class="ctrl-seg">
              <button :class="{ active: autoClose === 'on' }" @click="autoClose = 'on'">
                {{ t('ctrl.autoclose.on') }}
              </button>
              <button :class="{ active: autoClose === 'off' }" @click="autoClose = 'off'">
                {{ t('ctrl.autoclose.off') }}
              </button>
            </div>
          </div>
        </div>

        <!-- ── 排版 tab ───────────────────────────── -->
        <div v-else-if="tab === 'layout'" class="ctrl-section">
          <div class="ctrl-section-h">
            <span class="label-micro">{{ t('ctrl.layout.grid') }}</span>
          </div>

          <div class="ctrl-field">
            <div class="ctrl-field-lbl">
              <span class="lbl">
                {{ t('ctrl.layout.cols') }}
                <span class="hint" style="margin-left: 4px">{{ tweaks.cols }}</span>
              </span>
            </div>
            <input
              type="range"
              class="ctrl-slider"
              min="2"
              max="7"
              step="1"
              v-model.number="tweaks.cols"
            />
          </div>

          <div class="ctrl-field">
            <div class="ctrl-field-lbl">
              <span class="lbl">
                {{ t('ctrl.layout.gap') }}
                <span class="hint" style="margin-left: 4px">{{ tweaks.gap }} px</span>
              </span>
            </div>
            <input
              type="range"
              class="ctrl-slider"
              min="4"
              max="32"
              step="2"
              v-model.number="tweaks.gap"
            />
          </div>

          <div class="ctrl-section-h" style="margin-top: 12px">
            <span class="label-micro">{{ t('ctrl.layout.density') }}</span>
          </div>
          <div class="ctrl-field">
            <div class="ctrl-field-lbl">
              <span class="lbl">{{ t('ctrl.layout.density.label') }}</span>
            </div>
            <div class="ctrl-seg">
              <button
                :class="{ active: tweaks.density === 'compact' }"
                @click="setDensity('compact')"
              >
                {{ t('ctrl.layout.density.compact') }}
              </button>
              <button
                :class="{ active: tweaks.density === 'regular' }"
                @click="setDensity('regular')"
              >
                {{ t('ctrl.layout.density.regular') }}
              </button>
              <button
                :class="{ active: tweaks.density === 'spacious' }"
                @click="setDensity('spacious')"
              >
                {{ t('ctrl.layout.density.spacious') }}
              </button>
            </div>
          </div>

          <div class="ctrl-field">
            <div class="ctrl-field-lbl">
              <span class="lbl">{{ t('ctrl.layout.aspect') }}</span>
            </div>
            <div class="ctrl-seg">
              <button :class="{ active: tweaks.aspect === '16/9' }" @click="setAspect('16/9')">
                16/9
              </button>
              <button :class="{ active: tweaks.aspect === '4/3' }" @click="setAspect('4/3')">
                4/3
              </button>
              <button :class="{ active: tweaks.aspect === 'square' }" @click="setAspect('square')">
                {{ t('ctrl.layout.aspect.square') }}
              </button>
            </div>
          </div>

          <div class="ctrl-section-h" style="margin-top: 12px">
            <span class="label-micro">{{ t('ctrl.layout.hover') }}</span>
          </div>
          <div class="ctrl-field">
            <div class="ctrl-field-lbl">
              <span class="lbl">{{ t('ctrl.layout.actions') }}</span>
            </div>
            <div class="ctrl-seg">
              <button
                :class="{ active: tweaks.actions === 'overlay' }"
                @click="setActions('overlay')"
              >
                {{ t('ctrl.layout.actions.overlay') }}
              </button>
              <button
                :class="{ active: tweaks.actions === 'footer' }"
                @click="setActions('footer')"
              >
                {{ t('ctrl.layout.actions.footer') }}
              </button>
              <button
                :class="{ active: tweaks.actions === 'corner' }"
                @click="setActions('corner')"
              >
                {{ t('ctrl.layout.actions.corner') }}
              </button>
            </div>
          </div>

          <div class="ctrl-section-h" style="margin-top: 12px">
            <span class="label-micro">{{ t('ctrl.layout.badge') }}</span>
          </div>
          <div class="ctrl-field">
            <div class="ctrl-field-lbl">
              <span class="lbl">{{ t('ctrl.layout.badge.label') }}</span>
            </div>
            <div class="ctrl-seg">
              <button
                :class="{ active: tweaks.badgePlacement === 'top' }"
                @click="setBadgePlacement('top')"
              >
                {{ t('ctrl.layout.badge.top') }}
              </button>
              <button
                :class="{ active: tweaks.badgePlacement === 'inline' }"
                @click="setBadgePlacement('inline')"
              >
                {{ t('ctrl.layout.badge.inline') }}
              </button>
              <button
                :class="{ active: tweaks.badgePlacement === 'footer' }"
                @click="setBadgePlacement('footer')"
              >
                {{ t('ctrl.layout.actions.footer') }}
              </button>
              <button
                :class="{ active: tweaks.badgePlacement === 'none' }"
                @click="setBadgePlacement('none')"
              >
                {{ t('ctrl.layout.badge.none') }}
              </button>
            </div>
          </div>

          <div class="ctrl-field">
            <div class="ctrl-field-lbl">
              <span class="lbl">{{ t('ctrl.layout.favicon') }}</span>
            </div>
            <button
              class="ctrl-toggle"
              :class="{ on: tweaks.showFavicon }"
              :aria-pressed="tweaks.showFavicon"
              @click="tweaks.showFavicon = !tweaks.showFavicon"
            ></button>
          </div>
        </div>

        <!-- ── 整理 tab ───────────────────────────── -->
        <div v-else class="ctrl-section">
          <div class="ctrl-section-h">
            <span class="label-micro">{{ t('ctrl.organize.section') }}</span>
            <span class="ctrl-section-meta">v0.1.0</span>
          </div>
          <div class="ctrl-stat-row">
            <span class="lbl">{{ t('ctrl.organize.candidates') }}</span>
            <span class="val">{{ scanLoading ? '—' : scanTotal }}</span>
          </div>
          <div class="ctrl-stat-row">
            <span class="lbl">{{ t('ctrl.organize.suggested') }}</span>
            <span class="val">{{ scanLoading ? '—' : scanSuggested }}</span>
          </div>
          <div class="ctrl-stat-row">
            <span class="lbl">{{ t('ctrl.organize.unassigned') }}</span>
            <span class="val">{{ scanLoading ? '—' : scanUnassigned }}</span>
          </div>

          <div class="ctrl-actions">
            <button
              class="btn btn-primary"
              :disabled="settings.organizeInProgress"
              @click="emit('organize')"
            >
              {{ settings.organizeInProgress ? t('header.organize.busy') : t('header.organize') }}
            </button>
            <button class="btn" @click="emit('manage-categories')">
              {{ t('ctrl.organize.categories') }}
            </button>
          </div>

          <div class="ctrl-section-h" style="margin-top: 14px">
            <span class="label-micro">{{ t('ctrl.organize.domains') }}</span>
            <span class="ctrl-section-meta">{{ topDomains.length }} {{ t('filter.items') }}</span>
          </div>
          <div class="ctrl-domains">
            <div v-for="d in topDomains" :key="d.domain" class="ctrl-domain-row">
              <span class="d text-truncate">{{ d.domain }}</span>
              <span class="c">{{ d.count }}</span>
            </div>
            <div
              v-if="topDomains.length === 0 && !scanLoading"
              class="ctrl-domain-row text-muted"
              style="justify-content: center; padding: 12px 0"
            >
              {{ t('ctrl.organize.noTabs') }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.ctrl-section .lbl {
  font-size: var(--text-md);
  font-weight: 500;
  color: var(--text-primary);
}
.ctrl-section .hint {
  font-size: var(--text-sm);
  color: var(--text-muted);
  font-weight: 400;
}
.revalidate-row {
  display: flex;
  align-items: center;
  gap: var(--gap-2);
  margin-top: 6px;
}
.revalidate-result {
  font-size: var(--text-xs);
}

/* 語言選單 — 與 ii Design Language 對齊 */
.ctrl-select {
  appearance: none;
  -webkit-appearance: none;
  height: 28px;
  padding: 4px 26px 4px 10px;
  border: 0.5px solid var(--border-medium);
  border-radius: var(--radius);
  background: var(--bg-block);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  cursor: pointer;
  outline: none;
  transition: border-color var(--t-fast);
  background-image: linear-gradient(45deg, transparent 50%, var(--text-secondary) 50%),
    linear-gradient(135deg, var(--text-secondary) 50%, transparent 50%);
  background-position: calc(100% - 14px) 50%, calc(100% - 9px) 50%;
  background-size: 5px 5px, 5px 5px;
  background-repeat: no-repeat;
  align-self: flex-start;
  min-width: 140px;
}
.ctrl-select:focus {
  border-color: var(--border-focus);
}
</style>
