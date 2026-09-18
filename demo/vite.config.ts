import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    root: fileURLToPath(new URL('.', import.meta.url)),
    plugins: [react()],
    resolve: {
        alias: {
            // Use the source directly, no build needed to run the demo
            '@avcs/autosuggest': fileURLToPath(new URL('../src/index.ts', import.meta.url))
        }
    }
});
