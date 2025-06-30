import { Request, Response } from 'express';
import { storage } from '../storage';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import crypto from 'crypto';
import { generateToken, invalidateToken } from '../auth/jwt';
import sgMail from '@sendgrid/mail';

// Set SendGrid API key if available
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// Validation schemas
const registerSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters')
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
});

const passwordResetSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters')
});

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters')
});

const emailSchema = z.object({
  email: z.string().email('Invalid email address')
});

/**
 * Register a new user with email and password
 */
export async function register(req: Request, res: Response) {
  try {
    // Validate request data
    const validatedData = registerSchema.parse(req.body);
    
    // Check if email is already registered (case-insensitive)
    const existingUser = await storage.getUserByEmail(validatedData.email.toLowerCase());
    
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(validatedData.password, salt);
    
    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    
    // Create user
    const user = await storage.createUser({
      email: validatedData.email.toLowerCase(),
      firstName: validatedData.firstName,
      lastName: validatedData.lastName,
      password: hashedPassword,
      provider: 'local',
      verificationToken,
      tier: 'free',
      totalPages: 20, // Free tier gets 20 pages
      usedPages: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // Send verification email if SendGrid is configured
    if (process.env.SENDGRID_API_KEY) {
      const verificationUrl = `${req.protocol}://${req.get('host')}/api/auth/verify-email?token=${verificationToken}`;
      
      await sgMail.send({
        to: user.email,
        from: process.env.SENDGRID_FROM_EMAIL || 'noreply@indieshots.com',
        subject: 'Verify your IndieShots account',
        html: `
          <h1>Welcome to IndieShots!</h1>
          <p>Please verify your email address by clicking the link below:</p>
          <p><a href="${verificationUrl}">Verify Email</a></p>
          <p>This link will expire in 24 hours.</p>
        `
      });
    }
    
    // Generate JWT token
    const token = generateToken(user);
    
    // Set secure HTTP-only cookie with the token
    res.cookie('auth_token', token, {
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days for persistent login
    });
    
    // Return user data (without sensitive fields)
    res.status(201).json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      tier: user.tier,
      totalPages: user.totalPages,
      usedPages: user.usedPages,
      emailVerified: user.emailVerified,
      profileImageUrl: user.profileImageUrl
    });
  } catch (error) {
    console.error('Registration error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: error.errors 
      });
    }
    
    res.status(500).json({ message: 'Server error during registration' });
  }
}

/**
 * Login with email and password
 */
export async function login(req: Request, res: Response) {
  try {
    // Validate request data
    const validatedData = loginSchema.parse(req.body);
    console.log('Login attempt for email:', validatedData.email);
    
    // Find user by email (case-insensitive)
    const user = await storage.getUserByEmail(validatedData.email.toLowerCase());
    console.log('User found:', user ? 'Yes' : 'No');
    
    if (!user) {
      console.log('User not found in database for email:', validatedData.email);
      return res.status(401).json({ 
        message: 'This email is not registered',
        code: 'USER_NOT_FOUND'
      });
    }
    
    if (user.provider !== 'local') {
      return res.status(400).json({ 
        message: 'This email is registered with a different sign-in method',
        code: 'WRONG_PROVIDER'
      });
    }
    
    // Verify password
    const isPasswordValid = await bcrypt.compare(validatedData.password, user.password || '');
    
    if (!isPasswordValid) {
      return res.status(401).json({ 
        message: 'Incorrect password',
        code: 'INVALID_PASSWORD'
      });
    }
    
    // Generate JWT token
    const token = generateToken(user);
    
    // Set secure HTTP-only cookie with the token
    res.cookie('auth_token', token, {
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days for persistent login
    });
    
    // Return user data (without sensitive fields)
    res.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      tier: user.tier,
      totalPages: user.totalPages,
      usedPages: user.usedPages,
      emailVerified: user.emailVerified,
      profileImageUrl: user.profileImageUrl
    });
  } catch (error) {
    console.error('Login error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: error.errors 
      });
    }
    
    res.status(500).json({ message: 'Server error during login' });
  }
}

/**
 * Send a magic link for passwordless login
 */
