#!/usr/bin/env node

import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { 
  CallToolRequestSchema, 
  ErrorCode, 
  McpError,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import { AgentService } from "./core/agent-service.js";
import { PaymentManager } from "./payments/payment-manager.js";
import { 
  createAgentTools, 
  validateToolArguments, 
  handleCreateAgent, 
  handleListAgents, 
  handleGetAgent, 
  handlePromptAgent 
} from "./tools/agent-tools.js";
import { PlatformAPIClient } from "./platform/api-client.js";
import { handlePlatformError } from "./platform/error-handler.js";
import { atxpServer, requirePayment } from '@atxp/server';
import BigNumber from 'bignumber.js';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

// Create ATXP-enabled MCP server at global scope
const atxpMcpServer = new McpServer({
  name: "moluabi-atxp-server", 
  version: "2.0.0",
});

// Define ATXP tools at global scope - CRITICAL for tool discovery
atxpMcpServer.tool(
  "atxp_create_agent",
  "Create a new AI agent with crypto payment",
  {
    name: z.string().describe("The name of the agent"),
    description: z.string().describe("Description of the agent"),
    instructions: z.string().describe("Instructions for the agent"),
    type: z.string().describe("Type of agent"),
    isPublic: z.boolean().optional().describe("Whether the agent is public"),
    apiKey: z.string().describe("MoluAbi API key")
  },
  async (args) => {
    console.log('🔥 ATXP create_agent tool called!');
    
    // Require payment before execution (0.10 USDC for agent creation)
    await requirePayment({ price: BigNumber(0.10) });
    console.log('💰 Payment validated for create_agent');
    
    const result = await handleCreateAgent(args);
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }
);

atxpMcpServer.tool(
  "atxp_list_agents",
  "List all agents with crypto payment",
  {
    apiKey: z.string().describe("MoluAbi API key")
  },
  async (args) => {
    console.log('🔥 ATXP list_agents tool called!');
    
    // Require payment before execution (0.02 USDC for listing)
    await requirePayment({ price: BigNumber(0.02) });
    console.log('💰 Payment validated for list_agents');
    
    const result = await handleListAgents(args);
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }
);

atxpMcpServer.tool(
  "atxp_prompt_agent",
  "Send a prompt to an agent with crypto payment",
  {
    agentId: z.string().describe("The ID of the agent"),
    prompt: z.string().describe("The prompt to send"),
    apiKey: z.string().describe("MoluAbi API key")
  },
  async (args) => {
    console.log('🔥 ATXP prompt_agent tool called!');
    
    // Require payment before execution (0.05 USDC for prompting)
    await requirePayment({ price: BigNumber(0.05) });
    console.log('💰 Payment validated for prompt_agent');
    
    const result = await handlePromptAgent(args);
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }
);

atxpMcpServer.tool(
  "atxp_get_agent",
  "Get details of a specific agent with crypto payment",
  {
    agentId: z.string().describe("The ID of the agent"),
    apiKey: z.string().describe("MoluAbi API key")
  },
  async (args) => {
    console.log('🔥 ATXP get_agent tool called!');
    
    // Require payment before execution (0.01 USDC for get agent)
    await requirePayment({ price: BigNumber(0.01) });
    console.log('💰 Payment validated for get_agent');
    
    const result = await handleGetAgent(args);
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }
);

atxpMcpServer.tool(
  "atxp_update_agent",
  "Update an existing agent with crypto payment",
  {
    agentId: z.string().describe("The ID of the agent"),
    name: z.string().optional().describe("New name for the agent"),
    description: z.string().optional().describe("New description for the agent"),
    instructions: z.string().optional().describe("New instructions for the agent"),
    type: z.string().optional().describe("New type for the agent"),
    isPublic: z.boolean().optional().describe("Whether the agent is public"),
    isShareable: z.boolean().optional().describe("Whether the agent is shareable"),
    apiKey: z.string().describe("MoluAbi API key")
  },
  async (args) => {
    console.log('🔥 ATXP update_agent tool called!');
    
    // Require payment before execution (0.03 USDC for updating)
    await requirePayment({ price: BigNumber(0.03) });
    console.log('💰 Payment validated for update_agent');
    
    // Use existing update agent logic from main server
    try {
      const platformClient = new PlatformAPIClient(process.env.PLATFORM_API_URL || 'https://app.moluabi.com');
      const keyValidation = await platformClient.validateAPIKey(args.apiKey);
      if (!keyValidation.valid) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: false, error: "Invalid API key", cost: 0.03 }, null, 2),
            },
          ],
        };
      }

      const agent = await platformClient.updateAgent(args.apiKey, parseInt(args.agentId), {
        name: args.name,
        description: args.description,
        instructions: args.instructions,
        type: args.type,
        isPublic: args.isPublic,
        isShareable: args.isShareable
      });

      const result = {
        success: true,
        agent,
        cost: 0.03,
        operation: "update_agent",
        organizationId: keyValidation.organizationId
      };
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorResult = handlePlatformError(error, 'update_agent');
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(errorResult, null, 2),
          },
        ],
      };
    }
  }
);

