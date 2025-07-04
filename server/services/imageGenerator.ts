import { OpenAI } from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import fetch from 'node-fetch';
import { characterMemoryService } from './characterMemoryService';

const promptClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const imageClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `You are a professional film director and AI visual artist. 
Your task is to take each shot from a shot division table and turn it into a vivid, detailed prompt for an image generation AI. 
Your prompt should visually describe the entire scene in cinematic terms with emphasis on character consistency. 
When character descriptions are provided, use them exactly as specified to maintain visual continuity across scenes.
Focus on cinematic composition, lighting, mood, and visual storytelling. Be descriptive and use visual language.
Format the response as a single detailed paragraph suitable for DALL-E 3 generation.`;

const IMAGE_OUTPUT_DIR = path.join(process.cwd(), 'generated_images');

// Ensure output directory exists
if (!fs.existsSync(IMAGE_OUTPUT_DIR)) {
  fs.mkdirSync(IMAGE_OUTPUT_DIR, { recursive: true });
}

/**
 * Clean prompt to avoid OpenAI content policy violations
 */
function sanitizePromptForGeneration(prompt: string): string {
  let cleaned = prompt;
  
  // More comprehensive content policy replacements
  const replacements: { [key: string]: string } = {
    // Violence and harm
    'blood-soaked': 'red-stained',
    'bloody': 'red-tinted',
    'gore': 'dramatic effects',
    'violent': 'intense dramatic',
    'death': 'dramatic conclusion',
    'murder': 'mystery scene',
    'kill': 'dramatic confrontation',
    'weapon': 'prop',
    'gun': 'hand prop',
    'knife': 'kitchen utensil',
    'sword': 'stage prop',
    'violence': 'dramatic action',
    'brutal': 'intense',
    'torture': 'dramatic questioning',
    'wound': 'stage makeup',
    'injury': 'dramatic effect',
    'attack': 'dramatic scene',
    'fight': 'choreographed sequence',
    'shooting': 'filming',
    'shot': 'filmed',
    
    // Crime terms
    'crime scene': 'investigation scene',
    'criminal': 'character',
    'victim': 'person',
    'suspect': 'character',
    'police tape': 'yellow barrier tape',
    'evidence': 'clues',
    'blood soaked': 'red-stained',
    'bloodsoaked': 'red-stained',
    'lane': 'street area',
    
    // General problematic terms
    'dead': 'still',
    'dying': 'dramatic',
    'pain': 'emotion',
    'suffering': 'dramatic emotion',
    'terror': 'suspense',
    'horror': 'mystery'
  };
  
  // Apply replacements case-insensitively
  for (const [problematic, replacement] of Object.entries(replacements)) {
    const regex = new RegExp(`\\b${problematic}\\b`, 'gi');
    cleaned = cleaned.replace(regex, replacement);
  }
  
  // Remove any remaining potentially problematic phrases
  const problematicPhrases = [
    /blood\s+everywhere/gi,
    /covered\s+in\s+blood/gi,
    /pools?\s+of\s+blood/gi,
    /graphic\s+violence/gi,
    /extreme\s+violence/gi
  ];
  
  for (const phrase of problematicPhrases) {
    cleaned = cleaned.replace(phrase, 'dramatic red effects');
  }
  
  // Ensure prompt emphasizes artistic/cinematic nature
  if (!cleaned.toLowerCase().includes('cinematic') && !cleaned.toLowerCase().includes('film')) {
    cleaned = `Professional cinematic scene: ${cleaned}`;
  }
  
  // Add artistic modifiers to make it more acceptable
  cleaned = `${cleaned}, professional movie scene, artistic lighting, film production quality`;
  
  return cleaned.trim();
}

export interface StoryboardFrame {
  shotNumber: number;
  imagePath?: string;
  prompt: string;
  description: string;
  shotType: string;
  cameraAngle: string;
  notes?: string;
}

/**
 * Detect problematic characters that might cause OpenAI API errors
 */
