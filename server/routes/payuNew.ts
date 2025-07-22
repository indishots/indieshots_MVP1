import express from 'express';
import { payuService } from '../services/payuServiceNew.js';

const router = express.Router();

/**
 * Create PayU payment session - REBUILT FROM SCRATCH
 * Uses official PayU hash formula and production credentials
 */
router.post('/create-payment', async (req, res) => {
  try {
    const { email, firstname, amount = 1 } = req.body;

    console.log('🚀 Creating PayU payment - PRODUCTION MODE');
    console.log(`👤 Customer: ${firstname} (${email})`);
    console.log(`💰 Amount: ₹${amount}`);

    // Validate inputs
    if (!email || !firstname) {
      return res.status(400).json({
        success: false,
        error: 'Email and firstname are required'
      });
    }

    // Create payment request with correct hash
    const paymentRequest = payuService.createPaymentRequest(email, firstname, amount);

    console.log('✅ Payment request generated successfully');

    // Return payment data for form submission
    res.json({
      success: true,
      paymentParams: paymentRequest,
      paymentUrl: payuService.getPaymentUrl(),
      txnid: paymentRequest.txnid
    });

  } catch (error) {
    console.error('❌ Payment creation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create payment session'
    });
  }
});

/**
 * PayU Success Callback
 */
router.post('/success', async (req, res) => {
  try {
    console.log('✅ PayU Success Callback:', req.body);

    const { txnid, status, amount, firstname, email } = req.body;

    // Verify response hash
    const isValidHash = payuService.verifyResponseHash(req.body);
    
    if (!isValidHash) {
      console.error('❌ Invalid response hash');
      return res.redirect('/upgrade?status=error&message=Invalid payment verification');
    }

    if (status === 'success') {
      console.log(`💰 Payment successful: ${txnid} - ₹${amount}`);
      
      // TODO: Update user tier to pro in database
      // await updateUserTier(email, 'pro');
      
      res.redirect('/upgrade?status=success&message=Payment completed successfully');
    } else {
      res.redirect('/upgrade?status=error&message=Payment failed');
    }

  } catch (error) {
    console.error('❌ Success callback error:', error);
    res.redirect('/upgrade?status=error&message=Payment processing error');
  }
});

/**
 * PayU Failure Callback
 */
router.post('/failure', async (req, res) => {
  try {
    console.log('❌ PayU Failure Callback:', req.body);

    const { txnid, status, error_Message } = req.body;
    
    console.log(`💳 Payment failed: ${txnid} - ${error_Message || 'Unknown error'}`);
    
    res.redirect(`/upgrade?status=error&message=${encodeURIComponent(error_Message || 'Payment failed')}`);

  } catch (error) {
    console.error('❌ Failure callback error:', error);
    res.redirect('/upgrade?status=error&message=Payment processing error');
  }
});

export { router as default };