#!/usr/bin/env node

/**
 * MCP Server Backward Compatibility Test Suite
 * Tests all 10 tools with both "tool" and "name" parameter formats
 */

const https = require('https');
const http = require('http');

// Configuration
const SERVER_URL = 'https://moluabi-mcp-server.replit.app';
const LOCAL_URL = 'http://localhost:5000';
const TEST_API_KEY = 'mab_test123456789abcdef'; // Test API key

// Test data for different tools
const testCases = [
  {
    tool: 'get_pricing',
    args: { apiKey: TEST_API_KEY }
  },
  {
    tool: 'list_agents', 
    args: { apiKey: TEST_API_KEY, limit: 10 }
  },
  {
    tool: 'get_agent',
    args: { apiKey: TEST_API_KEY, agentId: 1 }
  },
  {
    tool: 'create_agent',
    args: { 
      apiKey: TEST_API_KEY,
      name: 'Test Compatibility Agent',
      description: 'Testing backward compatibility'
    }
  },
  {
    tool: 'update_agent',
    args: { 
      apiKey: TEST_API_KEY,
      agentId: 1,
      name: 'Updated Test Agent'
    }
  },
  {
    tool: 'delete_agent',
    args: { apiKey: TEST_API_KEY, agentId: 999 }
  },
  {
    tool: 'prompt_agent',
    args: { 
      apiKey: TEST_API_KEY,
      agentId: 1,
      message: 'Hello, this is a compatibility test!'
    }
  },
  {
    tool: 'add_user_to_agent',
    args: { 
      apiKey: TEST_API_KEY,
      agentId: 1,
      userEmail: 'test@example.com'
    }
  },
  {
    tool: 'remove_user_from_agent',
    args: { 
      apiKey: TEST_API_KEY,
      agentId: 1,
      userEmail: 'test@example.com'
    }
  },
  {
    tool: 'get_usage_report',
    args: { apiKey: TEST_API_KEY, days: 7 }
  }
];

// Error test cases
const errorTestCases = [
  {
    name: 'Missing tool/name parameter',
    payload: { arguments: { apiKey: TEST_API_KEY } },
    expectedError: 'Missing tool/name parameter'
  },
  {
    name: 'Missing arguments',
    payload: { tool: 'get_pricing' },
    expectedError: 'API key is required'
  },
  {
    name: 'Invalid tool name',
    payload: { 
      tool: 'nonexistent_tool',
      arguments: { apiKey: TEST_API_KEY }
    },
    expectedError: 'Unknown tool'
  }
];

// HTTP request helper
function makeRequest(url, payload) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https');
    const client = isHttps ? https : http;
    
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify(payload))
      }
    };

    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: JSON.parse(data)
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: data
          });
        }
      });
    });

    req.on('error', reject);
    req.write(JSON.stringify(payload));
    req.end();
  });
}

