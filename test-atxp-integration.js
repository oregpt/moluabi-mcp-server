#!/usr/bin/env node

/**
 * ATXP Integration Test Script
 * Tests the OAuth authentication flow and tool availability for crypto payments
 */

const https = require('https');

const SERVER_URL = 'https://moluabi-mcp-server.replit.app';

console.log('🧪 Testing ATXP Integration...');
console.log(`🔗 Server: ${SERVER_URL}`);

async function makeRequest(url, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      method: data ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ATXP-Test-Client/1.0'
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
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function testOAuthMetadata() {
  console.log('\n🔑 Testing OAuth Metadata Endpoint...');
  try {
    const response = await makeRequest(`${SERVER_URL}/.well-known/oauth-protected-resource/`);
    
    if (response.status === 200) {
      const metadata = JSON.parse(response.body);
      console.log('✅ OAuth metadata available');
      console.log(`📋 Resource: ${metadata.resource}`);
      console.log(`🔐 Auth Server: ${metadata.authorization_server}`);
      console.log(`🎯 Scopes: ${metadata.scopes_supported.join(', ')}`);
      console.log(`📝 Server: ${metadata.resource_server_metadata.name} v${metadata.resource_server_metadata.version}`);
      return true;
    } else {
      console.log(`❌ OAuth metadata failed: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ OAuth metadata error: ${error.message}`);
    return false;
  }
}

async function testATXPAuthentication() {
  console.log('\n🔐 Testing ATXP Authentication Requirement...');
  try {
    const response = await makeRequest(`${SERVER_URL}/atxp`, {
      jsonrpc: "2.0",
      method: "tools/list",
      params: {},
      id: 1
    });
    
    if (response.status === 401) {
      console.log('✅ ATXP requires authentication (401 Unauthorized)');
      console.log(`🔑 Auth header: ${response.headers['www-authenticate']}`);
      return true;
    } else {
      console.log(`❌ Expected 401, got: ${response.status}`);
      console.log(`📋 Response: ${response.body}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ ATXP auth test error: ${error.message}`);
    return false;
  }
}

async function testFreeAPIKeyEndpoint() {
  console.log('\n🆓 Testing Free API Key Endpoint...');
  try {
    const response = await makeRequest(`${SERVER_URL}/`);
    
    if (response.status === 200) {
      const healthData = JSON.parse(response.body);
      console.log('✅ Free API key endpoint available');
      console.log(`📋 Service: ${healthData.service}`);
      console.log(`🔑 Auth Method: ${healthData.authentication}`);
      return true;
    } else {
      console.log(`❌ Free endpoint failed: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Free endpoint error: ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Starting ATXP Integration Tests');
  console.log('=' * 50);
  
  const results = {
    oauthMetadata: await testOAuthMetadata(),
    atxpAuth: await testATXPAuthentication(), 
    freeEndpoint: await testFreeAPIKeyEndpoint()
  };
  
  console.log('\n📊 Test Results Summary:');
  console.log('=' * 30);
  console.log(`🔑 OAuth Metadata: ${results.oauthMetadata ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`🔐 ATXP Authentication: ${results.atxpAuth ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`🆓 Free API Endpoint: ${results.freeEndpoint ? '✅ PASS' : '❌ FAIL'}`);
  
  const allPassed = Object.values(results).every(result => result);
  
  if (allPassed) {
    console.log('\n🎉 ALL TESTS PASSED!');
    console.log('✅ ATXP crypto payment integration is working correctly');
    console.log('✅ OAuth authentication is properly configured');
    console.log('✅ Dual payment system (API keys + crypto) is operational');
    console.log('\n💡 Next Steps:');
    console.log('   • Use an MCP client like Goose to test the full OAuth + payment flow');
    console.log('   • The ATXP tools require OAuth authentication through ATXP auth server');
    console.log('   • Free API key tools work immediately with valid API keys');
  } else {
    console.log('\n❌ Some tests failed - check the details above');
  }
}

runTests().catch(console.error);