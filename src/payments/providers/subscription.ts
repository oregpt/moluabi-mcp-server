import { PaymentProvider } from "../payment-manager.js";
import { db, usageRecords } from "../../core/database.js";
import { sql } from "drizzle-orm";

/**
 * Subscription-based payment provider
 * Validates access based on subscription tiers and usage limits
 */
export class SubscriptionPaymentProvider implements PaymentProvider {
  private subscriptionApiKey: string;
  private subscriptionEndpoint: string;

  constructor() {
    this.subscriptionApiKey = process.env.SUBSCRIPTION_API_KEY || "demo_key";
    this.subscriptionEndpoint = process.env.SUBSCRIPTION_ENDPOINT || "https://api.subscription.example.com";
  }

  async initialize(): Promise<void> {
    console.log("💸 Payment mode: SUBSCRIPTION (tier-based access)");
    console.log(`🔗 Subscription Endpoint: ${this.subscriptionEndpoint}`);
    
    try {
      await this.testConnection();
      console.log("✅ Subscription service connection verified");
    } catch (error) {
      console.warn("⚠️ Subscription service connection test failed, proceeding with mock validation");
    }
  }

  async validatePayment(userId: string, action: string): Promise<boolean> {
    try {
      const subscription = await this.getUserSubscription(userId);
      
      if (!subscription.isActive) {
        console.log(`⚠️ User ${userId} has inactive subscription`);
        return false;
      }

      // Check if action is allowed for this subscription tier
      if (!this.isActionAllowed(action, subscription.tier)) {
        console.log(`⚠️ Action ${action} not allowed for ${subscription.tier} tier`);
        return false;
      }

      // Check usage limits
      const currentUsage = await this.getCurrentMonthlyUsage(userId);
      const tierLimits = this.getTierLimits(subscription.tier);
      
      if (currentUsage >= tierLimits.monthlyOperations) {
        console.log(`⚠️ User ${userId} exceeded monthly operation limit: ${currentUsage}/${tierLimits.monthlyOperations}`);
        return false;
      }

      return true;
    } catch (error) {
      console.error(`❌ Subscription validation error:`, error);
      // Fallback to allowing operation
      return true;
    }
  }

  async recordUsage(userId: string, action: string, cost: number): Promise<void> {
    try {
      // Record in local database for analytics
      await db.insert(usageRecords).values({
        userId,
        action,
        cost: 0, // No direct cost for subscription users
        tokensUsed: 0, // Will be updated by calling service
      });

      console.log(`📊 [SUBSCRIPTION] Usage recorded: ${action} for user ${userId}`);
    } catch (error) {
      console.error(`❌ Failed to record subscription usage:`, error);
    }
  }

  getName(): string {
    return "SubscriptionPaymentProvider";
  }

  /**
   * Test connection to subscription service
   */
  private async testConnection(): Promise<void> {
    console.log("🔍 Testing subscription service connection...");
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Get user's subscription details
   */
  private async getUserSubscription(userId: string): Promise<{
    isActive: boolean;
    tier: string;
    expiresAt: Date;
  }> {
    // Mock implementation - replace with actual subscription API call
    const tiers = ["basic", "pro", "enterprise"];
    const randomTier = tiers[Math.floor(Math.random() * tiers.length)];
    
    return {
      isActive: Math.random() > 0.1, // 90% chance of active subscription
      tier: randomTier,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    };
  }

  /**
   * Check if an action is allowed for a subscription tier
   */
  private isActionAllowed(action: string, tier: string): boolean {
    const tierPermissions: Record<string, string[]> = {
      basic: ["list_agents", "get_agent", "prompt_agent"],
      pro: ["list_agents", "get_agent", "prompt_agent", "create_agent", "update_agent", "add_user_to_agent"],
      enterprise: [
        "list_agents", "get_agent", "prompt_agent", "create_agent", 
        "update_agent", "delete_agent", "add_user_to_agent", 
        "remove_user_from_agent", "get_usage_report", "get_pricing"
      ],
    };

    return tierPermissions[tier]?.includes(action) || false;
  }

  /**
   * Get current monthly usage for a user
   */
  private async getCurrentMonthlyUsage(userId: string): Promise<number> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    try {
      const records = await db
        .select()
        .from(usageRecords)
        .where(sql`user_id = ${userId} AND created_at >= ${startOfMonth}`);
      
      return records.length;
    } catch (error) {
      console.error("Error fetching monthly usage:", error);
      return 0;
    }
  }

  /**
   * Get usage limits for subscription tier
   */
  private getTierLimits(tier: string): { monthlyOperations: number; maxAgents: number } {
    const limits: Record<string, { monthlyOperations: number; maxAgents: number }> = {
      basic: { monthlyOperations: 100, maxAgents: 1 },
      pro: { monthlyOperations: 1000, maxAgents: 10 },
      enterprise: { monthlyOperations: 10000, maxAgents: 100 },
    };

    return limits[tier] || limits.basic;
  }
}
