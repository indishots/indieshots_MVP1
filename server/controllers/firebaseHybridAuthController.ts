import { Request, Response } from 'express';
import { auth as firebaseAdmin } from '../firebase/admin';
import { z } from 'zod';
import crypto from 'crypto';
import { generateOTP, logOTPToConsole, sendOTPEmail } from '../emailService';

// Simple in-memory OTP storage (in production, use Redis or database)
const otpStore = new Map<string, { 
  otp: string; 
  expires: number; 
  userData: any;
  attempts: number;
}>();

// Validation schemas
const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  couponCode: z.string().optional()
});

const signinSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
});

const verifyOTPSchema = z.object({
  email: z.string().email('Invalid email address'),
  otp: z.string().length(6, 'OTP must be 6 digits')
});

/**
 * Check if Firebase user exists
 */
async function checkFirebaseUserExists(email: string): Promise<boolean> {
  try {
    await firebaseAdmin.getUserByEmail(email);
    return true;
  } catch (error: any) {
    if (error.code === 'auth/user-not-found') {
      return false;
    }
    throw error;
  }
}

/**
 * Signup Flow: 1. Check if user exists -> 2. Send OTP if new user
 */
export async function hybridSignup(req: Request, res: Response) {
  try {
    const validatedData = signupSchema.parse(req.body);
    const email = validatedData.email.toLowerCase();
    
    // Check if user already exists in Firebase
    const userExists = await checkFirebaseUserExists(email);
    
    if (userExists) {
      return res.status(400).json({ 
        message: 'Email already registered, sign in.',
        code: 'USER_EXISTS',
        action: 'signin'
      });
    }
    
    // User doesn't exist, send OTP
    const otp = generateOTP();
    
    // Check coupon code
    const validCoupons = ['DEMO2024', 'PREMIUM', 'LAUNCH', 'INDIE2025'];
    const isPremium = validatedData.couponCode && 
      validCoupons.includes(validatedData.couponCode.toUpperCase());
    
    // Store user data with OTP
    const userData = {
      email,
      password: validatedData.password, // We'll hash this after OTP verification
      firstName: validatedData.firstName || '',
      lastName: validatedData.lastName || '',
      tier: isPremium ? 'premium' : 'free',
      couponCode: validatedData.couponCode,
      provider: 'email'
    };
    
    // Store OTP with user data
    otpStore.set(email, {
      otp,
      expires: Date.now() + 10 * 60 * 1000, // 10 minutes
      userData,
      attempts: 0
    });
    
    // Send OTP email
    const emailSent = await sendOTPEmail(email, otp, userData.firstName + ' ' + userData.lastName);
    
    if (!emailSent) {
      console.log('📧 Email sending failed, falling back to console logging');
      logOTPToConsole(email, userData.firstName + ' ' + userData.lastName, otp);
    }
    
    // Auto-cleanup OTP after expiration
    setTimeout(() => {
      otpStore.delete(email);
    }, 10 * 60 * 1000);
    
    return res.status(200).json({
      message: 'Verification code sent to your email address!',
      email,
      requiresVerification: true,
      devNote: 'Check your email inbox for the OTP code'
    });
    
  } catch (error: any) {
    console.error('Hybrid signup error:', error);
    return res.status(500).json({ message: 'Signup failed' });
  }
}

/**
 * Signin Flow: 1. Check if user exists -> 2. Authenticate if exists
 */
export async function hybridSignin(req: Request, res: Response) {
  try {
    const validatedData = signinSchema.parse(req.body);
    const email = validatedData.email.toLowerCase();
    
    // Check if user exists in Firebase
    const userExists = await checkFirebaseUserExists(email);
    
    if (!userExists) {
      return res.status(400).json({ 
        message: 'Email is not registered, sign up.',
        code: 'USER_NOT_FOUND',
        action: 'signup'
      });
    }
    
    // For Firebase-first approach, we need to use client-side Firebase Auth
    // Return user exists confirmation, client will handle Firebase authentication
    try {
      const firebaseUser = await firebaseAdmin.getUserByEmail(email);
      
      return res.status(200).json({
        message: 'User found, use client-side Firebase authentication',
        action: 'firebase_auth',
        user: {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName
        }
      });
      
    } catch (error: any) {
      return res.status(401).json({ 
        message: 'Authentication failed',
        code: 'AUTH_FAILED'
      });
    }
    
  } catch (error: any) {
    console.error('Hybrid signin error:', error);
    return res.status(500).json({ message: 'Signin failed' });
  }
}

