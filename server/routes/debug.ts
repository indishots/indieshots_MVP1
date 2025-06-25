import { Router, Request, Response } from 'express';
import { authMiddleware } from '../auth/jwt';
import { PayUService } from '../services/payuService';

const router = Router();

/**
 * GET /api/debug/payu-form
 * Debug endpoint to test PayU form generation
 */
router.get('/payu-form', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const payuService = new PayUService();
    
    // Create test payment parameters
    const paymentParams = payuService.createPaymentParams(
      29, // $29 USD
      user.email,
      user.displayName || user.email.split('@')[0],
      '', // phone - optional
      'pro'
    );

    const paymentUrl = payuService.getPaymentUrl();
    const paymentForm = payuService.generatePaymentForm(paymentParams, paymentUrl);

    // Parse form to extract parameters for debugging
    const formMatch = paymentForm.match(/<input[^>]+>/g);
    const parameters: any = {};
    
    if (formMatch) {
      formMatch.forEach(inputTag => {
        const nameMatch = inputTag.match(/name="([^"]+)"/);
        const valueMatch = inputTag.match(/value="([^"]+)"/);
        if (nameMatch && valueMatch) {
          parameters[nameMatch[1]] = valueMatch[1];
        }
      });
    }

    res.json({
      success: true,
      paymentUrl,
      parameters: {
        key: parameters.key,
        txnid: parameters.txnid,
        amount: parameters.amount,
        email: parameters.email,
        firstname: parameters.firstname,
        productinfo: parameters.productinfo,
        surl: parameters.surl,
        furl: parameters.furl,
        service_provider: parameters.service_provider,
        hashPresent: !!parameters.hash,
        hashLength: parameters.hash ? parameters.hash.length : 0,
        totalFields: Object.keys(parameters).length
      },
      formHtml: paymentForm.substring(0, 500) + '...' // First 500 chars for debugging
    });

  } catch (error) {
    console.error('PayU debug error:', error);
    res.status(500).json({ 
      error: 'Failed to generate PayU form',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;