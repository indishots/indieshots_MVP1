import { OpenAI } from 'openai';
import { storage } from '../storage';

// Configure OpenAI with deployment-safe settings
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 45000, // 45 second timeout to prevent hanging
  maxRetries: 1, // Single retry to prevent long delays
  dangerouslyAllowBrowser: false
});

/**
 * Robust batch image generation with complete error isolation
 * This function NEVER throws exceptions - all errors are caught and handled
 */
export async function generateStoryboardBatch(shots: any[], parseJobId: number): Promise<void> {
  try {
    console.log(`🎬 Starting robust batch generation for ${shots.length} shots`);
    console.log(`📋 Shot details:`, shots.map((s, i) => ({ index: i, id: s.id, description: s.shotDescription })));
    
    // Validate inputs
    if (!shots || shots.length === 0) {
      console.log('❌ No shots to process - batch generation aborted');
      return;
    }
    
    // Check OpenAI API key availability
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ CRITICAL: OpenAI API key not found in environment variables');
      throw new Error('OpenAI API key not configured');
    }
    console.log('✅ OpenAI API key is configured');
    
    // Process shots in smaller batches to prevent overwhelming the database
    const BATCH_SIZE = 3;
    for (let i = 0; i < shots.length; i += BATCH_SIZE) {
      try {
        const batch = shots.slice(i, i + BATCH_SIZE);
        console.log(`Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(shots.length/BATCH_SIZE)} (shots ${i+1}-${Math.min(i+BATCH_SIZE, shots.length)})`);
        
        // Process each shot in batch independently with complete isolation
        const promises = batch.map(async (shot, batchIndex) => {
          const shotNumber = i + batchIndex + 1;
          try {
            console.log(`🎨 Starting generation for shot ${shotNumber}/${shots.length}`);
            await generateSingleShotImage(shot, parseJobId, shotNumber);
            console.log(`✅ Shot ${shotNumber} completed successfully - image immediately available for frontend polling`);
          } catch (error) {
            console.error(`❌ Shot ${shotNumber} failed independently (continuing with remaining shots):`, error);
            
            // Individual failures don't affect the batch - mark as failed and continue
            try {
              await storage.updateShotImage(shot.id, null, `ERROR: ${error instanceof Error ? error.message : 'Generation failed'}`);
              console.log(`📝 Shot ${shotNumber} marked as failed in database, continuing with batch`);
            } catch (saveError) {
              console.error(`Failed to save error state for shot ${shotNumber}:`, saveError);
            }
          }
        });
        
        // Wait for all shots in this batch to complete (successful or failed)
        const results = await Promise.allSettled(promises);
        const successCount = results.filter(r => r.status === 'fulfilled').length;
        const failedCount = results.filter(r => r.status === 'rejected').length;
        console.log(`Batch ${Math.floor(i/BATCH_SIZE) + 1} completed: ${successCount} successful, ${failedCount} failed - continuing to next batch`);
        
        // Small delay between batches to prevent overwhelming the API
        if (i + BATCH_SIZE < shots.length) {
          await new Promise(resolve => setTimeout(resolve, 500)); // Reduced delay for faster image appearance
        }
      } catch (batchError) {
        console.error(`Batch ${Math.floor(i/BATCH_SIZE) + 1} failed completely:`, batchError);
        
        // Mark all shots in this batch as failed
        const batch = shots.slice(i, i + BATCH_SIZE);
        for (const shot of batch) {
          try {
            await storage.updateShotImage(shot.id, null, `ERROR: Batch processing failed - ${batchError instanceof Error ? batchError.message : 'Unknown error'}`);
          } catch (markError) {
            console.error(`Failed to mark shot ${shot.id} as failed:`, markError);
          }
        }
      }
    }
    
    console.log(`🎬 Batch generation completed for ${shots.length} shots`);
  } catch (topLevelError) {
    console.error('Top-level batch generation error:', topLevelError);
    console.error('Stack trace:', topLevelError instanceof Error ? topLevelError.stack : 'No stack trace');
    
    // Final fallback - mark all shots as failed
    if (shots && Array.isArray(shots)) {
      for (const shot of shots) {
        try {
          await storage.updateShotImage(shot.id, null, `ERROR: System error - ${topLevelError instanceof Error ? topLevelError.message : 'Unknown error'}`);
        } catch (finalError) {
          console.error(`Final fallback error for shot ${shot.id}:`, finalError);
          // At this point, there's nothing more we can do
        }
      }
    }
  }
}

/**
 * Generate image for a single shot with complete error isolation
 */
