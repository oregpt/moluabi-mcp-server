#!/usr/bin/env node

import express, { Request, Response } from "express";
import { z } from "zod";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { atxpServer, requirePayment } from '@atxp/server';
import BigNumber from "bignumber.js";

// Import our existing services and handlers
import { AgentService } from './core/agent-service.js';
import { PlatformAPIClient } from './platform/api-client.js';
import { 
  handleCreateAgent,
  handleListAgents,
  handleGetAgent,
  handlePromptAgent
} from './tools/agent-tools.js';
import { createAgentTools } from './tools/agent-tools.js';

console.log('🚀 MoluAbi ATXP Server starting...');

// Initialize services
const agentService = new AgentService();
const platformClient = new PlatformAPIClient(process.env.PLATFORM_API_URL || 'https://app.moluabi.com');

// Create our MCP Server instance with proper schema
const server = new Server(
  {
    name: "moluabi-atxp-server",
    version: "2.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Create agent tools with ATXP payment integration
const { tools } = createAgentTools();

// Handle tool listing requests (required for ATXP SDK)
server.setRequestHandler(ListToolsRequestSchema, async () => {
  console.log('📋 MCP list_tools called');
  return { tools };
});

// Handle tool execution requests with ATXP payment integration
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  console.log(`🔧 ATXP tool call: ${name}`);
  
  try {
    let result;
    let paymentAmount = BigNumber(0);
    
    // Define payment amounts for each tool
    const toolPricing: Record<string, string> = {
      "create_agent": "0.05",
      "list_agents": "0.001", 
      "get_agent": "0.001",
      "update_agent": "0.02",
      "delete_agent": "0.01",
      "prompt_agent": "0.01",
      "add_user_to_agent": "0.005",
      "remove_user_from_agent": "0.005",
      "get_usage_report": "0.002",
      "get_pricing": "0.001"
    };
    
    if (toolPricing[name]) {
      paymentAmount = BigNumber(toolPricing[name]);
      // Require payment before tool execution
      await requirePayment({price: paymentAmount});
    }
    
    // Execute the tool logic based on name
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
      case "get_pricing":
        result = await agentService.getPricing();
        result = {
          success: true,
          pricing: result,
          cost: parseFloat(paymentAmount.toString()),
          operation: "get_pricing"
        };
        break;
      case "get_usage_report":
        result = await platformClient.getUsageReport((args as any).apiKey, (args as any).days);
        result = {
          success: true,
          report: result,
          cost: parseFloat(paymentAmount.toString()),
          operation: "get_usage_report"
        };
        break;
      default:
        throw new Error(`Tool not implemented: ${name}`);
    }
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
    
  } catch (error) {
    console.error(`❌ Error executing tool ${name}:`, error);
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ],
    };
  }
});










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
  
  // Handle specific MCP methods that ATXP SDK requires
  const { jsonrpc, method, params, id } = req.body;
  
  if (!jsonrpc || jsonrpc !== "2.0") {
    return res.status(400).json({
      jsonrpc: "2.0",
      error: {
        code: -32600,
        message: "Invalid JSON-RPC request"
      },
      id: id || null
    });
  }
  
  try {
    if (method === "initialize") {
      console.log('🛠️ MCP initialize called');
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
            version: "2.0.0"
          }
        },
        id
      });
    } else {
      // Let the MCP transport handle other methods (tools/list, tools/call)
      await transport.handleRequest(req, res, req.body);
    }
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
const PORT = parseInt(process.env.ATXP_PORT || '8080', 10);
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