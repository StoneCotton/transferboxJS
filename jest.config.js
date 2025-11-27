module.exports = {
  collectCoverageFrom: [
    'src/main/**/*.ts',
    'src/preload/**/*.ts',
    '!src/main/index.ts',
    '!**/*.d.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  // Separate config for renderer tests with jsdom
  projects: [
    {
      displayName: 'main',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/tests/main/**/*.test.ts',
        '<rootDir>/tests/integration/**/*.test.ts',
        '<rootDir>/tests/shared/**/*.test.ts',
        '<rootDir>/tests/preload/**/*.test.ts'
      ],
      preset: 'ts-jest',
      transform: {
        '^.+\\.tsx?$': [
          'ts-jest',
          {
            tsconfig: {
              esModuleInterop: true,
              allowSyntheticDefaultImports: true
            }
          }
        ]
      },
      moduleNameMapper: {
        '^electron$': '<rootDir>/tests/__mocks__/electron.ts'
      },
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
      transform: {
        '^.+\\.tsx?$': [
          'ts-jest',
          {
            tsconfig: '<rootDir>/tsconfig.web.json'
          }
        ]
      },
      moduleNameMapper: {
        '^~/(.*)$': '<rootDir>/src/renderer/src/$1',
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
        '\\.(jpg|jpeg|png|gif|svg|webp|mp3|wav)$': '<rootDir>/tests/__mocks__/fileMock.js'
      },
      transformIgnorePatterns: [
        'node_modules/(?!(electron-store|conf|atomically|dot-prop|env-paths|type-fest|pkg-up|find-up|locate-path|p-locate|path-exists)/)'
      ]
    }
  ]
}
