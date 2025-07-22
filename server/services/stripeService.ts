import Stripe from 'stripe';

export interface StripeConfig {
  secretKey: string;
  publishableKey: string;
  webhookSecret: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSessionData {
  priceId?: string;
  amount: number;
  currency: string;
  customerEmail: string;
  customerName?: string;
  tier: string;
  userId: string;
}

export class StripeService {
  private stripe: Stripe;
  private config: StripeConfig;

  constructor() {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      // In development mode, provide a warning but don't crash
      if (process.env.NODE_ENV !== 'production') {
        console.warn('⚠️  STRIPE_SECRET_KEY not found - Stripe payments will not work');
        this.stripe = null as any;
        this.config = {} as StripeConfig;
        return;
      }
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }

    this.stripe = new Stripe(secretKey, {
      apiVersion: '2025-05-28.basil',
    });

    const baseUrl = process.env.NODE_ENV === 'production' 
      ? process.env.BASE_URL || 'https://indieshots.onrender.com'
      : 'http://localhost:5000';

    this.config = {
      secretKey,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
      successUrl: `${baseUrl}/payment/success`,
      cancelUrl: `${baseUrl}/payment/cancel`
    };

    console.log('Stripe Service initialized');
    console.log(`Success URL: ${this.config.successUrl}`);
    console.log(`Cancel URL: ${this.config.cancelUrl}`);
  }

  /**
   * Create Stripe checkout session
   */
  async createCheckoutSession(data: CheckoutSessionData): Promise<Stripe.Checkout.Session> {
    try {
      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: data.currency,
              product_data: {
                name: `IndieShots ${data.tier.charAt(0).toUpperCase() + data.tier.slice(1)} Plan`,
                description: data.tier === 'pro' 
                  ? 'Unlimited pages, unlimited shots, AI storyboards, priority support'
                  : 'Basic plan with limited features',
                images: ['https://your-domain.com/indieshots-logo.png'], // Add your logo URL
              },
              unit_amount: Math.round(data.amount * 100), // Convert to cents
            },
            quantity: 1,
          },
        ],
        mode: 'subscription', // Change to 'payment' for one-time payments
        success_url: `${this.config.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: this.config.cancelUrl,
        customer_email: data.customerEmail,
        metadata: {
          userId: data.userId,
          tier: data.tier,
          plan: `indieshots_${data.tier}`,
        },
        subscription_data: {
          metadata: {
            userId: data.userId,
            tier: data.tier,
          },
        },
        billing_address_collection: 'auto',
        automatic_tax: {
          enabled: true,
        },
      };

      const session = await this.stripe.checkout.sessions.create(sessionParams);
      
      console.log('Stripe checkout session created:', {
        sessionId: session.id,
        userId: data.userId,
        tier: data.tier,
        amount: data.amount
      });

      return session;
    } catch (error) {
      console.error('Failed to create Stripe checkout session:', error);
      throw error;
    }
  }

  /**
   * Retrieve checkout session
   */
  async retrieveSession(sessionId: string): Promise<Stripe.Checkout.Session> {
    try {
      return await this.stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['customer', 'subscription']
      });
    } catch (error) {
      console.error('Failed to retrieve checkout session:', error);
      throw error;
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string | Buffer, signature: string): Stripe.Event {
    try {
      return this.stripe.webhooks.constructEvent(
        payload,
        signature,
        this.config.webhookSecret
      );
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      throw new Error('Invalid webhook signature');
    }
  }

  /**
   * Handle successful payment
   */
  async handleSuccessfulPayment(session: Stripe.Checkout.Session): Promise<{
    userId: string;
    tier: string;
    customerId?: string;
    subscriptionId?: string;
  }> {
    const userId = session.metadata?.userId;
    const tier = session.metadata?.tier;

    if (!userId || !tier) {
      throw new Error('Missing required metadata in session');
    }

    return {
      userId,
      tier,
      customerId: typeof session.customer === 'string' ? session.customer : session.customer?.id,
      subscriptionId: typeof session.subscription === 'string' ? session.subscription : session.subscription?.id,
    };
  }

  /**
   * Create price for subscription
   */
  async createPrice(productId: string, amount: number, currency: string = 'usd', interval: 'month' | 'year' = 'month'): Promise<Stripe.Price> {
    try {
      return await this.stripe.prices.create({
        unit_amount: Math.round(amount * 100),
        currency,
        recurring: {
          interval,
        },
        product: productId,
      });
    } catch (error) {
      console.error('Failed to create Stripe price:', error);
      throw error;
    }
  }

  /**
   * Create product
   */
  async createProduct(name: string, description?: string): Promise<Stripe.Product> {
    try {
      return await this.stripe.products.create({
        name,
        description,
        type: 'service',
      });
    } catch (error) {
      console.error('Failed to create Stripe product:', error);
      throw error;
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    try {
      return await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
      throw error;
    }
  }

  /**
   * Get customer's subscriptions
   */
  async getCustomerSubscriptions(customerId: string): Promise<Stripe.Subscription[]> {
    try {
      const subscriptions = await this.stripe.subscriptions.list({
        customer: customerId,
        status: 'active',
      });
      return subscriptions.data;
    } catch (error) {
      console.error('Failed to get customer subscriptions:', error);
      throw error;
    }
  }

  /**
   * Get publishable key for frontend
   */
  getPublishableKey(): string {
    return this.config.publishableKey;
  }
}