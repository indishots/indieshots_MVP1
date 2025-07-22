import { Router, Request, Response } from 'express';
import { StripeService } from '../services/stripeService';
import { PayUService } from '../services/payuService';
import { authMiddleware } from '../auth/jwt';
import { storage } from '../storage';

const router = Router();

// Initialize payment services
let stripeService: StripeService | null = null;
let payuService: PayUService | null = null;

// Initialize services with error handling
try {
  if (process.env.STRIPE_SECRET_KEY) {
    stripeService = new StripeService();
  }
  payuService = new PayUService();
} catch (error) {
  console.error('Error initializing payment services:', error);
}

/**
 * GET /api/payments/methods
 * Get available payment methods
 */
router.get('/methods', (req: Request, res: Response) => {
  const methods = [];

  if (stripeService) {
    methods.push({
      id: 'stripe',
      name: 'Stripe',
      description: 'Credit/Debit Cards, Digital Wallets',
      currencies: ['usd', 'eur', 'gbp'],
      regions: ['global'],
      logo: '/stripe-logo.png'
    });
  }

  if (payuService) {
    methods.push({
      id: 'payu',
      name: 'PayU',
      description: 'UPI, Net Banking, Cards, Wallets',
      currencies: ['inr'],
      regions: ['india'],
      logo: '/payu-logo.png'
    });
  }

  res.json({ methods });
});

/**
 * POST /api/payments/create-session
 * Create payment session based on preferred method
 */
router.post('/create-session', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { 
      method = 'auto', // 'stripe', 'payu', or 'auto'
      amount = 29, 
      currency = 'usd',
      tier = 'pro' 
    } = req.body;

    // Get user information
    const user = await storage.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Auto-detect best payment method based on currency/region
    let selectedMethod = method;
    if (method === 'auto') {
      selectedMethod = currency === 'inr' ? 'payu' : 'stripe';
    }

    // Create session based on selected method
    if (selectedMethod === 'stripe' && stripeService) {
      const sessionData = {
        amount: currency === 'inr' ? amount : amount, // Keep original amount
        currency: currency === 'inr' ? 'usd' : currency, // Convert INR to USD for Stripe
        customerEmail: user.email,
        customerName: user.displayName || user.email.split('@')[0],
        tier,
        userId,
      };

      const session = await stripeService.createCheckoutSession(sessionData);

      res.json({
        success: true,
        method: 'stripe',
        sessionId: session.id,
        url: session.url,
      });

    } else if (selectedMethod === 'payu' && payuService) {
      const paymentParams = payuService.createPaymentParams(
        amount,
        user.email,
        user.displayName || user.email.split('@')[0],
        '', // phone
        tier
      );

      // Store pending payment
      const pendingPayments = (global as any).pendingPayments || new Map();
      pendingPayments.set(paymentParams.txnid, {
        txnid: paymentParams.txnid,
        email: user.email,
        amount,
        tier,
        timestamp: Date.now(),
      });

      const baseUrl = process.env.NODE_ENV === 'production' 
        ? process.env.BASE_URL || 'https://indieshots.onrender.com'
        : 'http://localhost:5000';

      res.json({
        success: true,
        method: 'payu',
        redirectUrl: `${baseUrl}/api/payu/redirect/${paymentParams.txnid}`,
        paymentParams,
      });

    } else {
      res.status(400).json({ 
        error: 'Payment method not available',
        availableMethods: stripeService ? ['stripe', 'payu'] : ['payu']
      });
    }

  } catch (error) {
    console.error('Error creating payment session:', error);
    res.status(500).json({ 
      error: 'Failed to create payment session',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/payments/session/:sessionId
 * Get payment session status
 */
router.get('/session/:sessionId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { method = 'stripe' } = req.query;

    if (method === 'stripe' && stripeService) {
      const session = await stripeService.retrieveSession(sessionId);
      res.json({
        id: session.id,
        status: session.payment_status,
        amount: session.amount_total,
        currency: session.currency,
        customer: session.customer_details,
      });
    } else {
      res.status(400).json({ error: 'Method not supported for session retrieval' });
    }
  } catch (error) {
    console.error('Error retrieving payment session:', error);
    res.status(500).json({ error: 'Failed to retrieve session' });
  }
});

/**
 * POST /api/payments/cancel-subscription
 * Cancel user subscription
 */
router.post('/cancel-subscription', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await storage.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Cancel Stripe subscription if exists
    if (user.stripeSubscriptionId && stripeService) {
      await stripeService.cancelSubscription(user.stripeSubscriptionId);
      console.log(`Cancelled Stripe subscription for user ${userId}`);
    }

    // Update user tier to free (will be effective at period end for Stripe)
    await storage.updateUserTier(userId, 'free', {
      paymentStatus: 'canceled',
    });

    res.json({ 
      success: true, 
      message: 'Subscription cancelled. Access will continue until the end of the billing period.' 
    });

  } catch (error) {
    console.error('Error cancelling subscription:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

/**
 * GET /api/payments/invoices
 * Get user's payment history/invoices
 */
router.get('/invoices', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get payment history from database
    const paymentHistory = await storage.getUserPaymentHistory(userId);

    res.json({ 
      invoices: paymentHistory || []
    });

  } catch (error) {
    console.error('Error getting payment history:', error);
    res.status(500).json({ error: 'Failed to get payment history' });
  }
});

export default router;