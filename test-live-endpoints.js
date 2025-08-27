#!/usr/bin/env node

/**
 * Live Platform Endpoint Testing Suite
 * Tests all MCP API endpoints directly against the deployed platform
 */

const API_KEY = process.env.MOLUABI_API_KEY;
const BASE_URLS = [
  'https://moluabi.com',
  'https://api.moluabi.com',
  'https://app.moluabi.com'
];

// ANSI colors for better output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

class EndpointTester {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.workingBaseUrl = null;
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

  async testEndpoint(method, endpoint, data = null, headers = {}) {
    const results = [];
    
    for (const baseUrl of BASE_URLS) {
      try {
        const url = `${baseUrl}${endpoint}`;
        const options = {
          method,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'MoluAbi-MCP-Test/1.0',
            ...headers
          }
        };

        if (data && (method === 'POST' || method === 'PUT')) {
          options.body = JSON.stringify(data);
        }

        await this.log(`Testing ${method} ${url}`, 'blue');
        
        const response = await fetch(url, options);
        const contentType = response.headers.get('content-type');
        
        let responseData;
        if (contentType && contentType.includes('application/json')) {
          responseData = await response.json();
        } else {
          const text = await response.text();
          responseData = text.substring(0, 200) + (text.length > 200 ? '...' : '');
        }

        results.push({
          baseUrl,
          url,
          status: response.status,
          ok: response.ok,
          contentType,
          data: responseData
        });

        if (response.ok && contentType && contentType.includes('application/json')) {
          if (!this.workingBaseUrl) {
            this.workingBaseUrl = baseUrl;
          }
          await this.success(`${method} ${endpoint} works at ${baseUrl}`);
          await this.info(`Response: ${JSON.stringify(responseData).substring(0, 100)}...`);
          return { success: true, baseUrl, data: responseData };
        } else {
          await this.warn(`${method} ${endpoint} at ${baseUrl} - Status: ${response.status}, Type: ${contentType}`);
        }

      } catch (error) {
        await this.fail(`${method} ${endpoint} at ${baseUrl} - Error: ${error.message}`);
        results.push({
          baseUrl,
          error: error.message
        });
      }
    }

