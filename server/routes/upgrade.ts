import { Router } from 'express';
import { Request, Response } from 'express';
import { authMiddleware } from '../auth/jwt';
import { getUserTierInfo } from '../middleware/tierLimits';
const router = Router();

/**
 * GET /api/upgrade/plans
 * Get available upgrade plans
 */
router.get('/plans', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const currentTier = getUserTierInfo(user);

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
        current: currentTier.tier === 'free'
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
        current: currentTier.tier === 'pro',
        popular: true
      }
    ];

    res.json({
      plans,
      currentTier: currentTier.tier,
      usage: {
        pagesUsed: currentTier.usedPages,
        totalPages: currentTier.totalPages,
        canGenerateStoryboards: currentTier.canGenerateStoryboards
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

    const currentTier = getUserTierInfo(user);
    if (currentTier.tier === 'pro') {
      return res.status(400).json({ error: 'Already on pro tier' });
    }

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
    
    // Use production quota manager for accurate tier information
    const { productionQuotaManager } = await import('../lib/productionQuotaManager');
    // Use Firebase UID (user.id) instead of email to match auth endpoint
    const actualQuota = await productionQuotaManager.getUserQuota(user.id, user.tier);
    
    console.log('🔍 UPGRADE STATUS DEBUG: Actual quota from manager:', actualQuota);
    
    // Use storage layer data which includes dynamic promo code validation
    // Only special override for premium demo account for development purposes
    const isPremiumDemo = user.email === 'premium@demo.com' || 
                         user.id === '119' || 
                         user.id === 119;
    const finalQuota = isPremiumDemo ? {
      tier: 'pro',
      totalPages: -1,
      usedPages: 0,
      maxShotsPerScene: -1,
      canGenerateStoryboards: true
    } : actualQuota;
    
    if (isPremiumDemo) {
      console.log('🔒 UPGRADE STATUS: Applied pro tier override for premium@demo.com');
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

export default router;