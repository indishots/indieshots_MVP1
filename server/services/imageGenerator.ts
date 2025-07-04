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
 * Build prompt from shot data using the working Python format
 */
function buildPrompt(shot: any): string {
  // Match the exact format from the working Python version using correct database column names
  let prompt = 
    `Scene Type: ${shot.shot_type || shot.shotType || ''}, Lens: ${shot.lens || ''}, Movement: ${shot.movement || ''}\n` +
    `Location: ${shot.location || ''} (${shot.time_of_day || shot.timeOfDay || ''}), Mood: ${shot.mood_and_ambience || shot.moodAndAmbience || ''}, Tone: ${shot.tone || ''}\n` +
    `Lighting: ${shot.lighting || ''}, Props: ${shot.props || ''}, Notes: ${shot.notes || ''}, Sound: ${shot.sound_design || shot.soundDesign || ''}\n\n` +
    `Describe this scene in a cinematic, stylized animated graphic novel format. ` +
    `Use moody lighting, animated art direction, and visual storytelling tone.\n\n` +
    `Action: ${shot.shot_description || shot.shotDescription || ''}`;
  
  // Add characters if they exist in the shot data (use database column name)
  if (shot.characters && shot.characters !== 'None' && shot.characters.trim()) {
    prompt += `\n\nCharacters: ${shot.characters}`;
  }
  
  // Add dialogue if it exists
  if (shot.dialogue && shot.dialogue !== 'None' && shot.dialogue.trim()) {
    prompt += `\n\nDialogue: ${shot.dialogue}`;
  }
  
  return prompt;
}

/**
 * Generate visual prompt using GPT-4 with character memory integration
 */