atxpMcpServer.tool(
  "atxp_delete_agent",
  "Delete an agent with crypto payment",
  {
    agentId: z.string().describe("The ID of the agent to delete"),
    apiKey: z.string().describe("MoluAbi API key")
  },
  async (args) => {
    console.log('🔥 ATXP delete_agent tool called!');
    
    // Require payment before execution (0.02 USDC for deletion)
    await requirePayment({ price: BigNumber(0.02) });
    console.log('💰 Payment validated for delete_agent');
    
    try {
      const platformClient = new PlatformAPIClient(process.env.PLATFORM_API_URL || 'https://app.moluabi.com');
      const keyValidation = await platformClient.validateAPIKey(args.apiKey);
      if (!keyValidation.valid) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: false, error: "Invalid API key", cost: 0.02 }, null, 2),
            },
          ],
        };
      }

      await platformClient.deleteAgent(args.apiKey, parseInt(args.agentId));

      const result = {
        success: true,
        message: `Agent ${args.agentId} deleted successfully`,
        cost: 0.02,
        operation: "delete_agent",
        organizationId: keyValidation.organizationId
      };
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorResult = handlePlatformError(error, 'delete_agent');
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(errorResult, null, 2),
          },
        ],
      };
    }
  }
);

atxpMcpServer.tool(
  "atxp_add_user_to_agent",
  "Add user access to an agent with crypto payment",
  {
    agentId: z.string().describe("The ID of the agent"),
    userId: z.string().describe("The ID of the user to add"),
    permission: z.enum(["read", "write", "admin"]).describe("Permission level for the user"),
    apiKey: z.string().describe("MoluAbi API key")
  },
  async (args) => {
    console.log('🔥 ATXP add_user_to_agent tool called!');
    
    // Require payment before execution (0.01 USDC for user management)
    await requirePayment({ price: BigNumber(0.01) });
    console.log('💰 Payment validated for add_user_to_agent');
    
    try {
      const platformClient = new PlatformAPIClient(process.env.PLATFORM_API_URL || 'https://app.moluabi.com');
      const keyValidation = await platformClient.validateAPIKey(args.apiKey);
      if (!keyValidation.valid) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: false, error: "Invalid API key", cost: 0.01 }, null, 2),
            },
          ],
        };
      }

      await platformClient.addUserToAgent(args.apiKey, parseInt(args.agentId), args.userId);

      const result = {
        success: true,
        message: `User ${args.userId} added to agent ${args.agentId} with ${args.permission} permission`,
        cost: 0.01,
        operation: "add_user_to_agent",
        organizationId: keyValidation.organizationId
      };
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorResult = handlePlatformError(error, 'add_user_to_agent');
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(errorResult, null, 2),
          },
        ],
      };
    }
  }
);

atxpMcpServer.tool(
  "atxp_remove_user_from_agent",
  "Remove user access from an agent with crypto payment",
  {
    agentId: z.string().describe("The ID of the agent"),
    userId: z.string().describe("The ID of the user to remove"),
    apiKey: z.string().describe("MoluAbi API key")
  },
  async (args) => {
    console.log('🔥 ATXP remove_user_from_agent tool called!');
    
    // Require payment before execution (0.01 USDC for user management)
    await requirePayment({ price: BigNumber(0.01) });
    console.log('💰 Payment validated for remove_user_from_agent');
    
    try {
      const platformClient = new PlatformAPIClient(process.env.PLATFORM_API_URL || 'https://app.moluabi.com');
      const keyValidation = await platformClient.validateAPIKey(args.apiKey);
      if (!keyValidation.valid) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: false, error: "Invalid API key", cost: 0.01 }, null, 2),
            },
          ],
        };
      }

      await platformClient.removeUserFromAgent(args.apiKey, parseInt(args.agentId), args.userId);

      const result = {
        success: true,
        message: `User ${args.userId} removed from agent ${args.agentId}`,
        cost: 0.01,
        operation: "remove_user_from_agent",
        organizationId: keyValidation.organizationId
      };
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorResult = handlePlatformError(error, 'remove_user_from_agent');
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(errorResult, null, 2),
          },
        ],
      };
    }
  }
);

