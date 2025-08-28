import { McpError, ErrorCode, type Tool } from "@modelcontextprotocol/sdk/types.js";
import { PlatformAPIClient } from "../platform/api-client.js";
import { handlePlatformError, handleAPIKeyError, checkPermission, handlePermissionError } from "../platform/error-handler.js";

// Initialize platform API client
const platformClient = new PlatformAPIClient(process.env.PLATFORM_API_URL || 'https://app.moluabi.com');

/**
 * Create all MCP tools for agent management with API key authentication
 */
export function createAgentTools(): Tool[] {
  return [
    {
      name: "create_agent",
      description: "Create a new AI agent with custom instructions and configuration using your MoluAbi API key",
      inputSchema: {
        type: "object",
        properties: {
          apiKey: { 
            type: "string", 
            description: "Your MoluAbi API key (format: mab_...)",
            pattern: "^mab_[a-fA-F0-9]+$"
          },
          name: { 
            type: "string", 
            description: "Name of the AI agent",
            minLength: 1,
            maxLength: 255
          },
          description: { 
            type: "string", 
            description: "Description of the agent's purpose and capabilities" 
          },
          instructions: { 
            type: "string", 
            description: "Detailed instructions for how the agent should behave" 
          },
          type: { 
            type: "string", 
            description: "Type of agent", 
            enum: ["file-based", "team", "hybrid"],
            default: "file-based"
          },
          isPublic: { 
            type: "boolean", 
            description: "Whether the agent is publicly accessible",
            default: false
          },
          isShareable: { 
            type: "boolean", 
            description: "Whether the agent can be shared with others",
            default: false
          }
        },
        required: ["apiKey", "name"]
      }
    },

    {
      name: "list_agents", 
      description: "List all agents accessible to you within your organization",
      inputSchema: {
        type: "object",
        properties: {
          apiKey: { 
            type: "string", 
            description: "Your MoluAbi API key (format: mab_...)",
            pattern: "^mab_[a-fA-F0-9]+$"
          },
          limit: { 
            type: "number", 
            description: "Maximum number of agents to return",
            minimum: 1,
            maximum: 100,
            default: 50
          }
        },
        required: ["apiKey"]
      }
    },

    {
      name: "get_agent",
      description: "Get detailed information about a specific agent", 
      inputSchema: {
        type: "object",
        properties: {
          apiKey: { 
            type: "string", 
            description: "Your MoluAbi API key (format: mab_...)",
            pattern: "^mab_[a-fA-F0-9]+$"
          },
          agentId: { 
            type: "number", 
            description: "Unique identifier of the agent" 
          }
        },
        required: ["apiKey", "agentId"]
      }
    },

    {
      name: "update_agent",
      description: "Update an existing agent's configuration (requires agents:write permission)",
      inputSchema: {
        type: "object",
        properties: {
          apiKey: { 
            type: "string", 
            description: "Your MoluAbi API key (format: mab_...)",
            pattern: "^mab_[a-fA-F0-9]+$"
          },
          agentId: { 
            type: "number", 
            description: "Unique identifier of the agent to update" 
          },
          name: { 
            type: "string", 
            description: "New name for the agent",
            minLength: 1,
            maxLength: 255
          },
          description: { 
            type: "string", 
            description: "New description for the agent" 
          },
          instructions: { 
            type: "string", 
            description: "New instructions for the agent" 
          },
          type: { 
            type: "string", 
            description: "New agent type", 
            enum: ["file-based", "team", "hybrid"]
          },
          isPublic: { 
            type: "boolean", 
            description: "Update public accessibility" 
          },
          isShareable: { 
            type: "boolean", 
            description: "Update sharing permissions" 
          }
        },
        required: ["apiKey", "agentId"]
      }
    },

    {
      name: "delete_agent",
      description: "Permanently delete an agent and all associated data (requires agents:delete permission)",
      inputSchema: {
        type: "object", 
        properties: {
          apiKey: { 
            type: "string", 
            description: "Your MoluAbi API key (format: mab_...)",
            pattern: "^mab_[a-fA-F0-9]+$"
          },
          agentId: { 
            type: "number", 
            description: "Unique identifier of the agent to delete" 
          }
        },
        required: ["apiKey", "agentId"]
      }
    },

    {
      name: "prompt_agent",
      description: "Send a message to an agent and receive an AI-generated response",
      inputSchema: {
        type: "object",
        properties: {
          apiKey: { 
            type: "string", 
            description: "Your MoluAbi API key (format: mab_...)",
            pattern: "^mab_[a-fA-F0-9]+$"
          },
          agentId: { 
            type: "number", 
            description: "Unique identifier of the agent to interact with" 
          },
          message: { 
            type: "string", 
            description: "Message or prompt to send to the agent",
            minLength: 1,
            maxLength: 10000
          },
          model: {
            type: "string",
            description: "Optional AI model override (gpt-5, claude, grok). Uses agent's default if not specified.",
            enum: ["gpt-5", "claude", "grok"]
          }
        },
        required: ["apiKey", "agentId", "message"]
      }
    },

    {
      name: "add_user_to_agent",
      description: "Grant a user access to an agent by email address (requires users:write permission)",
      inputSchema: {
        type: "object",
        properties: {
          apiKey: { 
            type: "string", 
            description: "Your MoluAbi API key (format: mab_...)",
            pattern: "^mab_[a-fA-F0-9]+$"
          },
          agentId: { 
            type: "number", 
            description: "Unique identifier of the agent" 
          },
          userEmail: { 
            type: "string", 
            description: "Email address of the user to grant access to",
            format: "email"
          }
        },
        required: ["apiKey", "agentId", "userEmail"]
      }
    },

    {
      name: "remove_user_from_agent",
      description: "Revoke a user's access to an agent (requires users:write permission)",
      inputSchema: {
        type: "object",
        properties: {
          apiKey: { 
            type: "string", 
            description: "Your MoluAbi API key (format: mab_...)",
            pattern: "^mab_[a-fA-F0-9]+$"
          },
          agentId: { 
            type: "number", 
            description: "Unique identifier of the agent" 
          },
          userEmail: { 
            type: "string", 
            description: "Email address of the user to revoke access from",
            format: "email"
          }
        },
        required: ["apiKey", "agentId", "userEmail"]
      }
    },

    {
      name: "get_usage_report",
      description: "Get detailed usage and billing report for your account",
      inputSchema: {
        type: "object",
        properties: {
          apiKey: { 
            type: "string", 
            description: "Your MoluAbi API key (format: mab_...)",
            pattern: "^mab_[a-fA-F0-9]+$"
          },
          days: { 
            type: "number", 
            description: "Number of days to include in the report",
            minimum: 1,
            maximum: 365,
            default: 30
          }
        },
        required: ["apiKey"]
      }
    },

    {
      name: "get_pricing",
      description: "Get current pricing information for all models and operations",
      inputSchema: {
        type: "object",
        properties: {
          apiKey: { 
            type: "string", 
            description: "Your MoluAbi API key (format: mab_...)",
            pattern: "^mab_[a-fA-F0-9]+$"
          }
        },
        required: ["apiKey"]
      }
    }
  ];
}

