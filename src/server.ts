#!/usr/bin/env node

import express, { Request, Response } from "express";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { atxpServer, requirePayment, atxpAccountId, getATXPConfig } from '@atxp/server';
import { ConsoleLogger, LogLevel, UrlString } from '@atxp/common';
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

// Add health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    server: 'MoluAbi ATXP MCP Server',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    payment: {
      network: 'base',
      currency: 'USDC',
      destination: PAYMENT_DESTINATION
    }
  });
});

// Read your wallet address from the environment variable
const PAYMENT_DESTINATION = process.env.PAYMENT_DESTINATION;
const ATXP_AUTH_CLIENT_TOKEN = process.env.ATXP_AUTH_CLIENT_TOKEN;

if (!PAYMENT_DESTINATION) {
  console.error('❌ PAYMENT_DESTINATION environment variable is required');
  process.exit(1);
}


console.log('💰 Payment destination configured:', PAYMENT_DESTINATION.substring(0, 10) + '...');

// Configure our Express application to use the ATXP middleware - EXACT official pattern
console.log('🔧 Configuring ATXP server with:');
console.log('  - destination:', PAYMENT_DESTINATION);
console.log('  - payeeName: MoluAbi MCP Server');

// Import MemoryOAuthDb from ATXP common package  
import { MemoryOAuthDb } from '@atxp/common';

// Create memory OAuth database with debug logging
const memoryOAuthDb = new MemoryOAuthDb();

// Add debug logging to see what methods actually get called
const originalSaveAccessToken = memoryOAuthDb.saveAccessToken.bind(memoryOAuthDb);
const originalGetAccessToken = memoryOAuthDb.getAccessToken.bind(memoryOAuthDb);

memoryOAuthDb.saveAccessToken = async (userId, url, token) => {
  console.log('🟢 DEBUG: saveAccessToken called with:', { userId, url, tokenLength: token.accessToken?.length });
  return originalSaveAccessToken(userId, url, token);
};

memoryOAuthDb.getAccessToken = async (userId, url) => {
  console.log('🔍 DEBUG: getAccessToken called with:', { userId, url });
  const result = await originalGetAccessToken(userId, url);
  console.log('🔍 DEBUG: getAccessToken returned:', result ? 'TOKEN_FOUND' : 'NO_TOKEN');
  return result;
};

// Configure ATXP server with proper OAuth configuration
app.use(atxpServer({
  destination: PAYMENT_DESTINATION,
  resource: `https://moluabi-mcp-server.replit.app/` as UrlString,
  server: 'https://auth.atxp.ai' as UrlString,
  mountPath: '/',
  payeeName: 'MoluAbi MCP Server',
  oAuthDb: memoryOAuthDb,
  logger: new ConsoleLogger({ level: LogLevel.INFO }),
}));


// Create our transport instance
const transport: StreamableHTTPServerTransport = new StreamableHTTPServerTransport({
  sessionIdGenerator: undefined, // set to undefined for stateless servers
});

// Define all 10 agent management tools with ATXP payments

