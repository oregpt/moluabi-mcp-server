#!/usr/bin/env node

/**
 * Comprehensive Dual Server Test Suite
 * Tests both API Key server (port 5000) and ATXP server (port 5001)
 * Validates that both payment methods work correctly
 */

const https = require('https');
const http = require('http');

// Test configuration
const SERVERS = {
  apikey: {
    name: 'API Key Server',
    url: 'http://localhost:5000',
    method: 'POST',
    path: '/mcp/call',
    headers: { 'Content-Type': 'application/json' }
  },
  atxp: {
    name: 'ATXP Server', 
    url: 'http://localhost:5001',
    method: 'POST',
    path: '/',
    headers: { 'Content-Type': 'application/json' }
  }
};

// ANSI colors for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m', 
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

class DualServerTester {
  constructor() {
    this.results = {
      apikey: { passed: 0, failed: 0, errors: [] },
      atxp: { passed: 0, failed: 0, errors: [] }
    };
  }

  log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  success(server, test) {
    this.results[server].passed++;
    this.log(`✅ [${SERVERS[server].name}] ${test}`, 'green');
  }

  fail(server, test, error) {
    this.results[server].failed++;
    this.results[server].errors.push({ test, error });
    this.log(`❌ [${SERVERS[server].name}] ${test}: ${error}`, 'red');
  }

  info(message) {
    this.log(`ℹ️  ${message}`, 'blue');
  }

