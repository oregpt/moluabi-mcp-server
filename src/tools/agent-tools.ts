import { McpError, ErrorCode, type Tool } from "@modelcontextprotocol/sdk/types.js";
import { AgentService } from "../core/agent-service.js";
import { PaymentManager } from "../payments/payment-manager.js";

/**
 * Create all MCP tools for agent management
 */
export function createAgentTools(
  agentService: AgentService,
  paymentManager: PaymentManager
): Tool[] {
  return [
    {
      name: "create_agent",
      description: "Create a new AI agent with custom instructions and configuration",
      inputSchema: {
        type: "object",
        properties: {
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
          userId: { 
            type: "string", 
            description: "ID of the user creating the agent" 
          },
          organizationId: { 
            type: "string", 
            description: "Organization ID (optional for future use)" 
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
        required: ["name", "userId"]
      }
    },

    {
      name: "list_agents", 
      description: "List all agents accessible to the user with pagination support",
      inputSchema: {
        type: "object",
        properties: {
          userId: { 
            type: "string", 
            description: "ID of the user requesting the list" 
          },
          limit: { 
            type: "number", 
            description: "Maximum number of agents to return",
            minimum: 1,
            maximum: 100,
            default: 50
          }
        },
        required: ["userId"]
      }
    },

    {
      name: "get_agent",
      description: "Get detailed information about a specific agent including configuration and metadata", 
      inputSchema: {
        type: "object",
        properties: {
          agentId: { 
            type: "number", 
            description: "Unique identifier of the agent" 
          },
          userId: { 
            type: "string", 
            description: "ID of the user requesting agent details" 
          }
        },
        required: ["agentId", "userId"]
      }
    },

    {
      name: "update_agent",
      description: "Update an existing agent's configuration (owner only)",
      inputSchema: {
        type: "object",
        properties: {
          agentId: { 
            type: "number", 
            description: "Unique identifier of the agent to update" 
          },
          userId: { 
            type: "string", 
            description: "ID of the user requesting the update" 
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
        required: ["agentId", "userId"]
      }
    },

    {
      name: "delete_agent",
      description: "Permanently delete an agent and all associated data (owner only)",
      inputSchema: {
        type: "object", 
        properties: {
          agentId: { 
            type: "number", 
            description: "Unique identifier of the agent to delete" 
          },
          userId: { 
            type: "string", 
            description: "ID of the user requesting deletion (must be owner)" 
          }
        },
        required: ["agentId", "userId"]
      }
    },

    {
      name: "prompt_agent",
      description: "Send a message to an agent and receive an AI-generated response",
      inputSchema: {
        type: "object",
        properties: {
          agentId: { 
            type: "number", 
            description: "Unique identifier of the agent to interact with" 
          },
          userId: { 
            type: "string", 
            description: "ID of the user sending the message" 
          },
          message: { 
            type: "string", 
            description: "Message or prompt to send to the agent",
            minLength: 1,
            maxLength: 10000
          }
        },
        required: ["agentId", "userId", "message"]
      }
    },

    {
      name: "add_user_to_agent",
      description: "Grant a user access to an agent by email address",
      inputSchema: {
        type: "object",
        properties: {
          agentId: { 
            type: "number", 
            description: "Unique identifier of the agent" 
          },
          userEmail: { 
            type: "string", 
            description: "Email address of the user to grant access to",
            format: "email"
          },
          ownerId: { 
            type: "string", 
            description: "ID of the agent owner granting access" 
          }
        },
        required: ["agentId", "userEmail", "ownerId"]
      }
    },

    {
      name: "remove_user_from_agent",
      description: "Revoke a user's access to an agent",
      inputSchema: {
        type: "object",
        properties: {
          agentId: { 
            type: "number", 
            description: "Unique identifier of the agent" 
          },
          userEmail: { 
            type: "string", 
            description: "Email address of the user to revoke access from",
            format: "email"
          },
          ownerId: { 
            type: "string", 
            description: "ID of the agent owner revoking access" 
          }
        },
        required: ["agentId", "userEmail", "ownerId"]
      }
    },

    {
      name: "get_usage_report",
      description: "Get detailed usage and billing report for a user",
      inputSchema: {
        type: "object",
        properties: {
          userId: { 
            type: "string", 
            description: "ID of the user to generate report for" 
          },
          days: { 
            type: "number", 
            description: "Number of days to include in the report",
            minimum: 1,
            maximum: 365,
            default: 30
          }
        },
        required: ["userId"]
      }
    },

    {
      name: "get_pricing",
      description: "Get current pricing information for all models and operations",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false
      }
    }
  ];
}

/**
 * Validate tool arguments and handle common validation errors
 */
export function validateToolArguments(toolName: string, args: any): void {
  if (!args) {
    throw new McpError(ErrorCode.InvalidParams, `Missing arguments for tool ${toolName}`);
  }

  // Common validations
  if (args.userId && typeof args.userId !== 'string') {
    throw new McpError(ErrorCode.InvalidParams, "userId must be a string");
  }

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
