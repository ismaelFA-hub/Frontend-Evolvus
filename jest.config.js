/** @type {import('ts-jest').JestConfigWithTsJest} */
const sharedTransform = {
  '^.+\\.tsx?$': ['ts-jest', {
    tsconfig: {
      module: 'commonjs',
      moduleResolution: 'node',
      esModuleInterop: true,
      paths: { '@shared/*': ['./shared/*'] }
    }
  }]
};

const sharedModuleNameMapper = {
  '^@shared/(.*)$': '<rootDir>/shared/$1'
};

// Heavy backtest suites: generate 5+ years of candle data and take > 1 minute
// Run separately via --selectProjects backend-heavy (CI: continue-on-error: true)
const HEAVY_BACKTEST_PATTERN =
  /(leveragedBacktest|multiAssetBacktest|planComparisonBacktest|historicalBacktest|trendGatedLeverageBacktest)\.test\.ts$/;

module.exports = {
  projects: [
    // ── Fast backend tests (run on every PR) ─────────────────
    {
      displayName: 'backend',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/server/__tests__/**/*.test.ts'],
      testPathIgnorePatterns: [
        '/node_modules/',
        HEAVY_BACKTEST_PATTERN.source,
      ],
      transform: sharedTransform,
      moduleNameMapper: sharedModuleNameMapper,
      setupFiles: ['<rootDir>/server/__tests__/jestSetup.ts'],
    },
    // ── Heavy backtest suites (10+ min, run separately) ──────
    {
      displayName: 'backend-heavy',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/server/__tests__/leveragedBacktest.test.ts',
        '<rootDir>/server/__tests__/multiAssetBacktest.test.ts',
        '<rootDir>/server/__tests__/planComparisonBacktest.test.ts',
        '<rootDir>/server/__tests__/historicalBacktest.test.ts',
        '<rootDir>/server/__tests__/trendGatedLeverageBacktest.test.ts',
      ],
      transform: sharedTransform,
      moduleNameMapper: sharedModuleNameMapper,
    },
  ]
};
