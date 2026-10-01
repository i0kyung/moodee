import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages 등 하위 경로 배포를 고려해 상대 경로 base 사용
export default defineConfig({
  plugins: [react(), VitePWA({
    strategies: 'injectManifest', srcDir: 'src', filename: 'sw.ts',
    registerType: 'prompt', injectRegister: false, manifest: false,
    injectManifest: { globPatterns: ['**/*.{js,css,html}', 'manifest.webmanifest', 'assets/brand/*.png'], maximumFileSizeToCacheInBytes: 2000000 },
  })],
  base: './',
});
