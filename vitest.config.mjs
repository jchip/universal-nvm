import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'test/spec/**/*.spec.js',
      'test/e2e/**/*.spec.js'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',          // webpack bundle, not source
        'test/**',          // the tests themselves
        'stubs/**',         // webpack module shims
        '.temp/**',         // scratch/debug files
        '**/*.config.*',    // webpack.config.js, vitest.config.mjs
        'xclap.js',         // xrun task definitions
        'pack.js',          // packaging script
        'check-registry.js' // standalone registry diagnostic
      ]
    },
    // Separate test timeouts for different test types
    testTimeout: 30000, // Default 30s for most tests
    hookTimeout: 30000
  }
});
