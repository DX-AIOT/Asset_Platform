module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: { strict: false } }],
  },
  testEnvironment: 'node',
  // workspace-hoisted packages live in root node_modules; workspace-specific
  // packages (e.g. typeorm) end up in apps/api/node_modules — add both paths
  // so Jest can resolve across the monorepo boundary
  modulePaths: ['<rootDir>/node_modules', '<rootDir>/../../node_modules'],
  // Stub @nestjs/swagger so coverage runs pass in workspaces where the package
  // is not present in the Jest module resolution paths (e.g. NODE_ENV=production
  // installs, partial hoisting, or fresh CI checkouts before npm ci completes).
  // All swagger decorators are metadata-only and have no effect on test logic.
  moduleNameMapper: {
    '^@nestjs/swagger$': '<rootDir>/test/__mocks__/nestjs-swagger.js',
  },
};
