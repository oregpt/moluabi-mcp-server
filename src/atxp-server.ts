#!/usr/bin/env node

import express, { Request, Response } from "express";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { atxpServer, requirePayment } from '@atxp/server';
import BigNumber from "bignumber.js";

// Import our existing services and handlers
import { AgentService } from './core/agent-service.js';
import { PlatformAPIClient } from './platform/api-client.js';
import { 
  handleCreateAgent,
  handleListAgents,
  handleGetAgent,
  handleUpdateAgent,
  handleDeleteAgent,
  handlePromptAgent,
  handleAddUserToAgent,
  handleRemoveUserFromAgent
} from './tools/agent-tools.js';

console.log('🚀 MoluAbi ATXP Server starting...');

// Initialize services
const agentService = new AgentService();
const platformClient = new PlatformAPIClient(process.env.PLATFORM_API_URL || 'https://app.moluabi.com');

// Create our McpServer instance
const server = new McpServer({
  name: "moluabi-atxp-server",
  version: "2.0.0",
});

// ATXP Tool Registration with Payments
// Each tool requires payment before execution

server.tool(
  "create_agent",
  "Create a new AI agent with specified configuration",
  {
    apiKey: z.string().describe("ATXP authentication will handle payment"),
    name: z.string().describe("Name of the agent"),
    description: z.string().describe("Description of what the agent does"),
    model: z.string().optional().describe("AI model to use (gpt-4, gpt-3.5-turbo, claude-3)"),
    systemPrompt: z.string().optional().describe("System prompt for the agent"),
  },
  async ({ apiKey, name, description, model, systemPrompt }) => {
    // Require payment for agent creation
    await requirePayment({price: BigNumber(0.05)});
    
    try {
      const result = await handleCreateAgent({ apiKey, name, description, model, systemPrompt });
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  }
);

server.tool(
  "list_agents",
  "List all agents accessible to the user",
  {
    apiKey: z.string().describe("ATXP authentication will handle payment"),
  },
  async ({ apiKey }) => {
    await requirePayment({price: BigNumber(0.001)});
    
    try {
      const result = await handleListAgents({ apiKey });
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  }
);

server.tool(
  "get_agent",
  "Get details of a specific agent",
  {
    apiKey: z.string().describe("ATXP authentication will handle payment"),
    agentId: z.number().describe("ID of the agent to retrieve"),
  },
  async ({ apiKey, agentId }) => {
    await requirePayment({price: BigNumber(0.001)});
    
    try {
      const result = await handleGetAgent({ apiKey, agentId });
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  }
);

server.tool(
  "update_agent",
  "Update an existing agent's configuration",
  {
    apiKey: z.string().describe("ATXP authentication will handle payment"),
    agentId: z.number().describe("ID of the agent to update"),
    name: z.string().optional().describe("New name for the agent"),
    description: z.string().optional().describe("New description for the agent"),
    model: z.string().optional().describe("New AI model to use"),
    systemPrompt: z.string().optional().describe("New system prompt for the agent"),
  },
  async ({ apiKey, agentId, name, description, model, systemPrompt }) => {
    await requirePayment({price: BigNumber(0.02)});
    
    try {
      const result = await handleUpdateAgent({ apiKey, agentId, name, description, model, systemPrompt });
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  }
);

server.tool(
  "delete_agent",
  "Delete an agent permanently",
  {
    apiKey: z.string().describe("ATXP authentication will handle payment"),
    agentId: z.number().describe("ID of the agent to delete"),
  },
  async ({ apiKey, agentId }) => {
    await requirePayment({price: BigNumber(0.01)});
    
    try {
      const result = await handleDeleteAgent({ apiKey, agentId });
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  }
);

server.tool(
  "prompt_agent",
  "Send a message to an agent and get a response",
  {
    apiKey: z.string().describe("ATXP authentication will handle payment"),
    agentId: z.number().describe("ID of the agent to prompt"),
    message: z.string().describe("Message to send to the agent"),
    model: z.string().optional().describe("Override the agent's default model"),
  },
  async ({ apiKey, agentId, message, model }) => {
    await requirePayment({price: BigNumber(0.01)});
    
    try {
      const result = await handlePromptAgent({ apiKey, agentId, message, model });
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  }
);

server.tool(
  "add_user_to_agent",
  "Grant a user access to an agent",
  {
    apiKey: z.string().describe("ATXP authentication will handle payment"),
    agentId: z.number().describe("ID of the agent"),
    userEmail: z.string().describe("Email of the user to grant access"),
  },
  async ({ apiKey, agentId, userEmail }) => {
    await requirePayment({price: BigNumber(0.005)});
    
    try {
      const result = await handleAddUserToAgent({ apiKey, agentId, userEmail });
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  }
);

server.tool(
  "remove_user_from_agent",
  "Revoke a user's access to an agent",
  {
    apiKey: z.string().describe("ATXP authentication will handle payment"),
    agentId: z.number().describe("ID of the agent"),
    userEmail: z.string().describe("Email of the user to revoke access"),
  },
  async ({ apiKey, agentId, userEmail }) => {
    await requirePayment({price: BigNumber(0.005)});
    
    try {
      const result = await handleRemoveUserFromAgent({ apiKey, agentId, userEmail });
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  }
);

server.tool(
  "get_usage_report",
  "Get usage statistics and billing information",
  {
    apiKey: z.string().describe("ATXP authentication will handle payment"),
    days: z.number().optional().describe("Number of days to include in report (default: 30)"),
  },
  async ({ apiKey, days }) => {
    await requirePayment({price: BigNumber(0.002)});
    
    try {
      const result = await platformClient.getUsageReport(apiKey, days);
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              report: result,
              cost: 0.002,
              operation: "get_usage_report"
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  }
);

server.tool(
  "get_pricing",
  "Get current pricing information for all operations",
  {
    apiKey: z.string().describe("ATXP authentication will handle payment"),
  },
  async ({ apiKey }) => {
    await requirePayment({price: BigNumber(0.001)});
    
    try {
      const pricing = await agentService.getPricing();
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              pricing,
              cost: 0.001,
              operation: "get_pricing"
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  }
);

// Create Express application
const app = express();
app.use(express.json());

// Read wallet address from environment
const PAYMENT_DESTINATION = process.env.PAYMENT_DESTINATION;

if (!PAYMENT_DESTINATION) {
  console.error('❌ PAYMENT_DESTINATION environment variable is required');
  process.exit(1);
}

console.log('💸 Payment destination configured:', PAYMENT_DESTINATION.substring(0, 8) + '...');

// Configure ATXP middleware
app.use(atxpServer({
  destination: PAYMENT_DESTINATION,
  payeeName: 'MoluAbi ATXP Server',
}));

// Create transport
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: undefined, // stateless server
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'MoluAbi ATXP Server',
    version: '2.0.0',
    authentication: 'ATXP OAuth2',
    timestamp: new Date().toISOString(),
    paymentDestination: PAYMENT_DESTINATION.substring(0, 8) + '...'
  });
});

// CORS preflight
app.options('/', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
  res.status(200).end();
});

// Setup server connection
const setupServer = async () => {
  await server.connect(transport);
  console.log('✅ MCP server connected to transport');
};

// ATXP MCP endpoint - this is where ATXP SDK will connect
app.post('/', async (req: Request, res: Response) => {
  console.log('🔄 ATXP MCP request received:', req.body);
  
  // Set proper headers for MCP protocol
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  try {
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('❌ Error handling ATXP MCP request:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
        },
        id: null,
      });
    }
  }
});

// Use port 8080 which is explicitly allowed by Replit
const PORT = process.env.ATXP_PORT || 8080;
setupServer().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log('🌐 MoluAbi ATXP Server listening on 0.0.0.0:' + PORT);
    console.log('🔑 Authentication: ATXP OAuth2 + Payment validation');
    console.log('💰 Payment processing: Enabled');
    console.log('🛠️ Available tools: 10 MCP tools with payment requirements');
    console.log('✅ Ready for ATXP SDK integration');
    console.log('🌍 External access: Available on all interfaces');
    console.log(`🌍 External URL: https://moluabi-mcp-server.replit.app:${PORT}`);
  });
}).catch(error => {
  console.error('💥 Failed to setup ATXP server:', error);
  process.exit(1);
});