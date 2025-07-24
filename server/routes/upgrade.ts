import { Router } from 'express';
import { Request, Response } from 'express';
import { authMiddleware } from '../auth/jwt';
import { getUserTierInfo } from '../middleware/tierLimits';
import { generateToken } from '../auth/jwt';
const router = Router();

/**
 * GET /api/upgrade/plans
 * Get available upgrade plans
 */
router.get('/plans', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    
    // Use the same database query logic as the status endpoint for accurate page counts
    const { db } = await import('../db');
    const { scripts, promoCodeUsage } = await import('../../shared/schema');
    const { eq } = await import('drizzle-orm');
    
    // Check for promo code usage
    const hasPromoCode = await db.select()
      .from(promoCodeUsage)
      .where(eq(promoCodeUsage.userEmail, user.email.toLowerCase()));
    
    const shouldBeProTier = hasPromoCode.length > 0;
    const isPremiumDemo = user.email === 'premium@demo.com' || 
                         user.id === '119' || 
                         user.id === 119;
    
    // Calculate actual used pages by summing page_count from user's scripts
    const userIdForQuery = String(user.uid || user.id);
    const userScripts = await db.select()
      .from(scripts)
      .where(eq(scripts.userId, userIdForQuery));
    
    const actualUsedPages = userScripts.reduce((total, script) => {
      return total + (script.pageCount || 0);
    }, 0);
    
    // Determine final tier
    const finalTier = isPremiumDemo || shouldBeProTier ? 'pro' : 'free';
    
    const plans = [
      {
        id: 'free',
        name: 'Free',
        price: 0,
        currency: 'USD',
        interval: 'month',
        features: [
          'Up to 5 pages per month',
          'Maximum 5 shots per scene',
          'Basic shot generation',
          'CSV export',
          'Email support'
        ],
        limitations: [
          'No storyboard generation',
          'Limited shots per scene',
          'Monthly page limit'
        ],
        current: finalTier === 'free'
      },
      {
        id: 'pro',
        name: 'Pro',
        price: 29,
        currency: 'USD',
        interval: 'month',
        features: [
          'Unlimited pages',
          'Unlimited shots per scene',
          'AI storyboard generation',
          'Visual storyboards with DALL-E',
          'Individual image regeneration',
          'Advanced shot analysis',
          'Priority support',
          'CSV & ZIP exports'
        ],
        limitations: [],
        current: finalTier === 'pro',
        popular: true
      }
    ];

    res.json({
      plans,
      currentTier: finalTier,
      usage: {
        pagesUsed: actualUsedPages,
        totalPages: finalTier === 'pro' ? -1 : 5,
        canGenerateStoryboards: finalTier === 'pro'
      }
    });
  } catch (error) {
    console.error('Error getting upgrade plans:', error);
    res.status(500).json({ error: 'Failed to get upgrade plans' });
  }
});

/**
 * POST /api/upgrade/create-checkout-session
 * Create PayU payment session for Pro upgrade
 */
