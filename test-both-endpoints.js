#!/usr/bin/env node

/**
 * Complete MCP Server Test
 * Tests both free API key and ATXP crypto endpoints
 */

const https = require('https');

const SERVER_URL = 'https://moluabi-mcp-server.replit.app';

async function makeRequest(url, data) {
  return new Promise((resolve, reject) => {
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'MCP-Test-Client/1.0'
      }
    };

    const req = https.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: body
        });
      });
    });

    req.on('error', reject);
    req.write(JSON.stringify(data));
    req.end();
  });
}

async function testFreeAPITools() {
  console.log('🆓 Testing Free API Key Endpoint...');
  
  // Test tools/list via tool/name format
  const response = await makeRequest(`${SERVER_URL}/`, {
    tool: "list_agents",
    arguments: {
      apiKey: "mab_test_key_123"
    }
  });
  
  console.log(`Status: ${response.status}`);
  console.log(`Response: ${response.body}`);
  
  return response.status !== 500;
}

async function testATXPEndpoint() {
  console.log('\n🔐 Testing ATXP Crypto Endpoint...');
  
  // Test MCP protocol tools/list 
  const response = await makeRequest(`${SERVER_URL}/atxp`, {
    jsonrpc: "2.0",
    method: "tools/list",
    params: {},
    id: 1
  });
  
  console.log(`Status: ${response.status}`);
  console.log(`Response: ${response.body}`);
  
  // Should return 401 (requires OAuth) or tool list
  return response.status === 401 || (response.status === 200 && response.body.includes('tools'));
}

async function testATXPHealthCheck() {
  console.log('\n🏥 Testing ATXP Health Check...');
  
  const response = await new Promise((resolve) => {
    const req = https.request(`${SERVER_URL}/atxp/health`, { method: 'GET' }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', () => resolve({ status: 0, body: 'error' }));
    req.end();
  });
  
  console.log(`Status: ${response.status}`);
  console.log(`Response: ${response.body}`);
  
  return response.status === 200;
}

async function runTests() {
  console.log('🚀 Testing Both MCP Server Endpoints');
  console.log('=' * 45);
  
  const results = {
    freeAPI: await testFreeAPITools(),
    atxpEndpoint: await testATXPEndpoint(),
    atxpHealth: await testATXPHealthCheck()
  };
  
  console.log('\n📊 Test Results Summary:');
  console.log('=' * 30);
  console.log(`🆓 Free API Tools: ${results.freeAPI ? '✅ WORKING' : '❌ BROKEN'}`);
  console.log(`🔐 ATXP Endpoint: ${results.atxpEndpoint ? '✅ WORKING' : '❌ BROKEN'}`);
  console.log(`🏥 ATXP Health: ${results.atxpHealth ? '✅ WORKING' : '❌ BROKEN'}`);
  
  const allWorking = Object.values(results).every(result => result);
  
  if (allWorking) {
    console.log('\n🎉 BOTH ENDPOINTS WORKING!');
    console.log('✅ Dual payment system operational');
  } else {
    console.log('\n⚠️  Some endpoints need fixes');
  }
  
  return results;
}

runTests().catch(console.error);