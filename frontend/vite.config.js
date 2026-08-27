import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
export default defineConfig(function (_a) {
    var _b, _c;
    var mode = _a.mode;
    var env = loadEnv(mode, process.cwd(), '');
    var apiPort = (_c = (_b = env.VITE_API_PORT) !== null && _b !== void 0 ? _b : process.env.VITE_API_PORT) !== null && _c !== void 0 ? _c : '8080';
    var apiTarget = "http://localhost:".concat(apiPort);
    return {
        plugins: [react()],
        build: {
            emptyOutDir: false,
        },
        resolve: {
            alias: {
                '@': path.resolve(__dirname, './src'),
            },
        },
        server: {
            port: 3000,
            open: true,
            proxy: {
                '/api': {
                    target: apiTarget,
                    changeOrigin: true,
                },
                '/sanctum': {
                    target: apiTarget,
                    changeOrigin: true,
                },
            },
        },
    };
});
