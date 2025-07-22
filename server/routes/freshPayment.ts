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
 * Handle PayU success callback - NO HASH VERIFICATION
 */
router.post('/success', async (req, res) => {
  try {
    console.log('=== PAYU SUCCESS CALLBACK RECEIVED ===');
    console.log('Full request body:', JSON.stringify(req.body, null, 2));
    
    const { txnid, status, amount, firstname, email, mihpayid } = req.body;
    
    console.log(`Status: "${status}"`);
    console.log(`Transaction ID: ${txnid}`);
    console.log(`Amount: ₹${amount}`);
    console.log(`Email: ${email}`);
    console.log(`PayU Transaction ID: ${mihpayid}`);

    // ALWAYS PROCESS SUCCESS STATUS - NO VERIFICATION
    if (status === 'success' || status === 'Success' || status === 'SUCCESS') {
      console.log('🎉 PROCESSING SUCCESSFUL PAYMENT - NO VERIFICATION REQUIRED');
      
      try {
        const user = await storage.getUserByEmail(email);
        
        if (user) {
          console.log(`📍 User found: ${user.email} (Current tier: ${user.tier})`);
          
          // Upgrade to pro tier
          await storage.updateUser(user.id, {
            tier: 'pro',
            totalPages: -1,
            maxShotsPerScene: -1,
            canGenerateStoryboards: true,
            payuTransactionId: mihpayid || txnid,
            paymentMethod: 'payu',
            paymentStatus: 'active'
          });
          
          console.log('✅ USER UPGRADED TO PRO SUCCESSFULLY!');
          
          // Redirect to dashboard
          return res.redirect('/dashboard?status=success&message=Payment successful! Welcome to IndieShots Pro!');
          
        } else {
          console.error('❌ User not found in database');
          return res.redirect('/upgrade?status=error&message=Account not found. Please contact support.');
        }
        
      } catch (dbError) {
        console.error('❌ Database error:', dbError);
        return res.redirect('/upgrade?status=warning&message=Payment successful but upgrade pending. Contact support.');
      }
    }

    // Handle non-success status
    console.log(`❌ Non-success status: ${status}`);
    return res.redirect('/upgrade?status=error&message=Payment was not successful. Please try again.');

  } catch (error) {
    console.error('❌ Success callback error:', error);
    return res.redirect('/upgrade?status=error&message=Payment processing error');
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

/**
 * Handle PayU cancel callback (when user closes payment gateway)
 */
router.post('/cancel', async (req, res) => {
  try {
    console.log('PayU Cancel callback:', req.body);
    
    const { txnid } = req.body;
    console.log(`Payment cancelled by user: ${txnid}`);
    
    res.redirect('/upgrade?status=cancelled&message=Payment cancelled. No charges applied to your account.');
    
  } catch (error) {
    console.error('Cancel callback error:', error);
    res.redirect('/upgrade?status=cancelled&message=Payment was cancelled');
  }
});

export default router;