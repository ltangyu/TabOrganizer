export interface CheckResult {
  ok: boolean;
  status: number | 'timeout' | 'network-error';
}

interface CheckOptions {
  concurrency?: number;
  timeoutMs?: number;
}

async function checkOne(url: string, timeoutMs: number): Promise<CheckResult> {
  const tryFetch = async (method: 'HEAD' | 'GET'): Promise<CheckResult> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers: Record<string, string> = {};
      if (method === 'GET') headers['Range'] = 'bytes=0-0';
      const res = await fetch(url, {
        method,
        signal: controller.signal,
        redirect: 'follow',
        headers,
        cache: 'no-store',
      });
      return { ok: res.ok || (res.status >= 200 && res.status < 400), status: res.status };
    } catch (e) {
      if ((e as Error).name === 'AbortError') return { ok: false, status: 'timeout' };
      return { ok: false, status: 'network-error' };
    } finally {
      clearTimeout(timer);
    }
  };

  const head = await tryFetch('HEAD');
  if (head.ok) return head;
  if (typeof head.status === 'number') {
    if (head.status === 401) return { ok: true, status: head.status };
    if (head.status === 405 || head.status === 403) {
      const get = await tryFetch('GET');
      if (get.status === 401 || get.status === 403) return { ok: true, status: get.status };
      return get;
    }
  }
  return head;
}

export type CheckProgressFn = (done: number, total: number, lastUrl?: string) => void;

export async function checkBatch(
  urls: string[],
  { concurrency = 8, timeoutMs = 5000 }: CheckOptions = {},
  onProgress?: CheckProgressFn,
): Promise<Map<string, CheckResult>> {
  const results = new Map<string, CheckResult>();
  let i = 0;
  let done = 0;

  async function worker(): Promise<void> {
    while (i < urls.length) {
      const idx = i++;
      const url = urls[idx]!;
      const r = await checkOne(url, timeoutMs);
      results.set(url, r);
      done++;
      onProgress?.(done, urls.length, url);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, urls.length) }, () => worker());
  await Promise.all(workers);
  return results;
}
