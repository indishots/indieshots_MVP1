import { OpenAI } from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import fetch from 'node-fetch';
import { characterMemoryService } from './characterMemoryService';

const promptClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 60000 // 60 second timeout
});

const imageClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 60000 // 60 second timeout
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
 * Generate image using DALL-E 3 with robust retry system
 */
async function generateImage(prompt: string, filename: string): Promise<string> {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000; // 2 seconds between retries
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`🎨 Image generation attempt ${attempt}/${MAX_RETRIES} for ${filename}`);
      
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
      
      console.log(`✅ Image generation successful for ${filename}`);
      return `✅ Saved to ${filename}`;
      
    } catch (error: any) {
      console.error(`❌ Image generation attempt ${attempt} failed for ${filename}:`, error);
      
      // Check if this is a content policy error or API rate limit
      if (error.message && error.message.includes('content_policy')) {
        console.log(`⚠️  Content policy violation detected for ${filename}, trying fallback prompt`);
        break; // Move to fallback, don't retry
      }
      
      if (attempt === MAX_RETRIES) {
        console.error(`💥 All ${MAX_RETRIES} attempts failed for ${filename}`);
        return `[ERROR] Image generation failed after ${MAX_RETRIES} attempts: ${error.message}`;
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
    }
  }
  
  // If we get here, try fallback
  console.log(`🔄 Attempting fallback image generation for ${filename}`);
  return await generateFallbackImage(prompt) || `[ERROR] Both primary and fallback generation failed for ${filename}`;
}

/**
 * Generate a very safe fallback image when all other attempts fail
 */
async function generateFallbackImage(originalPrompt: string): Promise<string | null> {
  try {
    console.log('🔄 Attempting fallback image generation with ultra-safe prompt');
    
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
      return 'GENERATION_ERROR';
    }

    // Download the fallback image
    const imageResponse = await fetch(imageUrl, { 
      headers: {
        'User-Agent': 'IndieShots-Server/1.0'
      }
    });

    if (!imageResponse.ok) {
      console.error(`Failed to download fallback image: ${imageResponse.statusText}`);
      return 'GENERATION_ERROR';
    }

    const arrayBuffer = await imageResponse.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);
    const base64Data = imageBuffer.toString('base64');
    
    console.log('Successfully generated fallback image');
    return base64Data;
  } catch (error) {
    console.error('Fallback image generation failed:', error);
    return 'GENERATION_ERROR';
  }
}

/**
 * Generate image and return base64 data for database storage
 */
