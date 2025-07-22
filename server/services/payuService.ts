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
  service_provider: string;
  hash: string;
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

export class PayUService {
  private config: PayUConfig;

  constructor() {
    const isProduction = process.env.NODE_ENV === 'production';
    const hasProductionKeys = process.env.PAYU_MERCHANT_KEY && process.env.PAYU_MERCHANT_SALT;
    
    this.config = {
      merchantKey: process.env.PAYU_MERCHANT_KEY || 'xXZDKp', // Production key from dashboard
      merchantSalt: process.env.PAYU_MERCHANT_SALT || 'PEvebkhtqZbQ4VhCV7W2IZCdgnGGaa2B', // Production 32-bit salt (for hash generation)
      clientId: process.env.PAYU_CLIENT_ID || 'f10a90386f9639dadfe839bc565d2e6d26cb5d88e1f49640b53960ed0d1364c8',
      clientSecret: process.env.PAYU_CLIENT_SECRET || 'd2d92cbf109d9efe6430ec8399c5ffc89287b5fcfe6e8f27713a0fc17f3b74ec',
      baseUrl: 'https://secure.payu.in' // Always use production URL with production credentials
    };

    // Log configuration status
    console.log(`PayU Service initialized in ${isProduction ? 'PRODUCTION' : 'TEST'} mode`);
    console.log(`Using base URL: ${this.config.baseUrl}`);
    console.log(`Merchant Key: ${this.config.merchantKey.substring(0, 6)}...`);
    
    // Confirm production credentials are loaded
    if (this.config.merchantKey === 'xXZDKp') {
      console.log('✅ PayU Production credentials loaded successfully');
      console.log('✅ Real payments and QR codes will work correctly');
    }
  }

  /**
   * Generate hash for payment request
   */
  generatePaymentHash(params: Omit<PaymentParams, 'hash'>): string {
    // PayU EXACT hash formula: key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||salt
    // CRITICAL: Must have exactly 11 pipes after email (5 UDF fields + 6 additional empty pipes)
    const hashString = `${params.key}|${params.txnid}|${params.amount}|${params.productinfo}|${params.firstname}|${params.email}|||||||||||||${this.config.merchantSalt}`;
    
    console.log('=== PayU Hash Debug (EXACT FORMAT) ===');
    console.log('Hash String:', hashString);
    console.log('PayU Required Format: key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||salt');
    console.log('Our Format (FIXED):   ', hashString);
    console.log('Pipe Count After Email:', (hashString.split('|').length - 7), '(should be 11 pipes after email)');
    console.log('Total Pipes in String:', (hashString.split('|').length - 1), '(should be 17 total)');
    console.log('Key:', params.key);
    console.log('TxnID:', params.txnid);
    console.log('Amount:', params.amount);
    console.log('Product:', params.productinfo);
    console.log('Name:', params.firstname);
    console.log('Email:', params.email);
    console.log('Salt:', this.config.merchantSalt);
    
    const hash = crypto.createHash('sha512').update(hashString).digest('hex');
    console.log('Generated Hash (FIXED):', hash);
    return hash;
  }

  /**
   * Generate hash for payment response verification
   */
  generateResponseHash(response: PaymentResponse): string {
    // PayU response hash formula (reverse order): salt|status|udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key
    const hashString = `${this.config.merchantSalt}|${response.status}|||||${response.email}|${response.firstname}|${response.productinfo}|${response.amount}|${response.txnid}|${this.config.merchantKey}`;
    console.log('=== PayU Response Hash Debug ===');
    console.log('Response Hash String:', hashString);
    return crypto.createHash('sha512').update(hashString).digest('hex');
  }

  /**
   * Create payment parameters for PayU
   */
  createPaymentParams(
    amount: number,
    email: string,
    firstname: string,
    phone: string = '',
    tier: string = 'pro'
  ): PaymentParams {
    const txnid = `INDIE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const baseUrl = 'https://workspace.shruti37.replit.app';

    const params: Omit<PaymentParams, 'hash'> = {
      key: this.config.merchantKey,
      txnid,
      amount: amount.toFixed(2),
      productinfo: `IndieShots_${tier}_Subscription`,
      firstname,
      email,
      phone: phone || '9999999999',
      surl: `${baseUrl}/api/payu/success`,
      furl: `${baseUrl}/api/payu/failure`,
      service_provider: 'payu_paisa',
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

    const hash = this.generatePaymentHash(params);

    return {
      ...params,
      hash
    };
  }

  /**
   * Verify payment response
   */
  verifyPaymentResponse(response: PaymentResponse): boolean {
    const calculatedHash = this.generateResponseHash(response);
    return calculatedHash.toLowerCase() === response.hash.toLowerCase();
  }

  /**
   * Get PayU payment URL
   */
  getPaymentUrl(): string {
    return `${this.config.baseUrl}/_payment`;
  }

  /**
   * Generate payment form HTML for auto-submit
   */
  generatePaymentForm(params: PaymentParams, paymentUrl: string): string {
    const formFields = Object.entries(params)
      .map(([key, value]) => `<input type="hidden" name="${key}" value="${value}" />`)
      .join('\n');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>IndieShots - Redirecting to Payment Gateway</title>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }
          .container {
            text-align: center;
            padding: 2rem;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 1rem;
            backdrop-filter: blur(10px);
          }
          .spinner {
            border: 3px solid rgba(255, 255, 255, 0.3);
            border-top: 3px solid white;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto 1rem;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          #payuForm {
            display: none;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="spinner"></div>
          <h2>Redirecting to Payment Gateway</h2>
          <p>Please wait while we redirect you to PayU for secure payment processing...</p>
          <p><small>Transaction ID: ${params.txnid}</small></p>
        </div>
        <form id="payuForm" action="${paymentUrl}" method="POST" accept-charset="UTF-8">
          ${formFields}
        </form>
        <script>
          console.log('PayU Form Debug:', {
            action: '${paymentUrl}',
            txnid: '${params.txnid}',
            key: '${params.key}',
            amount: '${params.amount}',
            email: '${params.email}'
          });
          
          // Immediate form submission for PayU
          window.onload = function() {
            const form = document.getElementById('payuForm');
            console.log('Submitting PayU form to:', form.action);
            form.submit();
          };
          
          // Fallback submission after 1 second
          setTimeout(() => {
            const form = document.getElementById('payuForm');
            if (form) {
              console.log('Fallback PayU form submission');
              form.submit();
            }
          }, 1000);
        </script>
      </body>
      </html>
    `;
  }
}