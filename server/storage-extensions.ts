import { DatabaseStorage } from './storage';
import { users, type User } from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

// Extend DatabaseStorage with payment-related methods
export class ExtendedDatabaseStorage extends DatabaseStorage {
  // Additional user operations for payment system
  async getUserById(id: string): Promise<User | undefined> {
    // Try to find by Firebase UID (string ID) or numeric ID
    let user;
    
    // First try Firebase UID
    const [userByFirebaseId] = await db.select().from(users).where(eq(users.firebaseUID, id));
    if (userByFirebaseId) {
      user = userByFirebaseId;
    } else {
      // Try numeric ID conversion
      const numericId = parseInt(id);
      if (!isNaN(numericId)) {
        const [userByNumericId] = await db.select().from(users).where(eq(users.id, numericId));
        user = userByNumericId;
      }
    }
    
    if (!user) return undefined;
    
    // Apply same special handling as getUserByEmail
    return this.applyUserSpecialHandling(user);
  }

  async getUserByStripeSubscriptionId(subscriptionId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.stripeSubscriptionId, subscriptionId));
    return user ? this.applyUserSpecialHandling(user) : undefined;
  }

  async updateUserTier(userId: string, tier: string, paymentInfo?: any): Promise<User> {
    // Find user first
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Prepare tier-specific updates
    const tierUpdates = {
      tier,
      ...(tier === 'pro' && {
        totalPages: -1,
        maxShotsPerScene: -1,
        canGenerateStoryboards: true,
      }),
      ...(tier === 'free' && {
        totalPages: 5,
        maxShotsPerScene: 5,
        canGenerateStoryboards: false,
      }),
      ...paymentInfo,
    };

    // Update in database using numeric ID
    const [updatedUser] = await db
      .update(users)
      .set(tierUpdates)
      .where(eq(users.id, user.id))
      .returning();

    if (!updatedUser) {
      throw new Error('Failed to update user tier');
    }

    console.log(`User ${userId} tier updated to ${tier}`);
    return updatedUser;
  }

  async getUserPaymentHistory(userId: string): Promise<any[]> {
    // This would typically fetch from a payments table
    // For now, return basic info from user record
    const user = await this.getUserById(userId);
    if (!user) return [];

    const history = [];
    
    // Add Stripe payment info if available
    if (user.stripeCustomerId || user.stripeSubscriptionId) {
      history.push({
        id: user.stripeSubscriptionId || user.stripeCustomerId,
        method: 'stripe',
        status: user.paymentStatus || 'active',
        amount: 29.00,
        currency: 'usd',
        date: user.updatedAt || user.createdAt,
        description: 'IndieShots Pro Subscription'
      });
    }

    // Add PayU payment info if available
    if (user.payuTransactionId || user.payuTxnId) {
      history.push({
        id: user.payuTransactionId || user.payuTxnId,
        method: 'payu',
        status: user.paymentStatus || 'completed',
        amount: 29.00,
        currency: 'inr',
        date: user.updatedAt || user.createdAt,
        description: 'IndieShots Pro Plan'
      });
    }

    return history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  // Helper method to apply special user handling (extracted from existing code)
  private applyUserSpecialHandling(user: User): User {
    // Special handling for premium demo account and critical INDIE2025 accounts
    const criticalProAccounts = [
      'premium@demo.com',
      'dhulipallagopichandu@gmail.com', 
      'gopichandudhulipalla@gmail.com'
    ];
    
    if (user.email && criticalProAccounts.includes(user.email)) {
      return {
        ...user,
        tier: 'pro',
        totalPages: -1,
        maxShotsPerScene: -1,
        canGenerateStoryboards: true
      };
    }

    return user;
  }
}