/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>"],
  testMatch: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  moduleNameMapper: {
    "^expo-image-manipulator$": "<rootDir>/__mocks__/expo-image-manipulator.ts",
  },
  // Pure logic tests only (utils, services, store)
  // Component rendering tests (.tsx) require jest-expo + compatible Node
  collectCoverageFrom: [
    "utils/**/*.ts",
    "services/**/*.ts",
    "store/**/*.ts",
    "!**/__tests__/**",
  ],
  coverageThreshold: {
    global: {
      branches: 5,
      functions: 15,
      lines: 10,
      statements: 10,
    },
  },
};
