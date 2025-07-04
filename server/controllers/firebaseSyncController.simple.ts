import { Request, Response } from 'express';
import { storage } from '../storage.js';
import { generateToken } from '../auth/jwt.js';

// Simple Firebase sync controller without complex nested try-catch blocks
export const syncFirebaseUser = async (req: Request, res: Response) => {
  try {
    const { firebaseUser, provider } = req.body;
    
    if (!firebaseUser?.email) {
      return res.status(400).json({ message: 'Missing Firebase user data' });
    }
    
    console.log('Firebase sync for:', firebaseUser.email);
    
    // DYNAMIC PROMO CODE VALIDATION: Check if user has promo code usage
    const { db } = await import('../db.js');
    const { promoCodeUsage } = await import('../../shared/schema.js');
    const { eq } = await import('drizzle-orm');
    
    const hasPromoCode = await db.select()
      .from(promoCodeUsage)
      .where(eq(promoCodeUsage.userEmail, firebaseUser.email.toLowerCase()));
    
    const shouldBeProTier = hasPromoCode.length > 0;
    console.log(`Promo code check for ${firebaseUser.email}: ${shouldBeProTier ? 'Pro tier (has promo code)' : 'Free tier (no promo code)'}`);
    
    // Get or create user
    let user = await storage.getUserByEmail(firebaseUser.email.toLowerCase());
    
    if (!user) {
      // Create new user with tier based on promo code usage
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
        emailVerified: firebaseUser.emailVerified || false
      });
      console.log(`Created new user: ${user.email} with tier: ${tier}`);
    } else {
      // Update existing user if they have promo code but wrong tier
      if (shouldBeProTier && user.tier !== 'pro') {
        console.log(`🔧 PROMO CODE USER: Upgrading ${user.email} to pro tier`);
        user = await storage.updateUser(user.id, {
          tier: 'pro',
          totalPages: -1,
          maxShotsPerScene: -1,
          canGenerateStoryboards: true
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
