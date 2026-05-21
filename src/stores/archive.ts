import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { ArchivedTab } from '@/types/archive';
import {
  listArchives,
  deleteArchive,
  updateArchive,
  listDistinctDomains,
  listExcluded,
} from '@/modules/archive-store';

export type ViewMode = 'grid' | 'list';
export type SortKey = 'time-desc' | 'time-asc' | 'title-asc' | 'title-desc';

export const useArchiveStore = defineStore('archive', () => {
  const items = ref<ArchivedTab[]>([]);
  const domains = ref<string[]>([]);
  const excluded = ref<Awaited<ReturnType<typeof listExcluded>>>([]);
  const loading = ref(false);

  const filterCategoryId = ref<number | null | 'all'>('all');
  const filterDomain = ref<string>('');
  const filterStatus = ref<'all' | 'ok' | 'gone'>('all');
  const filterDateFrom = ref<number | null>(null);
  const filterDateTo = ref<number | null>(null);
  const searchQuery = ref<string>('');
  const viewMode = ref<ViewMode>('grid');
  /** 排序：時間正反、標題正反；預設「最新在前」（time-desc） */
  const sortBy = ref<SortKey>('time-desc');

  async function refresh(): Promise<void> {
    loading.value = true;
    try {
      const [list, doms, excl] = await Promise.all([
        listArchives(),
        listDistinctDomains(),
        listExcluded(),
      ]);
      items.value = list;
      domains.value = doms;
      excluded.value = excl;
    } finally {
      loading.value = false;
    }
  }

  async function remove(id: number): Promise<void> {
    await deleteArchive(id);
    await refresh();
  }

  async function recategorize(id: number, categoryId: number | null): Promise<void> {
    await updateArchive(id, { categoryId });
    await refresh();
  }

  const filtered = computed(() => {
    let list = items.value;
    if (filterCategoryId.value !== 'all') {
      list = list.filter((a) => a.categoryId === filterCategoryId.value);
    }
    if (filterDomain.value) {
      list = list.filter((a) => a.domain === filterDomain.value);
    }
    if (filterStatus.value !== 'all') {
      list = list.filter((a) => a.status === filterStatus.value);
    }
    if (filterDateFrom.value != null) {
      list = list.filter((a) => a.archivedAt >= filterDateFrom.value!);
    }
    if (filterDateTo.value != null) {
      list = list.filter((a) => a.archivedAt <= filterDateTo.value!);
    }
    // 排序（不在原 array 上 mutate，因為 items 是 IDB pulled order = time-desc，
    // 切換排序時必須回到完整重排）
    const sorted = list.slice();
    const titleCmp = (a: ArchivedTab, b: ArchivedTab): number =>
      (a.title || '').localeCompare(b.title || '', undefined, {
        numeric: true,
        sensitivity: 'base',
      });
    switch (sortBy.value) {
      case 'time-desc':
        sorted.sort((a, b) => b.archivedAt - a.archivedAt);
        break;
      case 'time-asc':
        sorted.sort((a, b) => a.archivedAt - b.archivedAt);
        break;
      case 'title-asc':
        sorted.sort(titleCmp);
        break;
      case 'title-desc':
        sorted.sort((a, b) => -titleCmp(a, b));
        break;
    }
    return sorted;
  });

  return {
    items,
    domains,
    excluded,
    loading,
    filterCategoryId,
    filterDomain,
    filterStatus,
    filterDateFrom,
    filterDateTo,
    searchQuery,
    viewMode,
    sortBy,
    refresh,
    remove,
    recategorize,
    filtered,
  };
});