atxpMcpServer.tool(
  "atxp_get_usage_report",
  "Get usage report with crypto payment",
  {
    days: z.number().optional().describe("Number of days to include in report"),
    apiKey: z.string().describe("MoluAbi API key")
  },
  async (args) => {
    console.log('🔥 ATXP get_usage_report tool called!');
    
    // Require payment before execution (0.01 USDC for usage report)
    await requirePayment({ price: BigNumber(0.01) });
    console.log('💰 Payment validated for get_usage_report');
    
    try {
      const platformClient = new PlatformAPIClient(process.env.PLATFORM_API_URL || 'https://app.moluabi.com');
      const keyValidation = await platformClient.validateAPIKey(args.apiKey);
      if (!keyValidation.valid) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: false, error: "Invalid API key", cost: 0.01 }, null, 2),
            },
          ],
        };
      }

      const report = await platformClient.getUsageReport(args.apiKey, args.days || 30);

      const result = {
        success: true,
        report,
        cost: 0.01,
        operation: "get_usage_report",
        organizationId: keyValidation.organizationId
      };
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorResult = handlePlatformError(error, 'get_usage_report');
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(errorResult, null, 2),
          },
        ],
      };
    }
  }
);

atxpMcpServer.tool(
  "atxp_get_pricing",
  "Get current pricing information with crypto payment",
  {
    apiKey: z.string().describe("MoluAbi API key")
  },
  async (args) => {
    console.log('🔥 ATXP get_pricing tool called!');
    
    // Require payment before execution (0.005 USDC for pricing info)
    await requirePayment({ price: BigNumber(0.005) });
    console.log('💰 Payment validated for get_pricing');
    
    const agentService = new AgentService();
    const pricing = await agentService.getPricing();
    
    const result = {
      success: true,
      pricing,
      cost: 0.005,
      operation: "get_pricing"
    };
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }
);

// Create transport for ATXP server - CRITICAL for tool discovery
const atxpTransport = new StreamableHTTPServerTransport({
  sessionIdGenerator: undefined,
});

// Connect ATXP server to transport
const setupAtxpServer = async () => {
  await atxpMcpServer.connect(atxpTransport);
  console.log('✅ ATXP MCP server connected to transport');
};

console.log("🚀 MoluAbi MCP Server starting...");
console.log("🔄 SECURITY UPDATE: Now using API key authentication with platform integration");

// Initialize services
const paymentMode = (process.env.PAYMENT_MODE as "none" | "atxp" | "subscription") || "none";
const paymentManager = new PaymentManager(paymentMode);
const agentService = new AgentService();
const platformClient = new PlatformAPIClient(process.env.PLATFORM_API_URL || 'https://app.moluabi.com');

