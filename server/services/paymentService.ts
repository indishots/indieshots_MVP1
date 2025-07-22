// Central payment service that handles both PayU and Stripe integrations
import { StripeService } from './stripeService';
import { PayuService } from './payuService';
import { EmailService } from './emailService';
import { storage } from '../storage';

export interface PaymentMethodInfo {
  id: string;
  name: string;
  description: string;
  currencies: string[];
  regions: string[];
  available: boolean;
}

export interface CreatePaymentSessionRequest {
  method: string;
  amount: number;
  currency: string;
  userId: string;
  userEmail: string;
  userDisplayName?: string;
}

export interface CreatePaymentSessionResponse {
  success: boolean;
  url?: string;
  redirectUrl?: string;
  sessionId?: string;
  error?: string;
}

export class PaymentService {
  private stripeService?: StripeService;
  private payuService: PayuService;
  private emailService: EmailService;

  constructor() {
    // Initialize PayU (always available)
    this.payuService = new PayuService();
    
    // Initialize Stripe (optional in development)
    try {
      this.stripeService = new StripeService();
    } catch (error) {
      console.warn('Stripe service unavailable:', error.message);
    }

    // Initialize email service
    this.emailService = new EmailService();
  }

  /**
   * Get available payment methods
   */
  getAvailablePaymentMethods(): PaymentMethodInfo[] {
    const methods: PaymentMethodInfo[] = [];

    // PayU method
    methods.push({
      id: 'payu',
      name: 'PayU',
      description: 'Secure payments for India - Credit/Debit Cards, Net Banking, UPI',
      currencies: ['inr'],
      regions: ['India'],
      available: true
    });

    // Stripe method (if available)
    if (this.stripeService) {
      methods.push({
        id: 'stripe',
        name: 'Stripe',
        description: 'Global payments - Credit/Debit Cards, Apple Pay, Google Pay',
        currencies: ['usd', 'eur', 'gbp'],
        regions: ['global'],
        available: true
      });
    }

    return methods;
  }

  /**
   * Auto-detect best payment method based on currency
   */
  getRecommendedPaymentMethod(currency: string): string {
    if (currency.toLowerCase() === 'inr') {
      return 'payu';
    }
    
    if (this.stripeService && ['usd', 'eur', 'gbp'].includes(currency.toLowerCase())) {
      return 'stripe';
    }

    // Default fallback
    return this.stripeService ? 'stripe' : 'payu';
  }

  /**
   * Create payment session with appropriate provider
   */
  async createPaymentSession(request: CreatePaymentSessionRequest): Promise<CreatePaymentSessionResponse> {
    try {
      const { method, amount, currency, userId, userEmail, userDisplayName } = request;

      // Auto-detect method if 'auto' is specified
      const actualMethod = method === 'auto' 
        ? this.getRecommendedPaymentMethod(currency)
        : method;

      console.log(`Creating payment session: ${actualMethod}, ${amount} ${currency.toUpperCase()} for ${userEmail}`);

      if (actualMethod === 'stripe' && this.stripeService) {
        // Create Stripe session
        const session = await this.stripeService.createCheckoutSession({
          amount,
          currency,
          customerEmail: userEmail,
          customerName: userDisplayName,
          tier: 'pro',
          userId
        });

        return {
          success: true,
          url: session.url || undefined,
          sessionId: session.id
        };

      } else if (actualMethod === 'payu') {
        // Create PayU session
        const payuResult = await this.payuService.createPaymentSession({
          amount,
          currency: 'INR', // PayU only supports INR
          customerEmail: userEmail,
          customerName: userDisplayName || 'IndieShots User',
          tier: 'pro',
          userId
        });

        return {
          success: true,
          redirectUrl: payuResult.redirectUrl,
          sessionId: payuResult.txnId
        };

      } else {
        return {
          success: false,
          error: `Payment method ${actualMethod} is not available`
        };
      }

    } catch (error) {
      console.error('Payment session creation failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to create payment session'
      };
    }
  }

  /**
   * Handle successful payment and upgrade user
   */
  async handleSuccessfulPayment(userId: string, paymentInfo: any): Promise<void> {
    try {
      // Update user tier to pro
      const paymentData = {
        paymentMethod: paymentInfo.method,
        paymentStatus: 'active',
        ...(paymentInfo.stripeCustomerId && { stripeCustomerId: paymentInfo.stripeCustomerId }),
        ...(paymentInfo.stripeSubscriptionId && { stripeSubscriptionId: paymentInfo.stripeSubscriptionId }),
        ...(paymentInfo.payuTransactionId && { payuTransactionId: paymentInfo.payuTransactionId }),
        ...(paymentInfo.payuTxnId && { payuTxnId: paymentInfo.payuTxnId })
      };

      await storage.updateUserTier(userId, 'pro', paymentData);
      
      // Send confirmation email
      const user = await storage.getUserByProviderId(userId);
      if (user?.email) {
        await this.emailService.sendPaymentConfirmation({
          email: user.email,
          name: user.displayName || user.firstName || 'IndieShots User',
          amount: paymentInfo.amount || 29,
          currency: paymentInfo.currency || 'USD',
          method: paymentInfo.method,
          transactionId: paymentInfo.transactionId
        });

        // Send welcome email for new Pro users
        await this.emailService.sendWelcomeEmail({
          email: user.email,
          name: user.displayName || user.firstName || 'IndieShots User'
        });
      }

      console.log(`✅ Payment processed successfully for user ${userId}`);
      
    } catch (error) {
      console.error('Failed to handle successful payment:', error);
      throw error;
    }
  }

  /**
   * Get payment environment info
   */
  getEnvironmentInfo() {
    return {
      environment: process.env.NODE_ENV || 'development',
      payuMode: process.env.NODE_ENV === 'production' ? 'live' : 'test',
      stripeMode: process.env.NODE_ENV === 'production' ? 'live' : 'test',
      stripeAvailable: !!this.stripeService,
      payuAvailable: true
    };
  }
}

// Export singleton instance
export const paymentService = new PaymentService();