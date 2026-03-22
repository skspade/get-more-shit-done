/**
 * UAT — Config loading and validation for automated UAT sessions
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const VALID_BROWSERS = ['chrome-mcp', 'playwright'];

/**
 * Load and validate UAT config from a planning directory.
 * Returns null if no config file exists (skip signal per CFG-02).
 * Throws on invalid config.
 */
function loadUatConfig(planningDir) {
  const configPath = path.join(planningDir, 'uat-config.yaml');
  if (!fs.existsSync(configPath)) return null;

  const raw = fs.readFileSync(configPath, 'utf-8');
  const parsed = yaml.load(raw);
  return validateUatConfig(parsed);
}

/**
 * Validate a parsed UAT config object and apply defaults.
 * Throws descriptive errors for invalid values.
 * Returns a structured config object with all fields populated.
 */
function validateUatConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('UAT config must be a YAML object');
  }

  // base_url: required, valid URL
  if (!config.base_url || typeof config.base_url !== 'string' || config.base_url.trim() === '') {
    throw new Error('UAT config: base_url is required');
  }
  try {
    const parsed = new URL(config.base_url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('bad protocol');
    }
  } catch {
    throw new Error(`UAT config: invalid base_url "${config.base_url}" — must include http:// or https://`);
  }

  // browser: optional, must be valid
  if (config.browser !== undefined && !VALID_BROWSERS.includes(config.browser)) {
    throw new Error(`UAT config: invalid browser "${config.browser}" — must be one of: ${VALID_BROWSERS.join(', ')}`);
  }

  // fallback_browser: optional, must be valid
  if (config.fallback_browser !== undefined && !VALID_BROWSERS.includes(config.fallback_browser)) {
    throw new Error(`UAT config: invalid fallback_browser "${config.fallback_browser}" — must be one of: ${VALID_BROWSERS.join(', ')}`);
  }

  // startup_wait_seconds: optional, must be positive number
  if (config.startup_wait_seconds !== undefined) {
    if (typeof config.startup_wait_seconds !== 'number' || config.startup_wait_seconds <= 0) {
      throw new Error('UAT config: startup_wait_seconds must be a positive number');
    }
  }

  // timeout_minutes: optional, must be positive number
  if (config.timeout_minutes !== undefined) {
    if (typeof config.timeout_minutes !== 'number' || config.timeout_minutes <= 0) {
      throw new Error('UAT config: timeout_minutes must be a positive number');
    }
  }

  return {
    base_url: config.base_url,
    startup_command: config.startup_command || null,
    startup_wait_seconds: config.startup_wait_seconds ?? 10,
    browser: config.browser || 'chrome-mcp',
    fallback_browser: config.fallback_browser || 'playwright',
    timeout_minutes: config.timeout_minutes ?? 10,
  };
}

module.exports = { loadUatConfig, validateUatConfig };
