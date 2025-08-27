import { PlatformAPIClient } from "../platform/api-client.js";

// Initialize platform API client
const platformClient = new PlatformAPIClient(process.env.PLATFORM_API_URL || 'https://app.moluabi.com');

/**
 * AgentService - Now uses platform HTTP API instead of direct database access
 * This ensures all business logic, validation, and security is handled by the main platform
 */
export class AgentService {
  /**
   * Get current pricing information from platform
   */
  async getPricing(): Promise<{
    models: Record<string, { inputCost: number; outputCost: number }>;
    operations: Record<string, number>;
  }> {
    // Static pricing for MCP operations - platform API handles actual AI model pricing
    return {
      models: {
        "gpt-4": { inputCost: 0.03, outputCost: 0.06 }, // per 1K tokens
        "gpt-3.5-turbo": { inputCost: 0.0015, outputCost: 0.002 },
        "claude-3": { inputCost: 0.025, outputCost: 0.075 }
      },
      operations: {
        "create_agent": 0.05,
        "list_agents": 0.001,
        "get_agent": 0.001,
        "update_agent": 0.02,
        "delete_agent": 0.01,
        "prompt_agent": 0.01, // Base cost, actual varies by tokens
        "add_user_to_agent": 0.005,
        "remove_user_from_agent": 0.005,
        "get_usage_report": 0.002,
        "get_pricing": 0.001
      }
    };
  }

  /**
   * DEPRECATED: All agent operations now handled by platform API
   * This service is kept for pricing info and backward compatibility only
   */
}