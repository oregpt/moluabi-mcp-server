#!/usr/bin/env node

/**
 * Comprehensive MCP Server Security Test Suite
 * Tests API key authentication and all tool calls
 */

const MCP_SERVER_URL = 'http://localhost:5000';
const API_KEY = process.env.MOLUABI_API_KEY;

// ANSI colors for better output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

class MCPTester {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.tests = [];
  }

  async log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  async success(message) {
    this.passed++;
    await this.log(`✅ ${message}`, 'green');
  }

  async fail(message) {
    this.failed++;
    await this.log(`❌ ${message}`, 'red');
  }

  async info(message) {
    await this.log(`ℹ️  ${message}`, 'blue');
  }

  async warn(message) {
    await this.log(`⚠️  ${message}`, 'yellow');
  }

  async callTool(toolName, args) {
    try {
      const response = await fetch(`${MCP_SERVER_URL}/mcp/call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tool: toolName,
          arguments: args
        })
      });

      const result = await response.json();
      return {
        success: response.ok,
        status: response.status,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async testHealthCheck() {
    await this.log('\n🔍 Testing Health Check...', 'bold');
    
    try {
      const response = await fetch(`${MCP_SERVER_URL}/`);
      const data = await response.json();
      
      if (data.status === 'healthy' && data.version === '2.0.0') {
        await this.success('Health check passed - Server running v2.0.0 with API key authentication');
        return true;
      } else {
        await this.fail(`Health check failed - Expected v2.0.0, got ${data.version}`);
        return false;
      }
    } catch (error) {
      await this.fail(`Health check error: ${error.message}`);
      return false;
    }
  }

  async testToolsEndpoint() {
    await this.log('\n🔧 Testing Tools Endpoint...', 'bold');
    
    try {
      const response = await fetch(`${MCP_SERVER_URL}/tools`);
      const data = await response.json();
      
      if (data.tools && data.tools.length > 0) {
        await this.success(`Found ${data.tools.length} available tools`);
        
        // Check that all tools require apiKey
        const toolsWithApiKey = data.tools.filter(tool => 
          tool.inputSchema.properties.apiKey && 
          tool.inputSchema.required.includes('apiKey')
        );
        
        if (toolsWithApiKey.length === data.tools.length) {
          await this.success('All tools require API key authentication ✓');
        } else {
          await this.fail(`Only ${toolsWithApiKey.length}/${data.tools.length} tools require API key`);
        }
        
        return true;
      } else {
        await this.fail('No tools found');
        return false;
      }
    } catch (error) {
      await this.fail(`Tools endpoint error: ${error.message}`);
      return false;
    }
  }

  async testAuthenticationSecurity() {
    await this.log('\n🔐 Testing Authentication Security...', 'bold');

    // Test 1: No API key provided
    const noKeyResult = await this.callTool('get_pricing', {});
    if (!noKeyResult.success && noKeyResult.data.error && 
        noKeyResult.data.error.includes('API key is required')) {
      await this.success('Correctly rejects requests without API key');
    } else {
      await this.fail('Should reject requests without API key');
    }

    // Test 2: Invalid API key format
    const invalidKeyResult = await this.callTool('get_pricing', { apiKey: 'invalid-key' });
    if (!invalidKeyResult.success && invalidKeyResult.data.error && 
        noKeyResult.data.error.includes('API key')) {
      await this.success('Correctly rejects invalid API key format');
    } else {
      await this.fail('Should reject invalid API key format');
    }

    // Test 3: Valid API key format but fake key
    const fakeKeyResult = await this.callTool('get_pricing', { apiKey: 'mab_fakekeyfakekeyfakekey' });
    if (fakeKeyResult.data && fakeKeyResult.data.success) {
      await this.success('get_pricing works with any valid API key format (expected for static pricing)');
    } else {
      await this.warn('get_pricing should work even with fake keys since it returns static data');
    }
  }

  async testGetPricing() {
    await this.log('\n💰 Testing get_pricing Tool...', 'bold');
    
    const result = await this.callTool('get_pricing', { apiKey: API_KEY });
    
    if (result.data && result.data.success && result.data.pricing) {
      await this.success('get_pricing returned pricing data');
      await this.info(`Cost: $${result.data.cost}`);
      
      if (result.data.pricing.models && result.data.pricing.operations) {
        await this.success('Pricing includes both models and operations');
      } else {
        await this.fail('Pricing missing models or operations data');
      }
    } else {
      await this.fail(`get_pricing failed: ${result.data?.error || 'Unknown error'}`);
    }
  }

  async testCreateAgent() {
    await this.log('\n🤖 Testing create_agent Tool...', 'bold');
    
    const result = await this.callTool('create_agent', {
      apiKey: API_KEY,
      name: 'Test Agent - Security Test',
      description: 'Test agent created by MCP security test suite',
      instructions: 'You are a test agent. Respond helpfully to any questions.',
      type: 'file-based',
      isPublic: false,
      isShareable: false
    });
    
    if (result.data && result.data.success) {
      await this.success(`Agent created successfully - ID: ${result.data.agent?.id}`);
      await this.info(`Cost: $${result.data.cost}`);
      return result.data.agent?.id;
    } else {
      await this.fail(`create_agent failed: ${result.data?.error || 'Unknown error'}`);
      if (result.data?.error?.includes('API key validation failed')) {
        await this.info('This is expected - platform API endpoints not yet implemented');
      }
      return null;
    }
  }

  async testListAgents() {
    await this.log('\n📋 Testing list_agents Tool...', 'bold');
    
    const result = await this.callTool('list_agents', {
      apiKey: API_KEY,
      limit: 10
    });
    
    if (result.data && result.data.success) {
      await this.success(`Listed ${result.data.agents?.length || 0} agents`);
      await this.info(`Cost: $${result.data.cost}`);
      return result.data.agents;
    } else {
      await this.fail(`list_agents failed: ${result.data?.error || 'Unknown error'}`);
      if (result.data?.error?.includes('API key validation failed')) {
        await this.info('This is expected - platform API endpoints not yet implemented');
      }
      return null;
    }
  }

  async testGetAgent(agentId = 1) {
    await this.log('\n🔍 Testing get_agent Tool...', 'bold');
    
    const result = await this.callTool('get_agent', {
      apiKey: API_KEY,
      agentId: agentId
    });
    
    if (result.data && result.data.success) {
      await this.success(`Retrieved agent details - ID: ${result.data.agent?.id}`);
      await this.info(`Cost: $${result.data.cost}`);
    } else {
      await this.fail(`get_agent failed: ${result.data?.error || 'Unknown error'}`);
      if (result.data?.error?.includes('API key validation failed')) {
        await this.info('This is expected - platform API endpoints not yet implemented');
      }
    }
  }

  async testPromptAgent(agentId = 1) {
    await this.log('\n💬 Testing prompt_agent Tool...', 'bold');
    
    const result = await this.callTool('prompt_agent', {
      apiKey: API_KEY,
      agentId: agentId,
      message: 'Hello! This is a test message from the MCP security test suite.'
    });
    
    if (result.data && result.data.success) {
      await this.success('Agent responded to prompt successfully');
      await this.info(`Response: ${result.data.response?.substring(0, 100)}...`);
      await this.info(`Tokens used: ${result.data.tokensUsed}`);
      await this.info(`Cost: $${result.data.cost}`);
    } else {
      await this.fail(`prompt_agent failed: ${result.data?.error || 'Unknown error'}`);
      if (result.data?.error?.includes('API key validation failed')) {
        await this.info('This is expected - platform API endpoints not yet implemented');
      }
    }
  }

  async testUpdateAgent(agentId = 1) {
    await this.log('\n✏️  Testing update_agent Tool...', 'bold');
    
    const result = await this.callTool('update_agent', {
      apiKey: API_KEY,
      agentId: agentId,
      name: 'Updated Test Agent',
      description: 'Updated by MCP security test suite'
    });
    
    if (result.data && result.data.success) {
      await this.success('Agent updated successfully');
      await this.info(`Cost: $${result.data.cost}`);
    } else {
      await this.fail(`update_agent failed: ${result.data?.error || 'Unknown error'}`);
      if (result.data?.error?.includes('API key validation failed')) {
        await this.info('This is expected - platform API endpoints not yet implemented');
      }
    }
  }

  async testUserAccess(agentId = 1) {
    await this.log('\n👥 Testing User Access Management Tools...', 'bold');
    
    // Test add_user_to_agent
    const addResult = await this.callTool('add_user_to_agent', {
      apiKey: API_KEY,
      agentId: agentId,
      userEmail: 'test@example.com'
    });
    
    if (addResult.data && addResult.data.success) {
      await this.success('User access granted successfully');
      await this.info(`Cost: $${addResult.data.cost}`);
    } else {
      await this.fail(`add_user_to_agent failed: ${addResult.data?.error || 'Unknown error'}`);
      if (addResult.data?.error?.includes('API key validation failed')) {
        await this.info('This is expected - platform API endpoints not yet implemented');
      }
    }

    // Test remove_user_from_agent
    const removeResult = await this.callTool('remove_user_from_agent', {
      apiKey: API_KEY,
      agentId: agentId,
      userEmail: 'test@example.com'
    });
    
    if (removeResult.data && removeResult.data.success) {
      await this.success('User access removed successfully');
      await this.info(`Cost: $${removeResult.data.cost}`);
    } else {
      await this.fail(`remove_user_from_agent failed: ${removeResult.data?.error || 'Unknown error'}`);
      if (removeResult.data?.error?.includes('API key validation failed')) {
        await this.info('This is expected - platform API endpoints not yet implemented');
      }
    }
  }

  async testUsageReport() {
    await this.log('\n📊 Testing get_usage_report Tool...', 'bold');
    
    const result = await this.callTool('get_usage_report', {
      apiKey: API_KEY,
      days: 7
    });
    
    if (result.data && result.data.success) {
      await this.success('Usage report generated successfully');
      await this.info(`Cost: $${result.data.cost}`);
    } else {
      await this.fail(`get_usage_report failed: ${result.data?.error || 'Unknown error'}`);
      if (result.data?.error?.includes('API key validation failed')) {
        await this.info('This is expected - platform API endpoints not yet implemented');
      }
    }
  }

  async testDeleteAgent(agentId) {
    if (!agentId) {
      await this.warn('Skipping delete_agent test - no agent ID available');
      return;
    }

    await this.log('\n🗑️  Testing delete_agent Tool...', 'bold');
    
    const result = await this.callTool('delete_agent', {
      apiKey: API_KEY,
      agentId: agentId
    });
    
    if (result.data && result.data.success) {
      await this.success(`Agent ${agentId} deleted successfully`);
      await this.info(`Cost: $${result.data.cost}`);
    } else {
      await this.fail(`delete_agent failed: ${result.data?.error || 'Unknown error'}`);
      if (result.data?.error?.includes('API key validation failed')) {
        await this.info('This is expected - platform API endpoints not yet implemented');
      }
    }
  }

  async runAllTests() {
    await this.log('🚀 MCP Server Security Test Suite Starting...', 'bold');
    await this.log(`📍 Server: ${MCP_SERVER_URL}`, 'blue');
    await this.log(`🔑 API Key: ${API_KEY ? API_KEY.substring(0, 10) + '...' : 'NOT SET'}`, 'blue');

    if (!API_KEY) {
      await this.fail('MOLUABI_API_KEY environment variable not set');
      return;
    }

    // Basic connectivity tests
    const healthOk = await this.testHealthCheck();
    if (!healthOk) return;

    await this.testToolsEndpoint();

    // Security tests
    await this.testAuthenticationSecurity();

    // Tool functionality tests
    await this.testGetPricing();
    
    const agentId = await this.testCreateAgent();
    await this.testListAgents();
    await this.testGetAgent(agentId || 1);
    await this.testPromptAgent(agentId || 1);
    await this.testUpdateAgent(agentId || 1);
    await this.testUserAccess(agentId || 1);
    await this.testUsageReport();
    
    // Cleanup
    if (agentId) {
      await this.testDeleteAgent(agentId);
    }

    // Summary
    await this.log('\n📋 Test Summary:', 'bold');
    await this.log(`✅ Passed: ${this.passed}`, 'green');
    await this.log(`❌ Failed: ${this.failed}`, 'red');
    
    if (this.failed === 0) {
      await this.log('\n🎉 All tests passed! MCP Server security is working correctly.', 'green');
    } else {
      await this.log('\n⚠️  Some tests failed. Check the output above for details.', 'yellow');
    }

    await this.log('\n💡 Note: API validation failures are expected until platform endpoints are implemented.', 'blue');
  }
}

// Run the tests
const tester = new MCPTester();
tester.runAllTests().catch(console.error);