export async function sendMagicLink(req: Request, res: Response) {
  try {
    // Validate email
    const { email } = emailSchema.parse(req.body);
    
    // Find user by email
    const user = await storage.getUserByEmail(email);
    
    if (!user) {
      // Don't reveal if email exists or not
      return res.json({ message: 'If your email is registered, you will receive a magic link shortly' });
    }
    
    // Generate a unique magic link token
    const magicLinkToken = crypto.randomBytes(32).toString('hex');
    
    // Set token expiry (1 hour from now)
    const now = new Date();
    const expiryTime = new Date(now.getTime() + 60 * 60 * 1000);
    
    // Store token in the database
    await storage.updateUser(user.id, {
      magicLinkToken,
      magicLinkExpiry: expiryTime
    });
    
    // Send magic link email if SendGrid is configured
    if (process.env.SENDGRID_API_KEY) {
      const magicLink = `${req.protocol}://${req.get('host')}/api/auth/magic-link/verify?token=${magicLinkToken}`;
      
      await sgMail.send({
        to: email,
        from: process.env.SENDGRID_FROM_EMAIL || 'noreply@indieshots.com',
        subject: 'Your IndieShots Magic Link',
        html: `
          <h1>Login to IndieShots</h1>
          <p>Click the link below to login to your account:</p>
          <p><a href="${magicLink}">Login to IndieShots</a></p>
          <p>This link will expire in 1 hour and can only be used once.</p>
          <p>If you didn't request this link, you can safely ignore this email.</p>
        `
      });
    }
    
    res.json({ message: 'If your email is registered, you will receive a magic link shortly' });
  } catch (error) {
    console.error('Magic link error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: error.errors 
      });
    }
    
    res.status(500).json({ message: 'Server error sending magic link' });
  }
}

/**
 * Verify magic link and log in the user
 */
export async function verifyMagicLink(req: Request, res: Response) {
  try {
    const { token } = req.query;
    
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ message: 'Invalid token' });
    }
    
    // Find user by magic link token
    const user = await storage.getUserByMagicLinkToken(token);
    
    if (!user || !user.magicLinkExpiry) {
      return res.redirect('/auth?error=invalid-token');
    }
    
    // Check if token is expired
    const now = new Date();
    if (now > user.magicLinkExpiry) {
      return res.redirect('/auth?error=expired-token');
    }
    
    // Clear the magic link token and expiry
    await storage.updateUser(user.id, {
      magicLinkToken: null,
      magicLinkExpiry: null
    });
    
    // Generate JWT token
    const authToken = generateToken(user);
    
    // Set secure HTTP-only cookie with the token
    res.cookie('auth_token', authToken, {
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });
    
    // Redirect to the dashboard
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Magic link verification error:', error);
    res.redirect('/auth?error=server-error');
  }
}

/**
 * Forgot password - send reset link
 */
export async function forgotPassword(req: Request, res: Response) {
  try {
    // Validate email
    const { email } = emailSchema.parse(req.body);
    
    // Find user by email
    const user = await storage.getUserByEmail(email);
    
    if (!user || user.provider !== 'local') {
      // Don't reveal if email exists or not
      return res.json({ message: 'If your email is registered, you will receive a password reset link shortly' });
    }
    
    // Generate a reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // Set token expiry (1 hour from now)
    const now = new Date();
    const expiryTime = new Date(now.getTime() + 60 * 60 * 1000);
    
    // Store token in the database
    await storage.updateUser(user.id, {
      resetToken,
      resetTokenExpiry: expiryTime
    });
    
    // Send reset link email if SendGrid is configured
    if (process.env.SENDGRID_API_KEY) {
      const resetLink = `${req.protocol}://${req.get('host')}/reset-password?token=${resetToken}`;
      
      await sgMail.send({
        to: email,
        from: process.env.SENDGRID_FROM_EMAIL || 'noreply@indieshots.com',
        subject: 'Reset Your IndieShots Password',
        html: `
          <h1>Password Reset</h1>
          <p>You requested a password reset for your IndieShots account.</p>
          <p>Click the link below to set a new password:</p>
          <p><a href="${resetLink}">Reset Password</a></p>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request this reset, you can safely ignore this email.</p>
        `
      });
    }
    
    res.json({ message: 'If your email is registered, you will receive a password reset link shortly' });
  } catch (error) {
    console.error('Forgot password error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: error.errors 
      });
    }
    
    res.status(500).json({ message: 'Server error processing password reset request' });
  }
}

/**
 * Reset password with token
 */
