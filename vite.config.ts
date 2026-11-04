import adapter from "@sveltejs/adapter-node";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    sveltekit({
      adapter: adapter({ out: "build" }),
      // PLAN §5: default-src 'self'; images only from our own routes. SvelteKit adds nonces for its
      // own inline scripts; Svelte's scoped styles need 'unsafe-inline' for style attributes only
      // (no script is ever inline).
      csp: {
        mode: "auto",
        directives: {
          "default-src": ["self"],
          "script-src": ["self"],
          "style-src": ["self", "unsafe-inline"],
          "img-src": ["self", "data:"],
          "font-src": ["self"],
          "connect-src": ["self"],
          "object-src": ["none"],
          "base-uri": ["self"],
          "form-action": ["self"],
          "frame-ancestors": ["none"]
        }
      },
    })
  ],
  server: { port: 5173, strictPort: false },
  build: { sourcemap: false }
});
