#!/usr/bin/env node

/**
 * MCP Protocol Test Script
 * Tests proper JSON-RPC MCP calls to verify ATXP tools
 */

const https = require('https');

const SERVER_URL = 'https://moluabi-mcp-server.replit.app';

async function makeMCPRequest(endpoint, method, params = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      jsonrpc: "2.0",
      method: method,
      params: params,
      id: 1
    });

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'MCP-Test-Client/1.0'
      }
    };

    const req = https.request(`${SERVER_URL}${endpoint}`, options, (res) => {
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
    req.write(data);
    req.end();
  });
}

async function testATXPToolsList() {
  console.log('🔐 Testing ATXP Tools List (should require OAuth)...');
  try {
    const response = await makeMCPRequest('/atxp', 'tools/list');
    
    console.log(`Status: ${response.status}`);
    
    if (response.status === 401) {
      console.log('✅ ATXP correctly requires OAuth authentication');
      return true;
    } else if (response.status === 200) {
      const data = JSON.parse(response.body);
      console.log('⚠️  ATXP returned tools without authentication:');
      console.log(JSON.stringify(data, null, 2));
      return false;
    } else {
      console.log(`❌ Unexpected status: ${response.status}`);
      console.log(`Body: ${response.body}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return false;
  }
}

async function testFreeToolsList() {
  console.log('\n🆓 Testing Free API Key Tools List...');
  try {
    const response = await makeMCPRequest('/', 'tools/list');
    
    console.log(`Status: ${response.status}`);
    
    if (response.status === 200) {
      const data = JSON.parse(response.body);
      if (data.result && data.result.tools) {
        console.log(`✅ Free endpoint has ${data.result.tools.length} tools available`);
        console.log('🔧 Available tools:');
        data.result.tools.forEach(tool => {
          console.log(`   • ${tool.name}`);
        });
        return true;
      } else {
        console.log('❌ No tools found in response');
        return false;
      }
    } else {
      console.log(`❌ Status: ${response.status}`);
      console.log(`Body: ${response.body}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Testing MCP Protocol Implementation');
  console.log('=' * 50);
  
  const atxpResult = await testATXPToolsList();
  const freeResult = await testFreeToolsList();
  
  console.log('\n📊 MCP Protocol Test Results:');
  console.log('=' * 35);
  console.log(`🔐 ATXP OAuth Protection: ${atxpResult ? '✅ WORKING' : '❌ BROKEN'}`);
  console.log(`🆓 Free API Key Tools: ${freeResult ? '✅ WORKING' : '❌ BROKEN'}`);
  
  if (atxpResult && freeResult) {
    console.log('\n🎉 MCP PROTOCOL WORKING CORRECTLY!');
    console.log('✅ Both payment methods are operational');
    console.log('✅ ATXP properly protected by OAuth');
    console.log('✅ Free tools available via API key');
  }
}

runTests().catch(console.error);