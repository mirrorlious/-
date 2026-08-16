import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readingCompletionPlugin } from './scripts/reading-completion-vite-plugin.mjs';

export default defineConfig({
  plugins: [readingCompletionPlugin(), react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/firebase')) return 'firebase';
          if (id.includes('node_modules/pdfjs-dist')) return 'pdfjs';
          if (id.includes('node_modules/react')) return 'react';
        }
      }
    }
  }
});