module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  testEnvironment: 'node',
  // workspace-hoisted packages live in root node_modules; workspace-specific
  // packages (e.g. typeorm) end up in apps/api/node_modules — add both paths
  // so Jest can resolve across the monorepo boundary
  modulePaths: ['<rootDir>/node_modules', '<rootDir>/../../node_modules'],
};
