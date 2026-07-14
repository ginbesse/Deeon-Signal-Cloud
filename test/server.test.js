const assert = require('assert');
const http = require('http');
const { createServer } = require('../server');

function startTestServer() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  return new Promise((resolve) => {
    server.on('listening', () => {
      const address = server.address();
      resolve({ server, port: address.port });
    });
  });
}

function requestJson(port, path, options = {}) {
  return new Promise((resolve, reject) => {
    const body = options.body ? Buffer.from(options.body) : undefined;
    const request = http.request({
      hostname: '127.0.0.1',
      port,
      path,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(body ? { 'Content-Length': body.length } : {}),
        ...(options.headers || {})
      }
    }, (response) => {
      let data = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        data += chunk;
      });
      response.on('end', () => {
        resolve({
          status: response.statusCode,
          body: data ? JSON.parse(data) : {}
        });
      });
    });

    request.on('error', reject);
    if (body) {
      request.write(body);
    }
    request.end();
  });
}

async function runTests() {
  const { server, port } = await startTestServer();
  try {
    const healthResponse = await requestJson(port, '/api/health');
    assert.equal(healthResponse.status, 200);
    assert.equal(healthResponse.body.status, 'ok');
    console.log('✓ health endpoint works');

    const requestResponse = await requestJson(port, '/api/request-access', {
      method: 'POST',
      body: JSON.stringify({ requester: 'demo-user', target: 'alpha', scope: 'signal-write', reason: 'test' })
    });
    assert.equal(requestResponse.status, 200);
    assert.equal(requestResponse.body.success, true);
    const requestId = requestResponse.body.request.id;

    const registerResponse = await requestJson(port, '/api/register', {
      method: 'POST',
      body: JSON.stringify({ username: 'neo', password: 'strongpass123' })
    });
    assert.equal(registerResponse.status, 200);
    assert.equal(registerResponse.body.success, true);

    const loginResponse = await requestJson(port, '/api/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'neo', password: 'strongpass123' })
    });
    assert.equal(loginResponse.status, 200);
    assert.equal(loginResponse.body.success, true);
    assert.equal(typeof loginResponse.body.token, 'string');

    const token = loginResponse.body.token;
    const approveWithTokenResponse = await requestJson(port, '/api/approve-access', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: requestId })
    });
    assert.equal(approveWithTokenResponse.status, 200);
    assert.equal(approveWithTokenResponse.body.request.status, 'approved');
    console.log('✓ auth flow works');
  } catch (error) {
    console.error('✗ test failed:', error.message);
    process.exitCode = 1;
  } finally {
    server.close();
  }
}

runTests();
