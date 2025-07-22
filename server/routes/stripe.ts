import { Router, Request, Response } from 'express';
import { StripeService } from '../services/stripeService';
import { EmailService } from '../services/emailService';
import { authMiddleware } from '../auth/jwt';
import { storage } from '../storage';

const router = Router();
const stripeService = new StripeService();
const emailService = new EmailService();

/**
 * GET /api/stripe/config
 * Get Stripe publishable key for frontend
 */
router.get('/config', (req: Request, res: Response) => {
  try {
    res.json({
      publishableKey: stripeService.getPublishableKey(),
    });
  } catch (error) {
    console.error('Error getting Stripe config:', error);
    res.status(500).json({ error: 'Failed to get Stripe configuration' });
  }
});

/**
 * POST /api/stripe/create-checkout-session
 * Create Stripe checkout session
 */
router.post('/create-checkout-session', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { amount = 29, tier = 'pro' } = req.body;

    // Get user information
    const user = await storage.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const sessionData = {
      amount,
      currency: 'usd',
      customerEmail: user.email,
      customerName: user.displayName || user.email.split('@')[0],
      tier,
      userId,
    };

    const session = await stripeService.createCheckoutSession(sessionData);

    console.log('Stripe checkout session created:', {
      sessionId: session.id,
      userId,
      customerEmail: user.email,
      amount,
      tier
    });

    res.json({
      success: true,
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error('Error creating Stripe checkout session:', error);
    res.status(500).json({ 
      error: 'Failed to create checkout session',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/stripe/session/:sessionId
 * Retrieve checkout session details
 */
router.get('/session/:sessionId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const session = await stripeService.retrieveSession(sessionId);

    res.json({
      session: {
        id: session.id,
        payment_status: session.payment_status,
        customer_details: session.customer_details,
        amount_total: session.amount_total,
        currency: session.currency,
        metadata: session.metadata,
      },
    });
  } catch (error) {
    console.error('Error retrieving Stripe session:', error);
    res.status(500).json({ error: 'Failed to retrieve session' });
  }
});

/**
 * POST /api/stripe/webhook
 * Handle Stripe webhooks
 */
router.post('/webhook', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;

  try {
    // Verify webhook signature
    const event = stripeService.verifyWebhookSignature(req.body, sig);

    console.log('Stripe webhook received:', {
      type: event.type,
      id: event.id,
    });

    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as any);
        break;
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as any);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as any);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as any);
        break;
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as any);
        break;
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as any);
        break;
      default:
        console.log(`Unhandled Stripe webhook event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    res.status(400).json({ error: 'Webhook signature verification failed' });
  }
});

/**
 * Handle successful checkout completion
 */
async function handleCheckoutCompleted(session: any) {
  try {
    const paymentData = await stripeService.handleSuccessfulPayment(session);
    const { userId, tier, customerId, subscriptionId } = paymentData;

    // Update user tier in database
    await storage.updateUserTier(userId, tier, {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      paymentMethod: 'stripe',
      paymentStatus: 'active',
    });

    // Get user details for email
    const user = await storage.getUserById(userId);
    if (user) {
      // Send payment confirmation email
      await emailService.sendPaymentConfirmation({
        customerName: user.displayName || user.email.split('@')[0],
        customerEmail: user.email,
        amount: session.amount_total / 100, // Convert from cents
        currency: session.currency,
        transactionId: session.id,
        tier,
        paymentMethod: 'Stripe',
        date: new Date(),
      });

      // Send welcome email
      await emailService.sendWelcomeEmail(user.email, user.displayName || user.email.split('@')[0], tier);
    }

    console.log(`User ${userId} upgraded to ${tier} tier via Stripe`);
  } catch (error) {
    console.error('Error handling checkout completion:', error);
  }
}

/**
 * Handle subscription creation
 */
async function handleSubscriptionCreated(subscription: any) {
  console.log('Subscription created:', {
    id: subscription.id,
    customerId: subscription.customer,
    status: subscription.status,
  });
}

/**
 * Handle subscription updates
 */
async function handleSubscriptionUpdated(subscription: any) {
  console.log('Subscription updated:', {
    id: subscription.id,
    status: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  });

  // Handle subscription cancellation
  if (subscription.cancel_at_period_end) {
    console.log(`Subscription ${subscription.id} will be canceled at period end`);
  }
}

/**
 * Handle subscription deletion
 */
async function handleSubscriptionDeleted(subscription: any) {
  console.log('Subscription deleted:', {
    id: subscription.id,
    customerId: subscription.customer,
  });

  // Find user by Stripe subscription ID and downgrade
  const user = await storage.getUserByStripeSubscriptionId(subscription.id);
  if (user) {
    await storage.updateUserTier(user.id, 'free', {
      stripeSubscriptionId: null,
      paymentStatus: 'canceled',
    });
    console.log(`User ${user.id} downgraded to free tier due to subscription cancellation`);
  }
}

/**
 * Handle successful invoice payment
 */
async function handleInvoicePaymentSucceeded(invoice: any) {
  console.log('Invoice payment succeeded:', {
    id: invoice.id,
    customerId: invoice.customer,
    subscriptionId: invoice.subscription,
    amountPaid: invoice.amount_paid / 100,
  });

  // This is for recurring payments - ensure user tier is maintained
  if (invoice.subscription) {
    const user = await storage.getUserByStripeSubscriptionId(invoice.subscription);
    if (user && user.tier !== 'pro') {
      await storage.updateUserTier(user.id, 'pro', {
        paymentStatus: 'active',
      });
      console.log(`User ${user.id} tier refreshed to pro due to successful recurring payment`);
    }
  }
}

/**
 * Handle failed invoice payment
 */
async function handleInvoicePaymentFailed(invoice: any) {
  console.error('Invoice payment failed:', {
    id: invoice.id,
    customerId: invoice.customer,
    subscriptionId: invoice.subscription,
  });

  // Find user and send notification
  if (invoice.subscription) {
    const user = await storage.getUserByStripeSubscriptionId(invoice.subscription);
    if (user) {
      await emailService.sendPaymentFailureNotification(
        user.email,
        user.displayName || user.email.split('@')[0],
        'Payment method declined or insufficient funds'
      );
      console.log(`Payment failure notification sent to user ${user.id}`);
    }
  }
}

export default router;