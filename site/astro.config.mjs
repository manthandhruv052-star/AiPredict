import { defineConfig } from 'astro/config';

export default defineConfig({
  // Static output: the whole point is a CDN-served site with no server.
  output: 'static',
  build: {
    // Keep the generated file count low — Cloudflare Pages free caps at 20,000.
    inlineStylesheets: 'always',
  },
  devToolbar: { enabled: false },
});
