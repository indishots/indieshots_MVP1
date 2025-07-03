// Debug tier validation issue
import fetch from 'node-fetch';

async function debugTierValidation() {
  const baseUrl = 'https://workspace.indieshots.replit.app';
  
  try {
    console.log('Debugging tier validation process...');
    
    // First, let's check if the promo code validation endpoint works
    console.log('\n1. Testing promo code validation endpoint...');
    const promoResponse = await fetch(`${baseUrl}/api/promo-codes/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: 'INDIE2025'
      })
    });
    
    const promoData = await promoResponse.json();
    console.log('   Promo validation response:', promoData);
    
    if (promoData.valid) {
      console.log('✅ Promo code INDIE2025 is valid');
      console.log('   Tier granted:', promoData.tier);
      console.log('   Usage count:', promoData.usageCount, '/', promoData.maxUsage);
    } else {
      console.log('❌ Promo code INDIE2025 is invalid');
      console.log('   Reason:', promoData.message);
    }
    
    // Check if user already exists with this email
    console.log('\n2. Testing auth endpoints...');
    const authTestResponse = await fetch(`${baseUrl}/api/auth/test-keys`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    const authData = await authTestResponse.json();
    console.log('   Auth test response:', authData);
    
    if (authData.openai === 'working') {
      console.log('✅ OpenAI API key is working');
    } else {
      console.log('❌ OpenAI API key issue');
    }
    
    if (authData.firebase === 'working') {
      console.log('✅ Firebase is working');
    } else {
      console.log('❌ Firebase issue');
    }
    
    // Check database connectivity
    console.log('\n3. Testing database connectivity...');
    const dbTestResponse = await fetch(`${baseUrl}/api/auth/user`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    console.log('   Database test status:', dbTestResponse.status);
    
    if (dbTestResponse.status === 401) {
      console.log('✅ Database is accessible (401 = not authenticated, which is expected)');
    } else {
      console.log('   Unexpected status - checking response...');
      const dbData = await dbTestResponse.json();
      console.log('   Response:', dbData);
    }
    
  } catch (error) {
    console.error('Debug failed:', error);
  }
}

debugTierValidation();