#!/usr/bin/env node

import express, { Request, Response } from "express";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { atxpServer, requirePayment } from '@atxp/server';
import BigNumber from "bignumber.js";
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('🚀 Starting minimal test server...');

// Create our McpServer instance
const server = new McpServer({
  name: "test-mcp-server",
  version: "1.0.0",
});

// Create our Express application
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

// Configure our Express application to use the ATXP middleware
console.log('🔧 Configuring ATXP middleware...');
app.use(atxpServer({ 
  destination: PAYMENT_DESTINATION, 
  payeeName: 'Test MCP Server', 
}));
console.log('✅ ATXP middleware configured');

// Create our transport instance
const transport: StreamableHTTPServerTransport = new StreamableHTTPServerTransport({
  sessionIdGenerator: undefined,
});

// Add ONE simple test tool
console.log('🛠️ Registering test tool...');
server.tool(
  "test_tool",
  "Simple test tool",
  {
    message: z.string().describe("Test message")
  },
  async (args) => {
    console.log('🛠️ test_tool called with:', args.message);
    
    // Require payment
    await requirePayment({price: BigNumber(0.001)});
    console.log('💰 Payment validated');
    
    return {
      content: [
        {
          type: "text",
          text: `Test successful! Message: ${args.message}`,
        },
      ],
    };
  }
);
console.log('✅ Test tool registered');

// Setup server
const setupServer = async () => {
  console.log('🔧 Setting up MCP server...');
  await server.connect(transport);
  console.log('✅ MCP server connected to transport');
};

// Setup the URL endpoint
app.post('/', async (req: Request, res: Response) => {
  console.log('🔥 Request received:', req.body);
  try {
      await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('❌ Error:', error);
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

// Start the server
const PORT = parseInt(process.env.PORT || '5000', 10);
setupServer().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Test MCP Server listening on port ${PORT}`);
  });
}).catch(error => {
  console.error('❌ Failed to set up server:', error);
  process.exit(1);
});