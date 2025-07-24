import { Request, Response } from 'express';
import { storage } from '../storage';
import { generateToken } from '../auth/jwt';
import { ensurePremiumDemoProTier, applyPremiumDemoOverrides } from '../utils/premiumDemo';
import { PromoCodeUniversalValidator } from '../utils/promoCodeUniversalValidator';

/**
 * Sync Firebase user with local database
 * This creates/updates users from Firebase Auth in our PostgreSQL database
 */
export async function firebaseSync(req: Request, res: Response) {
  try {
    console.log('=== Firebase User Sync ===');
    console.log('Request body received:', JSON.stringify(req.body, null, 2));
    
    const { firebaseUser, idToken, provider } = req.body;
    
    if (!firebaseUser || !firebaseUser.uid || !firebaseUser.email) {
      console.error('Missing required Firebase user data');
      return res.status(400).json({ message: 'Missing required Firebase user data' });
    }
    
    try {
      console.log('Syncing Firebase user:', {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        provider,
        emailVerified: firebaseUser.emailVerified
      });
      
      // Get Firebase custom claims to extract tier information
      let firebaseCustomClaims = {};
      let tierFromFirebase = 'free';
    
    try {
      // Get Firebase custom claims
      try {
      const admin = await import('firebase-admin');
      const firebaseAdmin = admin.default;
      
      if (firebaseAdmin.apps.length) {
        const firebaseUserRecord = await firebaseAdmin.auth().getUser(firebaseUser.uid);
        firebaseCustomClaims = firebaseUserRecord.customClaims || {};
        tierFromFirebase = (firebaseCustomClaims as any).tier || 'free';
        console.log('Firebase custom claims:', firebaseCustomClaims);
        console.log(`Using tier from Firebase: ${tierFromFirebase}`);
      } else {
        console.log('Firebase not initialized, defaulting to free tier');
      }
    } catch (error) {
      console.log('Could not fetch Firebase custom claims:', error);
    }
    
    // Check if user exists by Firebase UID first, then by email as fallback
    let user = await storage.getUserByProviderId(provider, firebaseUser.uid);
    
    if (!user) {
      // Check if user exists by email (for existing accounts)
      try {
        user = await storage.getUserByEmail(firebaseUser.email.toLowerCase());
        if (user) {
          console.log('Found existing user by email, updating Firebase provider info');
          // Update the existing user's provider info to match Firebase
          user = await storage.updateUser(user.id, {
            provider,
            providerId: firebaseUser.uid,
            emailVerified: firebaseUser.emailVerified || false,
          });
        }
      } catch (error) {
        console.log('No existing user found by email');
      }
    }
    
    if (!user) {
      // Create new user from Firebase data
      let firstName = firebaseUser.email?.split('@')[0] || 'User';
      let lastName = '';
      
      if (firebaseUser.displayName) {
        const nameParts = firebaseUser.displayName.split(' ');
        firstName = nameParts[0] || firstName;
        lastName = nameParts.slice(1).join(' ') || '';
      }
      
      console.log('Creating new user from Firebase:', firebaseUser.email);
      
      // Special handling for premium demo account
      const isDemo = firebaseUser.email === 'premium@demo.com';
      const finalTier = isDemo ? 'pro' : tierFromFirebase;
      
      if (isDemo) {
        console.log(`🔒 DEMO ACCOUNT: Creating premium@demo.com with pro tier`);
      }
      
      user = await storage.createUser({
        email: firebaseUser.email.toLowerCase(),
        firstName,
        lastName,
        profileImageUrl: firebaseUser.photoURL || null,
        provider,
        providerId: firebaseUser.uid,
        emailVerified: firebaseUser.emailVerified || false,
        tier: finalTier, // Use Firebase custom claims or force pro for demo
        totalPages: finalTier === 'pro' ? -1 : 5, // Pro tier gets unlimited pages, free tier gets 5
        usedPages: 0,
        maxShotsPerScene: finalTier === 'pro' ? -1 : 5, // Pro tier gets unlimited shots, free tier gets 5
        canGenerateStoryboards: finalTier === 'pro', // Pro tier can generate storyboards
      });
      
      console.log('New Firebase user created:', user.email);
    } else {
      // Update existing user with latest Firebase data
      console.log('Updating existing Firebase user:', user.email);
      
      const updates: any = {};
      
      // Update provider info if needed
      if (provider && firebaseUser.uid && user.providerId !== firebaseUser.uid) {
        updates.provider = provider;
        updates.providerId = firebaseUser.uid;
      }
      
      // Update profile image if provided and not already set
      if (firebaseUser.photoURL && !user.profileImageUrl) {
        updates.profileImageUrl = firebaseUser.photoURL;
      }
      
      // Update email verification status
      if (firebaseUser.emailVerified && !user.emailVerified) {
        updates.emailVerified = firebaseUser.emailVerified;
      }
      
      // Update display name if provided
      if (firebaseUser.displayName && (!user.firstName || !user.lastName)) {
        const nameParts = firebaseUser.displayName.split(' ');
        if (!user.firstName) updates.firstName = nameParts[0] || user.firstName;
        if (!user.lastName) updates.lastName = nameParts.slice(1).join(' ') || user.lastName;
      }
      
      // Special handling for premium demo account - preserve pro tier
      if (firebaseUser.email === 'premium@demo.com') {
        console.log(`🔒 DEMO ACCOUNT: Preserving pro tier for ${firebaseUser.email}`);
        if (user.tier !== 'pro') {
          updates.tier = 'pro';
          updates.totalPages = -1;
          updates.maxShotsPerScene = -1;
          updates.canGenerateStoryboards = true;
          console.log(`🔄 DEMO FIX: Restored pro tier for premium@demo.com`);
        }
      } else {
        // Sync tier information from Firebase custom claims (critical for promo code users)
        if (tierFromFirebase !== user.tier) {
          updates.tier = tierFromFirebase;
          updates.totalPages = tierFromFirebase === 'pro' ? -1 : 10;
          updates.maxShotsPerScene = tierFromFirebase === 'pro' ? -1 : 5;
          updates.canGenerateStoryboards = tierFromFirebase === 'pro';
          console.log(`🔄 TIER SYNC: ${user.email} - PostgreSQL tier: ${user.tier} → Firebase tier: ${tierFromFirebase}`);
          console.log(`🔄 TIER SYNC: Setting totalPages: ${updates.totalPages}, maxShots: ${updates.maxShotsPerScene}, storyboards: ${updates.canGenerateStoryboards}`);
          
          // Special validation for INDIE2025 promo code users
          if (tierFromFirebase === 'pro') {
            console.log(`🎯 PRO TIER SYNC: Applying unlimited access for ${user.email}`);
          }
        } else {
          console.log(`✓ TIER SYNC: ${user.email} - Tiers already match: ${tierFromFirebase}`);
          
          // Additional validation: Ensure pro tier users have correct unlimited values
          if (tierFromFirebase === 'pro' && (user.totalPages !== -1 || user.maxShotsPerScene !== -1 || !user.canGenerateStoryboards)) {
            updates.totalPages = -1;
            updates.maxShotsPerScene = -1;
            updates.canGenerateStoryboards = true;
            console.log(`🔧 PRO TIER CORRECTION: Fixed unlimited access values for ${user.email}`);
          }
        }
      }
      
      if (Object.keys(updates).length > 0) {
        user = await storage.updateUser(user.id, updates);
      }
      
      // Only premium@demo.com gets special protection
      if (user.email === 'premium@demo.com' && user.tier !== 'pro') {
        console.log(`🔧 DEMO ACCOUNT: Upgrading premium@demo.com to pro tier in Firebase sync`);
        
        user = await storage.updateUser(user.id, {
          tier: 'pro',
          totalPages: -1,
          maxShotsPerScene: -1,
          canGenerateStoryboards: true
        });
      }
      
      // UNIVERSAL INDIE2025 VALIDATION: Check promo code usage for other users
      try {
        if (user.email !== 'premium@demo.com' && user.email) {
          const { db } = await import('../db.js');
          const promoUsageCheck = await db.execute(`
            SELECT pc.code FROM promo_code_usage pcu 
            JOIN promo_codes pc ON pcu.promo_code_id = pc.id 
            WHERE pcu.user_email = '${user.email.toLowerCase()}' AND pc.code = 'INDIE2025'
          `);
          
          const hasINDIE2025 = promoUsageCheck && (promoUsageCheck as any).rows && (promoUsageCheck as any).rows.length > 0;
        
          if (hasINDIE2025 && user.tier !== 'pro') {
            console.log(`🔧 INDIE2025 UNIVERSAL FIX: Upgrading ${user.email} from ${user.tier} to pro tier`);
            
            user = await storage.updateUser(user.id, {
              tier: 'pro',
              totalPages: -1,
              maxShotsPerScene: -1,
              canGenerateStoryboards: true
            });
            
            console.log(`✅ INDIE2025 UNIVERSAL: ${user.email} now has pro tier access`);
          } else if (hasINDIE2025 && user.tier === 'pro') {
            console.log(`✓ INDIE2025 UNIVERSAL: ${user.email} already has correct pro tier`);
          }
        }
      } catch (error) {
        console.log('INDIE2025 universal check skipped (non-critical):', error);
      }
    
    // Generate JWT token for session with premium demo overrides
    const userForToken = applyPremiumDemoOverrides(user);
    const token = generateToken(userForToken);
    
    // Set HTTP-only cookie
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/',
    };
    
    console.log('Setting auth cookie for Firebase user');
    res.cookie('auth_token', token, cookieOptions);
    
    // Set session data
    if (req.session) {
      (req.session as any).userId = user.id;
      (req.session as any).user = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        tier: user.tier,
      };
    }
    
    console.log('✓ Firebase user sync successful:', user.email);
    console.log('✓ Auth cookie set, session created');
    
    // Return user data (excluding sensitive fields)
    const { password, ...userData } = user;
    
    // Apply premium demo overrides to response
    const finalUserData = applyPremiumDemoOverrides(userData);
    
    const responseData = { 
      ...finalUserData, 
      message: 'User synced successfully',
      redirectTo: '/dashboard',
      authenticated: true
    };
    
    console.log('✓ Sending response with user data:', { id: userData.id, email: userData.email });
    
      res.status(200).json(responseData);
    } catch (error) {
      console.error('Firebase sync error:', error);
      res.status(500).json({ message: 'Failed to sync user data' });
    }
}