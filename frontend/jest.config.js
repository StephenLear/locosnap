/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  // Pure logic tests only (utils, services, store)
  // Component rendering tests (.tsx) require jest-expo + compatible Node
  collectCoverageFrom: [
    "utils/**/*.ts",
    "services/**/*.ts",
    "store/**/*.ts",
    "!**/__tests__/**",
  ],
};