    return { success: false, results };
  }

  async findWorkingBaseUrl() {
    await this.log('\n🔍 Finding Working Base URL...', 'bold');
    
    // Test validation endpoint to find working base URL
    const result = await this.testEndpoint('POST', '/api/mcp/validate', 
      { apiKey: API_KEY });

    if (result.success) {
      this.workingBaseUrl = result.baseUrl;
      await this.success(`Found working base URL: ${this.workingBaseUrl}`);
      return true;
    } else {
      await this.warn('Could not find working base URL, will test all URLs for each endpoint');
      return false;
    }
  }

  async testValidation() {
    await this.log('\n🔐 Testing API Key Validation...', 'bold');
    
    // Test with valid API key
    const validResult = await this.testEndpoint('POST', '/api/mcp/validate', 
      { apiKey: API_KEY });
    
    if (validResult.success) {
      await this.success('API key validation works!');
      await this.info(`User ID: ${validResult.data.user?.id}`);
      await this.info(`Organizations: ${validResult.data.user?.organizationAccess?.length || 0}`);
      await this.info(`Permissions: ${validResult.data.user?.permissions?.join(', ') || 'none'}`);
      return validResult.data;
    } else {
      await this.fail('API key validation failed');
      return null;
    }
  }

  async testAgentCRUD() {
    await this.log('\n🤖 Testing Agent CRUD Operations...', 'bold');
    
    const authHeaders = { 'Authorization': `Bearer ${API_KEY}` };
    let createdAgentId = null;

    // 1. List agents first
    const listResult = await this.testEndpoint('GET', '/api/mcp/agents', null, authHeaders);
    if (listResult.success) {
      await this.success(`List agents works - Found ${listResult.data.agents?.length || 0} agents`);
    }

    // 2. Create agent
    const createData = {
      name: 'MCP Test Agent',
      description: 'Test agent created by endpoint testing suite',
      instructions: 'You are a test agent created through MCP API testing.',
      modelId: 'claude-opus-4-1-20250805',
      isPublic: false
    };

    const createResult = await this.testEndpoint('POST', '/api/mcp/agents', createData, authHeaders);
    if (createResult.success) {
      createdAgentId = createResult.data.agent?.id;
      await this.success(`Create agent works - Created agent ID: ${createdAgentId}`);
    }

    if (createdAgentId) {
      // 3. Get agent details
      const getResult = await this.testEndpoint('GET', `/api/mcp/agents/${createdAgentId}`, null, authHeaders);
      if (getResult.success) {
        await this.success(`Get agent works - Retrieved agent: ${getResult.data.agent?.name}`);
      }

      // 4. Update agent
      const updateData = {
        name: 'Updated MCP Test Agent',
        description: 'Updated by endpoint testing suite'
      };

      const updateResult = await this.testEndpoint('PUT', `/api/mcp/agents/${createdAgentId}`, updateData, authHeaders);
      if (updateResult.success) {
        await this.success(`Update agent works - Updated agent name`);
      }

      // 5. Delete agent (cleanup)
      const deleteResult = await this.testEndpoint('DELETE', `/api/mcp/agents/${createdAgentId}`, null, authHeaders);
      if (deleteResult.success) {
        await this.success(`Delete agent works - Cleaned up test agent`);
      }
    }

    return createdAgentId;
  }

  async testChatEndpoint() {
    await this.log('\n💬 Testing Chat Endpoint...', 'bold');
    
    const authHeaders = { 'Authorization': `Bearer ${API_KEY}` };
    
    // First get an agent to chat with
    const listResult = await this.testEndpoint('GET', '/api/mcp/agents', null, authHeaders);
    
    if (listResult.success && listResult.data.agents?.length > 0) {
      const agentId = listResult.data.agents[0].id;
      await this.info(`Testing chat with agent ID: ${agentId}`);
      
      const chatData = {
        agentId: agentId,
        message: 'Hello! This is a test message from the MCP endpoint testing suite.',
        conversationId: null
      };

      const chatResult = await this.testEndpoint('POST', '/api/mcp/chat', chatData, authHeaders);
      if (chatResult.success) {
        await this.success('Chat endpoint works!');
        await this.info(`Response: ${chatResult.data.response?.substring(0, 100)}...`);
        await this.info(`Tokens used: ${chatResult.data.usage?.totalTokens || 'unknown'}`);
        await this.info(`Conversation ID: ${chatResult.data.conversationId}`);
      }
    } else {
      await this.warn('No agents available for chat testing');
    }
  }

  async testUserManagement() {
    await this.log('\n👥 Testing User Management...', 'bold');
    
    const authHeaders = { 'Authorization': `Bearer ${API_KEY}` };
    
    const usersResult = await this.testEndpoint('GET', '/api/mcp/users', null, authHeaders);
    if (usersResult.success) {
      await this.success(`User management works - Found ${usersResult.data.users?.length || 0} users`);
      if (usersResult.data.users?.length > 0) {
        await this.info(`First user: ${usersResult.data.users[0].email}`);
      }
    }
  }

  async testUsageReporting() {
    await this.log('\n📊 Testing Usage Reporting...', 'bold');
    
    const authHeaders = { 'Authorization': `Bearer ${API_KEY}` };
    
    const usageResult = await this.testEndpoint('GET', '/api/mcp/usage?days=7', null, authHeaders);
    if (usageResult.success) {
      await this.success('Usage reporting works!');
      await this.info(`Total requests: ${usageResult.data.usage?.totalRequests || 0}`);
      await this.info(`Total tokens: ${usageResult.data.usage?.totalTokens || 0}`);
      await this.info(`Total cost: $${usageResult.data.usage?.totalCost || 0}`);
    }
  }

  async runAllTests() {
    await this.log('🚀 Live Platform Endpoint Testing Suite Starting...', 'bold');
    await this.log(`🔑 API Key: ${API_KEY ? API_KEY.substring(0, 10) + '...' : 'NOT SET'}`, 'blue');

    if (!API_KEY) {
      await this.fail('MOLUABI_API_KEY environment variable not set');
      return;
    }

    // Find working base URL
    await this.findWorkingBaseUrl();

    // Test all endpoints
    const userData = await this.testValidation();
    await this.testAgentCRUD();
    await this.testChatEndpoint();
    await this.testUserManagement();
    await this.testUsageReporting();

    // Summary
    await this.log('\n📋 Test Summary:', 'bold');
    await this.log(`✅ Passed: ${this.passed}`, 'green');
    await this.log(`❌ Failed: ${this.failed}`, 'red');
    
    if (this.workingBaseUrl) {
      await this.log(`\n🎉 Working Base URL: ${this.workingBaseUrl}`, 'green');
    }
    
    if (this.passed > 0) {
      await this.log('\n🎉 Some endpoints are working! Platform integration is live.', 'green');
    } else {
      await this.log('\n⚠️  No endpoints working. Platform may not be deployed yet.', 'yellow');
    }
  }
}

// Run the tests
const tester = new EndpointTester();
tester.runAllTests().catch(console.error);