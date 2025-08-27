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
    await this.log('\n🤖 Testing Create Agent Tool...', 'bold');
    
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
      await this.success(`Create Agent: Agent created successfully - ID: ${result.data.agent?.id}`);
      await this.info(`Cost: $${result.data.cost}`);
      return result.data.agent?.id;
    } else {
      await this.fail(`Create Agent failed: ${result.data?.error || 'Unknown error'}`);
      if (result.data?.error?.includes('API key validation failed')) {
        await this.info('This is expected - platform API endpoints not yet implemented');
      }
      return null;
    }
  }

  async testListAgents() {
    await this.log('\n📋 Testing List Agents Tool...', 'bold');
    
    const result = await this.callTool('list_agents', {
      apiKey: API_KEY,
      limit: 10
    });
    
    if (result.data && result.data.success) {
      await this.success(`List Agents: Found ${result.data.agents?.length || 0} agents`);
      await this.info(`Cost: $${result.data.cost}`);
      return result.data.agents;
    } else {
      await this.fail(`List Agents failed: ${result.data?.error || 'Unknown error'}`);
      if (result.data?.error?.includes('API key validation failed')) {
        await this.info('This is expected - platform API endpoints not yet implemented');
      }
      return null;
    }
  }

  async testViewAgent(agentId = 1) {
    await this.log('\n🔍 Testing View Agent Tool...', 'bold');
    
    const result = await this.callTool('get_agent', {
      apiKey: API_KEY,
      agentId: agentId
    });
    
    if (result.data && result.data.success) {
      await this.success(`View Agent: Retrieved agent details - ID: ${result.data.agent?.id}`);
      await this.info(`Cost: $${result.data.cost}`);
    } else {
      await this.fail(`View Agent failed: ${result.data?.error || 'Unknown error'}`);
      if (result.data?.error?.includes('API key validation failed')) {
        await this.info('This is expected - platform API endpoints not yet implemented');
      }
    }
  }

  async testChatWithAgent(agentId = 1) {
    await this.log('\n💬 Testing Chat with Agent Tool...', 'bold');
    
    const result = await this.callTool('prompt_agent', {
      apiKey: API_KEY,
      agentId: agentId,
      message: 'Hello! This is a test message from the MCP security test suite.'
    });
    
    if (result.data && result.data.success) {
      await this.success('Chat with Agent: Agent responded successfully');
      await this.info(`Response: ${result.data.response?.substring(0, 100)}...`);
      await this.info(`Tokens used: ${result.data.tokensUsed}`);
      await this.info(`Cost: $${result.data.cost}`);
    } else {
      await this.fail(`Chat with Agent failed: ${result.data?.error || 'Unknown error'}`);
      if (result.data?.error?.includes('API key validation failed')) {
        await this.info('This is expected - platform API endpoints not yet implemented');
      }
    }
  }

  async testUpdateAgent(agentId = 1) {
    await this.log('\n✏️  Testing Update Agent Tool...', 'bold');
    
    const result = await this.callTool('update_agent', {
      apiKey: API_KEY,
      agentId: agentId,
      name: 'Updated Test Agent',
      description: 'Updated by MCP security test suite'
    });
    
    if (result.data && result.data.success) {
      await this.success('Update Agent: Agent updated successfully');
      await this.info(`Cost: $${result.data.cost}`);
    } else {
      await this.fail(`Update Agent failed: ${result.data?.error || 'Unknown error'}`);
      if (result.data?.error?.includes('API key validation failed')) {
        await this.info('This is expected - platform API endpoints not yet implemented');
      }
    }
  }

  async testAddUserAccess(agentId = 1) {
    await this.log('\n➕ Testing Add User Access Tool...', 'bold');
    
    const result = await this.callTool('add_user_to_agent', {
      apiKey: API_KEY,
      agentId: agentId,
      userEmail: 'test@example.com'
    });
    
    if (result.data && result.data.success) {
      await this.success('Add User Access: User access granted successfully');
      await this.info(`Cost: $${result.data.cost}`);
    } else {
      await this.fail(`Add User Access failed: ${result.data?.error || 'Unknown error'}`);
      if (result.data?.error?.includes('API key validation failed')) {
        await this.info('This is expected - platform API endpoints not yet implemented');
      }
    }
  }

  async testRemoveUserAccess(agentId = 1) {
    await this.log('\n➖ Testing Remove User Access Tool...', 'bold');
    
    const result = await this.callTool('remove_user_from_agent', {
      apiKey: API_KEY,
      agentId: agentId,
      userEmail: 'test@example.com'
    });
    
    if (result.data && result.data.success) {
      await this.success('Remove User Access: User access removed successfully');
      await this.info(`Cost: $${result.data.cost}`);
    } else {
      await this.fail(`Remove User Access failed: ${result.data?.error || 'Unknown error'}`);
      if (result.data?.error?.includes('API key validation failed')) {
        await this.info('This is expected - platform API endpoints not yet implemented');
      }
    }
  }


  async testUsageReport() {
    await this.log('\n📊 Testing Usage Report Tool...', 'bold');
    
    const result = await this.callTool('get_usage_report', {
      apiKey: API_KEY,
      days: 7
    });
    
    if (result.data && result.data.success) {
      await this.success('Usage Report: Report generated successfully');
      await this.info(`Cost: $${result.data.cost}`);
    } else {
      await this.fail(`Usage Report failed: ${result.data?.error || 'Unknown error'}`);
      if (result.data?.error?.includes('API key validation failed')) {
        await this.info('This is expected - platform API endpoints not yet implemented');
      }
    }
  }

  async testRefreshPricing() {
    await this.log('\n🔄 Testing Refresh Pricing Tool...', 'bold');
    
    const result = await this.callTool('get_pricing', {
      apiKey: API_KEY
    });
    
    if (result.data && result.data.success) {
      await this.success('Refresh Pricing: Latest pricing retrieved successfully');
      await this.info(`Models available: ${Object.keys(result.data.pricing.models || {}).length}`);
      await this.info(`Operations available: ${Object.keys(result.data.pricing.operations || {}).length}`);
      await this.info(`Cost: $${result.data.cost}`);
    } else {
      await this.fail(`Refresh Pricing failed: ${result.data?.error || 'Unknown error'}`);
    }
  }

  async testDeleteAgent(agentId) {
    if (!agentId) {
      await this.warn('Skipping Delete Agent test - no agent ID available');
      return;
    }

    await this.log('\n🗑️  Testing Delete Agent Tool...', 'bold');
    
    const result = await this.callTool('delete_agent', {
      apiKey: API_KEY,
      agentId: agentId
    });
    
    if (result.data && result.data.success) {
      await this.success(`Delete Agent: Agent ${agentId} deleted successfully`);
      await this.info(`Cost: $${result.data.cost}`);
    } else {
      await this.fail(`Delete Agent failed: ${result.data?.error || 'Unknown error'}`);
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

    // All 10 MCP Tool Tests
    await this.log('\n🛠️  Testing All 10 MCP Tools:', 'bold');
    await this.info('1. Create Agent | 2. List Agents | 3. View Agent | 4. Update Agent | 5. Delete Agent');
    await this.info('6. Add User Access | 7. Remove User Access | 8. Chat with Agent | 9. Usage Report | 10. Refresh Pricing');
    
    // 10. Refresh Pricing (static tool - test first)
    await this.testRefreshPricing();
    
    // 1. Create Agent 
    const agentId = await this.testCreateAgent();
    
    // 2. List Agents
    await this.testListAgents();
    
    // 3. View Agent
    await this.testViewAgent(agentId || 1);
    
    // 4. Update Agent
    await this.testUpdateAgent(agentId || 1);
    
    // 6. Add User Access
    await this.testAddUserAccess(agentId || 1);
    
    // 7. Remove User Access
    await this.testRemoveUserAccess(agentId || 1);
    
    // 8. Chat with Agent
    await this.testChatWithAgent(agentId || 1);
    
    // 9. Usage Report
    await this.testUsageReport();
    
    // 5. Delete Agent (cleanup - test last)
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