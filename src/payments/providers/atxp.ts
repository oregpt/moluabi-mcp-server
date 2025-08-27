import { PaymentProvider } from "../payment-manager.js";
import { db, usageRecords } from "../../core/database.js";
import { requirePayment } from "@atxp/server";
import BigNumber from "bignumber.js";

/**
 * ATXP (pay-per-use) payment provider using official ATXP SDK
 * Validates payments on a per-transaction basis
 */
export class AtxpPaymentProvider implements PaymentProvider {
  private walletDestination: string;

  constructor() {
    this.walletDestination = process.env.PAYMENT_DESTINATION || "";
    if (!this.walletDestination) {
      console.warn("⚠️ PAYMENT_DESTINATION not set. ATXP payments will fail.");
    }
  }

  async initialize(): Promise<void> {
    console.log("💸 Payment mode: ATXP (pay-per-use)");
    console.log(`🔗 Payment Destination: ${this.walletDestination ? 'Set' : 'Not Set'}`);
    
    if (this.walletDestination) {
      console.log("✅ ATXP SDK initialized with wallet destination");
    } else {
      console.warn("⚠️ No PAYMENT_DESTINATION set. Please visit https://accounts.atxp.ai/ to get your wallet address");
    }
  }

  async validatePayment(userId: string, action: string): Promise<boolean> {
    if (!this.walletDestination) {
      console.warn("⚠️ No wallet destination set, allowing free access");
      return true;
    }

    try {
      const operationCost = this.getOperationCost(action);
      
      // Use ATXP SDK to require payment
      await requirePayment({ 
        price: new BigNumber(operationCost)
      });
      
      console.log(`✅ ATXP payment validated for ${action}: $${operationCost}`);
      return true;
    } catch (error) {
      console.error(`❌ ATXP payment validation failed for ${action}:`, error);
      return false;
    }
  }

  async recordUsage(userId: string, action: string, cost: number): Promise<void> {
    try {
      // Record in local database for analytics
      await db.insert(usageRecords).values({
        userId,
        action,
        cost: Math.round(cost * 100), // Convert to cents
        tokensUsed: 0, // Will be updated by the calling service
      });

      console.log(`💳 ATXP payment processed: ${action} for user ${userId} - $${cost.toFixed(4)}`);
      
    } catch (error) {
      console.error(`❌ Failed to record ATXP usage:`, error);
    }
  }

  getName(): string {
    return "AtxpPaymentProvider";
  }

  /**
   * Get wallet destination address
   */
  getWalletDestination(): string {
    return this.walletDestination;
  }

  /**
   * Get the cost for a specific operation
   */
  private getOperationCost(action: string): number {
    const costs: Record<string, number> = {
      "create_agent": 0.05,
      "prompt_agent": 0.01,
      "update_agent": 0.02,
      "delete_agent": 0.01,
      "list_agents": 0.001,
      "get_agent": 0.001,
      "add_user_to_agent": 0.005,
      "remove_user_from_agent": 0.005,
      "get_usage_report": 0.002,
      "get_pricing": 0.001,
    };
    
    return costs[action] || 0.01; // Default cost
  }

}