function detectProblematicCharacters(text: string): string[] {
  if (!text) return [];
  
  const problematicChars = [];
  const problematicPatterns = [
    { pattern: /[^\x20-\x7E]/g, name: 'Non-ASCII characters' },
    { pattern: /[\x00-\x1F\x7F-\x9F]/g, name: 'Control characters' },
    { pattern: /[\u2000-\u206F]/g, name: 'Unicode punctuation' },
    { pattern: /[\u2E00-\u2E7F]/g, name: 'Supplemental punctuation' },
    { pattern: /[\u3000-\u303F]/g, name: 'CJK symbols' },
    { pattern: /[""''„‚]/g, name: 'Smart quotes' },
    { pattern: /[–—−]/g, name: 'Special dashes' },
    { pattern: /[…]/g, name: 'Ellipsis' },
    { pattern: /[\u{1F600}-\u{1F6FF}]/gu, name: 'Emojis' },
    { pattern: /[\u{2600}-\u{27BF}]/gu, name: 'Symbols' },
    { pattern: /["']{3,}/g, name: 'Multiple quotes' },
    { pattern: /[.]{3,}/g, name: 'Multiple dots' },
    { pattern: /[!]{3,}/g, name: 'Multiple exclamation marks' },
    { pattern: /[?]{3,}/g, name: 'Multiple question marks' },
    { pattern: /\s{3,}/g, name: 'Multiple spaces' }
  ];
  
  for (const { pattern, name } of problematicPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      problematicChars.push(`${name}: ${matches.slice(0, 5).join(', ')}`);
    }
  }
  
  return problematicChars;
}

/**
 * Sanitize text to remove special characters that cause OpenAI API errors
 */
export function sanitizeText(text: string): string {
  if (!text) return '';
  
  console.log(`🔧 SANITIZATION START: Original text length: ${text.length}`);
  console.log(`🔧 SANITIZATION START: First 100 chars: "${text.substring(0, 100)}"`);
  
  // Log problematic characters for debugging
  const problematicChars = detectProblematicCharacters(text);
  if (problematicChars.length > 0) {
    console.log(`🔧 SANITIZATION: Found problematic characters: ${problematicChars.join('; ')}`);
  }
  
  let sanitized = text
    // Remove ALL control characters and non-printable characters
    .replace(/[\x00-\x1F\x7F-\x9F]/g, ' ')
    // Remove ALL Unicode punctuation and symbols that cause issues
    .replace(/[\u2000-\u206F]/g, ' ')  // General punctuation
    .replace(/[\u2E00-\u2E7F]/g, ' ')  // Supplemental punctuation
    .replace(/[\u3000-\u303F]/g, ' ')  // CJK symbols
    .replace(/[\u2010-\u201F]/g, '-')  // Various dashes to hyphen
    .replace(/[\u2020-\u2027]/g, ' ')  // Dagger, bullet, etc.
    .replace(/[\u2030-\u205F]/g, ' ')  // Per mille, etc.
    // Replace smart quotes and curly quotes
    .replace(/[""''„‚]/g, '"')
    .replace(/['']/g, "'")
    // Replace special dashes
    .replace(/[–—−]/g, '-')
    // Replace ellipsis and similar
    .replace(/[…]/g, '...')
    // Remove emojis and symbols
    .replace(/[\u{1F600}-\u{1F64F}]/gu, ' ') // Emoticons
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, ' ') // Misc symbols
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, ' ') // Transport symbols
    .replace(/[\u{2600}-\u{26FF}]/gu, ' ')   // Misc symbols
    .replace(/[\u{2700}-\u{27BF}]/gu, ' ')   // Dingbats
    // Remove mathematical symbols
    .replace(/[\u{2200}-\u{22FF}]/gu, ' ')
    // Remove currency and other symbols
    .replace(/[\u{20A0}-\u{20CF}]/gu, ' ')
    // Keep ONLY ASCII letters, numbers, basic punctuation, and spaces
    .replace(/[^\x20-\x7E]/g, ' ')
    // Clean up multiple characters
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/["']{2,}/g, '"') // Replace multiple quotes with single quote
    .replace(/[.]{2,}/g, '.') // Replace multiple dots with single dot
    .replace(/[!]{2,}/g, '!') // Replace multiple exclamation marks
    .replace(/[?]{2,}/g, '?') // Replace multiple question marks
    .replace(/[-]{2,}/g, '-') // Replace multiple dashes
    .trim(); // Remove leading/trailing whitespace
  
  // Final validation - ensure only safe ASCII characters remain
  sanitized = sanitized.replace(/[^\w\s\-.,!?;:()"']/g, ' ');
  
  console.log(`🔧 SANITIZATION COMPLETE: Sanitized length: ${sanitized.length}`);
  console.log(`🔧 SANITIZATION COMPLETE: First 100 chars: "${sanitized.substring(0, 100)}"`);
  console.log(`🔧 SANITIZATION RESULT: Characters removed: ${text.length - sanitized.length}`);
  
  return sanitized;
}

/**
 * Build concise, effective prompts from shot data with comprehensive sanitization
 */
function buildPrompt(shot: any): string {
  console.log(`🎬 PROMPT CONSTRUCTION START for shot: ${shot.id || 'unknown'}`);
  
  // Sanitize and truncate all fields before building prompt
  const sanitizedShot = {
    shotType: sanitizeText(String(shot.shot_type || shot.shotType || '')).substring(0, 50),
    lens: sanitizeText(String(shot.lens || '')).substring(0, 20),
    movement: sanitizeText(String(shot.movement || '')).substring(0, 30),
    location: sanitizeText(String(shot.location || '')).substring(0, 40),
    timeOfDay: sanitizeText(String(shot.time_of_day || shot.timeOfDay || '')).substring(0, 20),
    mood: sanitizeText(String(shot.mood_and_ambience || shot.moodAndAmbience || '')).substring(0, 40),
    lighting: sanitizeText(String(shot.lighting || '')).substring(0, 40),
    props: sanitizeText(String(shot.props || '')).substring(0, 50),
    description: sanitizeText(String(shot.shot_description || shot.shotDescription || '')).substring(0, 200),
    characters: sanitizeText(String(shot.characters || '')).substring(0, 100)
  };
  
  // Log sanitized fields for debugging
  console.log(`🎬 SANITIZED FIELDS:`);
  console.log(`   Shot Type: "${sanitizedShot.shotType}"`);
  console.log(`   Description: "${sanitizedShot.description}"`);
  console.log(`   Characters: "${sanitizedShot.characters}"`);
  console.log(`   Location: "${sanitizedShot.location}"`);
  
  // Build a concise, focused prompt (target: under 400 characters)
  let prompt = `${sanitizedShot.shotType} shot of ${sanitizedShot.description}`;
  
  // Add essential details only if they exist and are meaningful
  if (sanitizedShot.characters && sanitizedShot.characters !== 'None' && sanitizedShot.characters.trim()) {
    prompt += `, featuring ${sanitizedShot.characters}`;
  }
  
  if (sanitizedShot.location && sanitizedShot.location !== 'None' && sanitizedShot.location.trim()) {
    prompt += ` at ${sanitizedShot.location}`;
  }
  
  if (sanitizedShot.lighting && sanitizedShot.lighting !== 'None' && sanitizedShot.lighting.trim()) {
    prompt += `, ${sanitizedShot.lighting} lighting`;
  }
  
  if (sanitizedShot.mood && sanitizedShot.mood !== 'None' && sanitizedShot.mood.trim()) {
    prompt += `, ${sanitizedShot.mood} mood`;
  }
  
  // Always add cinematic styling
  prompt += `, professional movie scene, artistic lighting, film production quality`;
  
  // Double sanitization - first pass during build, second pass on final result
  let finalPrompt = sanitizeText(prompt);
  
  // Additional cleanup for OpenAI compatibility
  finalPrompt = finalPrompt
    .replace(/\s+/g, ' ')  // Ensure single spaces
    .replace(/[^\w\s\-.,!?;:()"']/g, ' ')  // Remove any remaining special chars
    .trim();
  
  console.log(`🎬 PROMPT BUILD COMPLETE:`);
  console.log(`   - Original length: ${prompt.length} chars`);
  console.log(`   - Final length: ${finalPrompt.length} chars`);
  console.log(`   - Full prompt: "${finalPrompt}"`);
  
  // Ensure prompt isn't too long (OpenAI DALL-E limit is 1000 chars)
  if (finalPrompt.length > 800) {
    const truncatedPrompt = sanitizeText(finalPrompt.substring(0, 800)).trim();
    console.log(`⚠️ PROMPT TRUNCATED: ${finalPrompt.length} -> ${truncatedPrompt.length} chars`);
    return truncatedPrompt;
  }
  
  return finalPrompt;
}

/**
 * Generate visual prompt using GPT-4 with character memory integration and sanitization
 */
async function generatePrompt(userMessage: string, retries: number = 2): Promise<string | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Generating prompt (attempt ${attempt}/${retries})`);
      
      // Sanitize the input message first
      const sanitizedMessage = sanitizeText(userMessage);
      
      // First, enhance the prompt with character consistency
      const enhancedMessage = await characterMemoryService.buildEnhancedPrompt(sanitizedMessage);
      
      const response = await promptClient.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: enhancedMessage }
        ],
        max_tokens: 400, // Increased to accommodate character descriptions
        temperature: 0.7
      });
      
      const prompt = response.choices[0].message.content?.trim();
      if (prompt && prompt.length > 10) {
        // Sanitize the generated prompt before returning
        const sanitizedPrompt = sanitizeText(prompt);
        console.log(`Generated character-enhanced prompt: ${sanitizedPrompt.substring(0, 100)}...`);
        return sanitizedPrompt;
      } else {
        console.log(`Generated prompt too short or empty (attempt ${attempt})`);
        if (attempt === retries) {
          // Fallback to a basic prompt based on shot data
          const fallbackPrompt = `A cinematic shot showing ${sanitizedMessage.includes('Shot Description:') ? 
            sanitizeText(sanitizedMessage.split('Shot Description:')[1]?.split('\n')[0]?.trim() || 'scene') : 'scene'}`;
          console.log(`Using fallback prompt: ${fallbackPrompt}`);
          return fallbackPrompt;
        }
      }
    } catch (error: any) {
      console.error(`[ERROR] Prompt generation failed (attempt ${attempt}/${retries}):`, error?.message || error);
      
      if (error?.status === 429) {
        console.log('Rate limit hit for prompt generation, waiting before retry...');
        await new Promise(resolve => setTimeout(resolve, 5000 * attempt));
      } else if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
      }
      
      if (attempt === retries) {
        // Final fallback - create basic prompt from shot data
        const shotDesc = userMessage.includes('Shot Description:') ? 
          userMessage.split('Shot Description:')[1]?.split('\n')[0]?.trim() : 'cinematic scene';
        const fallbackPrompt = `A professional film shot of ${shotDesc || 'a scene'}`;
        console.log(`Using emergency fallback prompt: ${fallbackPrompt}`);
        return fallbackPrompt;
      }
    }
  }
  return null;
}

/**
 * Generate image using DALL-E 3
 */
async function generateImage(prompt: string, filename: string): Promise<string> {
  try {
    const response = await imageClient.images.generate({
      model: 'dall-e-3',
      prompt,
      size: '1792x1024',
      quality: 'standard',
      n: 1
    });

    const imageUrl = response.data?.[0]?.url;
    if (!imageUrl) {
      throw new Error('No image URL returned from DALL-E');
    }

    // Download and save the image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.statusText}`);
    }

    const imageBuffer = await imageResponse.buffer();
    const fullPath = path.join(IMAGE_OUTPUT_DIR, filename);
    
    fs.writeFileSync(fullPath, imageBuffer);
    
    return `✅ Saved to ${filename}`;
  } catch (error) {
    console.error('[ERROR] Image generation failed:', error);
    return `[ERROR] Image generation failed: ${error}`;
  }
}

