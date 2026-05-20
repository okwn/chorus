import { describe, it, expect } from 'vitest';
import {
  detectRuntimeEnv,
  shouldAutoOpenBrowser,
  type RuntimeEnv,
  type RuntimeEnvInfo,
} from '../src/cli/runtime-env.js';

// Save original env once at module load — tests restore after each
const ORIG_ENV = { ...process.env };

function withEnv(overrides: Record<string, string | undefined>, fn: () => void) {
  const prev = process.env;
  process.env = { ...ORIG_ENV, ...overrides };
  try {
    fn();
  } finally {
    process.env = prev;
  }
}

describe('runtime-env', () => {
  // ─── detectRuntimeEnv() ─────────────────────────────────────────────────

  describe('detectRuntimeEnv()', () => {
    it('returns native when no remote signals are present', () =>
      withEnv({}, () => {
        const result = detectRuntimeEnv();
        expect(result.kind).toBe('native');
        expect(result.hint).toBe('');
      }));

    it('detects Codespaces via CODESPACES env var', () =>
      withEnv({ CODESPACES: 'true' }, () => {
        const result = detectRuntimeEnv();
        expect(result.kind).toBe('codespaces');
        expect(result.hint).toContain('Ports tab');
      }));

    it('detects VSCode Remote-SSH via VSCODE_IPC_HOOK_CLI', () =>
      withEnv({ VSCODE_IPC_HOOK_CLI: '1' }, () => {
        const result = detectRuntimeEnv();
        expect(result.kind).toBe('vscode-remote');
        expect(result.hint).toContain('VSCode');
      }));

    it('returns native for TERM_PROGRAM=cursor without VSCODE_IPC_HOOK_CLI', () =>
      // Note: TERM_PROGRAM=cursor is currently only checked inside the
      // VSCODE_IPC_HOOK_CLI branch, so cursor-alone returns 'native'.
      // This is a known gap tracked in the PR notes.
      withEnv({ TERM_PROGRAM: 'cursor' }, () => {
        const result = detectRuntimeEnv();
        expect(result.kind).toBe('native');
      }));

    it('returns native for CURSOR_TRACE_ID without VSCODE_IPC_HOOK_CLI', () =>
      // Note: CURSOR_TRACE_ID is only checked inside the VSCODE_IPC_HOOK_CLI
      // branch, so CURSOR_TRACE_ID-alone returns 'native'.
      // This is a known gap tracked in the PR notes.
      withEnv({ CURSOR_TRACE_ID: 'abc-123' }, () => {
        const result = detectRuntimeEnv();
        expect(result.kind).toBe('native');
      }));

    it('detects cursor-remote when VSCODE_IPC_HOOK_CLI + TERM_PROGRAM=cursor', () =>
      withEnv({ VSCODE_IPC_HOOK_CLI: '1', TERM_PROGRAM: 'cursor' }, () => {
        const result = detectRuntimeEnv();
        expect(result.kind).toBe('cursor-remote');
      }));

    it('detects cursor-remote when VSCODE_IPC_HOOK_CLI + CURSOR_TRACE_ID', () =>
      withEnv({ VSCODE_IPC_HOOK_CLI: '1', CURSOR_TRACE_ID: 'abc-123' }, () => {
        const result = detectRuntimeEnv();
        expect(result.kind).toBe('cursor-remote');
      }));

    it('detects WSL2 via WSL_DISTRO_NAME', () =>
      withEnv({ WSL_DISTRO_NAME: 'Ubuntu-22.04' }, () => {
        const result = detectRuntimeEnv();
        expect(result.kind).toBe('wsl');
        expect(result.hint).toContain('localhost:5050');
      }));

    it('detects plain SSH session via SSH_CONNECTION', () =>
      withEnv({ SSH_CONNECTION: '192.168.1.1 22 10.0.0.1 22' }, () => {
        const result = detectRuntimeEnv();
        expect(result.kind).toBe('ssh');
        expect(result.hint).toContain('ssh -L');
      }));

    it('detects plain SSH session via SSH_TTY alone', () =>
      withEnv({ SSH_TTY: '/dev/pts/0' }, () => {
        const result = detectRuntimeEnv();
        expect(result.kind).toBe('ssh');
      }));

    it('prefers CODESPACES over VSCODE_IPC_HOOK_CLI', () =>
      withEnv({ CODESPACES: 'true', VSCODE_IPC_HOOK_CLI: '1' }, () => {
        const result = detectRuntimeEnv();
        expect(result.kind).toBe('codespaces');
      }));

    it('prefers VSCODE_IPC_HOOK_CLI over WSL_DISTRO_NAME when both present', () =>
      // VSCODE_IPC_HOOK_CLI is checked before WSL_DISTRO_NAME in the source.
      withEnv({ WSL_DISTRO_NAME: 'Ubuntu', VSCODE_IPC_HOOK_CLI: '1' }, () => {
        const result = detectRuntimeEnv();
        expect(result.kind).toBe('vscode-remote');
      }));
  });

  // ─── shouldAutoOpenBrowser() ──────────────────────────────────────────────

  describe('shouldAutoOpenBrowser()', () => {
    const make = (kind: RuntimeEnv, hint = ''): RuntimeEnvInfo => ({ kind, hint });

    it('returns true for native', () => {
      expect(shouldAutoOpenBrowser(make('native'))).toBe(true);
    });

    it('returns true for wsl', () => {
      expect(shouldAutoOpenBrowser(make('wsl'))).toBe(true);
    });

    it('returns false for vscode-remote', () => {
      expect(shouldAutoOpenBrowser(make('vscode-remote'))).toBe(false);
    });

    it('returns false for cursor-remote', () => {
      expect(shouldAutoOpenBrowser(make('cursor-remote'))).toBe(false);
    });

    it('returns false for codespaces', () => {
      expect(shouldAutoOpenBrowser(make('codespaces'))).toBe(false);
    });

    it('returns false for ssh', () => {
      expect(shouldAutoOpenBrowser(make('ssh'))).toBe(false);
    });
  });

  // ─── type exhaustiveness ──────────────────────────────────────────────────

  it('RuntimeEnv type covers all variants', () => {
    // If a new RuntimeEnv variant is added without updating this test,
    // TypeScript will error on the never assignment below.
    const variants: RuntimeEnv[] = [
      'native', 'wsl', 'vscode-remote', 'cursor-remote', 'codespaces', 'ssh',
    ];
    for (const v of variants) {
      const check = (env: RuntimeEnv): string => {
        switch (env) {
          case 'native': return 'native';
          case 'wsl': return 'wsl';
          case 'vscode-remote': return 'vscode-remote';
          case 'cursor-remote': return 'cursor-remote';
          case 'codespaces': return 'codespaces';
          case 'ssh': return 'ssh';
          default: {
            const _exhaustive: never = env;
            return _exhaustive;
          }
        }
      };
      expect(check(v)).toBe(v);
    }
  });
});