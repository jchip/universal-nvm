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
        'dist/**',
        'test/**',
        '**/*.config.js',
        'webpack.config.js',
        'xclap.js'
      ]
    },
    // Separate test timeouts for different test types
    testTimeout: 30000, // Default 30s for most tests
    hookTimeout: 30000
  }
});
