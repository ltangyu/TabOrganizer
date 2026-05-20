/**
 * 生成 Chrome MV3 extension 的固定 manifest "key"，並計算對應的 extension ID。
 * 一旦在 manifest 加入此 key，無論在哪個機器、哪個 Chrome profile 載入此 extension，
 * ID 都會相同 → .lnk 桌面捷徑可以硬寫 chrome-extension://[id]/... 而不會失效。
 *
 * 使用：node scripts/generate-ext-key.mjs
 * 然後把輸出的 key 貼到 manifest.config.ts。
 */
import { generateKeyPairSync, createHash } from 'node:crypto';

const { publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'der' },
});

const keyB64 = publicKey.toString('base64');

// Chrome 用 SHA-256(publicKey) 的前 16 bytes (32 hex chars)，每個 hex char 映射到 a-p
const hashHex = createHash('sha256').update(publicKey).digest('hex');
const id = hashHex
  .slice(0, 32)
  .split('')
  .map((c) => {
    const n = parseInt(c, 16);
    return String.fromCharCode('a'.charCodeAt(0) + n);
  })
  .join('');

console.log('Extension ID:', id);
console.log('');
console.log('Manifest key (貼到 manifest.config.ts):');
console.log(keyB64);
