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

    // Health check endpoint
    app.get('/', (req, res) => {
      res.json({
        status: 'healthy',
        service: 'MoluAbi MCP Server',
        version: '2.0.0',
        authentication: 'API Key (mab_...)',
        timestamp: new Date().toISOString()
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

    // ATXP Endpoint - ATXP MCP server on /atxp path
    app.post('/atxp', express.json(), async (req, res) => {
      console.log('🔥 === ATXP ENDPOINT HIT === STARTING TRACE ===');
      console.log('🔥 RAW REQUEST BODY:', JSON.stringify(req.body, null, 2));
      console.log('🔥 RAW HEADERS:', JSON.stringify(req.headers, null, 2));
      console.log('🔥 REQUEST URL:', req.url);
      console.log('🔥 REQUEST METHOD:', req.method);
      
      console.log('🔥 Step 1: Setting headers...');
      // Set proper headers for MCP protocol
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      console.log('🔥 Step 1: Headers set successfully');
      
      console.log('🔥 Step 2: Extracting request body fields...');
      // Handle ATXP MCP requests
      const { jsonrpc, method, params, id } = req.body;
      console.log('🔥 Step 2: Extracted values:');
      console.log('🔥   - jsonrpc:', JSON.stringify(jsonrpc), typeof jsonrpc);
      console.log('🔥   - method:', JSON.stringify(method), typeof method);
      console.log('🔥   - params:', JSON.stringify(params), typeof params);
      console.log('🔥   - id:', JSON.stringify(id), typeof id);
      
      console.log('🔥 Step 3: Validating JSON-RPC format...');
      if (!jsonrpc || jsonrpc !== "2.0") {
        console.log('🔥 Step 3: INVALID JSON-RPC - RETURNING ERROR');
        return res.status(400).json({
          jsonrpc: "2.0",
          error: {
            code: -32600,
            message: "Invalid JSON-RPC request"
          },
          id: id || null
        });
      }
      console.log('🔥 Step 3: JSON-RPC validation passed');
      
      console.log('🔥 Step 4: Entering try block for method handling...');
      try {
        console.log('🔥 Step 5: Analyzing method value...');
        console.log('🔥   - Method value (JSON):', JSON.stringify(method));
        console.log('🔥   - Method value (string):', String(method));
        console.log('🔥   - Method type:', typeof method);
        console.log('🔥   - Method length:', method ? method.length : 'undefined');
        console.log('🔥   - Method === "initialize":', method === "initialize");
        console.log('🔥   - Method.trim() === "initialize":', method ? method.trim() === "initialize" : 'N/A');
        
        console.log('🔥 Step 6: Starting method comparisons...');
        if (method === "initialize") {
          console.log('🔥 Step 6: INITIALIZE METHOD MATCHED!!! ENTERING HANDLER...');
          console.log('🛠️ MCP initialize called on /atxp');
          return res.json({
            jsonrpc: "2.0",
            result: {
              protocolVersion: "2024-11-05",
              capabilities: {
                tools: {},
                logging: {}
              },
              serverInfo: {
                name: "moluabi-atxp-server",
                version: "2.0.0",
                debug: "INITIALIZE_METHOD_REACHED_SUCCESSFULLY"
              }
            },
            id
          });
        } else if (method === "tools/list") {
          console.log('🔥 Step 6: TOOLS/LIST METHOD MATCHED!!! ENTERING HANDLER...');
          // Return ATXP-compatible tools list
          const tools = createAgentTools();
          return res.json({
            jsonrpc: "2.0",
            result: {
              tools: tools.map(tool => ({
                name: tool.name,
                description: tool.description,
                inputSchema: tool.inputSchema
              }))
            },
            id
          });
        } else if (method === "tools/call") {
          console.log('🔥 Step 6: TOOLS/CALL METHOD MATCHED!!! ENTERING HANDLER...');
          // Require ATXP authentication for tool execution
          const authHeader = req.headers.authorization;
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
              jsonrpc: "2.0",
              error: {
                code: -32001,
                message: "Payment required - ATXP authentication missing"
              },
              id
            });
          }
          
          // If properly authenticated, execute the tool (for now we'll return payment required)
          return res.status(402).json({
            jsonrpc: "2.0",
            error: {
              code: -32001,
              message: "Payment required - Please complete ATXP payment flow"
            },
            id
          });
        } else {
          console.log('🔥 Step 6: NO METHOD MATCHED!!! FALLING TO DEFAULT CASE...');
          console.log('🔥 METHOD NOT FOUND ERROR - About to return error...');
          console.log('🔥 Method comparison results:');
          console.log('🔥   - method === "initialize":', method === "initialize");
          console.log('🔥   - method === "tools/list":', method === "tools/list");
          console.log('🔥   - method === "tools/call":', method === "tools/call");
          console.log('🔥 Detailed method analysis:');
          for (let i = 0; i < method.length; i++) {
            console.log(`🔥   - Char ${i}: "${method[i]}" (code: ${method.charCodeAt(i)})`);
          }
          console.log('🔥 Expected initialize string analysis:');
          const expectedInit = "initialize";
          for (let i = 0; i < expectedInit.length; i++) {
            console.log(`🔥   - Expected char ${i}: "${expectedInit[i]}" (code: ${expectedInit.charCodeAt(i)})`);
          }
          
          return res.status(400).json({
            jsonrpc: "2.0",
            error: {
              code: -32601,
              message: `Method not found: ${method}`
            },
            id
          });
        }
      } catch (error) {
        console.error('❌ Error handling ATXP request:', error);
        return res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Internal server error"
          },
          id
        });
      }
    });

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