/**
 * Generate a very safe fallback image when all other attempts fail
 */
async function generateFallbackImage(originalPrompt: string): Promise<string | null> {
  try {
    console.log('Attempting fallback image generation with ultra-safe prompt');
    
    // Extract basic visual elements and create a very safe prompt
    const safeFallbackPrompt = `Professional film production still of a movie scene, cinematic lighting, high quality cinematography, artistic composition, clean and safe for work content`;
    
    const response = await imageClient.images.generate({
      model: "dall-e-3",
      prompt: safeFallbackPrompt,
      n: 1,
      size: "1792x1024", // Wider cinematic format
      response_format: "url"
    });

    const imageUrl = response.data?.[0]?.url;
    if (!imageUrl) {
      console.error('No fallback image URL returned');
      return 'GENERATION_FAILED';
    }

    // Download the fallback image
    const imageResponse = await fetch(imageUrl, { 
      headers: {
        'User-Agent': 'IndieShots-Server/1.0'
      }
    });

    if (!imageResponse.ok) {
      console.error(`Failed to download fallback image: ${imageResponse.statusText}`);
      return 'GENERATION_FAILED';
    }

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    const base64Data = imageBuffer.toString('base64');
    
    console.log('Successfully generated fallback image');
    return base64Data;
  } catch (error) {
    console.error('Fallback image generation failed:', error);
    return 'GENERATION_FAILED';
  }
}

