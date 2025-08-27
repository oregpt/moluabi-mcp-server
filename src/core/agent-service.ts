import { eq, and, or, desc } from "drizzle-orm";
import { 
  db, 
  agents, 
  users, 
  agentAccess, 
  usageRecords,
  type Agent, 
  type User, 
  type InsertAgent,
  type UsageRecord 
} from "./database.js";

export interface CreateAgentRequest {
  name: string;
  description?: string;
  instructions?: string;
  userId: string;
  organizationId?: string;
  type?: string;
  isPublic?: boolean;
  isShareable?: boolean;
}

export interface UpdateAgentRequest {
  name?: string;
  description?: string;
  instructions?: string;
  type?: string;
  isPublic?: boolean;
  isShareable?: boolean;
}

export interface AgentInteractionRequest {
  agentId: number;
  userId: string;
  message: string;
}

export interface AgentInteractionResponse {
  response: string;
  tokensUsed: number;
  cost: number;
}

export class AgentService {
  /**
   * Create a new AI agent with the specified configuration
   */
  async createAgent(request: CreateAgentRequest): Promise<Agent> {
    // Validate that the user exists
    const [user] = await db.select().from(users).where(eq(users.id, request.userId));
    if (!user) {
      throw new Error(`User with ID ${request.userId} not found`);
    }

    const agentData: InsertAgent = {
      name: request.name,
      description: request.description || null,
      instructions: request.instructions || null,
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
    console.log(`✅ Created agent: ${agent.name} (ID: ${agent.id})`);
    return agent;
  }

  /**
   * Get a specific agent by ID (with permission check)
   */
  async getAgent(agentId: number, userId: string): Promise<Agent | null> {
    const [agent] = await db.select().from(agents).where(eq(agents.id, agentId));
    if (!agent) {
      return null;
    }

    // Check if user has access to this agent
    const hasAccess = await this.checkAgentAccess(agentId, userId);
    if (!hasAccess) {
      throw new Error(`Access denied to agent ${agentId}`);
    }

    return agent;
  }

  /**
   * Update an existing agent (owner only)
   */
  async updateAgent(agentId: number, userId: string, updates: UpdateAgentRequest): Promise<Agent | null> {
    // Verify ownership
    const [agent] = await db.select().from(agents).where(
      and(eq(agents.id, agentId), eq(agents.ownerId, userId))
    );
    
    if (!agent) {
      throw new Error(`Agent ${agentId} not found or access denied`);
    }

    const [updatedAgent] = await db
      .update(agents)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(agents.id, agentId))
      .returning();

    console.log(`✅ Updated agent: ${updatedAgent.name} (ID: ${updatedAgent.id})`);
    return updatedAgent;
  }

  /**
   * List all agents accessible to the user
   */
  async listAgents(userId: string, limit: number = 50): Promise<Agent[]> {
    // Get agents owned by the user
    const ownedAgents = await db
      .select()
      .from(agents)
      .where(eq(agents.ownerId, userId))
      .orderBy(desc(agents.createdAt))
      .limit(limit);
    
    // Get agents the user has access to
    const accessibleAgents = await db
      .select({ agent: agents })
      .from(agentAccess)
      .innerJoin(agents, eq(agentAccess.agentId, agents.id))
      .where(eq(agentAccess.userId, userId))
      .orderBy(desc(agents.createdAt))
      .limit(limit);

    // Combine and deduplicate
    const allAgents = [...ownedAgents, ...accessibleAgents.map(a => a.agent)];
    const uniqueAgents = Array.from(
      new Map(allAgents.map(agent => [agent.id, agent])).values()
    );

    return uniqueAgents.slice(0, limit);
  }

  /**
   * Delete an agent (owner only)
   */
  async deleteAgent(agentId: number, userId: string): Promise<boolean> {
    const [agent] = await db.select().from(agents).where(
      and(eq(agents.id, agentId), eq(agents.ownerId, userId))
    );
    
    if (!agent) {
      return false;
    }

    await db.delete(agents).where(eq(agents.id, agentId));
    console.log(`🗑️ Deleted agent: ${agent.name} (ID: ${agent.id})`);
    return true;
  }

  /**
   * Grant user access to an agent
   */
  async addUserToAgent(agentId: number, userEmail: string, ownerId: string): Promise<boolean> {
    // Verify the requesting user owns the agent
    const [agent] = await db.select().from(agents).where(
      and(eq(agents.id, agentId), eq(agents.ownerId, ownerId))
    );
    
    if (!agent) {
      throw new Error(`Agent ${agentId} not found or access denied`);
    }

    // Find the user to grant access to
    const [user] = await db.select().from(users).where(eq(users.email, userEmail));
    if (!user) {
      throw new Error(`User with email ${userEmail} not found`);
    }

    try {
      await db.insert(agentAccess).values({
        agentId,
        userId: user.id,
      });
      console.log(`✅ Granted access to agent ${agentId} for user ${userEmail}`);
      return true;
    } catch (error) {
      // Handle duplicate access gracefully
      console.log(`⚠️ User ${userEmail} already has access to agent ${agentId}`);
      return false;
    }
  }

