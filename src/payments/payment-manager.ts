import { NoPaymentProvider } from "./providers/no-payment.js";
import { AtxpPaymentProvider } from "./providers/atxp.js";
import { SubscriptionPaymentProvider } from "./providers/subscription.js";

export interface PaymentProvider {
  /**
   * Validate if a user can perform a specific action
   */
  validatePayment(userId: string, action: string): Promise<boolean>;
  
  /**
   * Record usage for billing purposes
   */
  recordUsage(userId: string, action: string, cost: number): Promise<void>;
  
  /**
   * Initialize the payment provider
   */
  initialize(): Promise<void>;
  
  /**
   * Get provider name for logging
   */
  getName(): string;
}

export type PaymentMode = "none" | "atxp" | "subscription";

export class PaymentManager {
  private provider: PaymentProvider;
  private mode: PaymentMode;

  constructor(mode: PaymentMode = "none") {
    this.mode = mode;
    
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

  /**
   * Initialize the payment system
   */
  async initialize(): Promise<void> {
    try {
      await this.provider.initialize();
      console.log(`💸 Payment Provider: ${this.provider.getName()} initialized successfully`);
    } catch (error) {
      console.error(`❌ Failed to initialize payment provider: ${error}`);
      throw error;
    }
  }

  /**
   * Validate if a user can perform a specific action
   */
  async validatePayment(userId: string, action: string): Promise<boolean> {
    try {
      const isValid = await this.provider.validatePayment(userId, action);
      if (!isValid) {
        console.log(`⚠️ Payment validation failed for user ${userId}, action: ${action}`);
      }
      return isValid;
    } catch (error) {
      console.error(`❌ Payment validation error for user ${userId}, action: ${action}:`, error);
      return false;
    }
  }

  /**
   * Record usage for billing and analytics
   */
  async recordUsage(userId: string, action: string, cost: number = 0.05): Promise<void> {
    try {
      await this.provider.recordUsage(userId, action, cost);
      console.log(`📊 Recorded usage: ${action} for user ${userId}, cost: $${cost.toFixed(4)}`);
    } catch (error) {
      console.error(`❌ Failed to record usage for user ${userId}, action: ${action}:`, error);
    }
  }

  /**
   * Get the current payment mode
   */
  getMode(): PaymentMode {
    return this.mode;
  }

  /**
   * Get provider information
   */
  getProviderInfo(): { name: string; mode: PaymentMode } {
    return {
      name: this.provider.getName(),
      mode: this.mode
    };
  }
}