/**
 * Execute create_agent tool with platform API integration
 */
export async function handleCreateAgent(args: any) {
  try {
    // 1. Validate API key format
    if (!args.apiKey || !args.apiKey.startsWith('mab_')) {
      return handleAPIKeyError(args.apiKey);
    }

    // 2. Validate API key with platform
    const keyValidation = await platformClient.validateAPIKey(args.apiKey);
    if (!keyValidation.valid) {
      return handleAPIKeyError(args.apiKey);
    }

    // 3. Check required permission
    if (!checkPermission(keyValidation.permissions || [], 'agents:write')) {
      return handlePermissionError('create_agent', 'agents:write');
    }

    // 4. Call platform API
    const agent = await platformClient.createAgent(args.apiKey, {
      name: args.name,
      description: args.description,
      instructions: args.instructions,
      type: args.type || 'file-based',
      isPublic: args.isPublic || false,
      isShareable: args.isShareable || false
    });

    return {
      success: true,
      agent,
      cost: 0.05,
      operation: "create_agent",
      organizationId: keyValidation.organizationId
    };

  } catch (error) {
    return handlePlatformError(error, 'create_agent');
  }
}

/**
 * Execute list_agents tool with platform API integration
 */
export async function handleListAgents(args: any) {
  try {
    // 1. Validate API key
    if (!args.apiKey || !args.apiKey.startsWith('mab_')) {
      return handleAPIKeyError(args.apiKey);
    }

    // 2. Validate API key with platform
    const keyValidation = await platformClient.validateAPIKey(args.apiKey);
    if (!keyValidation.valid) {
      return handleAPIKeyError(args.apiKey);
    }

    // 3. Check required permission
    if (!checkPermission(keyValidation.permissions || [], 'agents:read')) {
      return handlePermissionError('list_agents', 'agents:read');
    }

    // 4. Call platform API
    const agents = await platformClient.listAgents(args.apiKey, args.limit);

    return {
      success: true,
      agents,
      total: agents.length,
      cost: 0.001,
      operation: "list_agents",
      organizationId: keyValidation.organizationId
    };

  } catch (error) {
    return handlePlatformError(error, 'list_agents');
  }
}

