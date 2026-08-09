const fs = require('fs');
const inspector = require('inspector');
const path = require('path');

const session = new inspector.Session();
const profilePath = path.resolve(
  process.env.PROFILE_OUTPUT || path.join(__dirname, 'results', `${process.env.RUN_ID || 'profile'}.cpuprofile`)
);
const profileDurationMs = Number.parseInt(process.env.PROFILE_DURATION_MS || '180000', 10);

session.connect();
session.post('Profiler.enable');
session.post('Profiler.start');

require('../backend/src/server');

let stopped = false;
function stopProfile() {
  if (stopped) return;
  stopped = true;
  session.post('Profiler.stop', (error, { profile } = {}) => {
    if (error) {
      console.error('Failed to stop CPU profiler:', error);
      process.exitCode = 1;
    } else {
      fs.writeFileSync(profilePath, JSON.stringify(profile));
      console.log(`CPU profile written to ${profilePath}`);
    }
    session.post('Profiler.disable');
    session.disconnect();
  });
}

process.on('SIGINT', stopProfile);
process.on('SIGTERM', stopProfile);
setTimeout(stopProfile, profileDurationMs);