  async makeRequest(server, data) {
    return new Promise((resolve, reject) => {
      const serverConfig = SERVERS[server];
      const url = new URL(serverConfig.url);
      
      const options = {
        hostname: url.hostname,
        port: url.port,
        path: serverConfig.path,
        method: serverConfig.method,
        headers: serverConfig.headers
      };

      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            resolve({ status: res.statusCode, data: parsed });
          } catch (e) {
            resolve({ status: res.statusCode, data: body });
          }
        });
      });

      req.on('error', reject);
      req.write(JSON.stringify(data));
      req.end();
    });
  }

  // Test API Key server format
  async testApiKeyServer(testName, toolName, args) {
    try {
      const payload = {
        name: toolName,
        arguments: args
      };

      const response = await this.makeRequest('apikey', payload);
      
      if (response.status === 200) {
        this.success('apikey', `${testName} - Server responded`);
        return response.data;
      } else {
        this.fail('apikey', testName, `HTTP ${response.status}: ${JSON.stringify(response.data)}`);
      }
    } catch (error) {
      this.fail('apikey', testName, error.message);
    }
  }

  // Test ATXP server format (MCP JSON-RPC)
  async testAtxpServer(testName, toolName, args) {
    try {
      const payload = {
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          name: toolName,
          arguments: args
        },
        id: Math.random().toString(36)
      };

      const response = await this.makeRequest('atxp', payload);
      
      if (response.status === 200 && response.data.result) {
        this.success('atxp', `${testName} - Server responded`);
        return response.data.result;
      } else if (response.data.error) {
        this.fail('atxp', testName, `MCP Error: ${response.data.error.message}`);
      } else {
        this.fail('atxp', testName, `HTTP ${response.status}: ${JSON.stringify(response.data)}`);
      }
    } catch (error) {
      this.fail('atxp', testName, error.message);
    }
  }

  async testServerAvailability() {
    this.log('\n🌐 Testing Server Availability', 'bold');
    this.log('================================', 'bold');

    // Test API Key server
    try {
      const response = await this.makeRequest('apikey', { name: 'test' });
      if (response.status) {
        this.success('apikey', 'Server is running and reachable');
      }
    } catch (error) {
      this.fail('apikey', 'Server availability', error.message);
    }

    // Test ATXP server tools list
    try {
      const payload = {
        jsonrpc: "2.0",
        method: "tools/list",
        id: "test"
      };
      const response = await this.makeRequest('atxp', payload);
      if (response.status === 200) {
        this.success('atxp', 'Server is running and reachable');
      }
    } catch (error) {
      this.fail('atxp', 'Server availability', error.message);
    }
  }

  async testListAgents() {
    this.log('\n🤖 Testing List Agents', 'bold');
    this.log('======================', 'bold');

    const apiKey = process.env.MOLUABI_API_KEY || 'mab_test_key_12345';
    
    // Test both servers
    await this.testApiKeyServer('List Agents', 'list_agents', { apiKey });
    await this.testAtxpServer('List Agents', 'list_agents', { apiKey });
  }

  async testCreateAgent() {
    this.log('\n🏗️  Testing Create Agent', 'bold');
    this.log('=======================', 'bold');

    const apiKey = process.env.MOLUABI_API_KEY || 'mab_test_key_12345';
    const agentData = {
      apiKey,
      name: `Test Agent ${Date.now()}`,
      description: 'Test agent created by dual server test suite',
      model: 'gpt-4',
      systemPrompt: 'You are a helpful test agent'
    };
    
    // Test both servers
    await this.testApiKeyServer('Create Agent', 'create_agent', agentData);
    await this.testAtxpServer('Create Agent', 'create_agent', agentData);
  }

  async testGetPricing() {
    this.log('\n💰 Testing Get Pricing', 'bold');
    this.log('=====================', 'bold');

    const apiKey = process.env.MOLUABI_API_KEY || 'mab_test_key_12345';
    
    // Test both servers
    await this.testApiKeyServer('Get Pricing', 'get_pricing', { apiKey });
    await this.testAtxpServer('Get Pricing', 'get_pricing', { apiKey });
  }

  async testInvalidRequests() {
    this.log('\n🚫 Testing Error Handling', 'bold');
    this.log('=========================', 'bold');

    // Test invalid API key
    await this.testApiKeyServer('Invalid API Key', 'list_agents', { apiKey: 'invalid_key' });
    await this.testAtxpServer('Invalid API Key', 'list_agents', { apiKey: 'invalid_key' });

    // Test missing parameters
    await this.testApiKeyServer('Missing Parameters', 'create_agent', { apiKey: 'mab_test' });
    await this.testAtxpServer('Missing Parameters', 'create_agent', { apiKey: 'mab_test' });
  }

  printSummary() {
    this.log('\n📊 Test Results Summary', 'bold');
    this.log('=======================', 'bold');

    Object.keys(this.results).forEach(server => {
      const result = this.results[server];
      const total = result.passed + result.failed;
      const color = result.failed === 0 ? 'green' : 'yellow';
      
      this.log(`\n${SERVERS[server].name}:`, 'bold');
      this.log(`   Total Tests: ${total}`, color);
      this.log(`   Passed: ${result.passed}`, 'green');
      this.log(`   Failed: ${result.failed}`, result.failed > 0 ? 'red' : 'green');
      
      if (result.errors.length > 0) {
        this.log(`   Errors:`, 'red');
        result.errors.forEach(error => {
          this.log(`     - ${error.test}: ${error.error}`, 'red');
        });
      }
    });

    const allPassed = Object.values(this.results).every(r => r.failed === 0);
    if (allPassed) {
      this.log('\n🎉 All tests passed! Both servers are working correctly.', 'green');
    } else {
      this.log('\n⚠️  Some tests failed. Check the errors above.', 'yellow');
    }
  }

  async runAllTests() {
    this.log('🧪 Comprehensive Dual Server Test Suite', 'bold');
    this.log('=======================================', 'bold');
    this.log('Testing both API Key (port 5000) and ATXP (port 5001) servers\n');

    // Check environment
    const apiKey = process.env.MOLUABI_API_KEY;
    if (!apiKey) {
      this.log('⚠️  MOLUABI_API_KEY not set - using test key', 'yellow');
    } else {
      this.log('✅ MOLUABI_API_KEY found', 'green');
    }

    // Run all test suites
    await this.testServerAvailability();
    await this.testListAgents();
    await this.testGetPricing();
    await this.testCreateAgent();
    await this.testInvalidRequests();

    this.printSummary();
  }
}

// Usage instructions
if (require.main === module) {
  const tester = new DualServerTester();
  
  console.log('💡 Usage Instructions:');
  console.log('   1. Make sure both servers are running:');
  console.log('      - API Key server: npm run start (port 5000)');
  console.log('      - ATXP server: npm run start:atxp (port 5001)');
  console.log('   2. Set MOLUABI_API_KEY environment variable');
  console.log('   3. Run: node test-dual-servers.js\n');
  
  tester.runAllTests().catch(console.error);
}

module.exports = DualServerTester;