// Tool 1: Create Agent - $0.05 USDC
server.tool(
  "create_agent",
  "Create a new AI agent with crypto payment",
  {
    name: z.string().describe("The name of the agent"),
    description: z.string().describe("Description of the agent"),
    instructions: z.string().describe("Instructions for the agent"),
    type: z.string().describe("Type of agent"),
    isPublic: z.boolean().optional().describe("Whether the agent is public"),
    apiKey: z.string().describe("MoluAbi API key")
  },
  async (args) => {
    console.log('🛠️ create_agent tool called');
    
    // TODO: REMOVE THIS PAYMENT BYPASS AFTER ATXP AUTH IS FIXED
    let paymentStatus = "success";
    try {
      await requirePayment({price: BigNumber(0.05)});
      console.log('💰 Payment validated for create_agent');
    } catch (error) {
      console.log('❌ Payment failed for create_agent, continuing anyway:', error);
      paymentStatus = "failed";
    }
    // END PAYMENT BYPASS SECTION
    
    try {
      const agent = await platformClient.createAgent(args.apiKey, {
        name: args.name,
        description: args.description,
        instructions: args.instructions,
        type: args.type,
        isPublic: args.isPublic || false
      });
      
      // TODO: REMOVE PAYMENT STATUS LOGIC AFTER ATXP AUTH IS FIXED
      const statusPrefix = paymentStatus === "failed" ? "[PAYMENT_FAILED] " : "";
      const paymentNote = paymentStatus === "failed" ? " (Payment validation failed - running in test mode)" : ". Payment of $0.05 USDC processed";
      
      return {
        content: [
          {
            type: "text",
            text: `${statusPrefix}Agent created successfully! ID: ${agent.id}, Name: ${agent.name}${paymentNote}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to create agent: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  }
);

// Tool 2: List Agents - $0.001 USDC
server.tool(
  "list_agents",
  "List all agents with crypto payment",
  {
    apiKey: z.string().describe("MoluAbi API key")
  },
  async (args) => {
    console.log('🛠️ list_agents tool called');
    
    // Try payment but continue regardless of result
    let paymentStatus = "success";
    try {
      console.log('💳 Attempting payment charge: $0.001 USDC');
      await requirePayment({price: BigNumber(0.001)});
      console.log('💰 Payment validated for list_agents');
    } catch (paymentError) {
      console.log('❌ Payment failed for list_agents, continuing anyway:', paymentError);
      paymentStatus = "failed";
    }
    
    try {
      const agents = await platformClient.listAgents(args.apiKey);
      
      // Include payment status in response
      const statusPrefix = paymentStatus === "failed" ? "[PAYMENT_FAILED] " : "";
      const paymentNote = paymentStatus === "failed" ? " (Payment validation failed - running in test mode)" : ". Payment of $0.001 USDC processed";
      
      return {
        content: [
          {
            type: "text",
            text: `${statusPrefix}Found ${agents.length} agents${paymentNote}\n\n${JSON.stringify(agents, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to list agents: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  }
);

// Tool 3: Get Agent - $0.001 USDC
server.tool(
  "get_agent",
  "Get agent details with crypto payment",
  {
    agentId: z.string().describe("The ID of the agent"),
    apiKey: z.string().describe("MoluAbi API key")
  },
  async (args) => {
    console.log('🛠️ get_agent tool called');
    
    // TODO: REMOVE THIS PAYMENT BYPASS AFTER ATXP AUTH IS FIXED
    let paymentStatus = "success";
    try {
      await requirePayment({price: BigNumber(0.001)});
      console.log('💰 Payment validated for get_agent');
    } catch (error) {
      console.log('❌ Payment failed for get_agent, continuing anyway:', error);
      paymentStatus = "failed";
    }
    // END PAYMENT BYPASS SECTION
    
    try {
      const agent = await platformClient.getAgent(args.apiKey, parseInt(args.agentId));
      
      // TODO: REMOVE PAYMENT STATUS LOGIC AFTER ATXP AUTH IS FIXED
      const statusPrefix = paymentStatus === "failed" ? "[PAYMENT_FAILED] " : "";
      const paymentNote = paymentStatus === "failed" ? " (Payment validation failed - running in test mode)" : ". Payment of $0.001 USDC processed";
      
      return {
        content: [
          {
            type: "text",
            text: `${statusPrefix}Agent details retrieved${paymentNote}\n\n${JSON.stringify(agent, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to get agent: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  }
);

// Tool 4: Update Agent - $0.02 USDC
server.tool(
  "update_agent",
  "Update agent with crypto payment",
  {
    agentId: z.string().describe("The ID of the agent"),
    name: z.string().optional().describe("New name"),
    description: z.string().optional().describe("New description"),
    instructions: z.string().optional().describe("New instructions"),
    type: z.string().optional().describe("Agent type"),
    isPublic: z.boolean().optional().describe("Whether the agent is public"),
    apiKey: z.string().describe("MoluAbi API key")
  },
  async (args) => {
    console.log('🛠️ update_agent tool called');
    
    // TODO: REMOVE THIS PAYMENT BYPASS AFTER ATXP AUTH IS FIXED
    let paymentStatus = "success";
    try {
      await requirePayment({price: BigNumber(0.02)});
      console.log('💰 Payment validated for update_agent');
    } catch (error) {
      console.log('❌ Payment failed for update_agent, continuing anyway:', error);
      paymentStatus = "failed";
    }
    // END PAYMENT BYPASS SECTION
    
    try {
      const agent = await platformClient.updateAgent(args.apiKey, parseInt(args.agentId), {
        name: args.name,
        description: args.description,
        instructions: args.instructions,
        type: args.type,
        isPublic: args.isPublic
      });
      
      // TODO: REMOVE PAYMENT STATUS LOGIC AFTER ATXP AUTH IS FIXED
      const statusPrefix = paymentStatus === "failed" ? "[PAYMENT_FAILED] " : "";
      const paymentNote = paymentStatus === "failed" ? " (Payment validation failed - running in test mode)" : ". Payment of $0.02 USDC processed";
      
      return {
        content: [
          {
            type: "text",
            text: `${statusPrefix}Agent updated successfully! ${paymentNote}\n\n${JSON.stringify(agent, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to update agent: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  }
);

// Tool 5: Delete Agent - $0.01 USDC
server.tool(
  "delete_agent",
  "Delete agent with crypto payment",
  {
    agentId: z.string().describe("The ID of the agent"),
    apiKey: z.string().describe("MoluAbi API key")
  },
  async (args) => {
    console.log('🛠️ delete_agent tool called');
    
    // TODO: REMOVE THIS PAYMENT BYPASS AFTER ATXP AUTH IS FIXED
    let paymentStatus = "success";
    try {
      await requirePayment({price: BigNumber(0.01)});
      console.log('💰 Payment validated for delete_agent');
    } catch (error) {
      console.log('❌ Payment failed for delete_agent, continuing anyway:', error);
      paymentStatus = "failed";
    }
    // END PAYMENT BYPASS SECTION
    
    try {
      await platformClient.deleteAgent(args.apiKey, parseInt(args.agentId));
      
      // TODO: REMOVE PAYMENT STATUS LOGIC AFTER ATXP AUTH IS FIXED
      const statusPrefix = paymentStatus === "failed" ? "[PAYMENT_FAILED] " : "";
      const paymentNote = paymentStatus === "failed" ? " (Payment validation failed - running in test mode)" : ". Payment of $0.01 USDC processed";
      
      return {
        content: [
          {
            type: "text",
            text: `${statusPrefix}Agent deleted successfully!${paymentNote}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to delete agent: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  }
);

// Tool 6: Prompt Agent - $0.01 USDC
server.tool(
  "prompt_agent",
  "Send prompt to agent with crypto payment",
  {
    agentId: z.string().describe("The ID of the agent"),
    prompt: z.string().describe("The prompt to send"),
    apiKey: z.string().describe("MoluAbi API key")
  },
  async (args) => {
    console.log('🛠️ prompt_agent tool called');
    
    // TODO: REMOVE THIS PAYMENT BYPASS AFTER ATXP AUTH IS FIXED
    let paymentStatus = "success";
    try {
      await requirePayment({price: BigNumber(0.01)});
      console.log('💰 Payment validated for prompt_agent');
    } catch (error) {
      console.log('❌ Payment failed for prompt_agent, continuing anyway:', error);
      paymentStatus = "failed";
    }
    // END PAYMENT BYPASS SECTION
    
    try {
      const response = await platformClient.promptAgent(args.apiKey, parseInt(args.agentId), args.prompt);
      
      // TODO: REMOVE PAYMENT STATUS LOGIC AFTER ATXP AUTH IS FIXED
      const statusPrefix = paymentStatus === "failed" ? "[PAYMENT_FAILED] " : "";
      const paymentNote = paymentStatus === "failed" ? " (Payment validation failed - running in test mode)" : ". Payment of $0.01 USDC processed";
      
      return {
        content: [
          {
            type: "text",
            text: `${statusPrefix}Agent response received${paymentNote}\n\nResponse: ${response}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to prompt agent: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  }
);

// Tool 7: Add User to Agent - $0.005 USDC
server.tool(
  "add_user_to_agent",
  "Add user to agent with crypto payment",
  {
    agentId: z.string().describe("The ID of the agent"),
    userEmail: z.string().describe("Email of user to add"),
    apiKey: z.string().describe("MoluAbi API key")
  },
  async (args) => {
    console.log('🛠️ add_user_to_agent tool called');
    
    // TODO: REMOVE THIS PAYMENT BYPASS AFTER ATXP AUTH IS FIXED
    let paymentStatus = "success";
    try {
      await requirePayment({price: BigNumber(0.005)});
      console.log('💰 Payment validated for add_user_to_agent');
    } catch (error) {
      console.log('❌ Payment failed for add_user_to_agent, continuing anyway:', error);
      paymentStatus = "failed";
    }
    // END PAYMENT BYPASS SECTION
    
    try {
      await platformClient.addUserToAgent(args.apiKey, parseInt(args.agentId), args.userEmail);
      
      // TODO: REMOVE PAYMENT STATUS LOGIC AFTER ATXP AUTH IS FIXED
      const statusPrefix = paymentStatus === "failed" ? "[PAYMENT_FAILED] " : "";
      const paymentNote = paymentStatus === "failed" ? " (Payment validation failed - running in test mode)" : ". Payment of $0.005 USDC processed";
      
      return {
        content: [
          {
            type: "text",
            text: `${statusPrefix}User ${args.userEmail} added to agent successfully!${paymentNote}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to add user to agent: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  }
);

// Tool 8: Remove User from Agent - $0.005 USDC
server.tool(
  "remove_user_from_agent",
  "Remove user from agent with crypto payment",
  {
    agentId: z.string().describe("The ID of the agent"),
    userEmail: z.string().describe("Email of user to remove"),
    apiKey: z.string().describe("MoluAbi API key")
  },
  async (args) => {
    console.log('🛠️ remove_user_from_agent tool called');
    
    // TODO: REMOVE THIS PAYMENT BYPASS AFTER ATXP AUTH IS FIXED
    let paymentStatus = "success";
    try {
      await requirePayment({price: BigNumber(0.005)});
      console.log('💰 Payment validated for remove_user_from_agent');
    } catch (error) {
      console.log('❌ Payment failed for remove_user_from_agent, continuing anyway:', error);
      paymentStatus = "failed";
    }
    // END PAYMENT BYPASS SECTION
    
    try {
      await platformClient.removeUserFromAgent(args.apiKey, parseInt(args.agentId), args.userEmail);
      
      // TODO: REMOVE PAYMENT STATUS LOGIC AFTER ATXP AUTH IS FIXED
      const statusPrefix = paymentStatus === "failed" ? "[PAYMENT_FAILED] " : "";
      const paymentNote = paymentStatus === "failed" ? " (Payment validation failed - running in test mode)" : ". Payment of $0.005 USDC processed";
      
      return {
        content: [
          {
            type: "text",
            text: `${statusPrefix}User ${args.userEmail} removed from agent successfully!${paymentNote}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to remove user from agent: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  }
);

// Tool 9: Get Usage Report - $0.002 USDC
server.tool(
  "get_usage_report",
  "Get usage report with crypto payment",
  {
    days: z.number().optional().describe("Number of days to report"),
    apiKey: z.string().describe("MoluAbi API key")
  },
  async (args) => {
    console.log('🛠️ get_usage_report tool called');
    
    // TODO: REMOVE THIS PAYMENT BYPASS AFTER ATXP AUTH IS FIXED
    let paymentStatus = "success";
    try {
      await requirePayment({price: BigNumber(0.002)});
      console.log('💰 Payment validated for get_usage_report');
    } catch (error) {
      console.log('❌ Payment failed for get_usage_report, continuing anyway:', error);
      paymentStatus = "failed";
    }
    // END PAYMENT BYPASS SECTION
    
    try {
      const report = await platformClient.getUsageReport(args.apiKey, args.days);
      
      // TODO: REMOVE PAYMENT STATUS LOGIC AFTER ATXP AUTH IS FIXED
      const statusPrefix = paymentStatus === "failed" ? "[PAYMENT_FAILED] " : "";
      const paymentNote = paymentStatus === "failed" ? " (Payment validation failed - running in test mode)" : ". Payment of $0.002 USDC processed";
      
      return {
        content: [
          {
            type: "text",
            text: `${statusPrefix}Usage report generated${paymentNote}\n\n${JSON.stringify(report, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to get usage report: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  }
);

// Tool 10: Get Pricing - $0.001 USDC
server.tool(
  "get_pricing",
  "Get pricing information with crypto payment",
  {
    apiKey: z.string().describe("MoluAbi API key")
  },
  async (args) => {
    console.log('🛠️ get_pricing tool called');
    
    // TODO: REMOVE THIS PAYMENT BYPASS AFTER ATXP AUTH IS FIXED
    let paymentStatus = "success";
    try {
      await requirePayment({price: BigNumber(0.001)});
      console.log('💰 Payment validated for get_pricing');
    } catch (error) {
      console.log('❌ Payment failed for get_pricing, continuing anyway:', error);
      paymentStatus = "failed";
    }
    // END PAYMENT BYPASS SECTION
    
    // Return pricing information
    const pricing = {
      tools: {
        create_agent: "$0.05",
        list_agents: "$0.001",
        get_agent: "$0.001", 
        update_agent: "$0.02",
        delete_agent: "$0.01",
        prompt_agent: "$0.01",
        add_user_to_agent: "$0.005",
        remove_user_from_agent: "$0.005",
        get_usage_report: "$0.002",
        get_pricing: "$0.001"
      },
      currency: "USDC",
      payment_method: "ATXP (crypto)"
    };
    
    // TODO: REMOVE PAYMENT STATUS LOGIC AFTER ATXP AUTH IS FIXED
    const statusPrefix = paymentStatus === "failed" ? "[PAYMENT_FAILED] " : "";
    const paymentNote = paymentStatus === "failed" ? " (Payment validation failed - running in test mode)" : ". Payment of $0.001 USDC processed";
    
    return {
      content: [
        {
          type: "text",
          text: `${statusPrefix}Pricing information retrieved${paymentNote}\n\n${JSON.stringify(pricing, null, 2)}`,
        },
      ],
    };
  }
);

// Setup routes for the server
const setupServer = async () => {
  await server.connect(transport);
  console.log('✅ MCP server connected to transport');
};

// Setup the URL endpoint that will handle MCP requests - EXACT official pattern
app.post('/', async (req: Request, res: Response) => {
  console.log('🔥 ATXP MCP request received:', req.body);
  console.log('🔐 Authorization header:', req.headers.authorization ? 'BEARER_TOKEN_PRESENT' : 'NO_AUTH_HEADER');
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
    console.log('🛠️ Available tools: 10 agent management tools');
    console.log('🔐 Authentication: ATXP OAuth + Crypto payments');
    console.log(`🌐 Server URL: https://moluabi-mcp-server.replit.app/`);
  });
}).catch(error => {
  console.error('❌ Failed to set up the server:', error);
  process.exit(1);
});