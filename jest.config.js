/** @type {import('jest').Config} */
module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	roots: ['<rootDir>/src'],
	testMatch: ['**/*.spec.ts'],
	moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
	clearMocks: true,
	restoreMocks: true,
	collectCoverageFrom: ['src/**/*.ts', '!src/**/*.spec.ts', '!src/test-utils/**', '!src/**/types.ts'],
	coverageDirectory: 'coverage',
	coverageReporters: ['text', 'lcov'],
	coverageThreshold: {
		global: { branches: 90, functions: 95, lines: 95, statements: 95 }
	}
};
