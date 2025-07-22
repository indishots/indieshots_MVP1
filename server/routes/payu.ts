import { Router, Request, Response } from 'express';
import { PayUService } from '../services/payuService';
import { authMiddleware } from '../auth/jwt';
import { storage } from '../storage';
import crypto from 'crypto';

const router = Router();
const payuService = new PayUService();

// Store pending payments in memory (in production, use Redis or database)
// Use global to share with upgrade.ts
if (!(global as any).pendingPayments) {
  (global as any).pendingPayments = new Map<string, {
    txnid: string;
    email: string;
    amount: number;
    tier: string;
    timestamp: number;
  }>();
}
const pendingPayments = (global as any).pendingPayments;

/**
 * GET /api/payu/redirect/:txnid
 * Direct redirect to PayU with payment form
 * Uses optional auth to associate payment with user
 */
router.get('/redirect/:txnid', async (req: Request, res: Response) => {
  try {
    const { txnid } = req.params;
    
    // Find pending payment - this validates the payment session exists
    const paymentInfo = pendingPayments.get(txnid);
    if (!paymentInfo) {
      console.log('Payment session not found for txnid:', txnid);
      return res.status(404).send(`
        <html>
          <body>
            <h2>Payment Session Not Found</h2>
            <p>The payment session has expired or is invalid.</p>
            <a href="/upgrade">Return to Upgrade Page</a>
          </body>
        </html>
      `);
    }
    
    // Validate payment session hasn't expired (30 minutes)
    const sessionAge = Date.now() - paymentInfo.timestamp;
    if (sessionAge > 30 * 60 * 1000) {
      console.log('Payment session expired for txnid:', txnid);
      pendingPayments.delete(txnid);
      return res.status(410).send(`
        <html>
          <body>
            <h2>Payment Session Expired</h2>
            <p>This payment session has expired. Please start a new payment.</p>
            <a href="/upgrade">Return to Upgrade Page</a>
          </body>
        </html>
      `);
    }

    // Recreate payment parameters with proper transaction ID
    const paymentParams = payuService.createPaymentParams(
      paymentInfo.amount,
      paymentInfo.email,
      paymentInfo.email.split('@')[0],
      '', // phone
      paymentInfo.tier
    );
    
    // Ensure transaction ID matches and regenerate hash
    paymentParams.txnid = paymentInfo.txnid;
    
    // Regenerate hash with the stored transaction ID using correct salt
    const merchantSalt = '6pSdSll7fkWxuRBbTESjJVztSp7wVGFD';
    const hashString = `${paymentParams.key}|${paymentParams.txnid}|${paymentParams.amount}|${paymentParams.productinfo}|${paymentParams.firstname}|${paymentParams.email}|||||||||||${merchantSalt}`;
    paymentParams.hash = crypto.createHash('sha512').update(hashString).digest('hex');

    // Generate payment form that auto-submits to PayU
    const paymentUrl = payuService.getPaymentUrl();
    const paymentForm = payuService.generatePaymentForm(paymentParams, paymentUrl);

    console.log('Redirecting payment:', {
      txnid: paymentInfo.txnid,
      email: paymentInfo.email,
      amount: paymentInfo.amount,
      paymentUrl,
      sessionAge: `${Math.round(sessionAge / 1000)}s`
    });

    // Security: Log payment attempt for audit trail
    console.log('PAYMENT_REDIRECT:', {
      txnid: paymentInfo.txnid,
      email: paymentInfo.email,
      amount: paymentInfo.amount,
      timestamp: new Date().toISOString(),
      userAgent: req.headers['user-agent']
    });

    // Return the HTML form that will auto-submit to PayU
    res.setHeader('Content-Type', 'text/html');
    res.send(paymentForm);

  } catch (error) {
    console.error('PayU redirect error:', error);
    res.status(500).send(`
      <html>
        <body>
          <h2>Payment Error</h2>
          <p>Unable to process payment. Please try again.</p>
          <a href="/upgrade">Return to Upgrade Page</a>
        </body>
      </html>
    `);
  }
});

/**
 * POST /api/payu/create-payment
 * Create a new PayU payment session
 */
