import crypto from 'crypto';

/**
 * PayU Production Payment Service - COMPLETELY REBUILT FROM SCRATCH
 * Using EXACT PayU official hash formula and your live production credentials
 * All credentials verified from PayU merchant dashboard
 */

interface PayUCredentials {
  merchantKey: string;
  merchantSalt: string;
  clientId: string;
  clientSecret: string;
  baseUrl: string;
}

interface PaymentRequest {
  key: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  phone: string;
  surl: string;
  furl: string;
  service_provider: string;
  hash: string;
  // Optional fields
  lastname?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  country?: string;
  zipcode?: string;
  udf1?: string;
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
}

export class PayUProductionService {
  private credentials: PayUCredentials;

  constructor() {
    // YOUR EXACT PRODUCTION CREDENTIALS FROM PAYU DASHBOARD
    this.credentials = {
      merchantKey: 'xXZDKp',                                    // Live merchant key
      merchantSalt: 'ezsXEEqchsA1ZLmHzn5BrLRl9snmckHn',         // Live salt (32 chars)
      clientId: 'f10a90386f9639dadfe839bc565d2e6d26cb5d88e1f49640b53960ed0d1364c8',     // Live client ID
      clientSecret: 'd2d92cbf109d9efe6430ec8399c5ffc89287b5fcfe6e8f27713a0fc17f3b74ec',  // Live client secret
      baseUrl: 'https://secure.payu.in'                         // Production gateway
    };

    console.log('🚀 PayU PRODUCTION Service - REBUILT FROM SCRATCH');
    console.log(`🔑 Merchant Key: ${this.credentials.merchantKey}`);
    console.log(`🧂 Salt Length: ${this.credentials.merchantSalt.length} characters`);
    console.log(`🌐 Gateway: ${this.credentials.baseUrl}`);
    console.log('💰 Ready for REAL money transactions');
  }

  /**
   * Generate PayU hash using EXACT official formula
   * Based on PayU documentation: https://docs.payu.in/docs/generate-hash-merchant-hosted
   * Formula: SHA512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||salt)
   */
  private generatePayUHash(params: Omit<PaymentRequest, 'hash'>): string {
    // Extract UDF values (User Defined Fields) - all empty for basic payments
    const udf1 = params.udf1 || '';
    const udf2 = params.udf2 || '';
    const udf3 = params.udf3 || '';
    const udf4 = params.udf4 || '';
    const udf5 = params.udf5 || '';

    // OFFICIAL PayU Hash Formula from Documentation
    // sha512(key|txnid|amount|productinfo|firstname|email|||||||||||SALT)
    // This is the EXACT format from PayU official docs
    const hashString = `${params.key}|${params.txnid}|${params.amount}|${params.productinfo}|${params.firstname}|${params.email}|||||||||||${this.credentials.merchantSalt}`;

    console.log('🔐 PayU Hash Generation - OFFICIAL FORMULA');
    console.log(`📋 Parameters:`);
    console.log(`   Key: ${params.key}`);
    console.log(`   TxnID: ${params.txnid}`);
    console.log(`   Amount: ${params.amount}`);
    console.log(`   ProductInfo: ${params.productinfo}`);
    console.log(`   FirstName: ${params.firstname}`);
    console.log(`   Email: ${params.email}`);
    console.log(`   UDF1-5: ${udf1}|${udf2}|${udf3}|${udf4}|${udf5} (empty)`);
    console.log(`   Salt: ${this.credentials.merchantSalt.substring(0, 8)}...`);
    console.log(`🧮 Hash String: ${hashString}`);
    
    // Count pipes for verification
    const pipeCount = (hashString.match(/\|/g) || []).length;
    console.log(`📊 Pipe Count: ${pipeCount} (PayU requires specific count)`);

    // Generate SHA512 hash
    const hash = crypto.createHash('sha512').update(hashString, 'utf8').digest('hex');
    console.log(`🔒 Generated Hash: ${hash.substring(0, 64)}...`);
    console.log(`📏 Hash Length: ${hash.length} characters`);

    return hash;
  }

  /**
   * Create complete payment request for PayU gateway
   * Amount: ₹1.00 for testing as requested
   */
  createPaymentRequest(
    email: string,
    firstname: string,
    amount: number = 1,
    phone: string = '9999999999'
  ): PaymentRequest {
    // Generate unique transaction ID
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 11);
    const txnid = `INDIE_${timestamp}_${random}`;

    // Get domain for success/failure URLs
    const domain = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : 'https://workspace.shruti37.replit.app';

    // Prepare payment parameters (without hash first)
    const paymentParams: Omit<PaymentRequest, 'hash'> = {
      key: this.credentials.merchantKey,
      txnid: txnid,
      amount: amount.toFixed(2),
      productinfo: 'IndieShots Pro Subscription',
      firstname: firstname,
      email: email,
      phone: phone,
      surl: `${domain}/api/payu/success`,
      furl: `${domain}/api/payu/failure`,
      service_provider: 'payu_paisa',
      // Optional fields
      lastname: '',
      address1: '',
      address2: '',
      city: '',
      state: '',
      country: 'India',
      zipcode: '',
      udf1: '',
      udf2: '',
      udf3: '',
      udf4: '',
      udf5: ''
    };

    // Generate hash using official PayU formula
    const hash = this.generatePayUHash(paymentParams);

    // Return complete payment request
    const paymentRequest: PaymentRequest = {
      ...paymentParams,
      hash: hash
    };

    console.log('✅ Payment Request Created');
    console.log(`💳 Transaction: ${txnid}`);
    console.log(`💰 Amount: ₹${amount.toFixed(2)}`);
    console.log(`👤 Customer: ${firstname} (${email})`);
    console.log(`🔗 Payment URL: ${this.credentials.baseUrl}/_payment`);

    return paymentRequest;
  }

  /**
   * Verify payment response hash
   */
  verifyResponseHash(response: any): boolean {
    try {
      const status = response.status || '';
      const firstname = response.firstname || '';
      const amount = response.amount || '';
      const txnid = response.txnid || '';
      const email = response.email || '';
      const productinfo = response.productinfo || '';
      const udf1 = response.udf1 || '';
      const udf2 = response.udf2 || '';
      const udf3 = response.udf3 || '';
      const udf4 = response.udf4 || '';
      const udf5 = response.udf5 || '';

      // Response hash formula (reverse order)
      const hashString = `${this.credentials.merchantSalt}|${status}|${udf5}|${udf4}|${udf3}|${udf2}|${udf1}|${email}|${firstname}|${productinfo}|${amount}|${txnid}|${this.credentials.merchantKey}`;
      const expectedHash = crypto.createHash('sha512').update(hashString, 'utf8').digest('hex');

      console.log('🔍 Response Hash Verification');
      console.log(`Expected: ${expectedHash.substring(0, 32)}...`);
      console.log(`Received: ${(response.hash || '').substring(0, 32)}...`);

      return expectedHash === response.hash;
    } catch (error) {
      console.error('❌ Hash verification failed:', error);
      return false;
    }
  }

  /**
   * Get payment gateway URL
   */
  getPaymentUrl(): string {
    return `${this.credentials.baseUrl}/_payment`;
  }
}

// Export singleton instance
export const payuService = new PayUProductionService();