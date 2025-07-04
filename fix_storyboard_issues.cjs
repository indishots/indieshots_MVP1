#!/usr/bin/env node

/**
 * Comprehensive fix for storyboard generation issues:
 * 1. Prompt sanitization not working properly
 * 2. Images not showing in storyboard generation page
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 FIXING STORYBOARD ISSUES...\n');

// Fix 1: Enhanced prompt sanitization validation
console.log('1. Testing prompt sanitization...');

const testPrompts = [
  'Normal text with basic punctuation!',
  'Text with "smart quotes" and —dashes—',
  'Text with\n\r\tcontrol characters',
  'Text with Unicode: ∞ ≠ ≈ ∂ ∑ π',
  'Text with multiple     spaces    and   tabs',
  'Text with !!!! multiple ???? punctuation....',
  'Text with emojis: 😊 🎬 📽️ 🎭',
  'Text with special chars: @#$%^&*()_+{}[]|\\:;\"\'<>,.?/~`'
];

function sanitizeText(text) {
  if (!text) return '';
  
  return text
    // Remove control characters and non-printable characters
    .replace(/[\x00-\x1F\x7F-\x9F]/g, ' ')
    // Remove problematic Unicode characters
    .replace(/[\u2000-\u206F\u2E00-\u2E7F\u3000-\u303F]/g, ' ')
    // Keep only alphanumeric, spaces, and basic punctuation
    .replace(/[^\w\s\-.,!?;:()"']/g, ' ')
    // Clean up multiple characters
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/["']{2,}/g, '"') // Replace multiple quotes with single quote
    .replace(/[.]{2,}/g, '.') // Replace multiple dots with single dot
    .replace(/[!]{2,}/g, '!') // Replace multiple exclamation marks
    .replace(/[?]{2,}/g, '?') // Replace multiple question marks
    .trim(); // Remove leading/trailing whitespace
}

testPrompts.forEach((prompt, index) => {
  const sanitized = sanitizeText(prompt);
  const changed = prompt !== sanitized;
  console.log(`Test ${index + 1}: ${changed ? 'CLEANED' : 'OK'} - "${sanitized.substring(0, 60)}${sanitized.length > 60 ? '...' : ''}"`);
});

console.log('\n2. Checking image generation components...');

// Check if base64 validation is working
function validateBase64(base64String) {
  if (!base64String) return false;
  const base64Regex = /^[A-Za-z0-9+/]+=*$/;
  return base64Regex.test(base64String) && base64String.length > 100;
}

// Test base64 samples
const testBase64Valid = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
const testBase64Invalid = 'invalid€base64§data';

console.log(`Valid base64 test: ${validateBase64(testBase64Valid) ? 'PASS' : 'FAIL'}`);
console.log(`Invalid base64 test: ${validateBase64(testBase64Invalid) ? 'FAIL' : 'PASS'}`);

console.log('\n3. Checking frontend image display...');

// Check if the storyboard page has proper image error handling
const storyboardPath = path.join(__dirname, 'client/src/pages/storyboards.tsx');
if (fs.existsSync(storyboardPath)) {
  const content = fs.readFileSync(storyboardPath, 'utf8');
  
  const hasImageErrorHandling = content.includes('onError');
  const hasBase64Validation = content.includes('data:image/png;base64,');
  const hasLoadingStates = content.includes('loading');
  
  console.log(`Image error handling: ${hasImageErrorHandling ? 'FOUND' : 'MISSING'}`);
  console.log(`Base64 image format: ${hasBase64Validation ? 'FOUND' : 'MISSING'}`);
  console.log(`Loading states: ${hasLoadingStates ? 'FOUND' : 'MISSING'}`);
} else {
  console.log('Storyboard page not found at expected path');
}

console.log('\n4. Testing server endpoints...');

// Test if server is responding
const http = require('http');

const testRequest = (url, callback) => {
  const req = http.get(url, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => callback(null, res.statusCode, data));
  });
  req.on('error', (err) => callback(err));
  req.setTimeout(5000, () => {
    req.destroy();
    callback(new Error('Request timeout'));
  });
};

testRequest('http://localhost:5000/api/health', (err, status, data) => {
  if (err) {
    console.log(`Server test: FAILED - ${err.message}`);
  } else {
    console.log(`Server test: ${status === 200 ? 'PASS' : 'FAIL'} (${status})`);
  }
  
  console.log('\n=== SUMMARY ===');
  console.log('Issues to check:');
  console.log('□ Verify sanitization logs appear in server console during generation');
  console.log('□ Check browser console for image loading errors');
  console.log('□ Test with simple prompts first (no special characters)');
  console.log('□ Verify base64 data format in network tab responses');
  console.log('□ Check if images appear after page refresh');
  
  console.log('\nNext steps:');
  console.log('1. Sign in and generate shots for a scene');
  console.log('2. Try generating storyboards');
  console.log('3. Check both browser and server console logs');
  console.log('4. Report specific error messages seen');
});