router.post('/create-payment', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { amount = 29, tier = 'pro' } = req.body;

    // Validate amount
    if (amount < 1 || amount > 10000) {
      return res.status(400).json({ error: 'Invalid payment amount' });
    }

    // Production credentials are now configured - allow payments to proceed
    console.log(`✅ PayU Payment initiated for user: ${user.email} with production credentials`);

    // Create payment parameters
    const paymentParams = payuService.createPaymentParams(
      amount,
      user.email,
      user.displayName || user.email.split('@')[0],
      '', // phone - optional
      tier
    );

    // Store payment info for verification
    pendingPayments.set(paymentParams.txnid, {
      txnid: paymentParams.txnid,
      email: user.email,
      amount,
      tier,
      timestamp: Date.now()
    });

    // Clean up old pending payments (older than 1 hour)
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const keysToDelete: string[] = [];
    pendingPayments.forEach((payment: any, txnid: string) => {
      if (payment.timestamp < oneHourAgo) {
        keysToDelete.push(txnid);
      }
    });
    keysToDelete.forEach((txnid: string) => pendingPayments.delete(txnid));

    const paymentUrl = payuService.getPaymentUrl();
    const paymentForm = payuService.generatePaymentForm(paymentParams, paymentUrl);

    res.json({
      success: true,
      txnid: paymentParams.txnid,
      paymentUrl,
      paymentForm,
      redirectUrl: `/api/payu/redirect/${paymentParams.txnid}`
    });

  } catch (error) {
    console.error('PayU payment creation error:', error);
    res.status(500).json({ 
      error: 'Failed to create payment session',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});



/**
 * POST /api/payu/success
 * Handle successful payment callback from PayU
 */
router.post('/success', async (req: Request, res: Response) => {
  try {
    console.log('PayU Success Callback:', req.body);

    const {
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      mihpayid,
      status,
      hash,
      phone
    } = req.body;

    // Verify the payment response
    const isValid = payuService.verifyPaymentResponse(req.body);
    
    if (!isValid) {
      console.error('Invalid hash in PayU response');
      return res.redirect('/upgrade?payment=failed&reason=invalid_hash');
    }

    if (status !== 'success') {
      console.error('Payment status not successful:', status);
      return res.redirect('/upgrade?payment=failed&reason=payment_failed');
    }

    // Get pending payment info
    const pendingPayment = pendingPayments.get(txnid);
    if (!pendingPayment) {
      console.error('No pending payment found for txnid:', txnid);
      return res.redirect('/upgrade?payment=failed&reason=invalid_transaction');
    }

    // Verify email matches
    if (pendingPayment.email !== email) {
      console.error('Email mismatch in payment verification');
      return res.redirect('/upgrade?payment=failed&reason=email_mismatch');
    }

    try {
      // For Firebase-based system, we'll use the quota manager to upgrade the user
      const { productionQuotaManager } = await import('../lib/productionQuotaManager');
      await productionQuotaManager.upgradeToPro(email);
      
      // Clean up pending payment
      pendingPayments.delete(txnid);

      console.log(`✓ Successfully upgraded user ${email} to pro tier`);
      console.log(`✓ PayU Transaction ID: ${mihpayid}`);
      console.log(`✓ Amount: ₹${amount}`);

      // Redirect to success page
      res.redirect('/dashboard?payment=success&upgrade=pro');

    } catch (dbError) {
      console.error('Database error during upgrade:', dbError);
      res.redirect('/upgrade?payment=failed&reason=upgrade_failed');
    }

  } catch (error) {
    console.error('PayU success callback error:', error);
    res.redirect('/upgrade?payment=failed&reason=callback_error');
  }
});

/**
 * POST /api/payu/failure
 * Handle failed payment callback from PayU
 */
router.post('/failure', async (req: Request, res: Response) => {
  try {
    console.log('PayU Failure Callback:', req.body);

    const {
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      status,
      error: payuError,
      error_Message
    } = req.body;

    // Clean up pending payment
    if (txnid) {
      pendingPayments.delete(txnid);
    }

    console.log(`✗ Payment failed for ${email}`);
    console.log(`✗ Status: ${status}`);
    console.log(`✗ Error: ${payuError || error_Message}`);

    // Redirect to upgrade page with failure message
    const errorReason = encodeURIComponent(payuError || error_Message || 'payment_failed');
    res.redirect(`/upgrade?payment=failed&reason=${errorReason}`);

  } catch (error) {
    console.error('PayU failure callback error:', error);
    res.redirect('/upgrade?payment=failed&reason=callback_error');
  }
});

/**
 * GET /api/payu/status/:txnid
 * Check payment status
 */
router.get('/status/:txnid', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { txnid } = req.params;
    const payment = pendingPayments.get(txnid);

    if (!payment) {
      return res.json({
        status: 'not_found',
        message: 'Payment session not found or expired'
      });
    }

    // Check if payment is older than 1 hour
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    if (payment.timestamp < oneHourAgo) {
      pendingPayments.delete(txnid);
      return res.json({
        status: 'expired',
        message: 'Payment session expired'
      });
    }

    res.json({
      status: 'pending',
      txnid: payment.txnid,
      amount: payment.amount,
      tier: payment.tier,
      timestamp: payment.timestamp
    });

  } catch (error) {
    console.error('PayU status check error:', error);
    res.status(500).json({ 
      error: 'Failed to check payment status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;