async function main() {
  try {
    // Initialize payment system
    await paymentManager.initialize();

    // Create HTTP server
    const app = express();
    const PORT = parseInt(process.env.PORT || '5000', 10);
    
    // Add global request logging FIRST - before any other middleware
    app.use((req, res, next) => {
      console.log(`🌐🌐🌐 GLOBAL REQUEST: ${req.method} ${req.url} at ${new Date().toISOString()}`);
      console.log(`🌐🌐🌐 AUTH HEADER:`, req.headers.authorization ? 'Present' : 'Missing');
      next();
    });

    // Configure ATXP middleware according to official documentation
    const PAYMENT_DESTINATION = process.env.PAYMENT_DESTINATION;
    if (PAYMENT_DESTINATION && paymentMode === 'atxp') {
      console.log('🔧 Setting up ATXP middleware for payment context...');
      console.log(`💰 Wallet destination: ${PAYMENT_DESTINATION}`);
      
      // OFFICIAL ATXP PATTERN: Apply middleware to entire app section
      console.log('🔧 Creating dedicated ATXP-enabled Express app...');
      
      // Setup ATXP server with transport connection first
      await setupAtxpServer();
      
      // Create separate Express app for ATXP following EXACT official pattern
      const atxpApp = express();
      atxpApp.use(express.json());
      
      // Apply ATXP middleware to ENTIRE app (official pattern)
      atxpApp.use(atxpServer({
        destination: PAYMENT_DESTINATION,
        payeeName: 'MoluAbi MCP Server'
      }));
      
      // Handle MCP requests - bypass transport and handle directly
      atxpApp.post('/', async (req, res) => {
        console.log('🔥 ATXP MCP request received:', req.body);
        
        try {
          const { method, params, id } = req.body;
          
          if (method === 'tools/list') {
            console.log('📋 ATXP tools/list requested');
            
            const tools = [
              { name: "atxp_create_agent", description: "Create a new AI agent with crypto payment" },
              { name: "atxp_list_agents", description: "List all agents with crypto payment" },
              { name: "atxp_get_agent", description: "Get details of a specific agent with crypto payment" },
              { name: "atxp_update_agent", description: "Update an existing agent with crypto payment" },
              { name: "atxp_delete_agent", description: "Delete an agent with crypto payment" },
              { name: "atxp_prompt_agent", description: "Send a prompt to an agent with crypto payment" },
              { name: "atxp_add_user_to_agent", description: "Add user access to an agent with crypto payment" },
              { name: "atxp_remove_user_from_agent", description: "Remove user access from an agent with crypto payment" },
              { name: "atxp_get_usage_report", description: "Get usage report with crypto payment" },
              { name: "atxp_get_pricing", description: "Get current pricing information with crypto payment" }
            ];
            
            return res.json({
              jsonrpc: "2.0",
              result: { tools },
              id
            });
          }
          
          if (method === 'tools/call') {
            const toolName = params?.name;
            console.log(`🔧 ATXP tool call: ${toolName}`);
            
            // Execute ATXP tools manually since transport is problematic
            if (toolName && toolName.startsWith('atxp_')) {
              try {
                let result;
                const args = params?.arguments || {};
                
                // Map ATXP tool names to their implementations
                switch (toolName) {
                  case "atxp_create_agent":
                    await requirePayment({ price: BigNumber(0.10) });
                    result = await handleCreateAgent(args);
                    break;
                  case "atxp_list_agents":
                    await requirePayment({ price: BigNumber(0.02) });
                    result = await handleListAgents(args);
                    break;
                  case "atxp_get_agent":
                    await requirePayment({ price: BigNumber(0.01) });
                    result = await handleGetAgent(args);
                    break;
                  case "atxp_prompt_agent":
                    await requirePayment({ price: BigNumber(0.05) });
                    result = await handlePromptAgent(args);
                    break;
                  case "atxp_update_agent":
                    await requirePayment({ price: BigNumber(0.03) });
                    const agent = await platformClient.updateAgent(args.apiKey, parseInt(args.agentId), {
                      name: args.name,
                      description: args.description,
                      instructions: args.instructions,
                      type: args.type,
                      isPublic: args.isPublic,
                      isShareable: args.isShareable
                    });
                    result = { success: true, agent, cost: 0.03, operation: "update_agent" };
                    break;
                  case "atxp_delete_agent":
                    await requirePayment({ price: BigNumber(0.02) });
                    await platformClient.deleteAgent(args.apiKey, parseInt(args.agentId));
                    result = { success: true, message: `Agent ${args.agentId} deleted`, cost: 0.02, operation: "delete_agent" };
                    break;
                  case "atxp_add_user_to_agent":
                    await requirePayment({ price: BigNumber(0.01) });
                    await platformClient.addUserToAgent(args.apiKey, parseInt(args.agentId), args.userId);
                    result = { success: true, message: `User ${args.userId} added`, cost: 0.01, operation: "add_user_to_agent" };
                    break;
                  case "atxp_remove_user_from_agent":
                    await requirePayment({ price: BigNumber(0.01) });
                    await platformClient.removeUserFromAgent(args.apiKey, parseInt(args.agentId), args.userId);
                    result = { success: true, message: `User ${args.userId} removed`, cost: 0.01, operation: "remove_user_from_agent" };
                    break;
                  case "atxp_get_usage_report":
                    await requirePayment({ price: BigNumber(0.01) });
                    result = await platformClient.getUsageReport(args.apiKey, args.days);
                    result = { success: true, report: result, cost: 0.01, operation: "get_usage_report" };
                    break;
                  case "atxp_get_pricing":
                    await requirePayment({ price: BigNumber(0.005) });
                    const pricing = await agentService.getPricing();
                    result = { success: true, pricing, cost: 0.005, operation: "get_pricing" };
                    break;
                  default:
                    return res.status(400).json({
                      jsonrpc: "2.0",
                      error: {
                        code: -32602,
                        message: `Unknown ATXP tool: ${toolName}`
                      },
                      id
                    });
                }
                
                return res.json({
                  jsonrpc: "2.0",
                  result: {
                    content: [
                      {
                        type: "text",
                        text: JSON.stringify(result, null, 2)
                      }
                    ]
                  },
                  id
                });
                
              } catch (error) {
                console.error(`❌ ATXP tool execution error for ${toolName}:`, error);
                return res.status(500).json({
                  jsonrpc: "2.0",
                  error: {
                    code: -32603,
                    message: `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
                  },
                  id
                });
              }
            } else {
              return res.status(400).json({
                jsonrpc: "2.0",
                error: {
                  code: -32602,
                  message: `Unknown tool: ${toolName}`
                },
                id
              });
            }
          }
          
        } catch (error) {
          console.error('❌ ATXP request error:', error);
          if (!res.headersSent) {
            res.status(500).json({
              jsonrpc: '2.0',
              error: {
                code: -32603,
                message: 'Internal server error',
              },
              id: req.body?.id || null,
            });
          }
        }
      });
      
      // Health check for ATXP app
      atxpApp.get('/health', (req, res) => {
        res.json({
          status: 'healthy',
          service: 'MoluAbi ATXP MCP Server',
          version: '2.0.0',
          pattern: 'Official ATXP Tutorial Pattern',
          authentication: 'ATXP OAuth2',
          payment: 'Crypto per-transaction'
        });
      });
      
      // Mount the ATXP app at /atxp
      app.use('/atxp', atxpApp);
      
      console.log('✅ ATXP app created following EXACT official tutorial pattern');
      
      console.log('✅ ATXP middleware configured for /atxp endpoint with payment-enabled tools');
    }

    // Health check endpoint
    app.get('/', (req, res) => {
      res.json({
        status: 'healthy',
        service: 'MoluAbi MCP Server',
        version: '2.0.0',
        authentication: 'API Key (mab_...)',
        timestamp: new Date().toISOString(),
        debug: 'CODE_IS_ACTUALLY_RUNNING_NOW'
      });
    });

    // ATXP SDK Compatibility: Route root POST requests to /mcp/call
    app.post('/', express.json(), async (req, res) => {
      console.log('🔄 ATXP SDK compatibility: Routing root POST to /mcp/call');
      
      // Accept both "tool" and "name" parameters for backward compatibility
      const toolName = req.body.tool || req.body.name;
      const args = req.body.arguments;
      
      try {
        if (!toolName) {
          return res.status(400).json({ error: 'Missing tool/name parameter' });
        }

        // Validate arguments using the same validation as MCP
        validateToolArguments(toolName, args);

        // All tools now use API key authentication
        if (!args.apiKey) {
          return res.status(400).json({ 
            error: 'API key required', 
            message: 'All operations require a valid MoluAbi API key (format: mab_...)' 
          });
        }

        let result;

        // Handle tool calls with new API key authentication
        switch (toolName) {
          case "create_agent":
            result = await handleCreateAgent(args);
            break;

          case "list_agents":
            result = await handleListAgents(args);
            break;

          case "get_agent":
            result = await handleGetAgent(args);
            break;

          case "prompt_agent":
            result = await handlePromptAgent(args);
            break;

          case "update_agent":
            try {
              const keyValidation = await platformClient.validateAPIKey(args.apiKey);
              if (!keyValidation.valid) {
                result = { success: false, error: "Invalid API key", cost: 0 };
                break;
              }

              const agent = await platformClient.updateAgent(args.apiKey, args.agentId, {
                name: args.name,
                description: args.description,
                instructions: args.instructions,
                type: args.type,
                isPublic: args.isPublic,
                isShareable: args.isShareable
              });

              result = {
                success: true,
                agent,
                cost: 0.02,
                operation: "update_agent",
                organizationId: keyValidation.organizationId
              };
            } catch (error) {
              result = handlePlatformError(error, 'update_agent');
            }
            break;

          case "delete_agent":
            try {
              const keyValidation = await platformClient.validateAPIKey(args.apiKey);
              if (!keyValidation.valid) {
                result = { success: false, error: "Invalid API key", cost: 0 };
                break;
              }

              await platformClient.deleteAgent(args.apiKey, args.agentId);

              result = {
                success: true,
                message: "Agent deleted successfully",
                cost: 0.01,
                operation: "delete_agent",
                organizationId: keyValidation.organizationId
              };
            } catch (error) {
              result = handlePlatformError(error, 'delete_agent');
            }
            break;

          case "add_user_to_agent":
            try {
              const keyValidation = await platformClient.validateAPIKey(args.apiKey);
              if (!keyValidation.valid) {
                result = { success: false, error: "Invalid API key", cost: 0 };
                break;
              }

              await platformClient.addUserToAgent(args.apiKey, args.agentId, args.userEmail);

              result = {
                success: true,
                message: `Access granted to ${args.userEmail}`,
                cost: 0.005,
                operation: "add_user_to_agent",
                organizationId: keyValidation.organizationId
              };
            } catch (error) {
              result = handlePlatformError(error, 'add_user_to_agent');
            }
            break;

          case "remove_user_from_agent":
            try {
              const keyValidation = await platformClient.validateAPIKey(args.apiKey);
              if (!keyValidation.valid) {
                result = { success: false, error: "Invalid API key", cost: 0 };
                break;
              }

              await platformClient.removeUserFromAgent(args.apiKey, args.agentId, args.userEmail);

              result = {
                success: true,
                message: `Access removed for ${args.userEmail}`,
                cost: 0.005,
                operation: "remove_user_from_agent",
                organizationId: keyValidation.organizationId
              };
            } catch (error) {
              result = handlePlatformError(error, 'remove_user_from_agent');
            }
            break;

          case "get_usage_report":
            try {
              const keyValidation = await platformClient.validateAPIKey(args.apiKey);
              if (!keyValidation.valid) {
                result = { success: false, error: "Invalid API key", cost: 0 };
                break;
              }

              const report = await platformClient.getUsageReport(args.apiKey, args.days);

              result = {
                success: true,
                report,
                cost: 0.002,
                operation: "get_usage_report",
                organizationId: keyValidation.organizationId
              };
            } catch (error) {
              result = handlePlatformError(error, 'get_usage_report');
            }
            break;

          case "get_pricing":
            try {
              const pricing = await agentService.getPricing();
              result = {
                success: true,
                pricing,
                cost: 0.001,
                operation: "get_pricing"
              };
            } catch (error) {
              result = handlePlatformError(error, 'get_pricing');
            }
            break;

          default:
            return res.status(400).json({ error: `Unknown tool: ${toolName}` });
        }

        // Record usage if payment system is enabled and operation was successful
        if (result.success && result.cost > 0 && args.apiKey) {
          try {
            const keyValidation = await platformClient.validateAPIKey(args.apiKey);
            if (keyValidation.valid && keyValidation.userId) {
              await paymentManager.recordUsage(keyValidation.userId, toolName, result.cost);
            }
          } catch (error) {
            console.warn('⚠️ Failed to record usage:', error);
          }
        }

        res.json(result);

      } catch (error) {
        console.error(`❌ Error executing root endpoint tool ${toolName}:`, error);
        res.status(500).json({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // MCP HTTP Endpoints for developers
    app.get('/tools', (req, res) => {
      const tools = createAgentTools();
      res.json({
        tools: tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema
        }))
      });
    });

    app.get('/pricing', async (req, res) => {
      try {
        const pricing = await agentService.getPricing();
        res.json(pricing);
      } catch (error) {
        res.status(500).json({ error: 'Failed to get pricing', message: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    // Standard OAuth Resource Server Metadata Endpoint (ATXP SDK expects this path)
    app.get('/.well-known/oauth-protected-resource', (req, res) => {
      console.log('🔐 OAuth resource metadata requested (standard path)');
      res.json({
        resource: "https://moluabi-mcp-server.replit.app",
        authorization_servers: ["https://auth.atxp.ai"],
        authorization_server: "https://auth.atxp.ai",
        issuer: "https://auth.atxp.ai",
        authorization_endpoint: "https://auth.atxp.ai/oauth/authorize",
        token_endpoint: "https://auth.atxp.ai/oauth/token",
        scopes_supported: ["mcp:tools", "mcp:read", "mcp:write"],
        token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],
        resource_server_metadata: {
          name: "MoluAbi ATXP MCP Server",
          version: "2.0.0",
          supported_operations: ["agent_management", "tool_execution"]
        }
      });
    });

    // Alternative OAuth Resource Server Metadata Endpoint for ATXP (backward compatibility)
    app.get('/.well-known/oauth-protected-resource/atxp', (req, res) => {
      console.log('🔐 OAuth resource metadata requested for ATXP (legacy path)');
      res.json({
        resource: "https://moluabi-mcp-server.replit.app",
        authorization_servers: ["https://auth.atxp.ai"],
        authorization_server: "https://auth.atxp.ai",
        issuer: "https://auth.atxp.ai",
        authorization_endpoint: "https://auth.atxp.ai/oauth/authorize",
        token_endpoint: "https://auth.atxp.ai/oauth/token",
        scopes_supported: ["mcp:tools", "mcp:read", "mcp:write"],
        token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],
        resource_server_metadata: {
          name: "MoluAbi ATXP MCP Server",
          version: "2.0.0",
          supported_operations: ["agent_management", "tool_execution"]
        }
      });
    });


    app.post('/mcp/call', express.json(), async (req, res) => {
      // Accept both "tool" and "name" parameters for backward compatibility
      const toolName = req.body.tool || req.body.name;
      const args = req.body.arguments;
      
      try {
        
        if (!toolName) {
          return res.status(400).json({ error: 'Missing tool/name parameter' });
        }

        // Validate arguments using the same validation as MCP
        validateToolArguments(toolName, args);

        // All tools now use API key authentication
        if (!args.apiKey) {
          return res.status(400).json({ 
            error: 'API key required', 
            message: 'All operations require a valid MoluAbi API key (format: mab_...)' 
          });
        }

        let result;

        // Handle tool calls with new API key authentication
        switch (toolName) {
          case "create_agent":
            result = await handleCreateAgent(args);
            break;

          case "list_agents":
            result = await handleListAgents(args);
            break;

          case "get_agent":
            result = await handleGetAgent(args);
            break;

          case "prompt_agent":
            result = await handlePromptAgent(args);
            break;

          case "update_agent":
            try {
              const keyValidation = await platformClient.validateAPIKey(args.apiKey);
              if (!keyValidation.valid) {
                result = { success: false, error: "Invalid API key", cost: 0 };
                break;
              }

              const agent = await platformClient.updateAgent(args.apiKey, args.agentId, {
                name: args.name,
                description: args.description,
                instructions: args.instructions,
                type: args.type,
                isPublic: args.isPublic,
                isShareable: args.isShareable
              });

              result = {
                success: true,
                agent,
                cost: 0.02,
                operation: "update_agent",
                organizationId: keyValidation.organizationId
              };
            } catch (error) {
              result = handlePlatformError(error, 'update_agent');
            }
            break;

          case "delete_agent":
            try {
              const keyValidation = await platformClient.validateAPIKey(args.apiKey);
              if (!keyValidation.valid) {
                result = { success: false, error: "Invalid API key", cost: 0 };
                break;
              }

              await platformClient.deleteAgent(args.apiKey, args.agentId);

              result = {
                success: true,
                message: `Agent ${args.agentId} deleted successfully`,
                cost: 0.01,
                operation: "delete_agent",
                organizationId: keyValidation.organizationId
              };
            } catch (error) {
              result = handlePlatformError(error, 'delete_agent');
            }
            break;

          case "add_user_to_agent":
            try {
              const keyValidation = await platformClient.validateAPIKey(args.apiKey);
              if (!keyValidation.valid) {
                result = { success: false, error: "Invalid API key", cost: 0 };
                break;
              }

              await platformClient.addUserToAgent(args.apiKey, args.agentId, args.userEmail);

              result = {
                success: true,
                message: `Access granted to ${args.userEmail}`,
                cost: 0.005,
                operation: "add_user_to_agent",
                organizationId: keyValidation.organizationId
              };
            } catch (error) {
              result = handlePlatformError(error, 'add_user_to_agent');
            }
            break;

          case "remove_user_from_agent":
            try {
              const keyValidation = await platformClient.validateAPIKey(args.apiKey);
              if (!keyValidation.valid) {
                result = { success: false, error: "Invalid API key", cost: 0 };
                break;
              }

              await platformClient.removeUserFromAgent(args.apiKey, args.agentId, args.userEmail);

              result = {
                success: true,
                message: `Access removed for ${args.userEmail}`,
                cost: 0.005,
                operation: "remove_user_from_agent",
                organizationId: keyValidation.organizationId
              };
            } catch (error) {
              result = handlePlatformError(error, 'remove_user_from_agent');
            }
            break;

          case "get_usage_report":
            try {
              const keyValidation = await platformClient.validateAPIKey(args.apiKey);
              if (!keyValidation.valid) {
                result = { success: false, error: "Invalid API key", cost: 0 };
                break;
              }

              const report = await platformClient.getUsageReport(args.apiKey, args.days);

              result = {
                success: true,
                report,
                cost: 0.002,
                operation: "get_usage_report",
                organizationId: keyValidation.organizationId
              };
            } catch (error) {
              result = handlePlatformError(error, 'get_usage_report');
            }
            break;

          case "get_pricing":
            try {
              const pricing = await agentService.getPricing();
              result = {
                success: true,
                pricing,
                cost: 0.001,
                operation: "get_pricing"
              };
            } catch (error) {
              result = handlePlatformError(error, 'get_pricing');
            }
            break;

          default:
            return res.status(400).json({ error: `Unknown tool: ${toolName}` });
        }

        // Record usage if payment system is enabled and operation was successful
        if (result.success && result.cost > 0 && args.apiKey) {
          try {
            const keyValidation = await platformClient.validateAPIKey(args.apiKey);
            if (keyValidation.valid && keyValidation.userId) {
              await paymentManager.recordUsage(keyValidation.userId, toolName, result.cost);
            }
          } catch (error) {
            console.warn('⚠️ Failed to record usage:', error);
          }
        }

        res.json(result);

      } catch (error) {
        console.error(`❌ Error executing HTTP tool ${toolName}:`, error);
        res.status(500).json({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Start HTTP server
    // Start HTTP server
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🌐 HTTP server listening on port ${PORT}`);
      console.log('📝 Available endpoints:');
      console.log('  GET  / - Health check');
      console.log('  POST / - Root tool execution (API Key method)');
      console.log('  POST /mcp/call - MCP tool execution (API Key method)');
      console.log('  POST /atxp - ATXP MCP endpoint (OAuth2 + Payment)');
      console.log('🔑 API Key method: https://moluabi-mcp-server.replit.app/mcp/call');
      console.log('🔐 ATXP method: https://moluabi-mcp-server.replit.app/atxp');
    });

    // Create MCP server
    const server = new Server(
      {
        name: "moluabi-mcp-server",
        version: "2.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Register all agent management tools
    const tools = createAgentTools();
    console.log(`🔧 Available tools: ${tools.map(t => t.name).join(', ')}`);
    console.log(`🔑 Authentication: All tools require API key (mab_...)`);

    // Handle tool listing requests
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      return { tools };
    });

    // Set up tool call handlers for MCP protocol
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        // Validate arguments
        validateToolArguments(name, args);

        let result;

        // Handle tool calls with new API key authentication
        switch (name) {
          case "create_agent":
            result = await handleCreateAgent(args);
            break;

          case "list_agents":
            result = await handleListAgents(args);
            break;

          case "get_agent":
            result = await handleGetAgent(args);
            break;

          case "prompt_agent":
            result = await handlePromptAgent(args);
            break;

          case "update_agent":
            try {
              const keyValidation = await platformClient.validateAPIKey((args as any).apiKey);
              if (!keyValidation.valid) {
                result = { success: false, error: "Invalid API key", cost: 0 };
                break;
              }

              const agent = await platformClient.updateAgent((args as any).apiKey, (args as any).agentId, {
                name: (args as any).name,
                description: (args as any).description,
                instructions: (args as any).instructions,
                type: (args as any).type,
                isPublic: (args as any).isPublic,
                isShareable: (args as any).isShareable
              });

              result = {
                success: true,
                agent,
                cost: 0.02,
                operation: "update_agent",
                organizationId: keyValidation.organizationId
              };
            } catch (error) {
              result = handlePlatformError(error, 'update_agent');
            }
            break;

          case "delete_agent":
            try {
              const keyValidation = await platformClient.validateAPIKey((args as any).apiKey);
              if (!keyValidation.valid) {
                result = { success: false, error: "Invalid API key", cost: 0 };
                break;
              }

              await platformClient.deleteAgent((args as any).apiKey, (args as any).agentId);

              result = {
                success: true,
                message: `Agent ${(args as any).agentId} deleted successfully`,
                cost: 0.01,
                operation: "delete_agent",
                organizationId: keyValidation.organizationId
              };
            } catch (error) {
              result = handlePlatformError(error, 'delete_agent');
            }
            break;

          case "add_user_to_agent":
            try {
              const keyValidation = await platformClient.validateAPIKey((args as any).apiKey);
              if (!keyValidation.valid) {
                result = { success: false, error: "Invalid API key", cost: 0 };
                break;
              }

              await platformClient.addUserToAgent((args as any).apiKey, (args as any).agentId, (args as any).userEmail);

              result = {
                success: true,
                message: `Access granted to ${(args as any).userEmail}`,
                cost: 0.005,
                operation: "add_user_to_agent",
                organizationId: keyValidation.organizationId
              };
            } catch (error) {
              result = handlePlatformError(error, 'add_user_to_agent');
            }
            break;

          case "remove_user_from_agent":
            try {
              const keyValidation = await platformClient.validateAPIKey((args as any).apiKey);
              if (!keyValidation.valid) {
                result = { success: false, error: "Invalid API key", cost: 0 };
                break;
              }

              await platformClient.removeUserFromAgent((args as any).apiKey, (args as any).agentId, (args as any).userEmail);

              result = {
                success: true,
                message: `Access removed for ${(args as any).userEmail}`,
                cost: 0.005,
                operation: "remove_user_from_agent",
                organizationId: keyValidation.organizationId
              };
            } catch (error) {
              result = handlePlatformError(error, 'remove_user_from_agent');
            }
            break;

          case "get_usage_report":
            try {
              const keyValidation = await platformClient.validateAPIKey((args as any).apiKey);
              if (!keyValidation.valid) {
                result = { success: false, error: "Invalid API key", cost: 0 };
                break;
              }

              const report = await platformClient.getUsageReport((args as any).apiKey, (args as any).days);

              result = {
                success: true,
                report,
                cost: 0.002,
                operation: "get_usage_report",
                organizationId: keyValidation.organizationId
              };
            } catch (error) {
              result = handlePlatformError(error, 'get_usage_report');
            }
            break;

          case "get_pricing":
            try {
              const pricing = await agentService.getPricing();
              result = {
                success: true,
                pricing,
                cost: 0.001,
                operation: "get_pricing"
              };
            } catch (error) {
              result = handlePlatformError(error, 'get_pricing');
            }
            break;

          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }

        // Record usage if payment system is enabled and operation was successful
        if (result.success && result.cost > 0 && (args as any).apiKey) {
          try {
            const keyValidation = await platformClient.validateAPIKey((args as any).apiKey);
            if (keyValidation.valid && keyValidation.userId) {
              await paymentManager.recordUsage(keyValidation.userId, name, result.cost);
            }
          } catch (error) {
            console.warn('⚠️ Failed to record usage:', error);
          }
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2)
            }
          ]
        };

      } catch (error) {
        console.error(`❌ Error executing tool ${name}:`, error);
        
        if (error instanceof McpError) {
          throw error;
        }

        // Log unexpected errors for debugging
        console.error(`Unexpected error in ${name}:`, error);
        
        throw new McpError(
          ErrorCode.InternalError, 
          `Internal server error while executing ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    });

    // Start the server
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    console.log("✅ MoluAbi MCP Server ready and listening for requests");
    console.log("🔐 Security: API key authentication enforced for all operations");

  } catch (error) {
    console.error("❌ Failed to start MCP server:", error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log("\n🛑 Shutting down MCP server...");
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log("\n🛑 Shutting down MCP server...");
  process.exit(0);
});

// Start the server
main().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});