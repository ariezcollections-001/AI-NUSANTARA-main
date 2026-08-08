const http = require('http');
const url = require('url');

const endpoints = [
  { method: 'GET', path: '/api/founder/profile' },
  { method: 'GET', path: '/api/founder/users' },
  { method: 'GET', path: '/api/founder/config?key=platform_logo' },
  { method: 'POST', path: '/api/founder/features', headers: { 'Content-Type': 'application/json' }, body: '{}' },
  { method: 'GET', path: '/x-founder-control-99f7jK' },
];

function makeRequest(method, path, headers = {}, body = null) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers: { ...headers },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        resolve({ status: res.statusCode, body: data.slice(0, 200) });
      });
    });

    req.on('error', (err) => {
      resolve({ status: 'ERR', body: err.message });
    });

    if (body) req.write(body);
    req.end();
  });
}

(async () => {
  const results = [];
  for (const ep of endpoints) {
    const res = await makeRequest(ep.method, ep.path, ep.headers, ep.body);
    results.push(`${ep.method} ${ep.path} -> ${res.status} ${res.body ? '| ' + res.body.replace(/\n/g, ' ') : ''}`);
  }
  console.log('=== SMOKE TESTS ===');
  results.forEach((r) => console.log(r));
  console.log('=== END ===');
})();