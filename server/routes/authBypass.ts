import { Router } from 'express';
import { Request, Response } from 'express';

const router = Router();

/**
 * GET /api/auth-bypass/user/:email
 * Bypass authentication to get user data for post-payment processing
 */
router.get('/user/:email', async (req: Request, res: Response) => {
  try {
    const { email } = req.params;
    
    console.log('🚨 AUTH BYPASS: Getting user data for:', email);
    
    const { storage } = await import('../storage');
    const user = await storage.getUserByEmail(email);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Calculate used pages
    const { db } = await import('../db');
    const { scripts } = await import('../../shared/schema');
    const { eq } = await import('drizzle-orm');
    
    const userScripts = await db.select()
      .from(scripts)
      .where(eq(scripts.userId, String(user.id)));
    
    const usedPages = userScripts.reduce((total, script) => {
      return total + (script.pageCount || 0);
    }, 0);
    
    const response = {
      id: user.id,
      email: user.email,
      tier: user.tier || 'free',
      totalPages: user.totalPages !== undefined ? user.totalPages : (user.tier === 'pro' ? -1 : 10),
      usedPages: usedPages,
      maxShotsPerScene: user.maxShotsPerScene || (user.tier === 'pro' ? -1 : 5),
      canGenerateStoryboards: user.canGenerateStoryboards !== undefined ? user.canGenerateStoryboards : (user.tier === 'pro'),
      displayName: user.displayName,
      isPro: user.tier === 'pro'
    };
    
    console.log('✅ AUTH BYPASS: Returning user data:', { email, tier: response.tier, isPro: response.isPro });
    res.json(response);
    
  } catch (error) {
    console.error('❌ AUTH BYPASS ERROR:', error);
    res.status(500).json({ error: 'Failed to get user data' });
  }
});

/**
 * POST /api/auth-bypass/regenerate-token/:email
 * Regenerate JWT token for user after payment
 */
router.post('/regenerate-token/:email', async (req: Request, res: Response) => {
  try {
    const { email } = req.params;
    
    console.log('🔄 AUTH BYPASS: Regenerating token for:', email);
    
    const { storage } = await import('../storage');
    const user = await storage.getUserByEmail(email);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Generate fresh JWT token
    const { generateToken } = await import('../auth/jwt');
    const tokenPayload = {
      id: user.id,
      uid: user.id,
      email: user.email,
      tier: user.tier || 'free',
      totalPages: user.totalPages !== undefined ? user.totalPages : (user.tier === 'pro' ? -1 : 10),
      maxShotsPerScene: user.maxShotsPerScene || (user.tier === 'pro' ? -1 : 5),
      canGenerateStoryboards: user.canGenerateStoryboards !== undefined ? user.canGenerateStoryboards : (user.tier === 'pro'),
      displayName: user.displayName
    };
    
    const newToken = generateToken(tokenPayload);
    
    // Set cookie
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/',
    };
    res.cookie('auth_token', newToken, cookieOptions);
    
    console.log('✅ AUTH BYPASS: Token regenerated and cookie set for:', email);
    
    res.json({ 
      success: true, 
      token: newToken.substring(0, 20) + '...',
      user: tokenPayload
    });
    
  } catch (error) {
    console.error('❌ AUTH BYPASS TOKEN ERROR:', error);
    res.status(500).json({ error: 'Failed to regenerate token' });
  }
});

export default router;