import { OpenAI } from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import fetch from 'node-fetch';

const promptClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const imageClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `You are a professional film director and AI visual artist. 
Your task is to take each shot from a shot division table and turn it into a vivid, single-sentence prompt for an image generation AI. 
Your prompt should visually describe the entire scene in cinematic terms. Be descriptive and use visual language.`;

const IMAGE_OUTPUT_DIR = path.join(process.cwd(), 'generated_images');

// Ensure output directory exists
if (!fs.existsSync(IMAGE_OUTPUT_DIR)) {
  fs.mkdirSync(IMAGE_OUTPUT_DIR, { recursive: true });
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
 * Build prompt from shot data
 */
function buildPrompt(shot: any): string {
  const parts = [
    `Shot Description: ${shot.shotDescription || ''}`,
    `Shot Type: ${shot.shotType || ''}`,
    `Location: ${shot.location || ''}`,
    `Time of Day: ${shot.timeOfDay || ''}`,
    `Lens: ${shot.lens || ''}`,
    `Camera Movement: ${shot.movement || ''}`,
    `Mood and Ambience: ${shot.moodAndAmbience || ''}`,
    `Lighting: ${shot.lighting || ''}`,
    `Props: ${shot.props || ''}`,
    `Notes: ${shot.notes || ''}`,
    `Colour Temp: ${shot.colourTemp || ''}`,
  ];
  return parts.join('\n');
}

/**
 * Generate visual prompt using GPT-4 with retry mechanism
 */
async function generatePrompt(userMessage: string, retries: number = 2): Promise<string | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Generating prompt (attempt ${attempt}/${retries})`);
      
      const response = await promptClient.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage }
        ],
        max_tokens: 300,
        temperature: 0.7
      });
      
      const prompt = response.choices[0].message.content?.trim();
      if (prompt && prompt.length > 10) {
        console.log(`Generated prompt: ${prompt.substring(0, 100)}...`);
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
      size: '1024x1024',
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
 * Generate image and return base64 data for database storage
 */
export async function generateImageData(prompt: string, retries: number = 3): Promise<string | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Generating image data (attempt ${attempt}/${retries}) with prompt: ${prompt.substring(0, 100)}...`);
      
      const response = await imageClient.images.generate({
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: "1024x1024",
        response_format: "url"
      });

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
      
      // Handle specific OpenAI errors
      if (error?.status === 429) {
        console.log('Rate limit hit, waiting longer before retry...');
        await new Promise(resolve => setTimeout(resolve, 10000 * attempt)); // Longer wait for rate limits
      } else if (error?.name === 'AbortError') {
        console.log('Request timed out, retrying...');
        await new Promise(resolve => setTimeout(resolve, 3000 * attempt));
      } else if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
      }
      
      if (attempt === retries) {
        console.error(`Failed to generate image after ${retries} attempts`);
        return null;
      }
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
    
    const userMessage = buildPrompt(shot);
    
    const prompt = await generatePrompt(userMessage);
    if (!prompt) {
      console.error(`Prompt generation failed for shot ${shotId}`);
      return { shotId, status: 'prompt generation failed' };
    }

    // Generate image and get base64 data instead of saving to file
    const imageData = await generateImageData(prompt);
    if (!imageData) {
      console.error(`Image generation failed for shot ${shotId}`);
      return { shotId, status: 'image generation failed' };
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
export async function generateStoryboards(shots: any[]): Promise<{ results: any[]; frames: StoryboardFrame[] }> {
  const results: any[] = [];
  const frames: StoryboardFrame[] = [];
  const failedShots: any[] = [];

  console.log(`Processing ${shots.length} shots sequentially for maximum reliability`);

  // First pass: process all shots sequentially
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
      } else {
        console.log(`Shot ${shot.shotNumberInScene || shot.id} failed, adding to retry list. Status: ${shotResult?.status}`);
        failedShots.push(shot);
        results.push(shotResult || { shotId: `shot_${shotIndex}`, status: 'processing failed' });
      }
    } catch (error) {
      console.error(`Error processing shot ${shot.shotNumberInScene || shot.id}:`, error);
      failedShots.push(shot);
      results.push({ shotId: `shot_${shotIndex}`, status: `error: ${error instanceof Error ? error.message : 'Unknown error'}` });
    }

    // Wait between shots to respect rate limits
    if (shotIndex < shots.length - 1) {
      console.log(`Waiting 5 seconds before next shot...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  // Second pass: retry failed shots individually with longer delays
  if (failedShots.length > 0) {
    console.log(`Retrying ${failedShots.length} failed shots individually...`);
    
    for (let i = 0; i < failedShots.length; i++) {
      const shot = failedShots[i];
      console.log(`Retry attempt for shot ${shot.shotNumberInScene || shot.id}`);
      
      try {
        const retryResult = await processShot(shot, shots.findIndex(s => s.id === shot.id));
        
        if ('frame' in retryResult && retryResult.frame) {
          frames.push(retryResult.frame);
          console.log(`Retry successful for shot ${shot.shotNumberInScene || shot.id}`);
        } else {
          console.log(`Retry failed for shot ${shot.shotNumberInScene || shot.id}: ${retryResult.status}`);
        }
      } catch (error) {
        console.error(`Retry error for shot ${shot.shotNumberInScene || shot.id}:`, error);
      }
      
      // Longer delay between retries
      if (i < failedShots.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 8000));
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