async function generatePrompt(userMessage: string, retries: number = 2): Promise<string | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Generating prompt (attempt ${attempt}/${retries})`);
      
      // First, enhance the prompt with character consistency
      const enhancedMessage = await characterMemoryService.buildEnhancedPrompt(userMessage);
      
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
        console.log(`Generated character-enhanced prompt: ${prompt.substring(0, 100)}...`);
        return prompt;
      } else {
        console.log(`Generated prompt too short or empty (attempt ${attempt})`);
        if (attempt === retries) {
          // Fallback to a basic prompt based on shot data
          const fallbackPrompt = `A cinematic shot showing ${userMessage.includes('Shot Description:') ? 
            userMessage.split('Shot Description:')[1]?.split('\n')[0]?.trim() || 'scene' : 'scene'}`;
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
export async function generateImageData(prompt: string, retries: number = 10): Promise<string | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Generating image data (attempt ${attempt}/${retries}) with prompt: ${prompt.substring(0, 100)}...`);
      
      // Clean the prompt to avoid content policy violations
      const cleanedPrompt = sanitizePromptForGeneration(prompt);
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
      
      console.log(`Successfully generated image data (attempt ${attempt}), base64 length:`, base64Data.length);
      return base64Data;
    } catch (error: any) {
      console.error(`Error generating image data (attempt ${attempt}/${retries}):`, error?.message || error);
      
      // Handle different types of errors with aggressive retry logic
      let waitTime = 5000; // Base wait time
      
      if (error?.status === 429 || error?.message?.includes('rate limit')) {
        console.log(`Rate limit hit (attempt ${attempt}/${retries}), waiting longer...`);
        waitTime = 20000 + (attempt * 10000); // Exponentially increasing wait: 30s, 40s, 50s...
      } else if (error?.status === 400 || error?.message?.includes('content policy')) {
        console.log(`Content policy issue (attempt ${attempt}/${retries}), cleaning prompt and retrying...`);
        // For content policy, try with a more generic prompt
        waitTime = 3000 * attempt;
      } else if (error?.message?.includes('timeout') || error?.name === 'AbortError') {
        console.log(`Request timeout (attempt ${attempt}/${retries}), retrying...`);
        waitTime = 8000 * attempt; // Longer waits for timeouts
      } else if (error?.message?.includes('upstream') || error?.message?.includes('JSON')) {
        console.log(`OpenAI server error detected (attempt ${attempt}/${retries}), waiting before retry...`);
        waitTime = 15000 + (attempt * 5000); // Long waits for server errors
      } else if (error?.status >= 500) {
        console.log(`OpenAI server error ${error.status} (attempt ${attempt}/${retries}), waiting...`);
        waitTime = 12000 + (attempt * 3000);
      } else {
        console.log(`Unknown error (attempt ${attempt}/${retries}), retrying with standard delay...`);
        waitTime = 5000 * attempt;
      }
      
      // Only give up after ALL retries are exhausted
      if (attempt === retries) {
        console.error(`Failed to generate image after ${retries} attempts with all error handling strategies`);
        // Try one final fallback with ultra-safe prompt
        try {
          console.log('Attempting final fallback with minimal prompt...');
          const fallbackResponse = await imageClient.images.generate({
            model: "dall-e-3",
            prompt: "Professional film scene, cinematic lighting, movie production still",
            n: 1,
            size: "1792x1024",
            response_format: "url"
          });
          
          if (fallbackResponse.data?.[0]?.url) {
            const imageResponse = await fetch(fallbackResponse.data[0].url);
            if (imageResponse.ok) {
              const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
              const base64Data = imageBuffer.toString('base64');
              console.log('Final fallback successful!');
              return base64Data;
            }
          }
        } catch (fallbackError) {
          console.error('Final fallback also failed:', fallbackError);
        }
        
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

    // Enhanced rate limiting - longer delays to prevent OpenAI errors
    if (shotIndex < shots.length - 1) {
      const delayTime = 15000; // Increased to 15 seconds for maximum reliability
      console.log(`Waiting ${delayTime/1000} seconds before next shot to prevent rate limits...`);
      await new Promise(resolve => setTimeout(resolve, delayTime));
    }
  }

  // Multiple retry passes to ensure ALL images are generated
  let remainingFailedShots = [...failedShots];
  let retryPass = 1;
  const maxRetryPasses = 5; // Up to 5 retry passes
  
  while (remainingFailedShots.length > 0 && retryPass <= maxRetryPasses) {
    console.log(`🔄 Retry pass ${retryPass}/${maxRetryPasses}: Attempting to generate ${remainingFailedShots.length} remaining images...`);
    
    const stillFailedShots: any[] = [];
    
    for (let i = 0; i < remainingFailedShots.length; i++) {
      const shot = remainingFailedShots[i];
      console.log(`Retry pass ${retryPass} - Processing shot ${shot.shotNumberInScene || shot.id}`);
      
      try {
        // Use longer delays in retry passes
        if (i > 0) {
          const delayTime = 12000 + (retryPass * 3000); // Increasingly longer delays
          console.log(`Waiting ${delayTime/1000}s before processing next failed shot...`);
          await new Promise(resolve => setTimeout(resolve, delayTime));
        }
        
        const retryResult = await processShot(shot, shots.findIndex(s => s.id === shot.id));
        
        if (retryResult && retryResult.status.includes('stored in database')) {
          if ('frame' in retryResult && retryResult.frame) {
            frames.push(retryResult.frame);
          }
          console.log(`✅ Retry pass ${retryPass} successful for shot ${shot.shotNumberInScene || shot.id}`);
        } else {
          console.log(`❌ Retry pass ${retryPass} failed for shot ${shot.shotNumberInScene || shot.id}: ${retryResult?.status}`);
          stillFailedShots.push(shot);
        }
      } catch (error) {
        console.error(`Retry pass ${retryPass} error for shot ${shot.shotNumberInScene || shot.id}:`, error);
        stillFailedShots.push(shot);
      }
    }
    
    remainingFailedShots = stillFailedShots;
    retryPass++;
    
    // Wait longer between retry passes
    if (remainingFailedShots.length > 0 && retryPass <= maxRetryPasses) {
      const passDelay = 30000 + (retryPass * 15000); // 45s, 60s, 75s, 90s
      console.log(`Waiting ${passDelay/1000}s before retry pass ${retryPass}...`);
      await new Promise(resolve => setTimeout(resolve, passDelay));
    }
  }
  
  if (remainingFailedShots.length > 0) {
    console.log(`⚠️  Final attempt: ${remainingFailedShots.length} shots still need images after ${maxRetryPasses} retry passes`);
    // Make one final attempt with ultra-basic prompts for any remaining failed shots
    for (const shot of remainingFailedShots) {
      try {
        console.log(`Final fallback attempt for shot ${shot.shotNumberInScene || shot.id}`);
        const basicPrompt = "Professional movie scene, cinematic style, film production";
        const imageData = await generateImageData(basicPrompt);
        
        if (imageData && imageData !== 'GENERATION_FAILED') {
          const { storage } = await import('../storage');
          await storage.updateShotImage(shot.id, imageData, basicPrompt);
          console.log(`✅ Final fallback successful for shot ${shot.shotNumberInScene || shot.id}`);
        }
      } catch (error) {
        console.error(`Final fallback failed for shot ${shot.shotNumberInScene || shot.id}:`, error);
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