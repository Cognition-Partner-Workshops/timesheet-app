export function handleSummary(data) {
  const runId = __ENV.RUN_ID || 'run';
  const scenario = __ENV.SCENARIO || 'scenario';
  const metrics = data.metrics || {};
  const http = metrics.http_req_duration?.values;
  const failed = metrics.http_req_failed?.values;
  const requests = metrics.http_reqs?.values;
  const lines = [
    `Scenario: ${scenario}`,
    `Run: ${runId}`,
    `HTTP requests: ${requests ? requests.count : 'n/a'}`,
    `Throughput (requests/s): ${requests ? (requests.rate || 0).toFixed(2) : 'n/a'}`,
    `HTTP p95 (ms): ${http ? (http['p(95)'] || 0).toFixed(2) : 'n/a'}`,
    `HTTP p99 (ms): ${http ? (http['p(99)'] || http['p(95)'] || 0).toFixed(2) : 'n/a'}`,
    `HTTP failure rate: ${failed ? ((failed.rate || 0) * 100).toFixed(2) : 'n/a'}%`,
    '',
    'Endpoint trends:',
  ];
  Object.keys(metrics).filter((name) => name.startsWith('endpoint_') && !name.endsWith('_requests')).sort((a, b) => a.localeCompare(b)).forEach((name) => {
    const values = metrics[name].values;
    const countMetric = metrics[`${name}_requests`];
    const count = countMetric ? countMetric.values.count : 0;
    lines.push(`${name}: count=${count} p95=${(values['p(95)'] || 0).toFixed(2)}ms p99=${(values['p(99)'] || values['p(95)'] || 0).toFixed(2)}ms`);
  });
  const text = `${lines.join('\n')}\n`;
  return {
    [`load-tests/results/${runId}-${scenario}.json`]: JSON.stringify(data, null, 2),
    [`load-tests/results/${runId}-${scenario}.txt`]: text,
    stdout: text,
  };
}
