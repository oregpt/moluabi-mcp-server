import express from "express";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { atxpServer, requirePayment } from '@atxp/server';
import BigNumber from "bignumber.js";
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Create McpServer instance (following exact docs pattern)
const server = new McpServer({
  name: "atxp-test-server",
  version: "1.0.0",
});

// Define a simple test tool with ATXP payment
server.tool(
  "test_add",
  "Add two numbers together with ATXP payment",
  {
    a: z.number().describe("The first number to add"),
    b: z.number().describe("The second number to add"),
  },
  async ({ a, b }) => {
    console.log('🔥 ATXP test_add tool called!');
    
    // Require payment before execution (0.01 USDC)
    await requirePayment({ price: BigNumber(0.01) });
    
    console.log('💰 Payment validated for test_add');
    
    const result = a + b;
    
    return {
      content: [
        {
          type: "text",
          text: `The sum of ${a} + ${b} = ${result}`,
        },
      ],
    };
  }
);

// Create Express application (following exact docs pattern)
const app = express();

// Configure JSON parsing
app.use(express.json());

// Read wallet address from environment
const PAYMENT_DESTINATION = process.env.PAYMENT_DESTINATION;

if (!PAYMENT_DESTINATION) {
  console.error('❌ PAYMENT_DESTINATION environment variable is required');
  process.exit(1);
}

console.log('🔧 Setting up standalone ATXP test server...');
console.log(`💰 Wallet destination: ${PAYMENT_DESTINATION}`);

// Configure ATXP middleware (exact pattern from docs)
app.use(atxpServer({
  destination: PAYMENT_DESTINATION,
  payeeName: 'ATXP Test Server'
}));

// Start server on different port to avoid conflicts
const PORT = 5001;
app.listen(PORT, () => {
  console.log(`🎉 ATXP test server listening on port ${PORT}`);
  console.log(`🔐 ATXP endpoint: http://localhost:${PORT}`);
});