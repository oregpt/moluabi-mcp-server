#!/usr/bin/env node

import express, { Request, Response } from "express";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { atxpServer, requirePayment } from '@atxp/server';
import BigNumber from "bignumber.js";
import dotenv from 'dotenv';

// Import our platform client
import { PlatformAPIClient } from "./platform/api-client.js";

// Load environment variables
dotenv.config();

// Initialize platform client
const platformClient = new PlatformAPIClient(process.env.PLATFORM_API_URL || 'https://moluabi.com');

// Create our McpServer instance - following official tutorial
const server = new McpServer({
  name: "moluabi-mcp-server",
  version: "2.0.0",
});

// Create our Express application - EXACT official pattern
const app = express();

// Configure our Express application to parse JSON bodies
app.use(express.json());

// Read your wallet address from the environment variable
const PAYMENT_DESTINATION = process.env.PAYMENT_DESTINATION;

if (!PAYMENT_DESTINATION) {
  console.error('❌ PAYMENT_DESTINATION environment variable is required');
  process.exit(1);
}

console.log('💰 Payment destination configured:', PAYMENT_DESTINATION.substring(0, 10) + '...');

// Configure our Express application to use the ATXP middleware - EXACT official pattern
app.use(atxpServer({ 
  destination: PAYMENT_DESTINATION, 
  payeeName: 'MoluAbi MCP Server', 
}));

// Create our transport instance
const transport: StreamableHTTPServerTransport = new StreamableHTTPServerTransport({
  sessionIdGenerator: undefined, // set to undefined for stateless servers
});

// Add only essential tools to avoid crashes
console.log('🛠️ Registering essential tools...');

// Tool 1: List Agents - Most important for testing
server.tool(
  "list_agents",
  "List all agents with crypto payment",
  {
    apiKey: z.string().describe("MoluAbi API key")
  },
  async (args) => {
    console.log('🛠️ list_agents tool called');
    await requirePayment({price: BigNumber(0.001)});
    console.log('💰 Payment validated for list_agents');
    
    try {
      const agents = await platformClient.listAgents(args.apiKey);
      return {
        content: [{
          type: "text",
          text: `Found ${agents.length} agents. Payment of $0.001 USDC processed.\n\n${JSON.stringify(agents, null, 2)}`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Failed to list agents: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }],
      };
    }
  }
);

// Tool 2: Get Pricing - Simple, no external calls
server.tool(
  "get_pricing",
  "Get pricing information with crypto payment",
  {
    apiKey: z.string().describe("MoluAbi API key")
  },
  async (args) => {
    console.log('🛠️ get_pricing tool called');
    await requirePayment({price: BigNumber(0.001)});
    console.log('💰 Payment validated for get_pricing');
    
    const pricing = {
      tools: {
        list_agents: "$0.001",
        get_pricing: "$0.001"
      },
      currency: "USDC",
      payment_method: "ATXP (crypto)"
    };
    
    return {
      content: [{
        type: "text",
        text: `Pricing information retrieved. Payment of $0.001 USDC processed.\n\n${JSON.stringify(pricing, null, 2)}`,
      }],
    };
  }
);

console.log('✅ Essential tools registered');

// Setup routes for the server
const setupServer = async () => {
  await server.connect(transport);
  console.log('✅ MCP server connected to transport');
};

// Setup the URL endpoint that will handle MCP requests - EXACT official pattern
app.post('/', async (req: Request, res: Response) => {
  console.log('🔥 MCP request received:', req.body);
  try {
      await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('❌ Error handling MCP request:', error);
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

// Start the server - EXACT official pattern
const PORT = parseInt(process.env.PORT || '5000', 10);
setupServer().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 MoluAbi ATXP MCP Server listening on port ${PORT}`);
    console.log('💰 Payment method: ATXP (crypto payments only)');
    console.log('🛠️ Available tools: 2 essential agent management tools');
    console.log('🔐 Authentication: ATXP OAuth + Crypto payments');
    console.log(`🌐 Server URL: https://moluabi-mcp-server.replit.app/`);
  });
}).catch(error => {
  console.error('❌ Failed to set up the server:', error);
  process.exit(1);
});