/**
 * Execute get_agent tool with platform API integration
 */
export async function handleGetAgent(args: any) {
  try {
    // 1. Validate API key
    if (!args.apiKey || !args.apiKey.startsWith('mab_')) {
      return handleAPIKeyError(args.apiKey);
    }

    // 2. Validate API key with platform
    const keyValidation = await platformClient.validateAPIKey(args.apiKey);
    if (!keyValidation.valid) {
      return handleAPIKeyError(args.apiKey);
    }

    // 3. Check required permission
    if (!checkPermission(keyValidation.permissions || [], 'agents:read')) {
      return handlePermissionError('get_agent', 'agents:read');
    }

    // 4. Call platform API
    const agent = await platformClient.getAgent(args.apiKey, args.agentId);

    return {
      success: true,
      agent,
      cost: 0.001,
      operation: "get_agent",
      organizationId: keyValidation.organizationId
    };

  } catch (error) {
    return handlePlatformError(error, 'get_agent');
  }
}

/**
 * Execute prompt_agent tool with platform API integration
 */
export async function handlePromptAgent(args: any) {
  try {
    // 1. Validate API key
    if (!args.apiKey || !args.apiKey.startsWith('mab_')) {
      return handleAPIKeyError(args.apiKey);
    }

    // 2. Validate API key with platform
    const keyValidation = await platformClient.validateAPIKey(args.apiKey);
    if (!keyValidation.valid) {
      return handleAPIKeyError(args.apiKey);
    }

    // 3. Check required permission
    if (!checkPermission(keyValidation.permissions || [], 'chat:write')) {
      return handlePermissionError('prompt_agent', 'chat:write');
    }

    // 4. Call platform API
    const response = await platformClient.promptAgent(args.apiKey, args.agentId, args.message, args.model);

    return {
      success: true,
      response: response.response,
      tokensUsed: response.tokensUsed || 0,
      cost: response.cost || 0.01,
      operation: "prompt_agent",
      organizationId: keyValidation.organizationId
    };

  } catch (error) {
    return handlePlatformError(error, 'prompt_agent');
  }
}

/**
 * Validate tool arguments with new API key model
 */
export function validateToolArguments(toolName: string, args: any): void {
  if (!args) {
    throw new McpError(ErrorCode.InvalidParams, `Missing arguments for tool ${toolName}`);
  }

  // API key validation
  if (!args.apiKey) {
    throw new McpError(ErrorCode.InvalidParams, "API key is required");
  }

  if (typeof args.apiKey !== 'string' || !args.apiKey.startsWith('mab_')) {
    throw new McpError(ErrorCode.InvalidParams, "API key must be in format 'mab_...'");
  }

  // Common validations
  if (args.agentId && (typeof args.agentId !== 'number' || args.agentId <= 0)) {
    throw new McpError(ErrorCode.InvalidParams, "agentId must be a positive number");
  }

  if (args.userEmail && typeof args.userEmail !== 'string') {
    throw new McpError(ErrorCode.InvalidParams, "userEmail must be a string");
  }

  if (args.userEmail && !args.userEmail.includes('@')) {
    throw new McpError(ErrorCode.InvalidParams, "userEmail must be a valid email address");
  }

  // Tool-specific validations
  switch (toolName) {
    case "create_agent":
    case "update_agent":
      if (args.name && (typeof args.name !== 'string' || args.name.trim().length === 0)) {
        throw new McpError(ErrorCode.InvalidParams, "name must be a non-empty string");
      }
      break;

    case "prompt_agent":
      if (!args.message || typeof args.message !== 'string' || args.message.trim().length === 0) {
        throw new McpError(ErrorCode.InvalidParams, "message must be a non-empty string");
      }
      break;

    case "list_agents":
      if (args.limit && (typeof args.limit !== 'number' || args.limit <= 0 || args.limit > 100)) {
        throw new McpError(ErrorCode.InvalidParams, "limit must be a number between 1 and 100");
      }
      break;
  }
}