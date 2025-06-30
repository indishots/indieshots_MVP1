import { Request, Response } from 'express';
import { storage } from '../storage';
import { generateToken } from '../auth/jwt';

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
    
    console.log('Syncing Firebase user:', {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      provider,
      emailVerified: firebaseUser.emailVerified
    });
    
    // Check if user exists by Firebase UID or email
    let user = await storage.getUserByProviderId(provider, firebaseUser.uid);
    
    if (!user && firebaseUser.email) {
      // Also check by email for existing accounts
      user = await storage.getUserByEmail(firebaseUser.email);
      
      // If user exists with different provider, update provider info
      if (user && user.providerId !== firebaseUser.uid) {
        console.log('Updating existing user with Firebase provider info');
        user = await storage.updateUser(user.id, {
          provider,
          providerId: firebaseUser.uid,
          emailVerified: firebaseUser.emailVerified
        });
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
      
      user = await storage.createUser({
        email: firebaseUser.email.toLowerCase(),
        firstName,
        lastName,
        profileImageUrl: firebaseUser.photoURL || null,
        provider,
        providerId: firebaseUser.uid,
        emailVerified: firebaseUser.emailVerified || false,
        tier: 'free',
        totalPages: 20, // Default pages for new users
        usedPages: 0,
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
      
      if (Object.keys(updates).length > 0) {
        user = await storage.updateUser(user.id, updates);
      }
    }
    
    // Generate JWT token for session
    const token = generateToken(user);
    
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
    
    const responseData = { 
      ...userData, 
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