/**
 * Generate image and return base64 data for database storage
 * Enhanced with aggressive retry logic to ensure ALL images are generated
 */
export async function generateImageData(prompt: string, retries: number = 3): Promise<string | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Generating image data (attempt ${attempt}/${retries}) with prompt: ${prompt.substring(0, 100)}...`);
      
      // Clean the prompt to avoid content policy violations and special characters
      const cleanedPrompt = sanitizeText(sanitizePromptForGeneration(prompt));
      console.log(`=== IMAGE GENERATION DEBUG ===`);
      console.log(`Original prompt: ${prompt}`);
      console.log(`Cleaned prompt: ${cleanedPrompt}`);
      console.log(`Prompt length: ${cleanedPrompt.length} characters`);
      console.log(`==============================`);
      
      // Add timeout and better error handling
      const response = await Promise.race([
        imageClient.images.generate({
          model: "dall-e-3",
          prompt: cleanedPrompt,
          n: 1,
          size: "1792x1024", // Wider cinematic format
          response_format: "url"
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Image generation timeout after 60 seconds')), 60000)
        )
      ]) as any;

      const imageUrl = response.data?.[0]?.url;
      if (!imageUrl) {
        console.error(`No image URL returned from OpenAI (attempt ${attempt})`);
        if (attempt === retries) return null;
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt)); // Exponential backoff
        continue;
      }

      // Download the image with timeout
      const imageResponse = await fetch(imageUrl, { 
        headers: {
          'User-Agent': 'IndieShots-Server/1.0'
        }
      });

      
      if (!imageResponse.ok) {
        console.error(`Failed to download image (attempt ${attempt}): ${imageResponse.statusText}`);
        if (attempt === retries) return null;
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        continue;
      }

      const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
      const base64Data = imageBuffer.toString('base64');
      
      // Comprehensive base64 validation
      if (base64Data.length < 1000) {
        console.error(`❌ Base64 data too short (${base64Data.length} chars), likely corrupted`);
        if (attempt === retries) return 'GENERATION_FAILED';
        await new Promise(resolve => setTimeout(resolve, 3000 * attempt));
        continue;
      }
      
      // Test that the base64 can be decoded properly
      try {
        const testBuffer = Buffer.from(base64Data, 'base64');
        if (testBuffer.length < 1000) {
          console.error(`❌ Decoded image buffer too small (${testBuffer.length} bytes)`);
          if (attempt === retries) return 'GENERATION_FAILED';
          await new Promise(resolve => setTimeout(resolve, 3000 * attempt));
          continue;
        }
      } catch (decodeError) {
        console.error(`❌ Invalid base64 data generated:`, decodeError);
        if (attempt === retries) return 'GENERATION_FAILED';
        await new Promise(resolve => setTimeout(resolve, 3000 * attempt));
        continue;
      }
      
      // Final validation and logging
      const isValidBase64 = /^[A-Za-z0-9+/]+=*$/.test(base64Data);
      
      if (!isValidBase64) {
        console.error(`❌ Base64 format validation failed`);
        if (attempt === retries) return 'GENERATION_FAILED';
        await new Promise(resolve => setTimeout(resolve, 3000 * attempt));
        continue;
      }
      
      console.log(`✅ IMAGE GENERATION SUCCESS:`);
      console.log(`   - Attempt: ${attempt}/${retries}`);
      console.log(`   - Base64 length: ${base64Data.length} chars`);
      console.log(`   - Valid format: ${isValidBase64}`);
      console.log(`   - Buffer size: ${imageBuffer.length} bytes`);
      console.log(`   - Preview: ${base64Data.substring(0, 50)}...`);
      console.log(`   - Preview: ${base64Data.substring(0, 50)}...`);
      
      if (!isValidBase64) {
        console.error(`❌ Invalid base64 format! Contains invalid characters.`);
        if (attempt === retries) return 'GENERATION_FAILED';
        await new Promise(resolve => setTimeout(resolve, 3000 * attempt));
        continue;
      }
      
      return base64Data;
    } catch (error: any) {
      console.error(`Error generating image data (attempt ${attempt}/${retries}):`, error?.message || error);
      
      // Simplified error handling for faster, more reliable generation
      let waitTime = 2000; // Base wait time
      
      if (error?.status === 429 || error?.message?.includes('rate limit')) {
        console.log(`Rate limit hit (attempt ${attempt}/${retries}), waiting...`);
        waitTime = 5000; // Fixed 5 second wait for rate limits
      } else if (error?.status === 400 || error?.message?.includes('content policy')) {
        console.log(`Content policy issue (attempt ${attempt}/${retries}), will try with safer prompt...`);
        console.log(`Original prompt causing issue: ${prompt.substring(0, 200)}...`);
        // Log the characters that might be causing problems
        const problematicChars = detectProblematicCharacters(prompt);
        if (problematicChars.length > 0) {
          console.log(`Potential problematic characters found: ${problematicChars.join('; ')}`);
        }
        waitTime = 1000; // Short wait for content policy
      } else if (error?.message?.includes('timeout') || error?.name === 'AbortError') {
        console.log(`Request timeout (attempt ${attempt}/${retries}), retrying...`);
        waitTime = 3000; // Fixed 3 second wait for timeouts
      } else if (error?.message?.includes('upstream') || error?.message?.includes('JSON')) {
        console.log(`OpenAI server error detected (attempt ${attempt}/${retries}), waiting...`);
        waitTime = 4000; // Fixed 4 second wait for server errors
      } else if (error?.status >= 500) {
        console.log(`OpenAI server error ${error.status} (attempt ${attempt}/${retries}), waiting...`);
        waitTime = 3000; // Fixed 3 second wait for server errors
      } else {
        console.log(`Unknown error (attempt ${attempt}/${retries}), retrying...`);
        waitTime = 2000; // Fixed 2 second wait for unknown errors
      }
      
      // Final attempt - return failure instead of complex fallback
      if (attempt === retries) {
        console.error(`Failed to generate image after ${retries} attempts`);
        return 'GENERATION_FAILED';
      }
      
      console.log(`Waiting ${waitTime/1000} seconds before retry ${attempt + 1}...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  return null;
}

