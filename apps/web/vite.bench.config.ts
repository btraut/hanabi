import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
	root: fileURLToPath(new URL('.', import.meta.url)),
	plugins: [react(), tailwindcss()],
	resolve: { alias: { '~/': fileURLToPath(new URL('./src/', import.meta.url)) } },
	build: {
		outDir: '../../dist/apps/bench-review',
		emptyOutDir: true,
		rollupOptions: { input: fileURLToPath(new URL('./bench.html', import.meta.url)) },
	},
});
