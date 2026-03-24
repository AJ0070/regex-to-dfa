import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/regex-to-dfa/' : '/',
  server: {
    allowedHosts: true,
  },
}));
