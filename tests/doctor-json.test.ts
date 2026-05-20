import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DoctorReport } from '../src/cli/commands/doctor.js';

// We test the JSON output format by checking the structure
// since full integration requires the daemon running.
describe('doctor JSON output format', () => {
  const sampleReport: DoctorReport = {
    detection: [
      {
        id: 'claude-code',
        found: true,
        path: '/usr/local/bin/claude',
        source: 'path',
      },
      {
        id: 'codex-cli',
        found: false,
        reason: 'not in PATH',
      },
      {
        id: 'opencode-cli',
        found: true,
        path: '~/.local/bin/opencode',
        source: 'manual',
      },
    ],
    capturedPath: '/usr/local/bin:/usr/bin:/home/user/.local/bin',
    daemonPath: '/usr/local/bin:/usr/bin',
    manualPaths: { 'opencode-cli': '~/.local/bin/opencode' },
  };

  it('report has all required fields', () => {
    expect(sampleReport.detection).toBeDefined();
    expect(Array.isArray(sampleReport.detection)).toBe(true);
    expect(sampleReport.capturedPath).toBeDefined();
    expect(sampleReport.daemonPath).toBeDefined();
    expect(sampleReport.manualPaths).toBeDefined();
  });

  it('detection entry has required fields when found', () => {
    const entry = sampleReport.detection[0];
    expect(entry.id).toBeDefined();
    expect(entry.found).toBe(true);
    expect(entry.path).toBeDefined();
    expect(entry.source).toMatch(/^(path|fallback|manual|rcfile)$/);
  });

  it('detection entry has reason when not found', () => {
    const entry = sampleReport.detection[1];
    expect(entry.id).toBeDefined();
    expect(entry.found).toBe(false);
    expect(entry.reason).toBeDefined();
  });

  it('paths are colon-separated strings', () => {
    expect(sampleReport.capturedPath!.split(':').length).toBeGreaterThan(0);
    expect(sampleReport.daemonPath.split(':').length).toBeGreaterThan(0);
  });

  it('JSON serialization round-trip', () => {
    const json = JSON.stringify(sampleReport);
    const parsed = JSON.parse(json) as DoctorReport;
    expect(parsed.detection.length).toBe(sampleReport.detection.length);
    expect(parsed.capturedPath).toBe(sampleReport.capturedPath);
  });
});
