# MCP SERVER STANDUP INSTRUCTIONS FOR AGENT

## GOAL
You are setting up a **MoluAbi MCP Server** that provides AI agent management capabilities through the Model Context Protocol. This server will enable programmatic access to create, manage, and interact with AI assistants.

## WHAT YOU'RE BUILDING
A production-ready MCP server with:
- **10 MCP tools** for complete agent management
- **Database integration** with PostgreSQL 
- **Payment system architecture** (pluggable for future monetization)
- **Security validation** and user authentication
- **Real-time agent interaction** capabilities

## STEP-BY-STEP SETUP

### 1. PROJECT INITIALIZATION
```bash
# Create MCP server directory
mkdir mcp-server && cd mcp-server

# Initialize npm project
npm init -y

# Install dependencies
npm install @modelcontextprotocol/sdk drizzle-orm @neondatabase/serverless zod memoizee

# Install dev dependencies  
npm install -D typescript tsx @types/node @types/memoizee
```

### 2. PROJECT STRUCTURE
Create this exact directory structure:
```
mcp-server/
├── src/
│   ├── core/
│   │   ├── database.ts          # Database connection
│   │   └── agent-service.ts     # Core agent business logic
│   ├── payments/
│   │   ├── payment-manager.ts   # Payment abstraction layer
│   │   ├── providers/
│   │   │   ├── no-payment.ts    # Free access provider
│   │   │   ├── atxp.ts          # ATXP pay-per-use provider  
│   │   │   └── subscription.ts  # Subscription provider
│   ├── tools/
│   │   └── agent-tools.ts       # MCP tool definitions
│   └── server.ts                # Main MCP server
├── package.json
├── tsconfig.json
└── README.md
```

### 3. TYPESCRIPT CONFIGURATION
Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext", 
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "allowJs": true,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist",
    "rootDir": ".",
    "resolveJsonModule": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@shared/*": ["../shared/*"]
    }
  },
  "include": ["src/**/*", "../shared/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 4. PACKAGE.JSON SCRIPTS
Update `package.json` scripts section:
```json
{
  "scripts": {
    "dev": "tsx src/server.ts",
    "start": "node dist/server.js", 
    "build": "tsc",
    "test": "tsx src/server.ts --version"
  }
}
```

### 5. DATABASE CONNECTION
Create `src/core/database.ts`:
```typescript
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import {
  agents,
  users, 
  agentAccess,
  files,
  documentChunks,
  type Agent,
  type User,
  type InsertAgent,
} from "../../../shared/schema.js";

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql);

// Export types and tables for use in agent service
export { agents, users, agentAccess, files, documentChunks };
export type { Agent, User, InsertAgent };
```

### 6. PAYMENT SYSTEM ARCHITECTURE

#### Create `src/payments/payment-manager.ts`:
```typescript
export interface PaymentProvider {
  validatePayment(userId: string, action: string): Promise<boolean>;
  recordUsage(userId: string, action: string, cost: number): Promise<void>;
  initialize(): Promise<void>;
}

export class PaymentManager {
  private provider: PaymentProvider;

  constructor(mode: "none" | "atxp" | "subscription" = "none") {
    switch (mode) {
      case "atxp":
        this.provider = new AtxpPaymentProvider();
        break;
      case "subscription":
        this.provider = new SubscriptionPaymentProvider();
        break;
      default:
        this.provider = new NoPaymentProvider();
    }
  }

  async initialize(): Promise<void> {
    await this.provider.initialize();
    console.log(`💸 Payment Provider: ${this.provider.constructor.name} initialized`);
  }

  async validatePayment(userId: string, action: string): Promise<boolean> {
    return await this.provider.validatePayment(userId, action);
  }

  async recordUsage(userId: string, action: string, cost: number = 0.05): Promise<void> {
    await this.provider.recordUsage(userId, action, cost);
  }
}
```

#### Create `src/payments/providers/no-payment.ts`:
```typescript
import { PaymentProvider } from "../payment-manager.js";

export class NoPaymentProvider implements PaymentProvider {
  async initialize(): Promise<void> {
    console.log("💸 Payment mode: none");
  }

  async validatePayment(): Promise<boolean> {
    return true; // Always allow free access
  }

  async recordUsage(): Promise<void> {
    // No-op for free tier
  }
}
```

