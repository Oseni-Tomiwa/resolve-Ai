const checks = [
  ['web', process.env.WEB_URL || 'http://localhost:3000/', 200],
  [
    'api liveness',
    `${process.env.PUBLIC_API_URL || 'http://localhost:4000/api/v1'}/health`,
    200,
  ],
  [
    'api readiness',
    `${process.env.PUBLIC_API_URL || 'http://localhost:4000/api/v1'}/health/ready`,
    200,
  ],
  [
    'login page',
    `${process.env.WEB_URL || 'http://localhost:3000'}/login`,
    200,
  ],
  [
    'widget script',
    process.env.WIDGET_SCRIPT_URL ||
      `${process.env.WEB_URL || 'http://localhost:3000'}/widget.js`,
    200,
  ],
];

async function check([name, url, expected]) {
  const response = await fetch(url, { redirect: 'manual' });
  if (response.status !== expected)
    throw new Error(`${name} returned HTTP ${response.status}`);
  console.log(JSON.stringify({ check: name, status: response.status }));
}

(async () => {
  for (const checkDefinition of checks) await check(checkDefinition);
  if (process.env.WORKER_URL) {
    const worker = process.env.WORKER_URL.replace(/\/$/, '');
    await check(['worker liveness', `${worker}/health`, 200]);
    await check(['worker readiness', `${worker}/ready`, 200]);
  }
  console.log(
    JSON.stringify({
      smoke: 'passed',
      note: 'Read-only checks only; no credentials or mutations were used.',
    }),
  );
})().catch((error) => {
  console.error(JSON.stringify({ smoke: 'failed', error: error.message }));
  process.exitCode = 1;
});