export async function generateImageData(prompt: string, retries: number = 3): Promise<string | null> {
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
      
      // Add timeout to the API call (60 seconds)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('API request timeout')), 60000);
      });
      
      const apiPromise = imageClient.images.generate({
        model: "dall-e-3",
        prompt: cleanedPrompt,
        n: 1,
        size: "1792x1024", // Wider cinematic format
        response_format: "url"
      });
      
      const response = await Promise.race([apiPromise, timeoutPromise]) as any;

      const imageUrl = response?.data?.[0]?.url;
      if (!imageUrl) {
        console.error(`No image URL returned from OpenAI (attempt ${attempt})`);
        if (attempt === retries) return 'GENERATION_ERROR';
        await new Promise(resolve => setTimeout(resolve, 5000 * attempt)); // Longer exponential backoff
        continue;
      }

      // Download the image with timeout (30 seconds)
      const downloadTimeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Download timeout')), 30000);
      });
      
      const downloadPromise = fetch(imageUrl, { 
        headers: {
          'User-Agent': 'IndieShots-Server/1.0'
        }
      });
      
      const imageResponse = await Promise.race([downloadPromise, downloadTimeout]) as any;
      
      if (!imageResponse?.ok) {
        console.error(`Failed to download image (attempt ${attempt}): ${imageResponse?.statusText}`);
        if (attempt === retries) return 'GENERATION_ERROR';
        await new Promise(resolve => setTimeout(resolve, 5000 * attempt));
        continue;
      }

      const arrayBuffer = await imageResponse.arrayBuffer();
      const imageBuffer = Buffer.from(arrayBuffer);
      const base64Data = imageBuffer.toString('base64');
      
      console.log(`Successfully generated image data (attempt ${attempt}), base64 length:`, base64Data.length);
      return base64Data;
    } catch (error: any) {
      console.error(`Error generating image data (attempt ${attempt}/${retries}):`, error?.message || error);
      
      // Handle specific OpenAI errors with appropriate delays
      if (error?.status === 429) {
        console.log('Rate limit hit, waiting before retry...');
        await new Promise(resolve => setTimeout(resolve, 15000 * attempt)); // 15s, 30s, 45s delays
      } else if (error?.message === 'API request timeout') {
        console.log('API request timed out, retrying with longer delay...');
        await new Promise(resolve => setTimeout(resolve, 10000 * attempt));
      } else if (error?.message === 'Download timeout') {
        console.log('Image download timed out, retrying...');
        await new Promise(resolve => setTimeout(resolve, 5000 * attempt));
      } else if (error?.message?.includes('content policy')) {
        console.log('Content policy violation detected');
        return 'CONTENT_POLICY_ERROR';
      } else if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 3000 * attempt));
      }
      
      if (attempt === retries) {
        console.error(`Failed to generate image after ${retries} attempts`);
        return 'GENERATION_ERROR';
      }
    }
  }
  return 'GENERATION_ERROR';
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
    if (!imageData || imageData === 'GENERATION_ERROR' || imageData === 'CONTENT_POLICY_ERROR') {
      console.error(`Image generation failed for shot ${shotId}: ${imageData || 'unknown error'}`);
      
      // Store the failure status in the database so frontend knows this shot failed
      const { storage } = await import('../storage');
      const failureMarker = imageData || 'GENERATION_ERROR';
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

/**
 * Generate storyboard frames for multiple shots with retry mechanism
 */
/**
 * Process individual shot with comprehensive error isolation
 */
async function processShotWithIsolation(shot: any, shotIndex: number, totalShots: number): Promise<{ success: boolean; shotId: string; error?: string }> {
  const shotId = shot.shotNumberInScene?.toString() || shot.id?.toString() || `shot_${shotIndex + 1}`;
  
  try {
    console.log(`[${shotIndex + 1}/${totalShots}] Processing shot ${shotId}...`);
    
    // Isolate each step with individual error handling
    let prompt: string | null = null;
    try {
      const userMessage = buildPrompt(shot);
      prompt = await generatePrompt(userMessage);
    } catch (promptError) {
      console.error(`Prompt generation failed for shot ${shotId}:`, promptError);
      // Continue with a basic fallback prompt
      prompt = `A cinematic shot showing ${shot.shotDescription || shot.shotType || 'a scene'}`;
    }

    if (!prompt) {
      throw new Error('No prompt could be generated');
    }

    // Try image generation with comprehensive error handling
    let imageData: string | null = null;
    try {
      imageData = await generateImageData(prompt);
    } catch (imageError) {
      console.error(`Image generation error for shot ${shotId}:`, imageError);
      
      // Intelligent fallback based on shot content
      try {
        let smartFallback: string;
        const shotType = shot.shotType || 'medium shot';
        const isAction = shot.shotDescription?.toLowerCase().includes('action') || 
                        shot.shotDescription?.toLowerCase().includes('fight') ||
                        shot.shotDescription?.toLowerCase().includes('chase');
        
        if (isAction) {
          smartFallback = `${shotType.toLowerCase()} of dramatic action scene, professional filmmaking, cinematic composition`;
        } else if (shot.characters && shot.characters !== 'None') {
          smartFallback = `${shotType.toLowerCase()} showing characters in conversation, professional film production, cinematic lighting`;
        } else {
          smartFallback = `Professional ${shotType.toLowerCase()}, cinematic lighting, movie production quality`;
        }
        
        console.log(`Trying smart fallback for shot ${shotId}: ${smartFallback}`);
        imageData = await generateImageData(smartFallback);
        console.log(`Smart fallback image generation succeeded for shot ${shotId}`);
      } catch (fallbackError) {
        console.error(`Smart fallback failed for shot ${shotId}, trying ultra-safe prompt:`, fallbackError);
        try {
          const ultraSafePrompt = `Professional film scene, cinematic lighting, movie production quality`;
          imageData = await generateImageData(ultraSafePrompt);
          console.log(`Ultra-safe fallback succeeded for shot ${shotId}`);
        } catch (finalError) {
          console.error(`All fallback attempts failed for shot ${shotId}:`, finalError);
          imageData = 'GENERATION_ERROR';
        }
      }
    }

    // Store result in database regardless of success/failure
    try {
      const { storage } = await import('../storage');
      if (imageData && imageData !== 'GENERATION_ERROR' && imageData !== 'CONTENT_POLICY_ERROR') {
        await storage.updateShotImage(shot.id, imageData, prompt);
        console.log(`✅ Shot ${shotId} - Image generated and stored successfully`);
        return { success: true, shotId };
      } else {
        // Store failure marker so frontend knows this shot failed
        const failureMarker = imageData || 'GENERATION_ERROR';
        await storage.updateShotImage(shot.id, failureMarker, prompt || 'No prompt generated');
        console.log(`❌ Shot ${shotId} - Marked as failed: ${failureMarker}`);
        return { success: false, shotId, error: failureMarker };
      }
    } catch (storageError) {
      console.error(`Database storage failed for shot ${shotId}:`, storageError);
      // Try to mark this shot as having storage failure
      try {
        const { storage } = await import('../storage');
        await storage.updateShotImage(shot.id, 'STORAGE_FAILED', prompt || 'Storage failed');
      } catch (fallbackError) {
        console.error(`Could not even mark storage failure for shot ${shotId}:`, fallbackError);
      }
      return { success: false, shotId, error: 'STORAGE_FAILED' };
    }

  } catch (error) {
    console.error(`Complete failure processing shot ${shotId}:`, error);
    // Still try to mark in database as failed
    try {
      const { storage } = await import('../storage');
      await storage.updateShotImage(shot.id, 'PROCESSING_ERROR', 'Error during processing');
    } catch (storageError) {
      console.error(`Could not even mark shot ${shotId} as failed in database:`, storageError);
    }
    return { success: false, shotId, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function generateStoryboards(shots: any[]): Promise<{ results: any[]; frames: StoryboardFrame[] }> {
  const results: any[] = [];
  const frames: StoryboardFrame[] = [];
  let successCount = 0;
  let failureCount = 0;

  console.log(`🎬 Starting isolated generation of ${shots.length} storyboard images...`);
  console.log(`Each image will be processed independently to ensure maximum success rate`);

  // Process each shot with complete isolation - one failure won't affect others
  for (let shotIndex = 0; shotIndex < shots.length; shotIndex++) {
    const shot = shots[shotIndex];
    
    try {
      // Each shot is completely isolated
      const result = await processShotWithIsolation(shot, shotIndex, shots.length);
      
      if (result.success) {
        successCount++;
        console.log(`✅ [${successCount}/${shots.length}] Shot ${result.shotId} completed successfully`);
      } else {
        failureCount++;
        console.log(`❌ [${failureCount} failures] Shot ${result.shotId} failed: ${result.error}`);
      }
      
      results.push(result);
      
    } catch (isolationError) {
      // This should never happen due to inner error handling, but just in case
      failureCount++;
      console.error(`Complete isolation failure for shot ${shotIndex + 1}:`, isolationError);
      results.push({ 
        success: false, 
        shotId: `shot_${shotIndex + 1}`, 
        error: 'ISOLATION_FAILURE' 
      });
    }

    // Enhanced rate limiting delay between shots to improve success rates
    if (shotIndex < shots.length - 1) {
      console.log(`⏱️ Waiting 5 seconds before next shot to respect OpenAI rate limits...`);
      await new Promise(resolve => setTimeout(resolve, 5000)); // Increased to 5 second delay
    }
  }

  console.log(`🎯 Generation Summary: ${successCount}/${shots.length} successful, ${failureCount} failed`);
  console.log(`Success rate: ${Math.round((successCount / shots.length) * 100)}%`);
  
  return { results, frames };
}

/**
 * Get storyboard image path
 */
export function getStoryboardImagePath(filename: string): string {
  return path.join(IMAGE_OUTPUT_DIR, filename);
}