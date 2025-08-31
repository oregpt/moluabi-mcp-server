import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { requirePayment } from '@atxp/server';
import BigNumber from "bignumber.js";
import { PlatformAPIClient } from "../platform/api-client.js";
import { handlePlatformError, handleAPIKeyError, checkPermission, handlePermissionError } from "../platform/error-handler.js";

// Initialize platform API client
const platformClient = new PlatformAPIClient(process.env.PLATFORM_API_URL || 'https://app.moluabi.com');

/**
 * Create ATXP-enabled MCP tools that require payment before execution
 * These tools work with the atxpServer middleware for crypto payments
 */
export function createAtxpMcpServer(): McpServer {
  const server = new McpServer({
    name: "moluabi-atxp-server",
    version: "2.0.0",
  });

  // Create Agent Tool (ATXP Version)
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
      // STEP 1: Require payment before execution (0.05 USDC for create_agent)
      await requirePayment({ price: BigNumber(0.05) });

      // STEP 2: Validate API key format
      if (!args.apiKey || !args.apiKey.startsWith('mab_')) {
        throw new Error("Invalid API key format. Must start with 'mab_'");
      }

      // STEP 3: Validate API key with platform
      const keyValidation = await platformClient.validateAPIKey(args.apiKey);
      if (!keyValidation.valid) {
        throw new Error("Invalid API key");
      }

      // STEP 4: Check required permission
      if (!checkPermission(keyValidation.permissions || [], 'agents:write')) {
        throw new Error("Insufficient permissions. Required: agents:write");
      }

      // STEP 5: Call platform API
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

  // List Agents Tool (ATXP Version)
  server.tool(
    "list_agents",
    "List all agents accessible to you within your organization using ATXP payment",
    {
      apiKey: z.string().describe("Your MoluAbi API key (format: mab_...)").regex(/^mab_[a-fA-F0-9]+$/),
      limit: z.number().min(1).max(100).default(50).describe("Maximum number of agents to return")
    },
    async (args) => {
      // STEP 1: Require payment before execution (0.001 USDC for list_agents)
      await requirePayment({ price: BigNumber(0.001) });

      // STEP 2: Validate API key
      if (!args.apiKey || !args.apiKey.startsWith('mab_')) {
        throw new Error("Invalid API key format. Must start with 'mab_'");
      }

      // STEP 3: Validate API key with platform
      const keyValidation = await platformClient.validateAPIKey(args.apiKey);
      if (!keyValidation.valid) {
        throw new Error("Invalid API key");
      }

      // STEP 4: Check required permission
      if (!checkPermission(keyValidation.permissions || [], 'agents:read')) {
        throw new Error("Insufficient permissions. Required: agents:read");
      }

      // STEP 5: Call platform API
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

  // Get Agent Tool (ATXP Version)
  server.tool(
    "get_agent",
    "Get detailed information about a specific agent using ATXP payment",
    {
      apiKey: z.string().describe("Your MoluAbi API key (format: mab_...)").regex(/^mab_[a-fA-F0-9]+$/),
      agentId: z.number().describe("Unique identifier of the agent to retrieve")
    },
    async (args) => {
      // STEP 1: Require payment before execution (0.001 USDC for get_agent)
      await requirePayment({ price: BigNumber(0.001) });

      // STEP 2: Validate API key
      if (!args.apiKey || !args.apiKey.startsWith('mab_')) {
        throw new Error("Invalid API key format. Must start with 'mab_'");
      }

      // STEP 3: Validate API key with platform
      const keyValidation = await platformClient.validateAPIKey(args.apiKey);
      if (!keyValidation.valid) {
        throw new Error("Invalid API key");
      }

      // STEP 4: Check required permission
      if (!checkPermission(keyValidation.permissions || [], 'agents:read')) {
        throw new Error("Insufficient permissions. Required: agents:read");
      }

      // STEP 5: Call platform API
      const agent = await platformClient.getAgent(args.apiKey, args.agentId);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              agent,
              cost: 0.001,
              operation: "get_agent",
              organizationId: keyValidation.organizationId
            }, null, 2),
          },
        ],
      };
    }
  );

  // Prompt Agent Tool (ATXP Version)
  server.tool(
    "prompt_agent",
    "Send a message to an AI agent and get a response using ATXP payment",
    {
      apiKey: z.string().describe("Your MoluAbi API key (format: mab_...)").regex(/^mab_[a-fA-F0-9]+$/),
      agentId: z.number().describe("Unique identifier of the agent to prompt"),
      message: z.string().describe("The message to send to the agent"),
      stream: z.boolean().default(false).describe("Whether to stream the response")
    },
    async (args) => {
      // STEP 1: Require payment before execution (0.02 USDC for prompt_agent)
      await requirePayment({ price: BigNumber(0.02) });

      // STEP 2: Validate API key
      if (!args.apiKey || !args.apiKey.startsWith('mab_')) {
        throw new Error("Invalid API key format. Must start with 'mab_'");
      }

      // STEP 3: Validate API key with platform
      const keyValidation = await platformClient.validateAPIKey(args.apiKey);
      if (!keyValidation.valid) {
        throw new Error("Invalid API key");
      }

      // STEP 4: Check required permission
      if (!checkPermission(keyValidation.permissions || [], 'agents:prompt')) {
        throw new Error("Insufficient permissions. Required: agents:prompt");
      }

      // STEP 5: Call platform API
      const response = await platformClient.promptAgent(args.apiKey, args.agentId, args.message);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              response,
              cost: 0.02,
              operation: "prompt_agent",
              organizationId: keyValidation.organizationId
            }, null, 2),
          },
        ],
      };
    }
  );

  // Update Agent Tool (ATXP Version)
  server.tool(
    "update_agent",
    "Update an existing AI agent's configuration using ATXP payment",
    {
      apiKey: z.string().describe("Your MoluAbi API key (format: mab_...)").regex(/^mab_[a-fA-F0-9]+$/),
      agentId: z.number().describe("Unique identifier of the agent to update"),
      name: z.string().min(1).max(255).optional().describe("New name for the agent"),
      description: z.string().optional().describe("New description of the agent's purpose"),
      instructions: z.string().optional().describe("New instructions for the agent behavior"),
      type: z.enum(["file-based", "team", "hybrid"]).optional().describe("New agent type"),
      isPublic: z.boolean().optional().describe("Whether the agent should be publicly accessible"),
      isShareable: z.boolean().optional().describe("Whether the agent can be shared with others")
    },
    async (args) => {
      // STEP 1: Require payment before execution (0.02 USDC for update_agent)
      await requirePayment({ price: BigNumber(0.02) });

      // STEP 2: Validate API key
      if (!args.apiKey || typeof args.apiKey !== 'string' || !args.apiKey.startsWith('mab_')) {
        throw new Error("Invalid API key format. Must start with 'mab_'");
      }

      // STEP 3: Validate API key with platform
      const keyValidation = await platformClient.validateAPIKey(args.apiKey);
      if (!keyValidation.valid) {
        throw new Error("Invalid API key");
      }

      // STEP 4: Check required permission
      if (!checkPermission(keyValidation.permissions || [], 'agents:write')) {
        throw new Error("Insufficient permissions. Required: agents:write");
      }

      // STEP 5: Call platform API
      const agent = await platformClient.updateAgent(args.apiKey, args.agentId, {
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
              cost: 0.02,
              operation: "update_agent",
              organizationId: keyValidation.organizationId
            }, null, 2),
          },
        ],
      };
    }
  );

  return server;
}