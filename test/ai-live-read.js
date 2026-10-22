'use strict';
// Read-only smoke check. Prints counts only, never session names or transcripts.
const { AiDashboard } = require('../src/ai-dashboard');
const { readLimits } = require('../src/ai-codex');
const monitor = new AiDashboard({ account: false });
const timeout = setTimeout(() => { monitor.stop(); console.error('AI history read timed out'); process.exitCode = 1; }, 60000);
monitor.on('change', (data) => {
  if (data.scanning) return;
  clearTimeout(timeout); monitor.stop();
  console.log(JSON.stringify({ providers: data.providers, aggregateBuckets: data.buckets.length, recentSessions: data.sessions.length, transcriptFields: false }));
  readLimits().then((result) => console.log(JSON.stringify({ accountStatus: result.status, quotaWindows: result.limits?.windows?.length || 0 })));
});
monitor.start();
