import crypto from 'crypto';

export interface PayUConfig {
  merchantKey: string;
  merchantSalt: string;
  clientId: string;
  clientSecret: string;
  baseUrl: string;
}

export interface PaymentParams {
  key: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  phone: string;
  surl: string;
  furl: string;
  hash: string;
  service_provider: string;
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

export interface PaymentResponse {
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  mihpayid: string;
  status: string;
  hash: string;
  phone?: string;
}

/**
 * Professional PayU Payment Gateway Service
 * Secure real-time payment processing with production credentials
 * All credentials are in LIVE MODE for real transactions
 */
export class PayUService {
  private config: PayUConfig;

  constructor() {
    // Production credentials - LIVE MODE ONLY
    this.config = {
      merchantKey: 'xXZDKp', // Live merchant key
      merchantSalt: 'ezsXEEqchsA1ZLmHzn5BrLRl9snmckHn', // Live salt (33 chars)
      clientId: 'f10a90386f9639dadfe839bc565d2e6d26cb5d88e1f49640b53960ed0d1364c8', // Live client ID
      clientSecret: 'd2d92cbf109d9efe6430ec8399c5ffc89287b5fcfe6e8f27713a0fc17f3b74ec', // Live client secret
      baseUrl: 'https://secure.payu.in' // Production gateway
    };

    console.log('🔒 PayU PRODUCTION Service Initialized');
    console.log(`📡 Gateway: ${this.config.baseUrl}`);
    console.log(`🔑 Merchant Key: ${this.config.merchantKey}`);
    console.log(`🧂 Salt Length: ${this.config.merchantSalt.length} characters`);
    console.log(`🆔 Client ID: ${this.config.clientId.substring(0, 8)}...`);
    console.log('✅ LIVE payment processing enabled - Real money transactions');
  }

  /**
   * Generate secure hash for payment request using PayU official format
   * Format: key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||salt
   */
  generatePaymentHash(params: Omit<PaymentParams, 'hash'>): string {
    const udf1 = params.udf1 || '';
    const udf2 = params.udf2 || '';
    const udf3 = params.udf3 || '';
    const udf4 = params.udf4 || '';
    const udf5 = params.udf5 || '';
    
    // PayU official hash format with UDF fields and empty pipes
    const hashString = `${params.key}|${params.txnid}|${params.amount}|${params.productinfo}|${params.firstname}|${params.email}|${udf1}|${udf2}|${udf3}|${udf4}|${udf5}||||||${this.config.merchantSalt}`;
    
    console.log('🔐 PayU Hash Generation (PRODUCTION)');
    console.log(`Hash String: ${hashString}`);
    console.log(`Salt: ${this.config.merchantSalt}`);
    
    const hash = crypto.createHash('sha512').update(hashString).digest('hex').toLowerCase();
    console.log(`Generated Hash: ${hash.substring(0, 32)}...`);
    
    return hash;
  }

  /**
   * Generate hash for payment response verification
   */
  generateResponseHash(response: PaymentResponse): string {
    const udf1 = (response as any).udf1 || '';
    const udf2 = (response as any).udf2 || '';
    const udf3 = (response as any).udf3 || '';
    const udf4 = (response as any).udf4 || '';
    const udf5 = (response as any).udf5 || '';
    
    // Response hash format (reverse order)
    const hashString = `${this.config.merchantSalt}|${response.status}|${udf5}|${udf4}|${udf3}|${udf2}|${udf1}|${response.email}|${response.firstname}|${response.productinfo}|${response.amount}|${response.txnid}|${this.config.merchantKey}`;
    
    console.log('🔐 PayU Response Hash Verification');
    console.log(`Response Hash String: ${hashString}`);
    
    return crypto.createHash('sha512').update(hashString).digest('hex').toLowerCase();
  }

  /**
   * Create secure payment parameters for PayU gateway
   * Amount set to 1 rupee for testing as requested
   */
  createPaymentParams(
    amount: number,
    email: string,
    firstname: string,
    phone: string = '9999999999',
    tier: string = 'pro'
  ): PaymentParams {
    // Generate unique transaction ID
    const txnid = `INDIE_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    
    // Get current domain for callbacks
    const domain = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : 'https://workspace.shruti37.replit.app';

    const paymentParams: Omit<PaymentParams, 'hash'> = {
      key: this.config.merchantKey,
      txnid: txnid,
      amount: amount.toFixed(2), // Use actual amount (1.00 for testing)
      productinfo: 'IndieShots_Pro_Upgrade',
      firstname: firstname,
      email: email,
      phone: phone,
      surl: `${domain}/api/payu/success`, // Success URL
      furl: `${domain}/api/payu/failure`, // Failure URL
      service_provider: 'payu_paisa',
      lastname: '',
      address1: '',
      address2: '',
      city: '',
      state: '',
      country: 'India',
      zipcode: '',
      udf1: tier, // Store tier in UDF1
      udf2: '',
      udf3: '',
      udf4: '',
      udf5: ''
    };

    // Generate secure hash
    const hash = this.generatePaymentHash(paymentParams);

    console.log('💰 Payment Parameters Created (PRODUCTION)');
    console.log(`Transaction ID: ${txnid}`);
    console.log(`Amount: ₹${amount} (Real money)`);
    console.log(`Email: ${email}`);
    console.log(`Merchant: ${this.config.merchantKey}`);
    console.log('🚨 This is a LIVE transaction with real money');

    return {
      ...paymentParams,
      hash: hash
    };
  }

  /**
   * Verify payment response hash for security
   */
  verifyPaymentResponse(response: PaymentResponse): boolean {
    const expectedHash = this.generateResponseHash(response);
    const receivedHash = response.hash.toLowerCase();
    
    const isValid = expectedHash === receivedHash;
    
    console.log('🔒 Payment Response Verification');
    console.log(`Expected Hash: ${expectedHash.substring(0, 32)}...`);
    console.log(`Received Hash: ${receivedHash.substring(0, 32)}...`);
    console.log(`Verification: ${isValid ? '✅ VALID' : '❌ INVALID'}`);
    
    return isValid;
  }

  /**
   * Get PayU gateway URL
   */
  getGatewayUrl(): string {
    return `${this.config.baseUrl}/_payment`;
  }

  /**
   * Get merchant configuration (safe for logging)
   */
  getConfig() {
    return {
      merchantKey: this.config.merchantKey,
      baseUrl: this.config.baseUrl,
      saltLength: this.config.merchantSalt.length,
      clientIdPreview: this.config.clientId.substring(0, 8) + '...'
    };
  }
}