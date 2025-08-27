#!/usr/bin/env node

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
            await paymentManager.recordUsage((args as any).userId, "create_agent", 0.05);
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
              }
            };
            break;

          case "list_agents":
            const agents = await agentService.listAgents((args as any).userId, (args as any).limit);
            await paymentManager.recordUsage((args as any).userId, "list_agents", 0.001);
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
              total: agents.length
            };
            break;

          case "get_agent":
            const agentDetails = await agentService.getAgent((args as any).agentId, (args as any).userId);
            if (!agentDetails) {
              throw new McpError(ErrorCode.InvalidParams, `Agent ${(args as any).agentId} not found or access denied`);
            }
            await paymentManager.recordUsage((args as any).userId, "get_agent", 0.001);
            result = {
              success: true,
              agent: agentDetails
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
            await paymentManager.recordUsage((args as any).userId, "update_agent", 0.02);
            result = {
              success: true,
              agent: updatedAgent
            };
            break;

          case "delete_agent":
            const deleted = await agentService.deleteAgent((args as any).agentId, (args as any).userId);
            if (!deleted) {
              throw new McpError(ErrorCode.InvalidParams, `Agent ${(args as any).agentId} not found or access denied`);
            }
            await paymentManager.recordUsage((args as any).userId, "delete_agent", 0.01);
            result = {
              success: true,
              message: `Agent ${(args as any).agentId} deleted successfully`
            };
            break;

          case "prompt_agent":
            const response = await agentService.promptAgent({
              agentId: (args as any).agentId,
              userId: (args as any).userId,
              message: (args as any).message,
            });
            await paymentManager.recordUsage((args as any).userId, "prompt_agent", response.cost);
            result = {
              success: true,
              response: response.response,
              tokensUsed: response.tokensUsed,
              cost: response.cost
            };
            break;

          case "add_user_to_agent":
            const accessGranted = await agentService.addUserToAgent(
              (args as any).agentId, 
              (args as any).userEmail, 
              (args as any).ownerId
            );
            await paymentManager.recordUsage((args as any).ownerId, "add_user_to_agent", 0.005);
            result = {
              success: true,
              message: accessGranted ? 
                `Access granted to ${(args as any).userEmail}` : 
                `User ${(args as any).userEmail} already has access`
            };
            break;

          case "remove_user_from_agent":
            await agentService.removeUserFromAgent(
              (args as any).agentId, 
              (args as any).userEmail, 
              (args as any).ownerId
            );
            await paymentManager.recordUsage((args as any).ownerId, "remove_user_from_agent", 0.005);
            result = {
              success: true,
              message: `Access removed for ${(args as any).userEmail}`
            };
            break;

          case "get_usage_report":
            const usageReport = await agentService.getUsageReport((args as any).userId, (args as any).days);
            await paymentManager.recordUsage((args as any).userId, "get_usage_report", 0.002);
            result = {
              success: true,
              report: usageReport
            };
            break;

          case "get_pricing":
            const pricing = await agentService.getPricing();
            result = {
              success: true,
              pricing
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