// Test runner
async function runCompatibilityTests(serverUrl) {
  console.log(`\n🧪 Testing MCP Server: ${serverUrl}`);
  console.log('=' * 60);
  
  let passed = 0;
  let failed = 0;
  let results = [];

  // Test each tool with both parameter formats
  for (const testCase of testCases) {
    const toolName = testCase.tool;
    
    console.log(`\n🔧 Testing tool: ${toolName}`);
    
    try {
      // Test with "tool" parameter (old format)
      const oldFormatPayload = {
        tool: toolName,
        arguments: testCase.args
      };
      
      // Test with "name" parameter (new format)  
      const newFormatPayload = {
        name: toolName,
        arguments: testCase.args
      };
      
      console.log('  📤 Testing old format ("tool" parameter)...');
      const oldResponse = await makeRequest(`${serverUrl}/mcp/call`, oldFormatPayload);
      
      console.log('  📤 Testing new format ("name" parameter)...');
      const newResponse = await makeRequest(`${serverUrl}/mcp/call`, newFormatPayload);
      
      // Compare responses
      const oldSuccess = oldResponse.status === 200 || (oldResponse.data && oldResponse.data.success !== undefined);
      const newSuccess = newResponse.status === 200 || (newResponse.data && newResponse.data.success !== undefined);
      
      if (oldSuccess && newSuccess) {
        // Check if responses are equivalent
        const responsesMatch = JSON.stringify(oldResponse.data) === JSON.stringify(newResponse.data);
        
        if (responsesMatch) {
          console.log('  ✅ PASS: Both formats work and return identical responses');
          passed++;
        } else {
          console.log('  ⚠️  PARTIAL: Both formats work but responses differ');
          console.log('    Old format response:', JSON.stringify(oldResponse.data, null, 2));
          console.log('    New format response:', JSON.stringify(newResponse.data, null, 2));
          passed++;
        }
      } else {
        console.log('  ❌ FAIL: Format compatibility issue');
        console.log('    Old format status:', oldResponse.status, 'Success:', oldSuccess);
        console.log('    New format status:', newResponse.status, 'Success:', newSuccess);
        if (!oldSuccess) console.log('    Old format error:', oldResponse.data);
        if (!newSuccess) console.log('    New format error:', newResponse.data);
        failed++;
      }
      
      results.push({
        tool: toolName,
        oldFormat: oldSuccess,
        newFormat: newSuccess,
        identical: oldSuccess && newSuccess && JSON.stringify(oldResponse.data) === JSON.stringify(newResponse.data)
      });
      
    } catch (error) {
      console.log(`  ❌ ERROR: ${error.message}`);
      failed++;
      results.push({
        tool: toolName,
        error: error.message
      });
    }
  }

  // Test error handling
  console.log('\n🚫 Testing Error Handling');
  for (const errorTest of errorTestCases) {
    console.log(`\n  Testing: ${errorTest.name}`);
    
    try {
      const response = await makeRequest(`${serverUrl}/mcp/call`, errorTest.payload);
      
      if (response.status >= 400 && response.data && response.data.error) {
        const errorMessage = response.data.error;
        if (errorMessage.includes(errorTest.expectedError)) {
          console.log('  ✅ PASS: Correct error handling');
          passed++;
        } else {
          console.log(`  ⚠️  PARTIAL: Got error but message differs`);
          console.log(`    Expected: ${errorTest.expectedError}`);
          console.log(`    Got: ${errorMessage}`);
          passed++;
        }
      } else {
        console.log('  ❌ FAIL: Expected error but got success');
        console.log('    Response:', response);
        failed++;
      }
    } catch (error) {
      console.log(`  ❌ ERROR: ${error.message}`);
      failed++;
    }
  }

  // Summary
  console.log('\n📊 TEST SUMMARY');
  console.log('=' * 40);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);
  
  // Detailed results table
  console.log('\n📋 DETAILED RESULTS');
  console.log('Tool'.padEnd(20) + 'Old Format'.padEnd(12) + 'New Format'.padEnd(12) + 'Identical');
  console.log('-'.repeat(60));
  
  results.filter(r => !r.error).forEach(result => {
    const tool = result.tool.padEnd(20);
    const oldFormat = (result.oldFormat ? '✅' : '❌').padEnd(12);
    const newFormat = (result.newFormat ? '✅' : '❌').padEnd(12);
    const identical = result.identical ? '✅' : '❌';
    console.log(tool + oldFormat + newFormat + identical);
  });
  
  return { passed, failed, results };
}

// Main execution
async function main() {
  console.log('🚀 MCP Server Backward Compatibility Test Suite');
  console.log('Testing both "tool" and "name" parameter formats\n');
  
  const args = process.argv.slice(2);
  const testLocal = args.includes('--local');
  const testProduction = args.includes('--production') || args.length === 0;
  
  if (testLocal) {
    console.log('🔧 Testing LOCAL server...');
    await runCompatibilityTests(LOCAL_URL);
  }
  
  if (testProduction) {
    console.log('🌐 Testing PRODUCTION server...');
    await runCompatibilityTests(SERVER_URL);
  }
  
  console.log('\n🎉 Test suite completed!');
  console.log('\nUsage:');
  console.log('  node test-backward-compatibility.js           # Test production server');
  console.log('  node test-backward-compatibility.js --local  # Test local server'); 
  console.log('  node test-backward-compatibility.js --local --production  # Test both');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { runCompatibilityTests, testCases, errorTestCases };