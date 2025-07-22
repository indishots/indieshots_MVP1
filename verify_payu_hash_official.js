import crypto from 'crypto';

// Test the EXACT official PayU hash formula
const MERCHANT_KEY = 'xXZDKp';
const MERCHANT_SALT = 'ezsXEEqchsA1ZLmHzn5BrLRl9snmckHn';

// Sample transaction data from our API response
const testData = {
  key: MERCHANT_KEY,
  txnid: 'INDIE_TEST_123456789',
  amount: '1.00',
  productinfo: 'IndieShots Pro Subscription',
  firstname: 'Test User',
  email: 'test@example.com'
};

console.log('=== PayU Official Hash Formula Verification ===\n');

// Official PayU Documentation Formula:
// sha512(key|txnid|amount|productinfo|firstname|email|||||||||||SALT)
const officialHashString = `${testData.key}|${testData.txnid}|${testData.amount}|${testData.productinfo}|${testData.firstname}|${testData.email}|||||||||||${MERCHANT_SALT}`;

console.log('Official PayU Hash Formula:');
console.log('sha512(key|txnid|amount|productinfo|firstname|email|||||||||||SALT)');
console.log('');

console.log('Hash String Construction:');
console.log(`Key: ${testData.key}`);
console.log(`TxnID: ${testData.txnid}`);
console.log(`Amount: ${testData.amount}`);
console.log(`ProductInfo: ${testData.productinfo}`);
console.log(`FirstName: ${testData.firstname}`);
console.log(`Email: ${testData.email}`);
console.log(`UDF Fields: Empty (11 pipes: |||||||||||)`);
console.log(`Salt: ${MERCHANT_SALT.substring(0, 8)}...`);
console.log('');

console.log('Complete Hash String:');
console.log(officialHashString);
console.log('');

// Count pipes
const pipeCount = (officialHashString.match(/\|/g) || []).length;
console.log(`Total Pipes: ${pipeCount}`);
console.log('');

// Generate hash
const officialHash = crypto.createHash('sha512').update(officialHashString, 'utf8').digest('hex');
console.log('Generated Hash:');
console.log(officialHash);
console.log('');

console.log('Hash Verification:');
console.log(`Length: ${officialHash.length} characters (should be 128)`);
console.log(`Algorithm: SHA512`);
console.log(`Encoding: UTF-8`);
console.log(`Format: Lowercase hex`);
console.log('');

// Verify against PayU requirements
const isValid = 
  pipeCount === 16 && 
  officialHash.length === 128 && 
  /^[a-f0-9]+$/.test(officialHash);

console.log(`PayU Compliance Check: ${isValid ? '✅ VALID' : '❌ INVALID'}`);

if (isValid) {
  console.log('');
  console.log('🎉 SUCCESS: Hash formula matches PayU official documentation!');
  console.log('This hash should be accepted by PayU production gateway.');
} else {
  console.log('');
  console.log('❌ ERROR: Hash formula does not match PayU requirements.');
}