const fs = require('fs');
const path = require('path');

const FLAG_DEFAULTS = {
  darkMode: false,
};

const FLAG_CONFIG_PATH = path.resolve(__dirname, '../../feature-flags.json');

function loadFileFlags() {
  try {
    if (fs.existsSync(FLAG_CONFIG_PATH)) {
      const raw = fs.readFileSync(FLAG_CONFIG_PATH, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('Failed to load feature-flags.json, falling back to defaults:', err.message);
  }
  return {};
}

function parseBool(value) {
  if (value === undefined || value === null) return undefined;
  return value === 'true' || value === '1';
}

function getFeatureFlags() {
  const fileFlags = loadFileFlags();

  return {
    darkMode:
      parseBool(process.env.FEATURE_DARK_MODE) ??
      fileFlags.darkMode ??
      FLAG_DEFAULTS.darkMode,
  };
}

module.exports = { getFeatureFlags };
