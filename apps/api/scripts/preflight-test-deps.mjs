#!/usr/bin/env node

import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import path from 'node:path';

const appRoot = path.resolve(process.cwd());
const rootRoot = path.resolve(appRoot, '../..');
const localRequire = createRequire(path.join(appRoot, 'package.json'));
const rootRequire = createRequire(path.join(rootRoot, 'package.json'));

const requiredModules = [
  '@nestjs/swagger',
  '@nestjs/testing',
  'jest',
  'ts-jest',
];

const missing = [];

for (const mod of requiredModules) {
  let resolved = false;
  try {
    localRequire.resolve(mod);
    resolved = true;
  } catch {
    // Try workspace root fallback used by monorepo hoisting.
    try {
      rootRequire.resolve(mod);
      resolved = true;
    } catch {
      resolved = false;
    }
  }

  if (!resolved) {
    missing.push(mod);
  }
}

const jestBinLocal = path.join(appRoot, 'node_modules', '.bin', 'jest');
const jestBinRoot = path.join(rootRoot, 'node_modules', '.bin', 'jest');
if (!existsSync(jestBinLocal) && !existsSync(jestBinRoot)) {
  missing.push('jest-bin');
}

if (missing.length > 0) {
  console.error('API test dependency preflight failed. Missing runtime deps:');
  for (const mod of missing) {
    console.error(` - ${mod}`);
  }
  console.error('Expected install command: npm ci --workspaces --include-workspace-root --include=dev');
  process.exit(1);
}

console.log('API test dependency preflight passed.');
