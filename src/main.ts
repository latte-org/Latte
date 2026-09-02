import { createApp } from "vue";
import App from "./App.vue";
import { applyTheme, loadSettings } from "./lib/settings";
import "./style.css";

applyTheme(loadSettings().theme);

createApp(App).mount("#app");
