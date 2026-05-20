import { createApp } from 'vue';
import { createPinia } from 'pinia';
import PopupApp from './PopupApp.vue';
import '@/styles/global.css';

const app = createApp(PopupApp);
app.use(createPinia());
app.mount('#app');
