import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json' with { type: 'json' };

export default defineManifest({
  manifest_version: 3,
  name: 'TabOrganizer',
  version: pkg.version,
  description: '分類分頁、截圖保留 URL、關閉分頁釋放記憶體；404 自動剔除',
  minimum_chrome_version: '116',
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
