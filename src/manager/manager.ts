import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ManagerApp from './ManagerApp.vue';
import '@/styles/global.css';

const app = createApp(ManagerApp);
app.use(createPinia());
app.mount('#app');