export async function resetPassword(req: Request, res: Response) {
  try {
    // Validate request data
    const { token, password } = passwordResetSchema.parse(req.body);
    
    // Find user by reset token
    const user = await storage.getUserByResetToken(token);
    
    if (!user || !user.resetTokenExpiry) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }
    
    // Check if token is expired
    const now = new Date();
    if (now > user.resetTokenExpiry) {
      return res.status(400).json({ message: 'Reset token has expired' });
    }
    
    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Update user with new password and clear reset token
    await storage.updateUser(user.id, {
      password: hashedPassword,
      resetToken: null,
      resetTokenExpiry: null,
      updatedAt: new Date()
    });
    
    res.json({ message: 'Password has been reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: error.errors 
      });
    }
    
    res.status(500).json({ message: 'Server error during password reset' });
  }
}

/**
 * Verify email with token
 */
export async function verifyEmail(req: Request, res: Response) {
  try {
    const { token } = req.query;
    
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ message: 'Invalid token' });
    }
    
    // Find user by verification token
    const user = await storage.getUserByVerificationToken(token);
    
    if (!user) {
      return res.redirect('/auth?error=invalid-verification');
    }
    
    // Mark email as verified and clear token
    await storage.updateUser(user.id, {
      emailVerified: true,
      verificationToken: null,
      updatedAt: new Date()
    });
    
    // Redirect to login page with success message
    res.redirect('/auth?verified=true');
  } catch (error) {
    console.error('Email verification error:', error);
    res.redirect('/auth?error=verification-failed');
  }
}

/**
 * Log out the user
 */
export async function logout(req: Request, res: Response) {
  try {
    console.log('=== PROCESSING LOGOUT REQUEST ===');
    
    // Get the token from cookies to invalidate it
    const token = req.cookies?.auth_token;
    if (token) {
      invalidateToken(token);
      console.log('✓ Token invalidated and blacklisted');
    }
    
    // Comprehensive cookie clearing strategy
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/'
    };
    
    // Method 1: Clear with exact same options used when setting
    res.clearCookie('auth_token', cookieOptions);
    
    // Method 2: Clear with basic options
    res.clearCookie('auth_token', { path: '/' });
    res.clearCookie('auth_token');
    
    // Method 3: Set expired cookie to force removal
    res.cookie('auth_token', '', {
      ...cookieOptions,
      maxAge: 0,
      expires: new Date(0)
    });
    
    // Method 4: Set different path variations to ensure removal
    res.clearCookie('auth_token', { path: '/', domain: undefined });
    
    // Clear all authentication-related headers
    res.removeHeader('Set-Cookie');
    
    // Clear session data if it exists
    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          console.error('Session destroy error:', err);
        }
      });
    }
    
    // Add headers to prevent caching
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    console.log('✓ LOGOUT COMPLETED - All cookies cleared and token invalidated');
    res.json({ 
      message: 'Logged out successfully',
      timestamp: Date.now(),
      cookiesCleared: true 
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Error during logout' });
  }
}

/**
 * Get current user's profile
 */
export async function getProfile(req: Request, res: Response) {
  try {
    const userId = req.user.id;
    const user = await storage.getUser(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Return user data (without sensitive fields)
    res.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
      provider: user.provider,
      tier: user.tier,
      totalPages: user.totalPages,
      usedPages: user.usedPages,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error fetching profile' });
  }
}

/**
 * Update user profile
 */
export async function updateProfile(req: Request, res: Response) {
  try {
    const userId = req.user.id;
    const { firstName, lastName, profileImageUrl } = req.body;
    
    // Update only allowed fields
    const updatedUser = await storage.updateUser(userId, {
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      profileImageUrl: profileImageUrl || undefined,
      updatedAt: new Date()
    });
    
    res.json({
      id: updatedUser.id,
      email: updatedUser.email,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      profileImageUrl: updatedUser.profileImageUrl,
      provider: updatedUser.provider,
      tier: updatedUser.tier,
      emailVerified: updatedUser.emailVerified
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error updating profile' });
  }
}

/**
 * Change user password
 */
export async function changePassword(req: Request, res: Response) {
  try {
    // Validate request data
    const { currentPassword, newPassword } = passwordChangeSchema.parse(req.body);
    
    const userId = req.user.id;
    const user = await storage.getUser(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if user has a password (could be OAuth user)
    if (!user.password || user.provider !== 'local') {
      return res.status(400).json({ message: 'Password change not available for this account type' });
    }
    
    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }
    
    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    // Update user with new password
    await storage.updateUser(userId, {
      password: hashedPassword,
      updatedAt: new Date()
    });
    
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: error.errors 
      });
    }
    
    res.status(500).json({ message: 'Server error changing password' });
  }
}