export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return await response.blob();
}

export async function resizeToThumb(
  dataUrl: string,
  maxWidth: number,
  quality = 0.8,
): Promise<Blob> {
  const blob = await dataUrlToBlob(dataUrl);
  const bitmap = await createImageBitmap(blob);

  const ratio = bitmap.width > maxWidth ? maxWidth / bitmap.width : 1;
  const w = Math.round(bitmap.width * ratio);
  const h = Math.round(bitmap.height * ratio);

  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('OffscreenCanvas 2d context unavailable');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  return await canvas.convertToBlob({ type: 'image/webp', quality });
}

export function blobToObjectUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}

export function revokeObjectUrl(url: string): void {
  URL.revokeObjectURL(url);
}
