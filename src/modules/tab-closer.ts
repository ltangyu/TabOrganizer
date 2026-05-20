export async function closeTabs(tabIds: number[]): Promise<number> {
  if (tabIds.length === 0) return 0;
  const valid: number[] = [];
  for (const id of tabIds) {
    try {
      const t = await chrome.tabs.get(id);
      if (t) valid.push(id);
    } catch {
      /* tab already closed */
    }
  }
  if (valid.length === 0) return 0;
  await chrome.tabs.remove(valid);
  return valid.length;
}