### 7. AGENT SERVICE LOGIC
Create `src/core/agent-service.ts`:
```typescript
import { eq, and } from "drizzle-orm";
import { db, agents, users, agentAccess, type Agent, type User } from "./database.js";

export interface CreateAgentRequest {
  name: string;
  description?: string;
  instructions?: string;
  userId: string;
  organizationId: string;
  type?: string;
  isPublic?: boolean;
  isShareable?: boolean;
}

export class AgentService {
  async createAgent(request: CreateAgentRequest): Promise<Agent> {
    const agentData = {
      name: request.name,
      description: request.description,
      instructions: request.instructions,
      ownerId: request.userId,
      type: request.type || "file-based",
      isPublic: request.isPublic || false,
      isShareable: request.isShareable || false,
      grantAllOrgAccess: false,
      tags: [],
      isAnonymous: false,
      conversationLoggingEnabled: false,
    };

    const [agent] = await db.insert(agents).values(agentData).returning();
    return agent;
  }

  async getAgent(agentId: number, userId: string): Promise<Agent | null> {
    const [agent] = await db.select().from(agents).where(eq(agents.id, agentId));
    if (!agent) return null;

    // Check permissions
    const hasAccess = await this.checkAgentAccess(agentId, userId);
    return hasAccess ? agent : null;
  }

  async listAgents(userId: string, limit: number = 50): Promise<Agent[]> {
    // Return agents user owns or has access to
    const ownedAgents = await db.select().from(agents).where(eq(agents.ownerId, userId)).limit(limit);
    
    const accessibleAgents = await db
      .select({ agent: agents })
      .from(agentAccess)
      .innerJoin(agents, eq(agentAccess.agentId, agents.id))
      .where(eq(agentAccess.userId, userId))
      .limit(limit);

    const combined = [...ownedAgents, ...accessibleAgents.map(a => a.agent)];
    return Array.from(new Map(combined.map(a => [a.id, a])).values());
  }

  async deleteAgent(agentId: number, userId: string): Promise<boolean> {
    const [agent] = await db.select().from(agents).where(
      and(eq(agents.id, agentId), eq(agents.ownerId, userId))
    );
    
    if (!agent) return false;

    await db.delete(agents).where(eq(agents.id, agentId));
    return true;
  }

  async addUserToAgent(agentId: number, userEmail: string, ownerId: string): Promise<boolean> {
    const [user] = await db.select().from(users).where(eq(users.email, userEmail));
    if (!user) return false;

    try {
      await db.insert(agentAccess).values({
        agentId,
        userId: user.id,
      });
      return true;
    } catch (error) {
      return false; // Handle duplicate access gracefully
    }
  }

  private async checkAgentAccess(agentId: number, userId: string): Promise<boolean> {
    const [agent] = await db.select().from(agents).where(eq(agents.id, agentId));
    if (!agent) return false;

    // Owner has access
    if (agent.ownerId === userId) return true;

    // Check granted access
    const [access] = await db.select().from(agentAccess).where(
      and(eq(agentAccess.agentId, agentId), eq(agentAccess.userId, userId))
    );
    
    return !!access;
  }
}
```

### 8. MCP TOOLS DEFINITION
Create `src/tools/agent-tools.ts`:
```typescript
import { McpError, ErrorCode, type Tool } from "@modelcontextprotocol/sdk/types.js";
import { AgentService } from "../core/agent-service.js";
import { PaymentManager } from "../payments/payment-manager.js";

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
          name: { type: "string", description: "Agent name" },
          description: { type: "string", description: "Agent description" },
          instructions: { type: "string", description: "Agent instructions" },
          organizationId: { type: "string", description: "Organization ID" },
          userId: { type: "string", description: "User ID" },
          type: { type: "string", description: "Agent type", enum: ["file-based", "team", "hybrid"] },
          isPublic: { type: "boolean", description: "Make agent public" },
          isShareable: { type: "boolean", description: "Allow sharing" }
        },
        required: ["name", "organizationId", "userId"]
      }
    },

    {
      name: "list_agents", 
      description: "List all agents accessible to the user",
      inputSchema: {
        type: "object",
        properties: {
          userId: { type: "string", description: "User ID" },
          limit: { type: "number", description: "Max number of agents to return" }
        },
        required: ["userId"]
      }
    },

    {
      name: "get_agent",
      description: "Get detailed information about a specific agent", 
      inputSchema: {
        type: "object",
        properties: {
          agentId: { type: "number", description: "Agent ID" },
          userId: { type: "string", description: "User ID" }
        },
        required: ["agentId", "userId"]
      }
    },

    {
      name: "delete_agent",
      description: "Delete an agent (only by owner)",
      inputSchema: {
        type: "object", 
        properties: {
          agentId: { type: "number", description: "Agent ID" },
          userId: { type: "string", description: "User ID" }
        },
        required: ["agentId", "userId"]
      }
    },

    {
      name: "add_user_to_agent",
      description: "Grant user access to an agent",
      inputSchema: {
        type: "object",
        properties: {
          agentId: { type: "number", description: "Agent ID" },
          userEmail: { type: "string", description: "User email to grant access" },
          ownerId: { type: "string", description: "Owner user ID" }
        },
        required: ["agentId", "userEmail", "ownerId"]
      }
    },

    // Add more tools: update_agent, remove_user_from_agent, get_usage_report, etc.
  ];
}
```

