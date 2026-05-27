import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Plugin to keep the Vite bundle compatible with older Android WebView.
// Classic scripts in <head> must be deferred so #root exists before React mounts.
function androidCompatPlugin() {
  return {
    name: 'android-compat',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        return html
          .replace(/\s*type="module"/g, '')
          .replace(/\s*crossorigin\s*/g, ' ')
          .replace(/<script src=/g, '<script defer src=');
      },
    },
  };
}

export default defineConfig({
  plugins: [react(), androidCompatPlugin()],
  base: './',
  build: {
    target: 'es2015',
    rollupOptions: {
      output: {
        format: 'iife',
        name: 'PhysicalHealthApp',
        inlineDynamicImports: true,
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
})
