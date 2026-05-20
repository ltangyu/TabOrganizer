import type { TabCandidate } from './archive';

export type RuntimeMessage =
  | { type: 'organize/start' }
  | { type: 'organize/progress'; current: number; total: number; stage: ProgressStage; currentTitle?: string }
  | { type: 'organize/done'; summary: OrganizeSummary }
  | { type: 'organize/error'; error: string; i18nKey?: string }
  | { type: 'scan/request' }
  | { type: 'scan/response'; candidates: TabCandidate[]; total: number; suggested: number; unassigned: number }
  | { type: 'manager/open' }
  | { type: 'archive/changed' }
  | { type: 'revalidate/run' }
  | { type: 'revalidate/done'; checked: number; gone: number }
  | { type: 'reopen/category'; categoryId: number };

export type ProgressStage = 'scanning' | 'checking' | 'snapshotting' | 'closing' | 'done';

export interface OrganizeSummary {
  scanned: number;
  checked: number;
  snapshotted: number;
  excluded: number;
  closed: number;
  durationMs: number;
}
