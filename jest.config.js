module.exports = {
  testEnvironment: "jest-environment-jsdom",
  roots: ["<rootDir>/src"],
  transform: {
    "^.+\\.tsx?$": "ts-jest"
  },
  setupFilesAfterEnv: ["<rootDir>/setupTests.ts"],
  testRegex: "(/__tests__/.*|(\\.|/)(test))\\.tsx?$"
};
