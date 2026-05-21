import type { TabCandidate } from './archive';
import type { MissingTab } from '@/modules/recovery';

export type RuntimeMessage =
  | { type: 'organize/start' }
  | { type: 'organize/progress'; current: number; total: number; stage: ProgressStage; currentTitle?: string }
  | { type: 'organize/done'; summary: OrganizeSummary }
  | { type: 'organize/error'; error: string; i18nKey?: string }
  | { type: 'organize/reset' }
  | { type: 'scan/request' }
  | { type: 'scan/response'; candidates: TabCandidate[]; total: number; suggested: number; unassigned: number }
  | { type: 'manager/open' }
  | { type: 'archive/changed' }
  | { type: 'revalidate/run' }
  | { type: 'revalidate/done'; checked: number; gone: number }
  | { type: 'reopen/category'; categoryId: number }
  | { type: 'recover/scan' }
  | { type: 'recover/scan-response'; missing: MissingTab[] }
  | { type: 'recover/reopen'; urls: string[] }
  | { type: 'recover/reopen-response'; opened: number };

export type ProgressStage = 'scanning' | 'checking' | 'snapshotting' | 'closing' | 'done';

export interface OrganizeSummary {
  scanned: number;
  checked: number;
  snapshotted: number;
  excluded: number;
  closed: number;
  durationMs: number;
}
