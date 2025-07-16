/**
 * Cost Controller - Prevents excessive OpenAI API usage and billing
 */

interface UsageTracker {
  imageGenerations: number;
  gptCalls: number;
  lastReset: Date;
  totalCost: number;
}

class CostController {
  private static instance: CostController;
  private userUsage: Map<string, UsageTracker> = new Map();
  
  // Daily limits to prevent billing spikes
  private readonly DAILY_LIMITS = {
    FREE_TIER: {
      imageGenerations: 5,   // 5 images per day ($0.20-0.40)
      gptCalls: 20,          // 20 GPT calls per day (~$0.10)
      maxCostPerDay: 0.50    // $0.50 maximum per day
    },
    PRO_TIER: {
      imageGenerations: 50,  // 50 images per day ($2.00-4.00)
      gptCalls: 200,         // 200 GPT calls per day (~$1.00)
      maxCostPerDay: 5.00    // $5.00 maximum per day
    }
  };

  private constructor() {
    // Reset usage counters daily
    setInterval(() => {
      this.resetDailyUsage();
    }, 24 * 60 * 60 * 1000); // 24 hours
  }

  static getInstance(): CostController {
    if (!CostController.instance) {
      CostController.instance = new CostController();
    }
    return CostController.instance;
  }

  private resetDailyUsage(): void {
    const now = new Date();
    for (const [userId, usage] of this.userUsage.entries()) {
      const hoursSinceReset = (now.getTime() - usage.lastReset.getTime()) / (1000 * 60 * 60);
      if (hoursSinceReset >= 24) {
        this.userUsage.set(userId, {
          imageGenerations: 0,
          gptCalls: 0,
          lastReset: now,
          totalCost: 0
        });
      }
    }
  }

  private getUserUsage(userId: string): UsageTracker {
    if (!this.userUsage.has(userId)) {
      this.userUsage.set(userId, {
        imageGenerations: 0,
        gptCalls: 0,
        lastReset: new Date(),
        totalCost: 0
      });
    }
    return this.userUsage.get(userId)!;
  }

  /**
   * Check if user can generate images without exceeding cost limits
   */
  canGenerateImage(userId: string, userTier: string = 'free'): { allowed: boolean; reason?: string } {
    const usage = this.getUserUsage(userId);
    const limits = userTier === 'pro' ? this.DAILY_LIMITS.PRO_TIER : this.DAILY_LIMITS.FREE_TIER;
    
    // Check image generation limit
    if (usage.imageGenerations >= limits.imageGenerations) {
      return {
        allowed: false,
        reason: `Daily image generation limit reached (${limits.imageGenerations}). Resets in 24 hours.`
      };
    }

    // Check cost limit
    const estimatedCost = 0.08; // DALL-E 3 cost per image
    if (usage.totalCost + estimatedCost > limits.maxCostPerDay) {
      return {
        allowed: false,
        reason: `Daily cost limit reached ($${limits.maxCostPerDay}). Resets in 24 hours.`
      };
    }

    return { allowed: true };
  }

  /**
   * Check if user can make GPT calls without exceeding limits
   */
  canMakeGPTCall(userId: string, userTier: string = 'free'): { allowed: boolean; reason?: string } {
    const usage = this.getUserUsage(userId);
    const limits = userTier === 'pro' ? this.DAILY_LIMITS.PRO_TIER : this.DAILY_LIMITS.FREE_TIER;
    
    if (usage.gptCalls >= limits.gptCalls) {
      return {
        allowed: false,
        reason: `Daily GPT call limit reached (${limits.gptCalls}). Resets in 24 hours.`
      };
    }

    return { allowed: true };
  }

  /**
   * Record image generation usage
   */
  recordImageGeneration(userId: string, cost: number = 0.08): void {
    const usage = this.getUserUsage(userId);
    usage.imageGenerations += 1;
    usage.totalCost += cost;
    
    console.log(`🔒 COST TRACKING: User ${userId} - Images: ${usage.imageGenerations}, Cost: $${usage.totalCost.toFixed(2)}`);
  }

  /**
   * Record GPT call usage
   */
  recordGPTCall(userId: string, cost: number = 0.005): void {
    const usage = this.getUserUsage(userId);
    usage.gptCalls += 1;
    usage.totalCost += cost;
    
    console.log(`🔒 COST TRACKING: User ${userId} - GPT Calls: ${usage.gptCalls}, Cost: $${usage.totalCost.toFixed(2)}`);
  }

  /**
   * Get current usage for a user
   */
  getUserUsageStats(userId: string): UsageTracker {
    return this.getUserUsage(userId);
  }
}

export const costController = CostController.getInstance();