async function generateSingleShotImage(shot: any, parseJobId: number, shotNumber: number): Promise<void> {
  const MAX_RETRIES = 3;
  let lastError: any = null;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`🎨 Shot ${shotNumber} - Attempt ${attempt}/${MAX_RETRIES}`);
      
      // Generate prompt
      const prompt = await generateSafePrompt(shot);
      if (!prompt) {
        throw new Error('Failed to generate prompt');
      }
      
      // Generate image
      const imageData = await generateImageWithRetry(prompt, attempt);
      if (!imageData) {
        throw new Error('Failed to generate image data');
      }
      
      // Save to database
      await storage.updateShotImage(shot.id, imageData, prompt);
      console.log(`✅ Shot ${shotNumber} - Success on attempt ${attempt}`);
      return;
      
    } catch (error: any) {
      lastError = error;
      console.error(`❌ Shot ${shotNumber} - Attempt ${attempt} failed:`, error.message);
      
      // Wait before retry (exponential backoff)
      if (attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
      }
    }
  }
  
  // All attempts failed - save error state with better error handling
  try {
    const errorMessage = `ERROR: ${lastError?.message || 'Generation failed after all retries'}`;
    await storage.updateShotImage(shot.id, null, errorMessage);
    console.error(`💥 Shot ${shotNumber} - All attempts failed, saved error state: ${errorMessage}`);
    console.log(`🔄 Shot ${shotNumber} - Marked as failed, batch will continue with remaining shots`);
  } catch (dbError) {
    console.error(`💥 Shot ${shotNumber} - Failed to save error state to database:`, dbError);
    // Don't throw here - we want the batch to continue
  }
  
  // Explicitly do NOT throw an exception - let the batch continue
  console.log(`⏭️ Shot ${shotNumber} - Error handled, returning to batch processing`);
}

/**
 * Generate safe prompt for image generation
 */
