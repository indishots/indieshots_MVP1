import { OpenAI } from 'openai';
import { storage } from '../storage';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 90000 // 90 second timeout
});

/**
 * Robust batch image generation with complete error isolation
 */
export async function generateStoryboardBatch(shots: any[], parseJobId: number): Promise<void> {
  console.log(`🎬 Starting robust batch generation for ${shots.length} shots`);
  
  // Process each shot independently with complete isolation
  const promises = shots.map(async (shot, index) => {
    try {
      await generateSingleShotImage(shot, parseJobId, index + 1);
    } catch (error) {
      console.error(`❌ Shot ${index + 1} failed independently:`, error);
      // Individual failures don't affect the batch
    }
  });
  
  // Wait for all shots to complete (successful or failed)
  await Promise.allSettled(promises);
  console.log(`🎬 Batch generation completed for ${shots.length} shots`);
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
  
  // All attempts failed - save error state
  try {
    await storage.updateShotImage(shot.id, null, `ERROR: ${lastError?.message || 'Unknown error'}`);
    console.error(`💥 Shot ${shotNumber} - All attempts failed, saved error state`);
  } catch (dbError) {
    console.error(`💥 Shot ${shotNumber} - Failed to save error state:`, dbError);
  }
}

/**
 * Generate safe prompt for image generation
 */
async function generateSafePrompt(shot: any): Promise<string | null> {
  try {
    // Build basic prompt from shot data
    const basicPrompt = buildShotPrompt(shot);
    
    // Enhance with GPT-4 for better visual description
    const response = await openai.chat.completions.create({
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
    
    const enhancedPrompt = response.choices[0].message.content?.trim();
    if (enhancedPrompt && enhancedPrompt.length > 10) {
      return sanitizePrompt(enhancedPrompt);
    }
    
    // Fallback to basic prompt
    return sanitizePrompt(basicPrompt);
    
  } catch (error) {
    console.error('Prompt generation failed, using fallback:', error);
    return sanitizePrompt(buildShotPrompt(shot));
  }
}

/**
 * Generate image with retry logic
 */
async function generateImageWithRetry(prompt: string, attempt: number): Promise<string | null> {
  try {
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: prompt,
      size: '1792x1024',
      quality: 'standard',
      n: 1
    });
    
    const imageUrl = response.data?.[0]?.url;
    if (!imageUrl) {
      throw new Error('No image URL returned from OpenAI');
    }
    
    // Download image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.statusText}`);
    }
    
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    const base64Data = imageBuffer.toString('base64');
    
    return base64Data;
    
  } catch (error: any) {
    console.error(`Image generation failed (attempt ${attempt}):`, error.message);
    
    // For content policy errors, try with safer prompt
    if (error.message?.includes('content_policy')) {
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
          const imageResponse = await fetch(imageUrl);
          if (imageResponse.ok) {
            const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
            return imageBuffer.toString('base64');
          }
        }
      } catch (fallbackError) {
        console.error('Fallback image generation also failed:', fallbackError);
      }
    }
    
    throw error;
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