router.post('/create-checkout-session', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.email) {
      return res.status(400).json({ error: 'User email required for checkout' });
    }

    // BYPASS JWT COMPLETELY - Always check fresh database data
    const { storage } = await import('../storage');
    const dbUser = await storage.getUserByEmail(user.email);
    
    if (!dbUser) {
      return res.status(404).json({ error: 'User not found in database' });
    }
    
    const currentTier = dbUser.tier;
    
    console.log(`[UPGRADE] User ${user.email} - JWT tier: ${user.tier}, DB tier: ${currentTier}`);
    
    // AUTOMATIC TIER CORRECTION: Fix any accounts with incorrect pro tier
    if (currentTier === 'pro' && user.email !== 'premium@demo.com') {
      // Check if they have a valid promo code - if yes, they should be pro
      const { db } = await import('../db');
      const { promoCodeUsage } = await import('../../shared/schema');
      const { eq } = await import('drizzle-orm');
      
      const hasPromoCode = await db.select()
        .from(promoCodeUsage)
        .where(eq(promoCodeUsage.userEmail, user.email.toLowerCase()));
      
      if (hasPromoCode.length > 0) {
        console.log(`✅ VALID PRO ACCOUNT: ${user.email} has promo code, blocking upgrade`);
        return res.status(400).json({ 
          error: 'You already have a Pro account with unlimited access to all features. No upgrade needed!' 
        });
      } else {
        // They don't have promo code but database shows pro - fix this immediately
        console.log(`🔧 AUTO-FIXING INCORRECT PRO TIER: ${user.email} has no promo code, correcting to free tier`);
        await storage.updateUser(dbUser.id, {
          tier: 'free',
          totalPages: 10,
          maxShotsPerScene: 5,
          canGenerateStoryboards: false
        });
        
        // Generate fresh JWT with corrected tier
        const correctedToken = generateToken({
          ...dbUser,
          tier: 'free',
          totalPages: 10,
          maxShotsPerScene: 5,
          canGenerateStoryboards: false
        });
        
        // Update cookie immediately
        const cookieOptions = {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax' as const,
          maxAge: 30 * 24 * 60 * 60 * 1000,
          path: '/',
        };
        res.cookie('auth_token', correctedToken, cookieOptions);
        
        console.log(`✅ TIER CORRECTED: ${user.email} now has free tier and fresh JWT token`);
        
        // Continue with upgrade process since they're now confirmed free tier
      }
    }
    
    if (user.email === 'premium@demo.com') {
      return res.status(400).json({ 
        error: 'Demo account already has pro access. This is a test account.' 
      });
    }
    
    // Additional debug logging
    console.log(`[UPGRADE] Processing payment for free tier user: ${user.email}`);
    console.log(`[UPGRADE] Database confirms free tier - proceeding with payment`);
    console.log(`[UPGRADE] User usage: ${dbUser?.usedPages || 0} pages used`);
    console.log(`[UPGRADE] Proceeding with PayU payment setup for free tier user`);
    
    // Generate fresh JWT with correct tier immediately to fix any cache issues
    const freshToken = generateToken(dbUser);
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/',
    };
    res.cookie('auth_token', freshToken, cookieOptions);

    // Import PayU service
    const { PayUService } = await import('../services/payuService');
    const payuService = new PayUService();

    // Create payment parameters
    const paymentParams = payuService.createPaymentParams(
      29, // $29 USD
      user.email,
      user.displayName || user.email.split('@')[0],
      '', // phone - optional
      'pro'
    );

    // Store payment info for verification (simplified for demo)
    const pendingPayments = (global as any).pendingPayments || new Map();
    (global as any).pendingPayments = pendingPayments;
    
    const paymentInfo = {
      txnid: paymentParams.txnid,
      email: user.email,
      amount: 29,
      tier: 'pro',
      timestamp: Date.now()
    };
    
    pendingPayments.set(paymentParams.txnid, paymentInfo);
    console.log('Payment session created:', {
      txnid: paymentParams.txnid,
      email: user.email,
      amount: 29
    });
    console.log('Total pending payments:', pendingPayments.size);

    const paymentUrl = payuService.getPaymentUrl();
    
    // Generate complete payment form HTML for direct redirect
    const paymentForm = payuService.generatePaymentForm(paymentParams, paymentUrl);
    
    const response = {
      success: true,
      redirectUrl: `/api/payu/redirect/${paymentParams.txnid}`,
      txnid: paymentParams.txnid,
      // For frontend testing - return both methods
      paymentParams: paymentParams,
      paymentUrl: paymentUrl,
      paymentForm: paymentForm
    };
    
    console.log('Sending checkout response:', {
      redirectUrl: response.redirectUrl,
      txnid: response.txnid,
      hasPaymentParams: !!response.paymentParams,
      hasPaymentForm: !!response.paymentForm,
      paymentUrl: response.paymentUrl
    });
    
    res.json(response);

  } catch (error) {
    console.error('PayU checkout error:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

/**
 * POST /api/upgrade/verify-payment
 * Verify PayU payment and upgrade user account
 */
router.post('/verify-payment', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { txnid } = req.body;
    const user = (req as any).user;

    if (!txnid) {
      return res.status(400).json({ error: 'Transaction ID required' });
    }

    // Check if payment was successful (simplified for demo)
    const pendingPayments = (global as any).pendingPayments || new Map();
    const payment = pendingPayments.get(txnid);
    
    if (!payment) {
      return res.status(400).json({ error: 'Payment session not found' });
    }

    if (payment.email !== user.email) {
      return res.status(403).json({ error: 'Payment session does not match user' });
    }

    // Upgrade user using quota manager
    const { productionQuotaManager } = await import('../lib/productionQuotaManager');
    await productionQuotaManager.upgradeToPro(user.email);
    
    // Clean up payment session
    pendingPayments.delete(txnid);
    
    res.json({
      success: true,
      message: 'Account upgraded to Pro successfully!',
      tier: 'pro',
      features: {
        unlimitedPages: true,
        unlimitedShots: true,
        storyboardGeneration: true
      }
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

/**
 * GET /api/upgrade/status
 * Get current user upgrade status and limitations
 */
router.get('/status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    console.log('🔍 UPGRADE STATUS DEBUG: User data received:', {
      id: user.id,
      uid: user.uid,
      email: user.email,
      tier: user.tier
    });
    
    // DYNAMIC PROMO CODE VALIDATION: Check if user has promo code usage
    const { db } = await import('../db');
    const { promoCodeUsage } = await import('../../shared/schema');
    const { eq } = await import('drizzle-orm');
    
    const hasPromoCode = await db.select()
      .from(promoCodeUsage)
      .where(eq(promoCodeUsage.userEmail, user.email.toLowerCase()));
    
    const shouldBeProTier = hasPromoCode.length > 0;
    console.log('🔍 UPGRADE STATUS: Promo code check for', user.email, ':', shouldBeProTier ? 'Pro tier (has promo code)' : 'Free tier (no promo code)');
    
    // Only special override for premium demo account for development purposes
    const isPremiumDemo = user.email === 'premium@demo.com' || 
                         user.id === '119' || 
                         user.id === 119;
    
    // Calculate actual used pages by summing page_count from user's scripts
    const { scripts } = await import('../../shared/schema');
    
    // Ensure user ID is properly converted to string format for database query
    const userIdForQuery = String(user.uid || user.id);
    
    const userScripts = await db.select()
      .from(scripts)
      .where(eq(scripts.userId, userIdForQuery));
    
    // Sum up actual page counts from all scripts instead of just counting scripts
    const actualUsedPages = userScripts.reduce((total, script) => {
      return total + (script.pageCount || 0);
    }, 0);
    
    console.log('📊 UPGRADE STATUS: User page count:', {
      originalUserId: user.uid || user.id,
      userIdForQuery,
      email: user.email,
      scriptCount: userScripts.length,
      actualUsedPages,
      scriptPageCounts: userScripts.map(s => ({ id: s.id, title: s.title, pageCount: s.pageCount }))
    });
    
    // Determine final tier based on promo code usage or premium demo status
    const finalTier = isPremiumDemo || shouldBeProTier ? 'pro' : 'free';
    const finalQuota = {
      tier: finalTier,
      totalPages: finalTier === 'pro' ? -1 : 10,
      usedPages: actualUsedPages,
      maxShotsPerScene: finalTier === 'pro' ? -1 : 5,
      canGenerateStoryboards: finalTier === 'pro'
    };
    
    if (isPremiumDemo) {
      console.log('🔒 UPGRADE STATUS: Applied pro tier override for premium@demo.com');
    }
    if (shouldBeProTier) {
      console.log('🔒 UPGRADE STATUS: Applied pro tier for promo code user:', user.email);
    }
    
    const responseData = {
      tier: finalQuota.tier,
      limits: {
        totalPages: finalQuota.totalPages,
        usedPages: finalQuota.usedPages,
        maxShotsPerScene: finalQuota.maxShotsPerScene,
        canGenerateStoryboards: finalQuota.canGenerateStoryboards
      },
      usage: {
        pagesRemaining: finalQuota.totalPages === -1 ? 'unlimited' : Math.max(0, finalQuota.totalPages - finalQuota.usedPages),
        percentageUsed: finalQuota.totalPages === -1 ? 0 : Math.round((finalQuota.usedPages / finalQuota.totalPages) * 100)
      },
      needsUpgrade: {
        forStoryboards: !finalQuota.canGenerateStoryboards,
        forMorePages: finalQuota.totalPages !== -1 && finalQuota.usedPages >= finalQuota.totalPages * 0.8,
        forMoreShots: finalQuota.maxShotsPerScene !== -1
      }
    };
    
    // Force cache invalidation and disable ETags
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Last-Modified', new Date().toUTCString());
    res.removeHeader('ETag');
    
    console.log('Sending upgrade status response:', responseData);
    res.status(200).json(responseData);
  } catch (error) {
    console.error('Error getting upgrade status:', error);
    res.status(500).json({ error: 'Failed to get upgrade status' });
  }
});

/**
 * POST /api/upgrade/clear-cache
 * Clear authentication cache and force database tier check
 */
router.post('/clear-cache', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.email) {
      return res.status(400).json({ error: 'User email required' });
    }

    // Get fresh user data from database
    const { storage } = await import('../storage');
    const dbUser = await storage.getUserByEmail(user.email);
    
    if (!dbUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate fresh JWT with correct tier
    const freshToken = generateToken(dbUser);
    
    // Set new cookie
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/',
    };
    
    res.cookie('auth_token', freshToken, cookieOptions);
    
    console.log(`[CLEAR CACHE] Updated tier for ${user.email}: ${dbUser.tier}`);
    
    res.json({
      message: 'Cache cleared and tier refreshed',
      tier: dbUser.tier,
      totalPages: dbUser.totalPages,
      canGenerateStoryboards: dbUser.canGenerateStoryboards
    });
    
  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

export default router;