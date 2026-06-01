import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    // Keep the build fast — this is a smoke check, not a production app.
    target: 'es2020',
    sourcemap: false,
  },
});
