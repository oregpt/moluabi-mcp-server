/**
 * MCP Server Integration Examples for Agent Teams
 * 
 * This file demonstrates how to integrate with the MoluAbi MCP Server
 * using both legacy and standard MCP protocol formats.
 * 
 * Server URL: https://moluabi-mcp-server.replit.app
 * Protocol: HTTP POST to /mcp/call endpoint
 * Authentication: API key required (format: mab_...)
 */

// =============================================================================
// IMPORTANT: BACKWARD COMPATIBILITY
// =============================================================================
// The MCP server now supports BOTH parameter formats:
// 
// Legacy format (existing clients):  {"tool": "tool_name", "arguments": {...}}
// Standard MCP format (ATXP/new):    {"name": "tool_name", "arguments": {...}}
//
// Both formats return identical responses - use whichever fits your integration!
// =============================================================================

const MCP_SERVER_URL = 'https://moluabi-mcp-server.replit.app/mcp/call';

/**
 * Generic MCP call function - supports both parameter formats
 */
async function callMCPTool(toolName, args, useStandardFormat = true) {
  const payload = useStandardFormat 
    ? { name: toolName, arguments: args }      // Standard MCP format (recommended)
    : { tool: toolName, arguments: args };     // Legacy format (still supported)
    
  const response = await fetch(MCP_SERVER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  
  return await response.json();
}

// =============================================================================
// COMPLETE TOOL EXAMPLES - All 10 MCP Tools
// =============================================================================

/**
 * Example: Get current pricing information
 * Cost: $0.001 per call
 */
async function exampleGetPricing(apiKey) {
  console.log('📊 Getting pricing information...');
  
  const result = await callMCPTool('get_pricing', {
    apiKey: apiKey
  });
  
  console.log('Response:', JSON.stringify(result, null, 2));
  return result;
}

/**
 * Example: List all accessible agents
 * Cost: $0.001 per call
 */
async function exampleListAgents(apiKey) {
  console.log('📋 Listing agents...');
  
  const result = await callMCPTool('list_agents', {
    apiKey: apiKey,
    limit: 20  // Optional: max 100
  });
  
  console.log(`Found ${result.total || 0} agents`);
  return result;
}

/**
 * Example: Get specific agent details
 * Cost: $0.001 per call
 */
async function exampleGetAgent(apiKey, agentId) {
  console.log(`🔍 Getting agent ${agentId}...`);
  
  const result = await callMCPTool('get_agent', {
    apiKey: apiKey,
    agentId: agentId  // Required: numeric agent ID
  });
  
  if (result.success) {
    console.log(`Agent: ${result.agent.name}`);
  }
  return result;
}

/**
 * Example: Create a new agent
 * Cost: $0.05 per call
 */
async function exampleCreateAgent(apiKey) {
  console.log('🤖 Creating new agent...');
  
  const result = await callMCPTool('create_agent', {
    apiKey: apiKey,
    name: 'ATXP Integration Agent',
    description: 'Agent created via MCP integration example',
    instructions: 'You are a helpful AI assistant for testing MCP integration.',
    type: 'file-based',        // Options: 'file-based', 'team', 'hybrid'
    isPublic: false,           // Optional: default false
    isShareable: true          // Optional: default false
  });
  
  if (result.success) {
    console.log(`✅ Agent created with ID: ${result.agent.id}`);
  }
  return result;
}

/**
 * Example: Update existing agent
 * Cost: $0.02 per call
 */
async function exampleUpdateAgent(apiKey, agentId) {
  console.log(`✏️ Updating agent ${agentId}...`);
  
  const result = await callMCPTool('update_agent', {
    apiKey: apiKey,
    agentId: agentId,
    name: 'Updated ATXP Agent',           // Optional
    description: 'Updated via MCP',       // Optional
    instructions: 'Updated instructions', // Optional
    isPublic: true                        // Optional
  });
  
  if (result.success) {
    console.log('✅ Agent updated successfully');
  }
  return result;
}

/**
 * Example: Chat with an agent
 * Cost: $0.01 base + token costs
 */
async function exampleChatWithAgent(apiKey, agentId, message) {
  console.log(`💬 Chatting with agent ${agentId}...`);
  
  const result = await callMCPTool('prompt_agent', {
    apiKey: apiKey,
    agentId: agentId,
    message: message,
    model: 'gpt-4o',          // Optional: 'gpt-4o', 'claude-3-5-sonnet', etc.
    stream: false             // Optional: default false
  });
  
  if (result.success) {
    console.log(`🤖 Agent response: ${result.response.content}`);
    console.log(`💰 Tokens used: ${result.response.tokensUsed}`);
  }
  return result;
}

/**
 * Example: Grant user access to agent
 * Cost: $0.005 per call
 * Requires: users:write permission
 */
async function exampleAddUserToAgent(apiKey, agentId, userEmail) {
  console.log(`👥 Adding user ${userEmail} to agent ${agentId}...`);
  
  const result = await callMCPTool('add_user_to_agent', {
    apiKey: apiKey,
    agentId: agentId,
    userEmail: userEmail  // Must be valid email format
  });
  
  if (result.success) {
    console.log(`✅ User ${userEmail} granted access`);
  }
  return result;
}

/**
 * Example: Remove user access from agent
 * Cost: $0.005 per call
 * Requires: users:write permission
 */
async function exampleRemoveUserFromAgent(apiKey, agentId, userEmail) {
  console.log(`🚫 Removing user ${userEmail} from agent ${agentId}...`);
  
  const result = await callMCPTool('remove_user_from_agent', {
    apiKey: apiKey,
    agentId: agentId,
    userEmail: userEmail
  });
  
  if (result.success) {
    console.log(`✅ User ${userEmail} access removed`);
  }
  return result;
}

/**
 * Example: Get usage report
 * Cost: $0.002 per call
 */
async function exampleGetUsageReport(apiKey, days = 7) {
  console.log(`📈 Getting usage report for last ${days} days...`);
  
  const result = await callMCPTool('get_usage_report', {
    apiKey: apiKey,
    days: days  // Optional: 1-365, default 30
  });
  
  if (result.success) {
    console.log('📊 Usage report received');
  }
  return result;
}

/**
 * Example: Delete an agent
 * Cost: $0.01 per call
 * Requires: agents:delete permission
 */
async function exampleDeleteAgent(apiKey, agentId) {
  console.log(`🗑️ Deleting agent ${agentId}...`);
  
  const result = await callMCPTool('delete_agent', {
    apiKey: apiKey,
    agentId: agentId
  });
  
  if (result.success) {
    console.log('✅ Agent deleted successfully');
  }
  return result;
}

// =============================================================================
// ERROR HANDLING EXAMPLES
// =============================================================================

/**
 * Example: Proper error handling for MCP calls
 */
async function exampleWithErrorHandling(apiKey) {
  try {
    const result = await callMCPTool('list_agents', {
      apiKey: apiKey
    });
    
    if (result.success) {
      console.log('✅ Success:', result);
      return result;
    } else {
      console.error('❌ MCP Error:', result.error);
      // Handle specific error cases
      if (result.error.includes('Invalid API key')) {
        console.log('🔑 Check your API key format (should start with mab_)');
      } else if (result.error.includes('Permission denied')) {
        console.log('🚫 Check your API key permissions');
      }
      return null;
    }
  } catch (error) {
    console.error('💥 Network/Request Error:', error.message);
    return null;
  }
}

// =============================================================================
// FULL INTEGRATION WORKFLOW EXAMPLE
// =============================================================================

/**
 * Complete workflow example - Create agent, chat, manage users
 */
async function fullWorkflowExample(apiKey) {
  console.log('🚀 Starting full MCP integration workflow...\n');
  
  try {
    // 1. Get pricing info
    await exampleGetPricing(apiKey);
    
    // 2. List existing agents
    const agentsList = await exampleListAgents(apiKey);
    
    // 3. Create new agent
    const newAgent = await exampleCreateAgent(apiKey);
    if (!newAgent.success) return;
    
    const agentId = newAgent.agent.id;
    
    // 4. Chat with the agent
    await exampleChatWithAgent(apiKey, agentId, 'Hello! Can you help me test the MCP integration?');
    
    // 5. Add user access (if you have users:write permission)
    // await exampleAddUserToAgent(apiKey, agentId, 'test@example.com');
    
    // 6. Get usage report
    await exampleGetUsageReport(apiKey, 1);
    
    // 7. Clean up - delete test agent
    await exampleDeleteAgent(apiKey, agentId);
    
    console.log('\n✅ Full workflow completed successfully!');
    
  } catch (error) {
    console.error('❌ Workflow failed:', error.message);
  }
}

// =============================================================================
// ATXP PAYMENT INTEGRATION NOTES
// =============================================================================

/**
 * ATXP Payment Integration Notes:
 * 
 * 1. The MCP server handles all payment processing internally via ATXP SDK
 * 2. Your client should NOT make direct ATXP API calls
 * 3. Simply call MCP tools - payment validation happens automatically
 * 4. Costs are returned in the response for tracking
 * 
 * Payment Flow:
 * Client -> MCP Server -> ATXP SDK -> Payment Processing
 *                     -> Tool Execution
 *                     -> Response with costs
 */

// =============================================================================
// USAGE INSTRUCTIONS FOR AGENT TEAMS
// =============================================================================

/**
 * Quick Start for Agent Teams:
 * 
 * 1. Get your MoluAbi API key from https://app.moluabi.com
 * 2. Replace 'your_mab_api_key_here' with your actual key
 * 3. Run examples:
 *    node mcp-integration-examples.js
 * 
 * 4. For production, use the callMCPTool() function with your tools
 * 
 * Key Points:
 * - All tools require API key authentication
 * - Use standard MCP format: {"name": "tool_name", "arguments": {...}}
 * - Handle success/error responses appropriately
 * - Costs are included in responses for billing integration
 */

// Example usage (uncomment to test):
/*
const API_KEY = 'your_mab_api_key_here';

// Run a single example
exampleGetPricing(API_KEY);

// Or run the full workflow
// fullWorkflowExample(API_KEY);
*/

module.exports = {
  callMCPTool,
  exampleGetPricing,
  exampleListAgents,
  exampleGetAgent,
  exampleCreateAgent,
  exampleUpdateAgent,
  exampleChatWithAgent,
  exampleAddUserToAgent,
  exampleRemoveUserFromAgent,
  exampleGetUsageReport,
  exampleDeleteAgent,
  exampleWithErrorHandling,
  fullWorkflowExample
};