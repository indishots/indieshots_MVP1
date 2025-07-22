import { Request, Response } from 'express';
import { storage } from '../storage';
import { generateToken } from '../auth/jwt';

// Simple Firebase sync controller without complex nested try-catch blocks
export const syncFirebaseUser = async (req: Request, res: Response) => {
  try {
    const { firebaseUser, provider } = req.body;
    
    if (!firebaseUser?.email) {
      return res.status(400).json({ message: 'Missing Firebase user data' });
    }
    
    console.log('Firebase sync for:', firebaseUser.email);
    
    // PROPER TIER ASSIGNMENT: Default to free tier, upgrade only if promo code exists
    let shouldBeProTier = false;
    
    try {
      // Check if user has any promo code usage records
      const { db } = await import('../db');
      const { promoCodeUsage } = await import('../../shared/schema');
      const { eq } = await import('drizzle-orm');
      
      const hasPromoCode = await db.select()
        .from(promoCodeUsage)
        .where(eq(promoCodeUsage.userEmail, firebaseUser.email.toLowerCase()));
      
      shouldBeProTier = hasPromoCode.length > 0;
      console.log(`Promo code check for ${firebaseUser.email}: ${shouldBeProTier ? 'Pro tier (has promo code)' : 'Free tier (no promo code)'}`);
    } catch (error) {
      console.log(`No promo code found for ${firebaseUser.email} - defaulting to free tier`);
      shouldBeProTier = false;
    }
    
    // Get or create user with proper tier assignment
    let user = await storage.getUserByEmail(firebaseUser.email.toLowerCase());
    
    if (!user) {
      // Create new user - DEFAULT IS FREE TIER unless promo code exists
      const tier = shouldBeProTier ? 'pro' : 'free';
      user = await storage.createUser({
        email: firebaseUser.email.toLowerCase(),
        firstName: firebaseUser.displayName?.split(' ')[0] || 'User',
        lastName: firebaseUser.displayName?.split(' ').slice(1).join(' ') || '',
        provider: provider || 'firebase',
        providerId: firebaseUser.uid,
        tier,
        totalPages: tier === 'pro' ? -1 : 5,
        maxShotsPerScene: tier === 'pro' ? -1 : 5,
        canGenerateStoryboards: tier === 'pro',
        emailVerified: firebaseUser.emailVerified || false,
        firebaseUID: firebaseUser.uid,
        displayName: firebaseUser.displayName || null
      });
      console.log(`✅ Created new user: ${user.email} with ${tier} tier (promo code: ${shouldBeProTier ? 'YES' : 'NO'})`);
    } else {
      // For existing users, ensure tier is correct based on promo code usage
      const correctTier = shouldBeProTier ? 'pro' : 'free';
      if (user.tier !== correctTier) {
        console.log(`🔧 TIER CORRECTION: Updating ${user.email} from ${user.tier} to ${correctTier} tier`);
        user = await storage.updateUser(user.id, {
          tier: correctTier,
          totalPages: correctTier === 'pro' ? -1 : 5,
          maxShotsPerScene: correctTier === 'pro' ? -1 : 5,
          canGenerateStoryboards: correctTier === 'pro',
          firebaseUID: firebaseUser.uid,
          displayName: firebaseUser.displayName || user.displayName
        });
      }
    }
    
    // Generate JWT token
    const token = generateToken(user);
    
    // Set HTTP-only cookie
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/',
    };
    
    res.cookie('auth_token', token, cookieOptions);
    
    // Return user data
    const { password, ...userData } = user;
    
    const responseData = { 
      ...userData, 
      message: 'User synced successfully',
      redirectTo: '/dashboard',
      authenticated: true
    };
    
    console.log(`✓ Firebase sync successful for ${user.email} - tier: ${user.tier}`);
    res.status(200).json(responseData);
    
  } catch (error) {
    console.error('Firebase sync error:', error);
    res.status(500).json({ message: 'Failed to sync user data' });
  }
};
