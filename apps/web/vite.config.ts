import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
	plugins: [react(), tailwindcss()],
	resolve: {
		alias: {
			'~/': `${path.resolve(__dirname, 'src')}/`,
		},
	},
	server: {
		host: '127.0.0.1',
		port: Number(process.env.HANABI_DEV_WEB_PORT || 5173),
		strictPort: true,
		proxy: {
			'/api': {
				target: process.env.HANABI_DEV_SERVER_URL || 'http://127.0.0.1:3000',
				changeOrigin: true,
			},
			'/socket.io': {
				target: process.env.HANABI_DEV_SERVER_URL || 'http://127.0.0.1:3000',
				ws: true,
			},
		},
	},
	build: {
		outDir: '../../dist/apps/web',
		emptyOutDir: true,
	},
});
