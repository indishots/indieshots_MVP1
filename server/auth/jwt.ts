import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-development-secret-key-2025';
const JWT_EXPIRES_IN = '30d'; // Extended for persistent login

// In-memory token blacklist (in production, use Redis or database)
const blacklistedTokens = new Set<string>();

interface TokenPayload {
  id: number;
  email: string;
  tier: string;
  jti?: string; // JWT ID for token invalidation
}

// Extended user type for request object
interface RequestUser {
  id: number;
  email: string;
  tier: string;
  displayName?: string;
  provider?: string;
  [key: string]: any;
}

/**
 * Generate a JWT token for a user
 */
export function generateToken(user: any): string {
  const jti = Math.random().toString(36).substring(2, 15);
  const payload: TokenPayload = {
    id: user.id,
    email: user.email,
    tier: user.tier || 'free',
    jti
  };
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verify a JWT token and check blacklist
 */
export function verifyToken(token: string): any {
  try {
    // Check if token is blacklisted
    if (blacklistedTokens.has(token)) {
      console.log('Token is blacklisted');
      return null;
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Handle both old and new token formats
    if (decoded && typeof decoded === 'object') {
      // Normalize token format - handle both uid and id fields
      const normalizedToken = {
        id: (decoded as any).uid || (decoded as any).id,
        uid: (decoded as any).uid || (decoded as any).id,
        email: (decoded as any).email,
        tier: (decoded as any).tier || 'free',
        displayName: (decoded as any).displayName,
        // Preserve any other fields
        ...(decoded as any)
      };
      
      return normalizedToken;
    }
    
    return decoded;
  } catch (error) {
    console.error('Token verification error:', error);
    console.error('Token that failed verification:', token.substring(0, 30) + '...');
    return null;
  }
}

/**
 * Invalidate a JWT token by adding it to blacklist
 */
export function invalidateToken(token: string): void {
  blacklistedTokens.add(token);
  console.log('Token added to blacklist');
}

/**
 * Middleware to verify JWT token in Authorization header or cookies
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    // Check for token in cookies first (for browser clients)
    let token = req.cookies?.auth_token;
    
    console.log('Auth middleware - checking token in cookies:', !!token);
    console.log('Auth middleware - all cookies:', Object.keys(req.cookies || {}));
    
    // If no cookie, check Authorization header (for API clients)
    if (!token && req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
        console.log('Auth middleware - found token in Authorization header');
      }
    }
    
    if (!token) {
      console.log('Auth middleware - no token found, returning 401');
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    const decoded = verifyToken(token);
    if (!decoded) {
      console.log('Auth middleware - token verification failed');
      console.log('Auth middleware - token preview:', token.substring(0, 20) + '...');
      return res.status(401).json({ message: 'Invalid token' });
    }
    
    console.log('Auth middleware - token verified for user:', decoded.email);
    
    // Attach the decoded user info to the request
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ message: 'Authentication failed' });
  }
}

/**
 * Middleware to check if user has premium subscription
 */
export function isPremiumMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  const userTier = req.user.tier;
  if (userTier !== 'premium' && userTier !== 'pro') {
    return res.status(403).json({ message: 'Premium subscription required' });
  }
  
  next();
}

/**
 * Middleware to attach the full user object to the request if authenticated
 */
export async function attachUserMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    // Check for token in cookies first (for browser clients)
    let token = req.cookies?.auth_token;
    
    // If no cookie, check Authorization header (for API clients)
    if (!token && req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }
    
    if (token) {
      try {
        const decoded = verifyToken(token);
        if (decoded && decoded.id) {
          try {
            const user = await storage.getUser(decoded.id);
            if (user) {
              (req as any).user = user;
            }
          } catch (userError) {
            console.log('User lookup failed in attach middleware, continuing without user');
          }
        }
      } catch (tokenError) {
        // Token is invalid, but don't fail the request - just continue without user
        console.log('Invalid token in attach user middleware, continuing without user');
      }
    }
    
    next();
  } catch (error) {
    console.error('Attach user middleware error:', error);
    // Don't fail the request, just continue without attaching user
    next();
  }
}