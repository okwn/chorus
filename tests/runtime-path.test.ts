/**
 * Unit tests for src/lib/runtime-path.ts
 *
 * Covers the exported surface:
 *   - captureInteractivePath: null-return cases, environment detection
 *   - buildRuntimePath: PATH composition and deduplication
 *   - buildRuntimeEnv: env object construction
 *
 * Note: execSync cannot be mocked via Object.defineProperty in this
 * environment (the child_process module exports execSync as a
 * non-configurable property). The captureInteractivePath happy-path
 * tests are covered by the real shell call in the existing suite.
 * Focus here is on the null-return guards and the buildRuntime* layer.
 */
import { describe, it, expect } from 'vitest';

const ORIG_ENV = { ...process.env };

function withEnv(overrides: Record<string, string | undefined>, fn: () => void) {
  const prev = process.env;
  process.env = { ...ORIG_ENV, ...overrides };
  try { fn(); } finally { process.env = prev; }
}

import {
  captureInteractivePath,
  buildRuntimePath,
  buildRuntimeEnv,
} from '../src/lib/runtime-path.js';

describe('captureInteractivePath', () => {
  it('returns null when SHELL env var is empty/unset', () =>
    withEnv({ SHELL: '' }, () => {
      const result = captureInteractivePath();
      expect(result).toBeNull();
    }));

  it('returns null when shell binary does not exist on PATH', () =>
    withEnv({ SHELL: '/nonexistent/does-not-exist-12345' }, () => {
      const result = captureInteractivePath();
      expect(result).toBeNull();
    }));

  // Note: execSync cannot be mocked in this environment. Happy-path
  // coverage (valid PATH returned) is provided by the existing test
  // suite's integration tests. Here we cover the null-return guards.
});

describe('buildRuntimePath', () => {
  it('starts with process.env.PATH entries', async () => {
    await withEnv({ PATH: '/custom/bin:/other/bin' }, async () => {
      const result = await buildRuntimePath();
      expect(result).toContain('/custom/bin');
      expect(result).toContain('/other/bin');
    });
  });

  it('deduplicates PATH entries preserving first-occurrence order', async () => {
    await withEnv({ PATH: '/bin:/usr/bin:/bin:/usr/local/bin' }, async () => {
      const result = await buildRuntimePath();
      const parts = result.split(':');
      expect(parts.filter(p => p === '/bin')).toHaveLength(1);
      expect(parts.filter(p => p === '/usr/bin')).toHaveLength(1);
    });
  });

  it('appends known install dirs to PATH after process.env.PATH', async () => {
    await withEnv({ PATH: '/usr/bin' }, async () => {
      const result = await buildRuntimePath();
      // /usr/local/bin is in the known install dirs list and exists on linux
      expect(result.split(':').filter(p => p === '/usr/local/bin')).toHaveLength(1);
    });
  });

  it('filters empty parts from PATH split', async () => {
    await withEnv({ PATH: '/bin::/usr/bin:' }, async () => {
      const result = await buildRuntimePath();
      const parts = result.split(':');
      expect(parts.every(p => p.length > 0)).toBe(true);
    });
  });

  it('uses colon as delimiter on Unix', async () => {
    await withEnv({ PATH: '/bin' }, async () => {
      const result = await buildRuntimePath();
      expect(result).toContain(':');
    });
  });
});

describe('buildRuntimeEnv', () => {
  it('returns an object with PATH derived from buildRuntimePath', async () => {
    await withEnv({ PATH: '/bin:/usr/bin', HOME: process.env.HOME || '/root' }, async () => {
      const result = await buildRuntimeEnv();
      expect(typeof result.PATH).toBe('string');
      expect(result.PATH).toContain('/bin');
    });
  });

  it('preserves other env vars unchanged', async () => {
    await withEnv({ PATH: '/usr/bin', NODE_ENV: 'test', HOME: process.env.HOME || '/root' }, async () => {
      const result = await buildRuntimeEnv();
      expect(result.NODE_ENV).toBe('test');
    });
  });

  it('PATH is deduplicated via buildRuntimePath', async () => {
    await withEnv({ PATH: '/bin:/bin:/usr/bin' }, async () => {
      const result = await buildRuntimeEnv();
      const parts = result.PATH!.split(':');
      expect(parts.filter(p => p === '/bin')).toHaveLength(1);
    });
  });
});