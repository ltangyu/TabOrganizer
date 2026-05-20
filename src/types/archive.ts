export type ArchiveStatus = 'ok' | 'gone' | 'unchecked';

export interface Category {
  id?: number;
  name: string;
  color: string;
  createdAt: number;
  /**
   * 若為內建分類，存對應的 i18n key（例 'category.builtin.inbox'）。
   * 顯示時優先用 t(builtinKey)；使用者編輯名稱後 store 會自動清除此欄位，
   * 變回純 user-defined（不再翻譯）。
   */
  builtinKey?: string;
}

export interface DomainRule {
  id?: number;
  domain: string;
  categoryId: number;
}

export interface ArchivedTab {
  id?: number;
  url: string;
  title: string;
  domain: string;
  favIconUrl?: string;
  categoryId: number | null;
  thumbBlob: Blob | null;
  downloadId?: number;
  downloadPath?: string;
  archivedAt: number;
  status: ArchiveStatus;
  lastCheckedAt?: number;
  lastStatusCode?: number | string;
}

export interface ExcludedRecord {
  id?: number;
  url: string;
  title: string;
  domain: string;
  reason: 'http-error' | 'timeout' | 'network-error';
  statusCode?: number | string;
  excludedAt: number;
}

export interface ScanHistory {
  id?: number;
  ranAt: number;
  totalChecked: number;
  totalGone: number;
}

export interface TabCandidate {
  tabId: number;
  windowId: number;
  url: string;
  title: string;
  domain: string;
  favIconUrl?: string;
  suggestedCategoryId: number | null;
}
