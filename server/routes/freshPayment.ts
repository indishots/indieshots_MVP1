import express from 'express';
import { freshPayuService } from '../services/freshPayuService.js';
import { storage } from '../storage.js';

const router = express.Router();

/**
 * Create PayU payment for 1 rupee subscription
 */
router.post('/create', async (req, res) => {
  try {
    const { email, firstname, phone } = req.body;

    if (!email || !firstname) {
      return res.status(400).json({
        success: false,
        error: 'Email and firstname are required'
      });
    }

    console.log(`Creating payment for ${email} - ₹1 subscription`);

    // Generate payment data
    const paymentData = freshPayuService.createPaymentRequest(
      email, 
      firstname, 
      phone || '9999999999'
    );

    console.log('Payment data generated:', paymentData.txnid);

    res.json({
      success: true,
      paymentData: paymentData,
      paymentUrl: freshPayuService.getPaymentUrl()
    });

  } catch (error) {
    console.error('Payment creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create payment'
    });
  }
});

/**
 * Handle PayU success callback
 */
router.post('/success', async (req, res) => {
  try {
    console.log('PayU Success callback:', req.body);
    
    const { txnid, status, amount, firstname, email, mihpayid } = req.body;

    // Verify hash
    const isValid = freshPayuService.verifyPaymentResponse(req.body);
    
    if (!isValid) {
      console.error('Invalid payment hash');
      return res.redirect('/upgrade?status=error&message=Payment verification failed');
    }

    if (status === 'success') {
      console.log(`Payment successful: ${txnid} - ₹${amount} - ${mihpayid}`);
      
      try {
        // Update user to pro tier
        const user = await storage.getUserByEmail(email);
        if (user) {
          await storage.updateUser(user.id, {
            tier: 'pro',
            totalPages: -1, // Unlimited pages
            maxShotsPerScene: -1, // Unlimited shots
            canGenerateStoryboards: true,
            payuTransactionId: mihpayid || txnid
          });
          
          console.log(`User ${email} upgraded to pro tier`);
          
          // TODO: Send confirmation email here
          console.log(`Confirmation email should be sent to ${email}`);
          
          // Redirect to dashboard with success message
          return res.redirect('/dashboard?status=success&message=Welcome to Pro! Your subscription is now active.');
        }
      } catch (dbError) {
        console.error('Database update error:', dbError);
        // Payment was successful but user update failed
        return res.redirect('/upgrade?status=warning&message=Payment successful but account update pending. Contact support.');
      }
    }

    res.redirect('/upgrade?status=error&message=Payment was not successful');

  } catch (error) {
    console.error('Success callback error:', error);
    res.redirect('/upgrade?status=error&message=Payment processing error');
  }
});

/**
 * Handle PayU failure callback
 */
router.post('/failure', async (req, res) => {
  try {
    console.log('PayU Failure callback:', req.body);
    
    const { txnid, status, error_Message } = req.body;
    console.log(`Payment failed: ${txnid} - ${error_Message}`);
    
    const message = error_Message || 'Payment failed';
    res.redirect(`/upgrade?status=error&message=${encodeURIComponent(message)}`);
    
  } catch (error) {
    console.error('Failure callback error:', error);
    res.redirect('/upgrade?status=error&message=Payment processing error');
  }
});

export default router;