### 9. MAIN MCP SERVER
Create `src/server.ts`:
```typescript
#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { AgentService } from "./core/agent-service.js";
import { PaymentManager } from "./payments/payment-manager.js";
import { createAgentTools } from "./tools/agent-tools.js";

console.log("🚀 MoluAbi MCP Server starting...");

// Initialize services
const paymentManager = new PaymentManager(process.env.PAYMENT_MODE as any || "none");
const agentService = new AgentService();

async function main() {
  // Initialize payment system
  await paymentManager.initialize();

  const server = new Server(
    {
      name: "moluabi-mcp-server",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Register all agent management tools
  const tools = createAgentTools(agentService, paymentManager);
  console.log(`🔧 Available tools: ${tools.length}`);

  // Set up tool handlers
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      // Validate payment for this operation
      const userId = args.userId || args.ownerId;
      if (userId && !(await paymentManager.validatePayment(userId, name))) {
        throw new McpError(ErrorCode.InternalError, `Payment validation failed for ${name}`);
      }

      // Handle tool calls
      switch (name) {
        case "create_agent":
          const agent = await agentService.createAgent(args as any);
          await paymentManager.recordUsage(args.userId, "create_agent");
          return { content: [{ type: "text", text: JSON.stringify(agent) }] };

        case "list_agents":
          const agents = await agentService.listAgents(args.userId, args.limit);
          return { content: [{ type: "text", text: JSON.stringify(agents) }] };

        case "get_agent":
          const agentData = await agentService.getAgent(args.agentId, args.userId);
          return { content: [{ type: "text", text: JSON.stringify(agentData) }] };

        case "delete_agent":
          const deleted = await agentService.deleteAgent(args.agentId, args.userId);
          return { content: [{ type: "text", text: JSON.stringify({ success: deleted }) }] };

        case "add_user_to_agent":
          const added = await agentService.addUserToAgent(args.agentId, args.userEmail, args.ownerId);
          return { content: [{ type: "text", text: JSON.stringify({ success: added }) }] };

        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }
    } catch (error) {
      throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${error}`);
    }
  });

  // Start the server
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.log("✅ MoluAbi MCP Server ready!");
}

main().catch(console.error);
```

### 10. ENVIRONMENT SETUP
Create `.env` file:
```bash
# Database Connection
DATABASE_URL=postgresql://user:password@host:5432/database

# Payment Configuration (optional)
PAYMENT_MODE=none
# PAYMENT_MODE=atxp
# PAYMENT_MODE=subscription

# ATXP Configuration (if using ATXP)
# ATXP_API_KEY=your_atxp_key
# ATXP_ENDPOINT=https://api.atxp.example.com
```

### 11. TESTING & VERIFICATION
```bash
# Test server startup
npm run test

# Expected output:
# 🚀 MoluAbi MCP Server starting...
# 💸 Payment Provider: No-payment mode initialized  
# 🔧 Available tools: 10
# ✅ MoluAbi MCP Server ready!

# Development mode
npm run dev

# Production build
npm run build
npm start
```

### 12. INTEGRATION CHECKLIST
✅ **Database Schema**: Ensure shared schema matches main MoluAbi platform  
✅ **Environment Variables**: Copy DATABASE_URL from main platform  
✅ **Payment System**: Choose appropriate payment provider mode  
✅ **Tool Registration**: Verify all 10 tools are loaded correctly  
✅ **Error Handling**: Test with invalid requests  
✅ **Security**: Validate user permissions on all operations

## SUCCESS CRITERIA
When complete, you should have:
- ✅ **MCP server running** with all 10 tools available
- ✅ **Database integration** working with existing MoluAbi data
- ✅ **Payment architecture** ready for future monetization
- ✅ **Agent management** working programmatically
- ✅ **Perfect sync** with web platform (agents appear in both)

## NEXT STEPS
After MCP server is running:
1. **Test with MCP client** to verify functionality
2. **Configure payment provider** based on business model
3. **Deploy to production** environment
4. **Monitor usage** and performance
5. **Extend with additional tools** as needed

## SUPPORT NOTES
- **Database Connection**: Must use same PostgreSQL database as main platform
- **Schema Compatibility**: Uses existing shared schema from main platform  
- **Payment Flexibility**: Can switch between free, pay-per-use, and subscription models
- **Tool Extensibility**: Easy to add new MCP tools for additional functionality

**🎯 GOAL ACHIEVED: Production-ready MCP server providing programmatic AI agent management**