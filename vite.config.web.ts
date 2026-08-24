import { resolve } from 'path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_PROXY || 'http://localhost:8787'

  return {
    root: resolve('src/web'),
    envDir: resolve('.'),
    define: {
      'import.meta.env.VITE_APP_TARGET': JSON.stringify('web'),
      'import.meta.env.VITE_API_BASE': JSON.stringify(env.VITE_API_BASE ?? '')
    },
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [react()],
    optimizeDeps: {
      include: ['@vercel/blob/client']
    },
    server: {
      port: 5174,
      strictPort: true,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true
        }
      }
    },
    preview: {
      port: 4174,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true
        }
      }
    },
    build: {
      outDir: resolve('dist-web'),
      emptyOutDir: true
    }
  }
})
