import { PaymentProvider } from "../payment-manager.js";

/**
 * No-payment provider for free tier access
 * Allows all operations without any payment validation
 */
export class NoPaymentProvider implements PaymentProvider {
  async initialize(): Promise<void> {
    console.log("💸 Payment mode: FREE TIER (no payment required)");
  }

  async validatePayment(userId: string, action: string): Promise<boolean> {
    // Always allow free access for all operations
    return true;
  }

  async recordUsage(userId: string, action: string, cost: number): Promise<void> {
    // No-op for free tier, but we could log usage for analytics
    console.log(`📊 [FREE] Usage recorded: ${action} for user ${userId} (cost would be $${cost.toFixed(4)})`);
  }

  getName(): string {
    return "NoPaymentProvider";
  }
}
