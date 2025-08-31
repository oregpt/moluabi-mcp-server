import express from "express";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { atxpServer, requirePayment } from '@atxp/server';
import BigNumber from "bignumber.js";
import { PlatformAPIClient } from "./platform/api-client.js";
import { handlePlatformError, handleAPIKeyError, checkPermission, handlePermissionError } from "./platform/error-handler.js";

// Initialize platform API client
const platformClient = new PlatformAPIClient(process.env.PLATFORM_API_URL || 'https://app.moluabi.com');

/**
 * Create ATXP-enabled MCP server following official documentation pattern
 * This creates a complete standalone ATXP server with payment-enabled tools
 */
export function createAtxpStandaloneServer() {
  // Create Express application
  const app = express();
  
  // Configure JSON parsing
  app.use(express.json());
  
  // Read wallet address from environment
  const PAYMENT_DESTINATION = process.env.PAYMENT_DESTINATION;
  
  if (!PAYMENT_DESTINATION) {
    throw new Error('PAYMENT_DESTINATION environment variable is required for ATXP');
  }
  
  // Create the MCP server with tools
  const server = new McpServer({
    name: "moluabi-atxp-server",
    version: "2.0.0",
  });

  // Define create_agent tool with ATXP payment
  server.tool(
    "create_agent",
    "Create a new AI agent with custom instructions and configuration using ATXP payment",
    {
      apiKey: z.string().describe("Your MoluAbi API key (format: mab_...)").regex(/^mab_[a-fA-F0-9]+$/),
      name: z.string().min(1).max(255).describe("Name of the AI agent"),
      description: z.string().optional().describe("Description of the agent's purpose and capabilities"),
      instructions: z.string().optional().describe("Detailed instructions for how the agent should behave"),
      type: z.enum(["file-based", "team", "hybrid"]).default("file-based").describe("Type of agent"),
      isPublic: z.boolean().default(false).describe("Whether the agent is publicly accessible"),
      isShareable: z.boolean().default(false).describe("Whether the agent can be shared with others")
    },
    async (args) => {
      // Require payment before execution (0.05 USDC for create_agent)
      await requirePayment({ price: BigNumber(0.05) });

      // Validate API key format
      if (!args.apiKey || !args.apiKey.startsWith('mab_')) {
        throw new Error("Invalid API key format. Must start with 'mab_'");
      }

      // Validate API key with platform
      const keyValidation = await platformClient.validateAPIKey(args.apiKey);
      if (!keyValidation.valid) {
        throw new Error("Invalid API key");
      }

      // Check required permission
      if (!checkPermission(keyValidation.permissions || [], 'agents:write')) {
        throw new Error("Insufficient permissions. Required: agents:write");
      }

      // Call platform API
      const agent = await platformClient.createAgent(args.apiKey, {
        name: args.name,
        description: args.description,
        instructions: args.instructions,
        type: args.type,
        isPublic: args.isPublic,
        isShareable: args.isShareable
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              agent,
              cost: 0.05,
              operation: "create_agent",
              organizationId: keyValidation.organizationId
            }, null, 2),
          },
        ],
      };
    }
  );

  // Define list_agents tool with ATXP payment
  server.tool(
    "list_agents",
    "List all agents accessible to you within your organization using ATXP payment",
    {
      apiKey: z.string().describe("Your MoluAbi API key (format: mab_...)").regex(/^mab_[a-fA-F0-9]+$/),
      limit: z.number().min(1).max(100).default(50).describe("Maximum number of agents to return")
    },
    async (args) => {
      // Require payment before execution (0.001 USDC for list_agents)
      await requirePayment({ price: BigNumber(0.001) });

      // Validate API key
      if (!args.apiKey || !args.apiKey.startsWith('mab_')) {
        throw new Error("Invalid API key format. Must start with 'mab_'");
      }

      // Validate API key with platform
      const keyValidation = await platformClient.validateAPIKey(args.apiKey);
      if (!keyValidation.valid) {
        throw new Error("Invalid API key");
      }

      // Check required permission
      if (!checkPermission(keyValidation.permissions || [], 'agents:read')) {
        throw new Error("Insufficient permissions. Required: agents:read");
      }

      // Call platform API
      const agents = await platformClient.listAgents(args.apiKey, args.limit || 50);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              agents,
              total: agents.length,
              cost: 0.001,
              operation: "list_agents",
              organizationId: keyValidation.organizationId
            }, null, 2),
          },
        ],
      };
    }
  );

  // Configure ATXP middleware with the MCP server
  app.use(atxpServer({
    destination: PAYMENT_DESTINATION,
    payeeName: 'MoluAbi MCP Server'
  }));

  return { app, server };
}