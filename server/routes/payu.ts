import { Router, Request, Response } from 'express';
import { PayUService } from '../services/payuService';
import { authMiddleware } from '../auth/jwt';
import { storage } from '../storage';
import crypto from 'crypto';

const router = Router();
const payuService = new PayUService();

// Store pending payments securely
if (!(global as any).pendingPayments) {
  (global as any).pendingPayments = new Map<string, {
    txnid: string;
    email: string;
    amount: number;
    tier: string;
    timestamp: number;
    userAgent?: string;
  }>();
}
const pendingPayments = (global as any).pendingPayments;

/**
 * POST /api/payu/create-payment
 * Create secure PayU payment session
 */
router.post('/create-payment', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { amount = 1, tier = 'pro' } = req.body; // Default 1 rupee for testing
    const user = (req as any).user;

    if (!user?.email) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    console.log('💰 Creating PayU Payment (PRODUCTION)');
    console.log(`User: ${user.email}`);
    console.log(`Amount: ₹${amount} (Real money transaction)`);

    // Create payment parameters with your production credentials
    const paymentParams = payuService.createPaymentParams(
      amount,
      user.email,
      user.displayName || user.email.split('@')[0],
      '9999999999', // Default phone
      tier
    );

    // Store payment session securely
    pendingPayments.set(paymentParams.txnid, {
      txnid: paymentParams.txnid,
      email: user.email,
      amount: amount,
      tier: tier,
      timestamp: Date.now(),
      userAgent: req.headers['user-agent']
    });

    // Auto-cleanup expired payments (30 minutes)
    setTimeout(() => {
      pendingPayments.delete(paymentParams.txnid);
    }, 30 * 60 * 1000);

    console.log('✅ Payment session created successfully');
    console.log(`Transaction ID: ${paymentParams.txnid}`);

    res.json({
      success: true,
      paymentParams: paymentParams,
      paymentUrl: payuService.getGatewayUrl(),
      txnid: paymentParams.txnid,
      message: 'Payment session created - Ready for PayU gateway'
    });

  } catch (error) {
    console.error('❌ Payment creation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Payment creation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/payu/create-test-payment
 * Create test payment (1 rupee) for verification
 */
router.post('/create-test-payment', async (req: Request, res: Response) => {
  try {
    const { email, amount = 1, firstname = 'Test User' } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    console.log('🧪 Creating Test Payment (PRODUCTION GATEWAY)');
    console.log(`Email: ${email}`);
    console.log(`Amount: ₹${amount} (Real transaction)`);

    const paymentParams = payuService.createPaymentParams(
      amount,
      email,
      firstname,
      '9999999999',
      'pro'
    );

    // Store test payment session
    pendingPayments.set(paymentParams.txnid, {
      txnid: paymentParams.txnid,
      email: email,
      amount: amount,
      tier: 'pro',
      timestamp: Date.now()
    });

    res.json({
      success: true,
      paymentParams: paymentParams,
      paymentUrl: payuService.getGatewayUrl(),
      txnid: paymentParams.txnid,
      message: 'Test payment created for production gateway'
    });

  } catch (error) {
    console.error('❌ Test payment creation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Test payment creation failed'
    });
  }
});

/**
 * POST /api/payu/success
 * Handle successful payment callback from PayU
 */
router.post('/success', async (req: Request, res: Response) => {
  try {
    console.log('✅ PayU Success Callback Received');
    console.log('Payment Data:', req.body);

    const {
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      mihpayid,
      status,
      hash
    } = req.body;

    // Verify payment response hash
    const isValidHash = payuService.verifyPaymentResponse(req.body);

    if (!isValidHash) {
      console.error('❌ Invalid payment response hash');
      return res.status(400).send(`
        <html>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h2 style="color: #dc3545;">Payment Verification Failed</h2>
            <p>The payment response could not be verified.</p>
            <a href="/upgrade" style="color: #007bff;">Return to Upgrade Page</a>
          </body>
        </html>
      `);
    }

    // Check payment session
    const paymentSession = pendingPayments.get(txnid);
    if (!paymentSession) {
      console.error('❌ Payment session not found:', txnid);
      return res.status(404).send(`
        <html>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h2 style="color: #ffc107;">Payment Session Not Found</h2>
            <p>The payment session has expired or is invalid.</p>
            <a href="/upgrade" style="color: #007bff;">Return to Upgrade Page</a>
          </body>
        </html>
      `);
    }

    if (status === 'success') {
      console.log('💰 Payment Successful!');
      console.log(`Transaction ID: ${txnid}`);
      console.log(`PayU Payment ID: ${mihpayid}`);
      console.log(`Amount: ₹${amount}`);

      try {
        // Update user tier to pro
        const user = await storage.getUserByEmail(email);
        if (user) {
          await storage.updateUser(user.id, {
            tier: 'pro',
            totalPages: -1, // Unlimited
            canGenerateStoryboards: true,
            payuTransactionId: mihpayid,
            paymentStatus: 'completed',
            paymentMethod: 'payu'
          });

          console.log('✅ User upgraded to Pro tier');
        }

        // Clean up payment session
        pendingPayments.delete(txnid);

        // Success page
        res.send(`
          <html>
            <head>
              <title>Payment Successful</title>
              <style>
                body { font-family: Arial; text-align: center; padding: 50px; background: #f8f9fa; }
                .success { background: #d4edda; color: #155724; padding: 30px; border-radius: 10px; margin: 20px auto; max-width: 600px; }
                .btn { display: inline-block; padding: 15px 30px; background: #28a745; color: white; text-decoration: none; border-radius: 5px; margin: 10px; }
              </style>
            </head>
            <body>
              <div class="success">
                <h1>🎉 Payment Successful!</h1>
                <h2>Welcome to IndieShots Pro!</h2>
                <p><strong>Transaction ID:</strong> ${txnid}</p>
                <p><strong>PayU Payment ID:</strong> ${mihpayid}</p>
                <p><strong>Amount:</strong> ₹${amount}</p>
                <p><strong>Status:</strong> Your account has been upgraded to Pro tier</p>
                <br>
                <p><strong>Pro Features Unlocked:</strong></p>
                <ul style="text-align: left; display: inline-block;">
                  <li>Unlimited page uploads</li>
                  <li>Unlimited shots per scene</li>
                  <li>AI storyboard generation</li>
                  <li>Priority support</li>
                  <li>Advanced export options</li>
                </ul>
              </div>
              <a href="/dashboard" class="btn">Go to Dashboard</a>
              <a href="/upgrade" class="btn" style="background: #007bff;">View Pro Features</a>
            </body>
          </html>
        `);

      } catch (error) {
        console.error('❌ Error updating user tier:', error);
        res.send(`
          <html>
            <body style="font-family: Arial; text-align: center; padding: 50px;">
              <h2 style="color: #ffc107;">Payment Processed</h2>
              <p>Your payment was successful but there was an issue updating your account.</p>
              <p>Please contact support with transaction ID: ${txnid}</p>
              <a href="/dashboard" style="color: #007bff;">Go to Dashboard</a>
            </body>
          </html>
        `);
      }

    } else {
      console.log('❌ Payment failed or cancelled');
      res.send(`
        <html>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h2 style="color: #dc3545;">Payment Failed</h2>
            <p>Status: ${status}</p>
            <p>Transaction ID: ${txnid}</p>
            <a href="/upgrade" style="color: #007bff;">Try Again</a>
          </body>
        </html>
      `);
    }

  } catch (error) {
    console.error('❌ Payment success handler error:', error);
    res.status(500).send(`
      <html>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
          <h2 style="color: #dc3545;">Error Processing Payment</h2>
          <p>There was an error processing your payment.</p>
          <a href="/upgrade" style="color: #007bff;">Return to Upgrade Page</a>
        </body>
      </html>
    `);
  }
});

/**
 * POST /api/payu/failure
 * Handle failed payment callback from PayU
 */
router.post('/failure', async (req: Request, res: Response) => {
  try {
    console.log('❌ PayU Failure Callback Received');
    console.log('Failure Data:', req.body);

    const { txnid, status, error_Message } = req.body;

    // Clean up payment session
    if (txnid) {
      pendingPayments.delete(txnid);
    }

    res.send(`
      <html>
        <head>
          <title>Payment Failed</title>
          <style>
            body { font-family: Arial; text-align: center; padding: 50px; background: #f8f9fa; }
            .error { background: #f8d7da; color: #721c24; padding: 30px; border-radius: 10px; margin: 20px auto; max-width: 600px; }
            .btn { display: inline-block; padding: 15px 30px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 10px; }
          </style>
        </head>
        <body>
          <div class="error">
            <h1>Payment Failed</h1>
            <p><strong>Status:</strong> ${status}</p>
            <p><strong>Transaction ID:</strong> ${txnid}</p>
            ${error_Message ? `<p><strong>Error:</strong> ${error_Message}</p>` : ''}
            <p>Your payment could not be processed. Please try again.</p>
          </div>
          <a href="/upgrade" class="btn">Try Again</a>
          <a href="/dashboard" class="btn" style="background: #6c757d;">Go to Dashboard</a>
        </body>
      </html>
    `);

  } catch (error) {
    console.error('❌ Payment failure handler error:', error);
    res.status(500).send(`
      <html>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
          <h2 style="color: #dc3545;">Error Processing Failure</h2>
          <p>There was an error processing the payment failure.</p>
          <a href="/upgrade" style="color: #007bff;">Return to Upgrade Page</a>
        </body>
      </html>
    `);
  }
});

/**
 * GET /api/payu/status/:txnid
 * Check payment status
 */
router.get('/status/:txnid', async (req: Request, res: Response) => {
  try {
    const { txnid } = req.params;
    
    const paymentSession = pendingPayments.get(txnid);
    
    if (!paymentSession) {
      return res.json({
        success: false,
        status: 'not_found',
        message: 'Payment session not found'
      });
    }

    const age = Date.now() - paymentSession.timestamp;
    const expired = age > 30 * 60 * 1000; // 30 minutes

    res.json({
      success: true,
      status: expired ? 'expired' : 'pending',
      txnid: txnid,
      email: paymentSession.email,
      amount: paymentSession.amount,
      age: Math.floor(age / 1000) + 's'
    });

  } catch (error) {
    console.error('❌ Payment status check error:', error);
    res.status(500).json({
      success: false,
      error: 'Status check failed'
    });
  }
});

export default router;