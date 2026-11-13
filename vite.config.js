import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: false,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        configure: (proxy, _options) => {
          proxy.on('error', (err, req, res) => {
            console.error(`[Vite Proxy Error] Failed to proxy ${req.method} ${req.url} to port 5000:`, err.message);
            if (!res.headersSent && res.writeHead) {
              res.writeHead(503, {
                'Content-Type': 'application/json'
              });
              res.end(JSON.stringify({
                success: false,
                code: 'BACKEND_OFFLINE',
                error: 'Backend API server is not running on port 5000. Please start the backend server with: npm run server'
              }));
            }
          });
        }
      }
    }
  }
});
