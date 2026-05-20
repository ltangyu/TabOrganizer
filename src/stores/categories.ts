import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Category, DomainRule } from '@/types/archive';
import {
  listCategories,
  listDomainRules,
  createCategory,
  updateCategory,
  deleteCategory,
  addDomainRule,
  deleteDomainRule,
} from '@/modules/archive-store';
import { invalidateCategoryCache } from '@/modules/category-engine';
import { useI18n } from '@/composables/i18n';

export const useCategoriesStore = defineStore('categories', () => {
  const categories = ref<Category[]>([]);
  const rules = ref<DomainRule[]>([]);
  const loading = ref(false);

  async function refresh(): Promise<void> {
    loading.value = true;
    try {
      const [c, r] = await Promise.all([listCategories(), listDomainRules()]);
      categories.value = c;
      rules.value = r;
      invalidateCategoryCache();
    } finally {
      loading.value = false;
    }
  }

  async function create(name: string, color: string): Promise<number> {
    const id = await createCategory(name, color);
    await refresh();
    return id;
  }

  async function update(id: number, patch: Partial<Category>): Promise<void> {
    // 使用者改名 → 內建分類「降級」為 user-defined（清除 builtinKey）
    const target = categories.value.find((c) => c.id === id);
    if (target?.builtinKey && patch.name !== undefined && patch.name !== target.name) {
      await updateCategory(id, { ...patch, builtinKey: undefined });
    } else {
      await updateCategory(id, patch);
    }
    await refresh();
  }

  async function remove(id: number): Promise<void> {
    await deleteCategory(id);
    await refresh();
  }

  async function addRule(domain: string, categoryId: number): Promise<void> {
    await addDomainRule(domain, categoryId);
    await refresh();
  }

  async function removeRule(id: number): Promise<void> {
    await deleteDomainRule(id);
    await refresh();
  }

  function nameOf(id: number | null, fallback = '未分類'): string {
    if (id == null) return fallback;
    const c = categories.value.find((cat) => cat.id === id);
    if (!c) return fallback;
    // 內建分類用 i18n key 動態翻譯；user-defined 直接顯示 name
    if (c.builtinKey) {
      const { t } = useI18n();
      return t(c.builtinKey);
    }
    return c.name;
  }

  function colorOf(id: number | null): string {
    if (id == null) return '#c8c6c6';
    return categories.value.find((c) => c.id === id)?.color ?? '#c8c6c6';
  }

  /** 給定 Category 物件回傳顯示名稱（builtin 走 i18n，user-defined 顯示 name）。 */
  function displayName(c: Category): string {
    if (c.builtinKey) {
      const { t } = useI18n();
      return t(c.builtinKey);
    }
    return c.name;
  }

  return {
    categories,
    rules,
    loading,
    refresh,
    create,
    update,
    remove,
    addRule,
    removeRule,
    nameOf,
    colorOf,
    displayName,
  };
});
