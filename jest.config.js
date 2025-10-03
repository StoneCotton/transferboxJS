module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  moduleNameMapper: {
    '^~/(.*)$': '<rootDir>/src/renderer/src/$1'
  },
  collectCoverageFrom: [
    'src/main/**/*.ts',
    'src/preload/**/*.ts',
    '!src/main/index.ts',
    '!**/*.d.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  // Transform ESM modules from node_modules
  transformIgnorePatterns: [
    'node_modules/(?!(electron-store|conf|atomically|dot-prop|env-paths|type-fest|pkg-up|find-up|locate-path|p-locate|path-exists)/)'
  ],
  // Separate config for renderer tests with jsdom
  projects: [
    {
      displayName: 'main',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/main/**/*.test.ts', '<rootDir>/tests/integration/**/*.test.ts'],
      preset: 'ts-jest',
      transformIgnorePatterns: [
        'node_modules/(?!(electron-store|conf|atomically|dot-prop|env-paths|type-fest|pkg-up|find-up|locate-path|p-locate|path-exists)/)'
      ]
    },
    {
      displayName: 'renderer',
      testEnvironment: 'jsdom',
      testMatch: [
        '<rootDir>/tests/renderer/**/*.test.tsx',
        '<rootDir>/tests/renderer/**/*.test.ts'
      ],
      preset: 'ts-jest',
      moduleNameMapper: {
        '^~/(.*)$': '<rootDir>/src/renderer/src/$1',
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy'
      },
      transformIgnorePatterns: [
        'node_modules/(?!(electron-store|conf|atomically|dot-prop|env-paths|type-fest|pkg-up|find-up|locate-path|p-locate|path-exists)/)'
      ]
    }
  ]
}
