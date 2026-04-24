import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'url'
import path from 'path'

// ESM-compatible __dirname
const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'tests/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'release', 'src/__tests__/e2e'],
    setupFiles: ['src/main/__tests__/setup.ts', 'src/renderer/__tests__/setup.ts'],
    environmentMatchGlobs: [
      ['src/renderer/hooks/__tests__/**/*.spec.ts', 'jsdom'],
      ['src/renderer/utils/__tests__/terminal-scroll-machine.spec.ts', 'node'],
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: [
        'src/main/project/project-store.ts',
        'src/main/git/git-manager.ts',
        'src/main/terminal/terminal-manager.ts'
      ],
      exclude: [
        'src/main/**/*.{test,spec}.ts',
        'src/main/**/index.ts'
      ]
    },
    alias: {
      '@shared': path.resolve(__dirname, './src/shared'),
      '@main': path.resolve(__dirname, './src/main'),
      '@renderer': path.resolve(__dirname, './src/renderer')
    }
  }
})
