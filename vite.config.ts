import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'
import path from 'path'

const pathResolve = (dir: string) => path.resolve(__dirname, dir)

export default defineConfig(({ command }) => {
  const isServe = command === 'serve'
  const isBuild = command === 'build'

  return {
    plugins: [
      react(),
      electron({
        main: {
          entry: 'src/main/index.ts',
          vite: {
            build: {
              sourcemap: isServe,
              minify: isBuild,
              outDir: 'dist/main',
              rollupOptions: {
                external: ['@lydell/node-pty', 'electron', 'electron-store', 'simple-git']
              }
            },
            resolve: {
              alias: {
                '@shared': pathResolve('src/shared')
              }
            }
          }
        },
        preload: {
          input: 'src/preload/index.ts',
          vite: {
            build: {
              sourcemap: isServe ? 'inline' : undefined,
              minify: isBuild,
              outDir: 'dist/preload',
              rollupOptions: {
                output: {
                  entryFileNames: 'index.js'
                }
              }
            },
            resolve: {
              alias: {
                '@shared': pathResolve('src/shared')
              }
            }
          }
        }
      })
    ],
    resolve: {
      alias: {
        '@': pathResolve('src'),
        '@main': pathResolve('src/main'),
        '@renderer': pathResolve('src/renderer'),
        '@shared': pathResolve('src/shared')
      }
    },
    build: {
      outDir: 'dist/renderer'
    },
    clearScreen: false
  }
})
