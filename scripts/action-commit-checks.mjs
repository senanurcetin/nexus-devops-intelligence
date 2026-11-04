#!/usr/bin/env node
// GitHub Action entry point for action.yml. See src/lib/nexus-action-commit-checks.mjs.
import { runAction } from '../src/lib/nexus-action-commit-checks.mjs';

try {
  process.exitCode = await runAction();
} catch (error) {
  process.stderr.write('::error::' + (error instanceof Error ? error.message : 'Unexpected error') + '\n');
  process.exitCode = 2;
}
