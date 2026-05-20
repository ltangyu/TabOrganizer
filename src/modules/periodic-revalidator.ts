import { db, recordScan, updateArchive } from './archive-store';
import { checkBatch } from './link-checker';

export const ALARM_REVALIDATE = 'tab-organizer-revalidate';
export const DEFAULT_INTERVAL_MIN = 60 * 24 * 7;

export async function ensureAlarmConfigured(intervalMinutes: number): Promise<void> {
  const existing = await chrome.alarms.get(ALARM_REVALIDATE);
  if (existing && existing.periodInMinutes === intervalMinutes) return;
  await chrome.alarms.clear(ALARM_REVALIDATE);
  if (intervalMinutes > 0) {
    chrome.alarms.create(ALARM_REVALIDATE, {
      delayInMinutes: 1,
      periodInMinutes: intervalMinutes,
    });
  }
}

export async function runRevalidation(): Promise<{ checked: number; gone: number }> {
  const all = await db.archives.toArray();
  if (all.length === 0) {
    await recordScan({ ranAt: Date.now(), totalChecked: 0, totalGone: 0 });
    return { checked: 0, gone: 0 };
  }
  const urls = all.map((a) => a.url);
  const results = await checkBatch(urls, { concurrency: 6, timeoutMs: 6000 });

  let gone = 0;
  for (const a of all) {
    const r = results.get(a.url);
    if (!r) continue;
    const status = r.ok ? 'ok' : 'gone';
    if (status === 'gone') gone++;
    await updateArchive(a.id!, {
      status,
      lastCheckedAt: Date.now(),
      lastStatusCode: r.status,
    });
  }
  await recordScan({ ranAt: Date.now(), totalChecked: all.length, totalGone: gone });
  return { checked: all.length, gone };
}
