import { Router, Request, Response } from 'express';
import { PayUService } from '../services/payuService';

const router = Router();

/**
 * GET /api/payu/config-status
 * Check if PayU is properly configured
 */
router.get('/config-status', (req: Request, res: Response) => {
  try {
    const merchantKey = process.env.PAYU_MERCHANT_KEY;
    const merchantSalt = process.env.PAYU_MERCHANT_SALT;
    const clientId = process.env.PAYU_CLIENT_ID;
    const clientSecret = process.env.PAYU_CLIENT_SECRET;
    
    const configured = !!(merchantKey && merchantSalt && clientId && clientSecret);
    
    res.json({
      configured,
      summary: configured 
        ? `Key: ${merchantKey}, Salt: ${merchantSalt.length} chars, Client ID/Secret present`
        : 'Missing required environment variables',
      details: {
        merchantKey: merchantKey ? `${merchantKey.substring(0, 3)}...` : 'missing',
        merchantSalt: merchantSalt ? `${merchantSalt.length} characters` : 'missing',
        clientId: clientId ? 'present' : 'missing',
        clientSecret: clientSecret ? 'present' : 'missing'
      }
    });
  } catch (error) {
    console.error('PayU config check error:', error);
    res.status(500).json({ configured: false, error: 'Failed to check configuration' });
  }
});

/**
 * POST /api/payu/test-hash
 * Test PayU hash generation
 */
router.post('/test-hash', (req: Request, res: Response) => {
  try {
    const { email, amount, txnid } = req.body;
    
    if (!email || !amount || !txnid) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    
    const payuService = new PayUService();
    
    // Create test payment parameters
    const testParams = {
      key: process.env.PAYU_MERCHANT_KEY!,
      txnid,
      amount: amount.toFixed(2),
      productinfo: 'IndieShots_Test_Payment',
      firstname: 'Test User',
      email,
      phone: '9999999999',
      surl: 'https://example.com/success',
      furl: 'https://example.com/failure',
      service_provider: 'payu_paisa'
    };
    
    // Generate hash
    const hashString = `${testParams.key}|${testParams.txnid}|${testParams.amount}|${testParams.productinfo}|${testParams.firstname}|${testParams.email}|||||||||${process.env.PAYU_MERCHANT_SALT}`;
    const hash = (payuService as any).generatePaymentHash(testParams);
    
    console.log('=== PayU Hash Test ===');
    console.log('Hash String:', hashString);
    console.log('Generated Hash:', hash);
    
    res.json({
      success: true,
      hashString,
      hash,
      payuFormat: 'key|txnid|amount|productinfo|firstname|email|||||||||salt'
    });
    
  } catch (error) {
    console.error('PayU hash test error:', error);
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /api/payu/create-test-payment
 * Create a test payment session
 */
router.post('/create-test-payment', (req: Request, res: Response) => {
  try {
    const { email, amount, firstname } = req.body;
    
    if (!email || !amount) {
      return res.status(400).json({ success: false, error: 'Email and amount required' });
    }
    
    const payuService = new PayUService();
    
    // Create payment parameters
    const paymentParams = payuService.createPaymentParams(
      amount,
      email,
      firstname || 'Test User',
      '9999999999', // test phone
      'pro'
    );
    
    // Store in pending payments for testing
    const pendingPayments = (global as any).pendingPayments || new Map();
    (global as any).pendingPayments = pendingPayments;
    
    const paymentInfo = {
      txnid: paymentParams.txnid,
      email,
      amount,
      tier: 'pro',
      timestamp: Date.now()
    };
    
    pendingPayments.set(paymentParams.txnid, paymentInfo);
    
    console.log('=== Test Payment Created ===');
    console.log('Transaction ID:', paymentParams.txnid);
    console.log('Email:', email);
    console.log('Amount:', amount);
    console.log('Hash:', paymentParams.hash.substring(0, 20) + '...');
    
    res.json({
      success: true,
      paymentParams,
      paymentUrl: payuService.getPaymentUrl(),
      txnid: paymentParams.txnid
    });
    
  } catch (error) {
    console.error('Test payment creation error:', error);
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;