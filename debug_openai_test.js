/**
 * Debug OpenAI API to identify BadRequestError issues
 */
import { OpenAI } from 'openai';

async function testOpenAI() {
  console.log('🔍 Testing OpenAI API configuration...');
  
  // Check API key
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY not found');
    return;
  }
  
  console.log('✅ API key exists:', apiKey.substring(0, 10) + '...');
  
  // Initialize OpenAI
  const openai = new OpenAI({
    apiKey: apiKey,
    timeout: 30000,
    maxRetries: 1
  });
  
  try {
    // Test 1: Simple text completion
    console.log('\n🧪 Test 1: Text completion...');
    const textResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Say hello' }],
      max_tokens: 10
    });
    console.log('✅ Text completion works:', textResponse.choices[0].message.content);
    
    // Test 2: Image generation with minimal prompt
    console.log('\n🧪 Test 2: Image generation...');
    const imageResponse = await openai.images.generate({
      model: 'dall-e-3',
      prompt: 'A simple red circle',
      size: '1024x1024',
      quality: 'standard',
      n: 1
    });
    
    console.log('✅ Image generation works:', imageResponse.data[0].url);
    
  } catch (error) {
    console.error('❌ OpenAI API Error:', {
      name: error.constructor.name,
      message: error.message,
      status: error.status,
      code: error.code,
      type: error.type
    });
  }
}

testOpenAI();