// capstone 「전역 제약」: 클라이언트 번들(Vite) · 개발 프록시 · 테스트(Vitest)
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: '.',
  build: { outDir: 'dist/client', emptyOutDir: true, chunkSizeWarningLimit: 1500 },
  server: { port: 5173, proxy: { '/ws': { target: 'ws://localhost:3000', ws: true } } },
  test: { include: ['src/**/*.test.ts'], environment: 'node', testTimeout: 20000 },
});
