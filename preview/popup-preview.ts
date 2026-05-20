import './chrome-mock';
import { registerHandler } from './chrome-mock';
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import PopupApp from '@/popup/PopupApp.vue';
import '@/styles/global.css';

registerHandler('scan/request', () => ({
  type: 'scan/response',
  candidates: [
    { tabId: 1, windowId: 1, url: 'https://github.com/a', title: 'github tab', domain: 'github.com', suggestedCategoryId: 1 },
    { tabId: 2, windowId: 1, url: 'https://github.com/b', title: 'github tab 2', domain: 'github.com', suggestedCategoryId: 1 },
    { tabId: 3, windowId: 1, url: 'https://news.ycombinator.com/x', title: 'HN', domain: 'news.ycombinator.com', suggestedCategoryId: null },
    { tabId: 4, windowId: 1, url: 'https://developer.mozilla.org/x', title: 'MDN', domain: 'developer.mozilla.org', suggestedCategoryId: 2 },
    { tabId: 5, windowId: 1, url: 'https://youtube.com/x', title: 'YT', domain: 'youtube.com', suggestedCategoryId: 3 },
    { tabId: 6, windowId: 1, url: 'https://twitter.com/x', title: 'X', domain: 'twitter.com', suggestedCategoryId: null },
    { tabId: 7, windowId: 1, url: 'https://stackoverflow.com/x', title: 'SO', domain: 'stackoverflow.com', suggestedCategoryId: 1 },
  ],
  total: 47,
  suggested: 32,
  unassigned: 15,
}));

const app = createApp(PopupApp);
app.use(createPinia());
app.mount('#app');