  /**
   * Remove user access from an agent
   */
  async removeUserFromAgent(agentId: number, userEmail: string, ownerId: string): Promise<boolean> {
    // Verify the requesting user owns the agent
    const [agent] = await db.select().from(agents).where(
      and(eq(agents.id, agentId), eq(agents.ownerId, ownerId))
    );
    
    if (!agent) {
      throw new Error(`Agent ${agentId} not found or access denied`);
    }

    // Find the user to remove access from
    const [user] = await db.select().from(users).where(eq(users.email, userEmail));
    if (!user) {
      throw new Error(`User with email ${userEmail} not found`);
    }

    const result = await db.delete(agentAccess).where(
      and(eq(agentAccess.agentId, agentId), eq(agentAccess.userId, user.id))
    );

    console.log(`🚫 Removed access to agent ${agentId} for user ${userEmail}`);
    return true;
  }

  /**
   * Interact with an agent (simulate AI response)
   */
  async promptAgent(request: AgentInteractionRequest): Promise<AgentInteractionResponse> {
    // Verify access to the agent
    const agent = await this.getAgent(request.agentId, request.userId);
    if (!agent) {
      throw new Error(`Agent ${request.agentId} not found or access denied`);
    }

    // Simulate AI response (in real implementation, this would call an AI service)
    const response = await this.generateAIResponse(agent, request.message);
    const tokensUsed = Math.floor(Math.random() * 200) + 50; // Simulate token usage
    const cost = tokensUsed * 0.0001; // $0.0001 per token

    return {
      response,
      tokensUsed,
      cost
    };
  }

  /**
   * Get usage report for a user
   */
  async getUsageReport(userId: string, days: number = 30): Promise<{
    totalCost: number;
    totalTokens: number;
    totalInteractions: number;
    breakdown: UsageRecord[];
  }> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const records = await db
      .select()
      .from(usageRecords)
      .where(and(
        eq(usageRecords.userId, userId),
        eq(usageRecords.createdAt, since)
      ))
      .orderBy(desc(usageRecords.createdAt));

    const totalCost = records.reduce((sum, record) => sum + (record.cost || 0), 0);
    const totalTokens = records.reduce((sum, record) => sum + (record.tokensUsed || 0), 0);

    return {
      totalCost: totalCost / 100, // Convert cents to dollars
      totalTokens,
      totalInteractions: records.length,
      breakdown: records
    };
  }

  /**
   * Get current pricing information
   */
  async getPricing(): Promise<{
    models: Record<string, { inputCost: number; outputCost: number }>;
    operations: Record<string, number>;
  }> {
    return {
      models: {
        "gpt-4": { inputCost: 0.03, outputCost: 0.06 }, // per 1K tokens
        "gpt-3.5-turbo": { inputCost: 0.0015, outputCost: 0.002 },
        "claude-3": { inputCost: 0.025, outputCost: 0.075 }
      },
      operations: {
        "create_agent": 0.05,
        "prompt_agent": 0.01,
        "list_agents": 0.001,
        "get_agent": 0.001
      }
    };
  }

  /**
   * Check if a user has access to an agent
   */
  private async checkAgentAccess(agentId: number, userId: string): Promise<boolean> {
    const [agent] = await db.select().from(agents).where(eq(agents.id, agentId));
    if (!agent) return false;

    // Owner has access
    if (agent.ownerId === userId) return true;

    // Public agents are accessible to all
    if (agent.isPublic) return true;

    // Check granted access
    const [access] = await db.select().from(agentAccess).where(
      and(eq(agentAccess.agentId, agentId), eq(agentAccess.userId, userId))
    );
    
    return !!access;
  }

  /**
   * Generate AI response (placeholder implementation)
   */
  private async generateAIResponse(agent: Agent, message: string): Promise<string> {
    // This is a placeholder - in real implementation, this would integrate with
    // actual AI services like OpenAI, Anthropic, etc.
    
    const responses = [
      `Based on my instructions as ${agent.name}, I can help you with that. ${message}`,
      `As an AI assistant named ${agent.name}, I understand your request about: "${message}". Let me provide you with a helpful response.`,
      `Hello! I'm ${agent.name}. Regarding your question about "${message}", here's what I can tell you...`,
      `Thank you for your message. As ${agent.name}, I'm designed to help with queries like yours: "${message}".`
    ];

    const randomResponse = responses[Math.floor(Math.random() * responses.length)];
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return randomResponse + " This is a simulated response for demonstration purposes.";
  }
}
