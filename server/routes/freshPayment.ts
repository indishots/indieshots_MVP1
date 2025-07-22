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
        console.log(`Looking up user by email: ${email}`);
        const user = await storage.getUserByEmail(email);
        
        if (user) {
          console.log(`Found user: ${user.id} - ${user.email} - Current tier: ${user.tier}`);
          
          const updateData = {
            tier: 'pro',
            totalPages: -1, // Unlimited pages
            maxShotsPerScene: -1, // Unlimited shots
            canGenerateStoryboards: true,
            payuTransactionId: mihpayid || txnid,
            paymentMethod: 'payu',
            paymentStatus: 'active'
          };
          
          console.log('Updating user with:', updateData);
          await storage.updateUser(user.id, updateData);
          
          // Verify the update worked
          const updatedUser = await storage.getUserByEmail(email);
          console.log(`User ${email} upgraded to pro tier - New tier: ${updatedUser?.tier}`);
          console.log(`Pro features: Pages=${updatedUser?.totalPages}, Shots=${updatedUser?.maxShotsPerScene}, Storyboards=${updatedUser?.canGenerateStoryboards}`);
          
          // Redirect to dashboard with success message
          return res.redirect('/dashboard?status=success&message=Welcome to Pro! Your subscription is now active.');
        } else {
          console.error(`User not found for email: ${email}`);
          return res.redirect('/upgrade?status=error&message=User account not found. Please contact support.');
        }
      } catch (dbError) {
        console.error('Database update error:', dbError);
        // Payment was successful but user update failed
        return res.redirect('/upgrade?status=warning&message=Payment successful but account update pending. Contact support.');
      }
    }

    // Handle payment cancellation or other status
    if (status === 'cancel') {
      console.log(`Payment cancelled: ${txnid}`);
      return res.redirect('/upgrade?status=cancelled&message=Payment was cancelled. You can try again anytime.');
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