/**
 * Process a single shot to generate storyboard frame and store in database
 */
async function processShot(shot: any, index: number): Promise<{ shotId: string; status: string; frame?: StoryboardFrame }> {
  const shotId = shot.shotNumber?.toString() || `shot_${index + 1}`;
  
  try {
    console.log(`Processing shot ${shotId} (ID: ${shot.id})`);
    console.log(`Shot object keys:`, Object.keys(shot));
    console.log(`Shot characters field:`, shot.characters);
    
    const userMessage = buildPrompt(shot);
    console.log(`Built prompt:`, userMessage.substring(0, 200) + '...');
    
    const prompt = await generatePrompt(userMessage);
    if (!prompt) {
      console.error(`Prompt generation failed for shot ${shotId}`);
      return { shotId, status: 'prompt generation failed' };
    }

    // Generate image and get base64 data instead of saving to file
    const imageData = await generateImageData(prompt);
    if (!imageData || imageData === 'GENERATION_FAILED' || imageData === 'CONTENT_POLICY_VIOLATION') {
      console.error(`Image generation failed for shot ${shotId}: ${imageData || 'unknown error'}`);
      
      // Store the failure status in the database so frontend knows this shot failed
      const { storage } = await import('../storage');
      const failureMarker = imageData === 'CONTENT_POLICY_VIOLATION' ? 'CONTENT_POLICY_ERROR' : 'GENERATION_ERROR';
      await storage.updateShotImage(shot.id, failureMarker, prompt);
      
      return { shotId, status: `image generation failed: ${imageData || 'unknown error'}` };
    }

    // Store image data in the shot record
    const { storage } = await import('../storage');
    await storage.updateShotImage(shot.id, imageData, prompt);
    
    console.log(`Successfully generated and stored image for shot ${shotId}`);
    
    const frame: StoryboardFrame = {
      shotNumber: shot.shotNumber || index + 1,
      prompt,
      description: shot.shotDescription || '',
      shotType: shot.shotType || '',
      cameraAngle: shot.lens || '',
      notes: shot.notes || '',
      imagePath: `data:image/png;base64,${imageData}`
    };

    return { shotId, status: 'stored in database', frame };
  } catch (error) {
    console.error(`Error processing shot ${shotId}:`, error);
    return { shotId, status: `error: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

// Simple circuit breaker for OpenAI API
let consecutiveFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 3;
const CIRCUIT_BREAKER_TIMEOUT = 60000; // 1 minute
let circuitBreakerOpenTime = 0;

function isCircuitBreakerOpen(): boolean {
  if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
    if (Date.now() - circuitBreakerOpenTime < CIRCUIT_BREAKER_TIMEOUT) {
      return true;
    } else {
      // Reset circuit breaker after timeout
      consecutiveFailures = 0;
      circuitBreakerOpenTime = 0;
      console.log('Circuit breaker reset - attempting to reconnect to OpenAI');
    }
  }
  return false;
}

function recordFailure() {
  consecutiveFailures++;
  if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
    circuitBreakerOpenTime = Date.now();
    console.log(`Circuit breaker opened - too many consecutive OpenAI failures (${consecutiveFailures})`);
  }
}

function recordSuccess() {
  if (consecutiveFailures > 0) {
    console.log(`OpenAI service recovered - resetting failure count from ${consecutiveFailures}`);
    consecutiveFailures = 0;
    circuitBreakerOpenTime = 0;
  }
}

/**
 * Generate storyboard frames for multiple shots with retry mechanism and circuit breakerm
 */
export async function generateStoryboards(shots: any[]): Promise<{ results: any[]; frames: StoryboardFrame[] }> {
  const results: any[] = [];
  const frames: StoryboardFrame[] = [];
  const failedShots: any[] = [];

  console.log(`Processing ${shots.length} shots sequentially for maximum reliability`);

  // First pass: process all shots sequentially with enhanced rate limiting
  for (let shotIndex = 0; shotIndex < shots.length; shotIndex++) {
    const shot = shots[shotIndex];
    console.log(`Processing shot ${shotIndex + 1}/${shots.length} (ID: ${shot.id})`);
    
    try {
      const shotResult = await processShot(shot, shotIndex);
      
      if (shotResult && shotResult.status.includes('stored in database')) {
        results.push(shotResult);
        if ('frame' in shotResult && shotResult.frame) {
          frames.push(shotResult.frame);
        }
        console.log(`✅ Shot ${shotIndex + 1}/${shots.length} completed successfully`);
      } else {
        console.log(`❌ Shot ${shot.shotNumberInScene || shot.id} failed, adding to retry list. Status: ${shotResult?.status}`);
        failedShots.push(shot);
        results.push(shotResult || { shotId: `shot_${shotIndex}`, status: 'processing failed' });
      }
    } catch (error) {
      console.error(`Error processing shot ${shot.shotNumberInScene || shot.id}:`, error);
      failedShots.push(shot);
      results.push({ shotId: `shot_${shotIndex}`, status: `error: ${error instanceof Error ? error.message : 'Unknown error'}` });
    }

    // Streamlined rate limiting - balanced for speed and reliability
    if (shotIndex < shots.length - 1) {
      const delayTime = 3000; // Reduced to 3 seconds for faster generation
      console.log(`Waiting ${delayTime/1000} seconds before next shot...`);
      await new Promise(resolve => setTimeout(resolve, delayTime));
    }
  }

  // Single streamlined retry pass for failed shots
  if (failedShots.length > 0) {
    console.log(`🔄 Retry pass: Attempting to generate ${failedShots.length} failed images...`);
    
    for (let i = 0; i < failedShots.length; i++) {
      const shot = failedShots[i];
      console.log(`Retry - Processing shot ${shot.shotNumberInScene || shot.id}`);
      
      try {
        // Short delay between retries for efficiency
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        const retryResult = await processShot(shot, shots.findIndex(s => s.id === shot.id));
        
        if (retryResult && retryResult.status.includes('stored in database')) {
          if ('frame' in retryResult && retryResult.frame) {
            frames.push(retryResult.frame);
          }
          console.log(`✅ Retry successful for shot ${shot.shotNumberInScene || shot.id}`);
        } else {
          console.log(`❌ Retry failed for shot ${shot.shotNumberInScene || shot.id}: ${retryResult?.status}`);
        }
      } catch (error) {
        console.error(`Retry error for shot ${shot.shotNumberInScene || shot.id}:`, error);
      }
    }
  }

  console.log(`Completed processing: generated ${frames.length} out of ${shots.length} shots`);
  
  return { results, frames };
}

/**
 * Get storyboard image path
 */
export function getStoryboardImagePath(filename: string): string {
  return path.join(IMAGE_OUTPUT_DIR, filename);
}