/**
 * Verify OTP and create Firebase user
 */
export async function hybridVerifyOTP(req: Request, res: Response) {
  try {
    const validatedData = verifyOTPSchema.parse(req.body);
    const email = validatedData.email.toLowerCase();
    const otp = validatedData.otp;
    
    // Get stored OTP data
    const storedData = otpStore.get(email);
    
    if (!storedData) {
      return res.status(400).json({ 
        message: 'OTP expired or invalid. Please request a new code.',
        code: 'OTP_EXPIRED'
      });
    }
    
    // Check if OTP expired
    if (Date.now() > storedData.expires) {
      otpStore.delete(email);
      return res.status(400).json({ 
        message: 'OTP expired. Please request a new code.',
        code: 'OTP_EXPIRED'
      });
    }
    
    // Check attempt limit
    if (storedData.attempts >= 5) {
      otpStore.delete(email);
      return res.status(429).json({ 
        message: 'Too many failed attempts. Please request a new code.',
        code: 'TOO_MANY_ATTEMPTS'
      });
    }
    
    // Verify OTP
    if (storedData.otp !== otp) {
      storedData.attempts++;
      return res.status(400).json({ 
        message: 'Invalid OTP code. Please try again.',
        code: 'INVALID_OTP',
        attemptsLeft: 5 - storedData.attempts
      });
    }
    
    // OTP verified, create Firebase user
    try {
      const userData = storedData.userData;
      
      // Create Firebase user
      const firebaseUser = await firebaseAdmin.createUser({
        email: userData.email,
        password: userData.password,
        emailVerified: true,
        displayName: `${userData.firstName} ${userData.lastName}`.trim(),
      });
      
      // Set custom claims for tier and other metadata
      await firebaseAdmin.setCustomUserClaims(firebaseUser.uid, {
        tier: userData.tier,
        couponCode: userData.couponCode,
        provider: userData.provider,
        createdAt: new Date().toISOString()
      });
      
      // Clean up OTP
      otpStore.delete(email);
      
      // Create custom token for immediate signin
      const customToken = await firebaseAdmin.createCustomToken(firebaseUser.uid);
      
      return res.status(200).json({
        message: 'Email verified successfully! Account created.',
        user: {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          tier: userData.tier
        },
        token: customToken,
        verified: true
      });
      
    } catch (error: any) {
      console.error('Firebase user creation error:', error);
      
      if (error.code === 'auth/email-already-exists') {
        return res.status(400).json({ 
          message: 'Email already registered',
          code: 'USER_EXISTS'
        });
      }
      
      return res.status(500).json({ 
        message: 'Failed to create account',
        code: 'ACCOUNT_CREATION_FAILED'
      });
    }
    
  } catch (error: any) {
    console.error('OTP verification error:', error);
    return res.status(500).json({ message: 'Verification failed' });
  }
}

/**
 * Resend OTP
 */
export async function hybridResendOTP(req: Request, res: Response) {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }
    
    const normalizedEmail = email.toLowerCase();
    const storedData = otpStore.get(normalizedEmail);
    
    if (!storedData) {
      return res.status(400).json({ 
        message: 'No pending verification found. Please start signup again.',
        code: 'NO_PENDING_VERIFICATION'
      });
    }
    
    // Generate new OTP
    const newOTP = generateOTP();
    
    // Update stored data
    storedData.otp = newOTP;
    storedData.expires = Date.now() + 10 * 60 * 1000;
    storedData.attempts = 0;
    
    // Send new OTP email
    const userData = storedData.userData;
    const emailSent = await sendOTPEmail(normalizedEmail, newOTP, userData.firstName + ' ' + userData.lastName);
    
    if (!emailSent) {
      console.log('📧 Email sending failed, falling back to console logging');
      logOTPToConsole(normalizedEmail, userData.firstName + ' ' + userData.lastName, newOTP);
    }
    
    return res.status(200).json({
      message: 'New verification code sent to your email address!',
      email: normalizedEmail
    });
    
  } catch (error: any) {
    console.error('Resend OTP error:', error);
    return res.status(500).json({ message: 'Failed to resend OTP' });
  }
}