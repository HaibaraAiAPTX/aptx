import { createApp } from "vue";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import App from "./App.vue";
import "./style.css";

const app = createApp(App);
app.use(VueQueryPlugin, { queryClient: new QueryClient() });
app.mount("#app");