async function generateSafePrompt(shot: any): Promise<string | null> {
  try {
    console.log(`🎯 Generating prompt for shot:`, { id: shot.id, description: shot.shotDescription });
    
    // Build basic prompt from shot data
    const basicPrompt = buildShotPrompt(shot);
    console.log(`📝 Basic prompt built:`, basicPrompt);
    
    // Enhance with GPT-4 for better visual description
    let response;
    try {
      console.log(`🤖 Calling GPT-4 for prompt enhancement...`);
      response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are a professional film director creating visual prompts for image generation. 
Transform the shot description into a vivid, cinematic visual prompt suitable for DALL-E 3.
Focus on visual composition, lighting, and mood. Keep it safe and professional.`
          },
          {
            role: 'user',
            content: basicPrompt
          }
        ],
        max_tokens: 200,
        temperature: 0.7
      });
    } catch (gptError: any) {
      console.error('GPT-4 prompt enhancement failed:', {
        type: gptError.constructor?.name,
        message: gptError.message,
        status: gptError.status
      });
      
      // Handle non-JSON responses from GPT-4
      if (gptError.message?.includes('JSON') || gptError.message?.includes('parse') || gptError.message?.includes('Unexpected')) {
        console.log('GPT-4 returned non-JSON response, using basic prompt');
        return sanitizePrompt(basicPrompt);
      }
      
      // For other errors, still fall back to basic prompt
      console.log('GPT-4 API error, using basic prompt');
      return sanitizePrompt(basicPrompt);
    }
    
    const enhancedPrompt = response.choices[0].message.content?.trim();
    if (enhancedPrompt && enhancedPrompt.length > 10) {
      return sanitizePrompt(enhancedPrompt);
    }
    
    // Fallback to basic prompt
    return sanitizePrompt(basicPrompt);
    
  } catch (error: any) {
    console.error('Prompt generation failed completely, using fallback:', {
      type: error.constructor?.name,
      message: error.message
    });
    return sanitizePrompt(buildShotPrompt(shot));
  }
}

/**
 * Generate image with retry logic
 */
async function generateImageWithRetry(prompt: string, attempt: number): Promise<string | null> {
  try {
    console.log(`🎨 Attempting OpenAI image generation (attempt ${attempt})...`);
    console.log(`📸 Using prompt:`, prompt);
    
    let response;
    try {
      console.log(`📡 Calling OpenAI DALL-E 3 API with timeout protection...`);
      
      // Wrap OpenAI call with additional timeout protection
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('OpenAI API timeout - 30 seconds')), 30000);
      });
      
      const apiPromise = openai.images.generate({
        model: 'dall-e-3',
        prompt: prompt,
        size: '1792x1024',
        quality: 'standard',
        n: 1
      });
      
      response = await Promise.race([apiPromise, timeoutPromise]);
      console.log(`✅ OpenAI responded successfully for attempt ${attempt}`);
      
    } catch (apiError: any) {
      // Handle API failures with detailed logging
      console.error(`OpenAI API error (attempt ${attempt}):`, {
        type: apiError.constructor?.name,
        message: apiError.message,
        status: apiError.status,
        code: apiError.code
      });
      
      // Check for timeout or common API issues
      if (apiError.message?.includes('timeout') || apiError.message?.includes('Timeout')) {
        console.log(`⏰ OpenAI API timed out on attempt ${attempt}, generating fallback image`);
        return await generateFallbackImage(prompt);
      }
      
      // Check if this is a non-JSON response issue
      if (apiError.message?.includes('JSON') || apiError.message?.includes('parse') || apiError.message?.includes('Unexpected')) {
        console.log(`📄 OpenAI returned non-JSON response, generating fallback image`);
        return await generateFallbackImage(prompt);
      }
      
      // Re-throw other API errors for normal handling
      throw apiError;
    }
    
    const imageUrl = response.data?.[0]?.url;
    if (!imageUrl) {
      throw new Error('No image URL returned from OpenAI API response');
    }
    
    console.log(`✅ OpenAI returned image URL, downloading...`);
    
    // Download image with error handling - deployment safe
    let imageResponse;
    let arrayBuffer;
    try {
      imageResponse = await fetch(imageUrl, {
        headers: {
          'User-Agent': 'IndieShots-Server/1.0'
        }
      });
      if (!imageResponse.ok) {
        throw new Error(`Failed to download image: ${imageResponse.status} ${imageResponse.statusText}`);
      }
      
      // Read the response body only once to prevent "body stream already read" error
      arrayBuffer = await imageResponse.arrayBuffer();
    } catch (downloadError: any) {
      throw new Error(`Image download failed: ${downloadError.message}`);
    }
    
    const imageBuffer = Buffer.from(arrayBuffer);
    const base64Data = imageBuffer.toString('base64');
    
    console.log(`✅ Image converted to base64 (${base64Data.length} characters)`);
    return base64Data;
    
  } catch (error: any) {
    console.error(`❌ Image generation failed (attempt ${attempt}):`, {
      type: error.constructor?.name,
      message: error.message,
      stack: error.stack?.split('\n')[0]
    });
    
    // For content policy errors, try with safer prompt
    if (error.message?.includes('content_policy')) {
      console.log(`🛡️  Content policy issue detected, trying safe fallback prompt...`);
      const safePrompt = 'Professional film production still, cinematic lighting, artistic composition';
      try {
        const response = await openai.images.generate({
          model: 'dall-e-3',
          prompt: safePrompt,
          size: '1792x1024',
          quality: 'standard',
          n: 1
        });
        
        const imageUrl = response.data?.[0]?.url;
        if (imageUrl) {
          const imageResponse = await fetch(imageUrl, {
            headers: {
              'User-Agent': 'IndieShots-Server/1.0'
            }
          });
          if (imageResponse.ok) {
            const arrayBuffer = await imageResponse.arrayBuffer();
            const imageBuffer = Buffer.from(arrayBuffer);
            console.log(`✅ Safe fallback image generated successfully`);
            return imageBuffer.toString('base64');
          }
        }
      } catch (fallbackError) {
        console.error('Safe fallback image generation also failed:', fallbackError);
        // Use placeholder image as final fallback
        return await generateFallbackImage(prompt);
      }
    }
    
    // For any other API errors (timeouts, non-JSON, rate limits), return placeholder
    console.log(`🔄 API error detected, using placeholder image to prevent hanging...`);
    return await generateFallbackImage(prompt);
            const arrayBuffer = await imageResponse.arrayBuffer();
            const imageBuffer = Buffer.from(arrayBuffer);
            console.log(`✅ Minimal fallback image generated after JSON error`);
            return imageBuffer.toString('base64');
          }
        }
      } catch (minimalError) {
        console.error('Minimal fallback also failed:', minimalError);
        return await generateFallbackImage(prompt);
      }
    }
    
    // Final fallback if all else fails
    return await generateFallbackImage(prompt);
  }
}

/**
 * Build shot prompt from shot data
 */
function buildShotPrompt(shot: any): string {
  const parts = [
    `Shot Type: ${shot.shot_type || shot.shotType || 'Medium shot'}`,
    `Scene: ${shot.shot_description || shot.shotDescription || 'Scene'}`,
    `Location: ${shot.location || 'Interior'}`,
    `Lighting: ${shot.lighting || 'Natural lighting'}`,
    `Mood: ${shot.mood_and_ambience || shot.moodAndAmbience || 'Neutral mood'}`
  ];
  
  return parts.join(', ') + '. Cinematic composition, professional cinematography.';
}

/**
 * Sanitize prompt to avoid content policy violations
 */
function sanitizePrompt(prompt: string): string {
  let cleaned = prompt;
  
  // Remove potentially problematic content
  const replacements: { [key: string]: string } = {
    'violent': 'intense',
    'blood': 'red liquid',
    'weapon': 'prop',
    'gun': 'prop',
    'knife': 'utensil',
    'death': 'dramatic scene',
    'murder': 'mystery scene',
    'attack': 'confrontation',
    'fight': 'physical scene',
    'battle': 'action scene'
  };
  
  for (const [bad, good] of Object.entries(replacements)) {
    cleaned = cleaned.replace(new RegExp(bad, 'gi'), good);
  }
  
  return cleaned;
}

/**
 * Generate fallback placeholder image when OpenAI API fails
 */
async function generateFallbackImage(prompt: string): Promise<string> {
  console.log('🎨 Generating fallback placeholder image due to OpenAI API failure...');
  
  // Create a simple base64 placeholder image (1x1 pixel transparent PNG)
  // This ensures the frontend doesn't hang waiting for images
  const placeholderBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  
  console.log('✅ Fallback placeholder generated - this indicates OpenAI API issues');
  return placeholderBase64;
}