/**
 * UAT Config — Tests for loadUatConfig and validateUatConfig
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Helper: create a temp directory with optional uat-config.yaml
function makeTempDir(yamlContent) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uat-test-'));
  if (yamlContent !== undefined) {
    fs.writeFileSync(path.join(dir, 'uat-config.yaml'), yamlContent, 'utf-8');
  }
  return dir;
}

// Helper: cleanup temp directory
function cleanupDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

const { loadUatConfig, validateUatConfig } = require('./uat.cjs');

describe('loadUatConfig', () => {
  it('returns null when uat-config.yaml does not exist', () => {
    const dir = makeTempDir();
    try {
      const result = loadUatConfig(dir);
      assert.equal(result, null);
    } finally {
      cleanupDir(dir);
    }
  });

  it('returns config with defaults for minimal valid config', () => {
    const dir = makeTempDir('base_url: "http://localhost:3000"\n');
    try {
      const result = loadUatConfig(dir);
      assert.equal(result.base_url, 'http://localhost:3000');
      assert.equal(result.startup_command, null);
      assert.equal(result.startup_wait_seconds, 10);
      assert.equal(result.browser, 'chrome-mcp');
      assert.equal(result.fallback_browser, 'playwright');
      assert.equal(result.timeout_minutes, 10);
    } finally {
      cleanupDir(dir);
    }
  });

  it('returns config with all fields specified', () => {
    const yaml = [
      'base_url: "https://myapp.com"',
      'startup_command: "npm run dev"',
      'startup_wait_seconds: 20',
      'browser: "playwright"',
      'fallback_browser: "chrome-mcp"',
      'timeout_minutes: 5',
    ].join('\n');
    const dir = makeTempDir(yaml);
    try {
      const result = loadUatConfig(dir);
      assert.equal(result.base_url, 'https://myapp.com');
      assert.equal(result.startup_command, 'npm run dev');
      assert.equal(result.startup_wait_seconds, 20);
      assert.equal(result.browser, 'playwright');
      assert.equal(result.fallback_browser, 'chrome-mcp');
      assert.equal(result.timeout_minutes, 5);
    } finally {
      cleanupDir(dir);
    }
  });

  it('throws when base_url is missing', () => {
    const dir = makeTempDir('browser: "chrome-mcp"\n');
    try {
      assert.throws(() => loadUatConfig(dir), /base_url/);
    } finally {
      cleanupDir(dir);
    }
  });

  it('throws when base_url has no protocol', () => {
    const dir = makeTempDir('base_url: "localhost:3000"\n');
    try {
      assert.throws(() => loadUatConfig(dir), /http:\/\/ or https:\/\//);
    } finally {
      cleanupDir(dir);
    }
  });

  it('throws when browser is invalid', () => {
    const dir = makeTempDir('base_url: "http://localhost:3000"\nbrowser: "firefox"\n');
    try {
      assert.throws(() => loadUatConfig(dir), /browser/);
    } finally {
      cleanupDir(dir);
    }
  });

  it('throws when startup_wait_seconds is negative', () => {
    const dir = makeTempDir('base_url: "http://localhost:3000"\nstartup_wait_seconds: -5\n');
    try {
      assert.throws(() => loadUatConfig(dir), /startup_wait_seconds/);
    } finally {
      cleanupDir(dir);
    }
  });

  it('throws when timeout_minutes is negative', () => {
    const dir = makeTempDir('base_url: "http://localhost:3000"\ntimeout_minutes: -1\n');
    try {
      assert.throws(() => loadUatConfig(dir), /timeout_minutes/);
    } finally {
      cleanupDir(dir);
    }
  });
});

describe('validateUatConfig', () => {
  it('validates base_url is present and a valid URL', () => {
    assert.throws(() => validateUatConfig({}), /base_url/);
    assert.throws(() => validateUatConfig({ base_url: '' }), /base_url/);
    assert.throws(() => validateUatConfig({ base_url: 'not-a-url' }), /http:\/\/ or https:\/\//);
  });

  it('validates browser must be chrome-mcp or playwright', () => {
    assert.throws(
      () => validateUatConfig({ base_url: 'http://localhost:3000', browser: 'safari' }),
      /browser/
    );
  });

  it('validates fallback_browser must be chrome-mcp or playwright', () => {
    assert.throws(
      () => validateUatConfig({ base_url: 'http://localhost:3000', fallback_browser: 'edge' }),
      /fallback_browser/
    );
  });

  it('validates startup_wait_seconds is a positive number', () => {
    assert.throws(
      () => validateUatConfig({ base_url: 'http://localhost:3000', startup_wait_seconds: 0 }),
      /startup_wait_seconds/
    );
    assert.throws(
      () => validateUatConfig({ base_url: 'http://localhost:3000', startup_wait_seconds: 'abc' }),
      /startup_wait_seconds/
    );
  });

  it('validates timeout_minutes is a positive number', () => {
    assert.throws(
      () => validateUatConfig({ base_url: 'http://localhost:3000', timeout_minutes: 0 }),
      /timeout_minutes/
    );
  });

  it('applies defaults for optional fields', () => {
    const result = validateUatConfig({ base_url: 'http://localhost:3000' });
    assert.equal(result.startup_command, null);
    assert.equal(result.startup_wait_seconds, 10);
    assert.equal(result.browser, 'chrome-mcp');
    assert.equal(result.fallback_browser, 'playwright');
    assert.equal(result.timeout_minutes, 10);
  });
});
