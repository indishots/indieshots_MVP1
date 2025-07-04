/**
 * Utility to ensure premium@demo.com always has pro tier
 * This runs after any user operation to maintain demo account state
 */

import { storage } from '../storage';

export async function ensurePremiumDemoProTier() {
  try {
    const user = await storage.getUserByEmail('premium@demo.com');
    
    if (user && user.tier !== 'pro') {
      console.log('🔧 FIXING: premium@demo.com was not pro tier, correcting...');
      
      await storage.updateUser(user.id, {
        tier: 'pro',
        totalPages: -1,
        maxShotsPerScene: -1,
        canGenerateStoryboards: true
      });
      
      console.log('✅ FIXED: premium@demo.com restored to pro tier');
    }
  } catch (error) {
    console.error('Failed to ensure premium demo pro tier:', error);
  }
}

export function isPremiumDemoUser(email: string): boolean {
  return email === 'premium@demo.com';
}

export function applyPremiumDemoOverrides(user: any): any {
  if (isPremiumDemoUser(user.email)) {
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