// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  css: ["./app/assets/css/main.css"],
  modules: ["nuxt-security"],
  security: {
    hidePoweredBy: false,
  },
  routeRules: {
    "/**": {
      headers: {
        "Permissions-Policy": "display-capture=()",
      },
    },
  },
  runtimeConfig: {
    // PRIVATE — only accessible server-side via useRuntimeConfig()
    // Never exposed to the browser bundle
    payloadSecret:
      process.env.PAYLOAD_SECRET || "fallback-secret-for-encryption-777",
    public: {
      // nothing sensitive here
    },
  },
  vite: {
    optimizeDeps: {
      include: ["lucide-vue-next"],
    },
    plugins: [tailwindcss()],
  },
});
