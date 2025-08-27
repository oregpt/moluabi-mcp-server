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
import { createAgentTools, validateToolArguments } from "./tools/agent-tools.js";

console.log("🚀 MoluAbi MCP Server starting...");

// Initialize services
const paymentMode = (process.env.PAYMENT_MODE as "none" | "atxp" | "subscription") || "none";
const paymentManager = new PaymentManager(paymentMode);
const agentService = new AgentService();

async function main() {
  try {
    // Initialize payment system
    await paymentManager.initialize();

    // Create HTTP server for health checks
    const app = express();
    const PORT = parseInt(process.env.PORT || '5000', 10);

    // Health check endpoint
    app.get('/', (req, res) => {
      res.json({
        status: 'healthy',
        service: 'MoluAbi MCP Server',
        version: '1.0.0',
        timestamp: new Date().toISOString()
      });
    });

    // MCP HTTP Endpoints for developers
    app.get('/tools', (req, res) => {
      const tools = createAgentTools(agentService, paymentManager);
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
      try {
        const { tool, arguments: args } = req.body;
        
        if (!tool) {
          return res.status(400).json({ error: 'Missing tool parameter' });
        }

        // Validate arguments using the same validation as MCP
        validateToolArguments(tool, args);

        // Validate payment for this operation
        const userId = args?.userId || args?.ownerId;
        if (userId && !(await paymentManager.validatePayment(userId, tool))) {
          return res.status(402).json({
            error: 'Payment validation failed',
            message: `Payment validation failed for ${tool}. Please check your account status or subscription.`
          });
        }

        let result;
        let operationCost = 0;

        // Define standard pricing for transparency
        const PRICING = {
          create_agent: 0.05,
          list_agents: 0.001,
          get_agent: 0.001,
          update_agent: 0.02,
          delete_agent: 0.01,
          prompt_agent: 0.01, // Base cost, actual cost varies by tokens
          add_user_to_agent: 0.005,
          remove_user_from_agent: 0.005,
          get_usage_report: 0.002,
          get_pricing: 0.001
        };

        // Handle tool calls (same logic as MCP)
        switch (tool) {
          case "create_agent":
            const agent = await agentService.createAgent({
              name: args.name,
              description: args.description,
              instructions: args.instructions,
              userId: args.userId,
              organizationId: args.organizationId,
              type: args.type,
              isPublic: args.isPublic,
              isShareable: args.isShareable,
            });
            operationCost = PRICING.create_agent;
            await paymentManager.recordUsage(args.userId, "create_agent", operationCost);
            result = {
              success: true,
              agent: {
                id: agent.id,
                name: agent.name,
                description: agent.description,
                type: agent.type,
                isPublic: agent.isPublic,
                isShareable: agent.isShareable,
                createdAt: agent.createdAt,
              },
              cost: operationCost,
              operation: "create_agent"
            };
            break;

          case "list_agents":
            const agents = await agentService.listAgents(args.userId, args.limit);
            operationCost = PRICING.list_agents;
            await paymentManager.recordUsage(args.userId, "list_agents", operationCost);
            result = {
              success: true,
              agents: agents.map(agent => ({
                id: agent.id,
                name: agent.name,
                description: agent.description,
                type: agent.type,
                isPublic: agent.isPublic,
                isShareable: agent.isShareable,
                ownerId: agent.ownerId,
                createdAt: agent.createdAt,
                updatedAt: agent.updatedAt,
              })),
              total: agents.length,
              cost: operationCost,
              operation: "list_agents"
            };
            break;

          case "get_agent":
            const agentDetails = await agentService.getAgent(args.agentId, args.userId);
            if (!agentDetails) {
              return res.status(404).json({ error: `Agent ${args.agentId} not found or access denied` });
            }
            operationCost = PRICING.get_agent;
            await paymentManager.recordUsage(args.userId, "get_agent", operationCost);
            result = {
              success: true,
              agent: agentDetails,
              cost: operationCost,
              operation: "get_agent"
            };
            break;

          case "prompt_agent":
            const response = await agentService.promptAgent({
              agentId: args.agentId,
              userId: args.userId,
              message: args.message,
            });
            operationCost = response.cost;
            await paymentManager.recordUsage(args.userId, "prompt_agent", operationCost);
            result = {
              success: true,
              response: response.response,
              tokensUsed: response.tokensUsed,
              cost: operationCost,
              operation: "prompt_agent"
            };
            break;

          case "get_pricing":
            const pricing = await agentService.getPricing();
            operationCost = PRICING.get_pricing;
            await paymentManager.recordUsage(args.userId || 'anonymous', "get_pricing", operationCost);
            result = {
              success: true,
              pricing,
              cost: operationCost,
              operation: "get_pricing"
            };
            break;

          default:
            return res.status(400).json({ error: `Unknown tool: ${tool}` });
        }

        res.json(result);

      } catch (error) {
        console.error(`❌ Error executing HTTP tool ${req.body.tool}:`, error);
        res.status(500).json({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Start HTTP server
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🌐 HTTP server listening on port ${PORT}`);
    });

    // Create MCP server
    const server = new Server(
      {
        name: "moluabi-mcp-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Register all agent management tools
    const tools = createAgentTools(agentService, paymentManager);
    console.log(`🔧 Available tools: ${tools.map(t => t.name).join(', ')}`);

    // Handle tool listing requests
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      return { tools };
    });

    // Set up tool call handlers
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        // Validate arguments
        validateToolArguments(name, args);

        // Validate payment for this operation
        const userId = (args as any)?.userId || (args as any)?.ownerId;
        if (userId && !(await paymentManager.validatePayment(userId, name))) {
          throw new McpError(
            ErrorCode.InternalError, 
            `Payment validation failed for ${name}. Please check your account status or subscription.`
          );
        }

        let result;
        let operationCost = 0;

        // Define standard pricing for transparency
        const PRICING = {
          create_agent: 0.05,
          list_agents: 0.001,
          get_agent: 0.001,
          update_agent: 0.02,
          delete_agent: 0.01,
          prompt_agent: 0.01, // Base cost, actual cost varies by tokens
          add_user_to_agent: 0.005,
          remove_user_from_agent: 0.005,
          get_usage_report: 0.002,
          get_pricing: 0.001
        };

        // Handle tool calls
        switch (name) {
          case "create_agent":
            const agent = await agentService.createAgent({
              name: (args as any).name,
              description: (args as any).description,
              instructions: (args as any).instructions,
              userId: (args as any).userId,
              organizationId: (args as any).organizationId,
              type: (args as any).type,
              isPublic: (args as any).isPublic,
              isShareable: (args as any).isShareable,
            });
            operationCost = PRICING.create_agent;
            await paymentManager.recordUsage((args as any).userId, "create_agent", operationCost);
            result = {
              success: true,
              agent: {
                id: agent.id,
                name: agent.name,
                description: agent.description,
                type: agent.type,
                isPublic: agent.isPublic,
                isShareable: agent.isShareable,
                createdAt: agent.createdAt,
              },
              cost: operationCost,
              operation: "create_agent"
            };
            break;

          case "list_agents":
            const agents = await agentService.listAgents((args as any).userId, (args as any).limit);
            operationCost = PRICING.list_agents;
            await paymentManager.recordUsage((args as any).userId, "list_agents", operationCost);
            result = {
              success: true,
              agents: agents.map(agent => ({
                id: agent.id,
                name: agent.name,
                description: agent.description,
                type: agent.type,
                isPublic: agent.isPublic,
                isShareable: agent.isShareable,
                ownerId: agent.ownerId,
                createdAt: agent.createdAt,
                updatedAt: agent.updatedAt,
              })),
              total: agents.length,
              cost: operationCost,
              operation: "list_agents"
            };
            break;

          case "get_agent":
            const agentDetails = await agentService.getAgent((args as any).agentId, (args as any).userId);
            if (!agentDetails) {
              throw new McpError(ErrorCode.InvalidParams, `Agent ${(args as any).agentId} not found or access denied`);
            }
            operationCost = PRICING.get_agent;
            await paymentManager.recordUsage((args as any).userId, "get_agent", operationCost);
            result = {
              success: true,
              agent: agentDetails,
              cost: operationCost,
              operation: "get_agent"
            };
            break;

          case "update_agent":
            const updatedAgent = await agentService.updateAgent((args as any).agentId, (args as any).userId, {
              name: (args as any).name,
              description: (args as any).description,
              instructions: (args as any).instructions,
              type: (args as any).type,
              isPublic: (args as any).isPublic,
              isShareable: (args as any).isShareable,
            });
            operationCost = PRICING.update_agent;
            await paymentManager.recordUsage((args as any).userId, "update_agent", operationCost);
            result = {
              success: true,
              agent: updatedAgent,
              cost: operationCost,
              operation: "update_agent"
            };
            break;

          case "delete_agent":
            const deleted = await agentService.deleteAgent((args as any).agentId, (args as any).userId);
            if (!deleted) {
              throw new McpError(ErrorCode.InvalidParams, `Agent ${(args as any).agentId} not found or access denied`);
            }
            operationCost = PRICING.delete_agent;
            await paymentManager.recordUsage((args as any).userId, "delete_agent", operationCost);
            result = {
              success: true,
              message: `Agent ${(args as any).agentId} deleted successfully`,
              cost: operationCost,
              operation: "delete_agent"
            };
            break;

          case "prompt_agent":
            const response = await agentService.promptAgent({
              agentId: (args as any).agentId,
              userId: (args as any).userId,
              message: (args as any).message,
            });
            operationCost = response.cost; // Actual cost from AI service
            await paymentManager.recordUsage((args as any).userId, "prompt_agent", operationCost);
            result = {
              success: true,
              response: response.response,
              tokensUsed: response.tokensUsed,
              cost: operationCost,
              operation: "prompt_agent"
            };
            break;

          case "add_user_to_agent":
            const accessGranted = await agentService.addUserToAgent(
              (args as any).agentId, 
              (args as any).userEmail, 
              (args as any).ownerId
            );
            operationCost = PRICING.add_user_to_agent;
            await paymentManager.recordUsage((args as any).ownerId, "add_user_to_agent", operationCost);
            result = {
              success: true,
              message: accessGranted ? 
                `Access granted to ${(args as any).userEmail}` : 
                `User ${(args as any).userEmail} already has access`,
              cost: operationCost,
              operation: "add_user_to_agent"
            };
            break;

          case "remove_user_from_agent":
            await agentService.removeUserFromAgent(
              (args as any).agentId, 
              (args as any).userEmail, 
              (args as any).ownerId
            );
            operationCost = PRICING.remove_user_from_agent;
            await paymentManager.recordUsage((args as any).ownerId, "remove_user_from_agent", operationCost);
            result = {
              success: true,
              message: `Access removed for ${(args as any).userEmail}`,
              cost: operationCost,
              operation: "remove_user_from_agent"
            };
            break;

          case "get_usage_report":
            const usageReport = await agentService.getUsageReport((args as any).userId, (args as any).days);
            operationCost = PRICING.get_usage_report;
            await paymentManager.recordUsage((args as any).userId, "get_usage_report", operationCost);
            result = {
              success: true,
              report: usageReport,
              cost: operationCost,
              operation: "get_usage_report"
            };
            break;

          case "get_pricing":
            const pricing = await agentService.getPricing();
            operationCost = PRICING.get_pricing;
            await paymentManager.recordUsage((args as any).userId || 'anonymous', "get_pricing", operationCost);
            result = {
              success: true,
              pricing,
              cost: operationCost,
              operation: "get_pricing"
            };
            break;

          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
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
