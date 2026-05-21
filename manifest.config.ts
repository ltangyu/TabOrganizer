import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json' with { type: 'json' };

export default defineManifest({
  manifest_version: 3,
  name: 'TabOrganizer',
  version: pkg.version,
  description: '分類分頁、截圖保留 URL、關閉分頁釋放記憶體；404 自動剔除',
  minimum_chrome_version: '116',
  // 固定 extension ID = eanilmbkohdgpndehpbikchfpnaboloh
  // 在使用者首次手動「載入未封裝項目」後，ID 永久不變，
  // 桌面捷徑因此可硬寫 chrome-extension://[id]/...
  key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuxoGVziNeCSWHscFZc78WYNQsxAaCZekKihQMLC7rg9/UZQl2ZeMLMZfpR4KKMVo1tNnwu34swK/uH3CrToyjZ39k2pX2NJQwlNHx/+z4Wg+EL9tOJR2JSyntdvpVoOA5/C5ZUXCi/n1tn+hV9floloDQ/6n3i+vf969pHQ/BihfXTTaqkdqCDvQzfBShfxlagqlN2UneVkLz8F963Uosn9CPDiIV5aL1am8LHpGLMm83xewE3G3PLmq9QxM0tEx6wWdsX+4g9u6dLR/oVQfAERy/mXPyGYOiJQb18ZC8Ch7My9ZB6AYEgzutQfIg5tCr3Ps/Lh62SHe4gUwNTqVnwIDAQAB',
  permissions: ['tabs', 'activeTab', 'downloads', 'storage', 'alarms', 'tabGroups'],
  host_permissions: ['<all_urls>'],
  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module',
  },
  action: {
    default_popup: 'src/popup/popup.html',
    default_title: 'TabOrganizer',
    default_icon: {
      '16': 'icons/icon-16.png',
      '32': 'icons/icon-32.png',
      '48': 'icons/icon-48.png',
      '128': 'icons/icon-128.png',
    },
  },
  icons: {
    '16': 'icons/icon-16.png',
    '32': 'icons/icon-32.png',
    '48': 'icons/icon-48.png',
    '128': 'icons/icon-128.png',
  },
  web_accessible_resources: [
    {
      resources: ['src/manager/manager.html'],
      matches: ['<all_urls>'],
    },
  ],
});
