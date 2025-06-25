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
 * Generate visual prompt using GPT-4
 */
async function generatePrompt(userMessage: string): Promise<string | null> {
  try {
    const response = await promptClient.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage }
      ]
    });
    
    return response.choices[0].message.content?.trim() || null;
  } catch (error) {
    console.error('[ERROR] Prompt generation failed:', error);
    return null;
  }
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
export async function generateImageData(prompt: string): Promise<string | null> {
  try {
    console.log(`Generating image data with prompt: ${prompt}`);
    
    const response = await imageClient.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1024x1024",
      response_format: "url"
    });

    const imageUrl = response.data?.[0]?.url;
    if (!imageUrl) {
      console.error('No image URL returned from OpenAI');
      return null;
    }

    // Download the image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      console.error(`Failed to download image: ${imageResponse.statusText}`);
      return null;
    }

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    return imageBuffer.toString('base64');
  } catch (error) {
    console.error('Image generation failed:', error);
    return null;
  }
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

  // Process shots in smaller batches to balance speed and rate limits
  const batchSize = 2;
  const batches = [];
  
  for (let i = 0; i < shots.length; i += batchSize) {
    batches.push(shots.slice(i, i + batchSize));
  }

  console.log(`Processing ${shots.length} shots in ${batches.length} batches of ${batchSize}`);

  // First pass: process all shots
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    console.log(`Processing batch ${batchIndex + 1}/${batches.length} with ${batch.length} shots`);
    
    const batchPromises = batch.map((shot, index) => 
      processShot(shot, batchIndex * batchSize + index)
    );
    
    const batchResults = await Promise.allSettled(batchPromises);
    
    // Collect results from settled promises
    for (let i = 0; i < batchResults.length; i++) {
      const settledResult = batchResults[i];
      const originalShot = batch[i];
      
      if (settledResult.status === 'fulfilled' && settledResult.value) {
        const result = settledResult.value;
        results.push(result);
        if ('frame' in result && result.frame) {
          frames.push(result.frame);
        } else {
          // Track failed shots for retry
          console.log(`Shot ${originalShot.shotNumberInScene || originalShot.id} failed, adding to retry list`);
          failedShots.push(originalShot);
        }
      } else if (settledResult.status === 'rejected') {
        console.error('Batch promise rejected:', settledResult.reason);
        results.push({ shotId: `unknown_${results.length}`, status: 'promise rejected' });
        failedShots.push(originalShot);
      }
    }

    // Delay between batches
    if (batchIndex < batches.length - 1) {
      console.log(`Waiting 3 seconds before next batch...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
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
        results.push(retryResult);
        
        if ('frame' in retryResult && retryResult.frame) {
          frames.push(retryResult.frame);
          console.log(`Retry successful for shot ${shot.shotNumberInScene || shot.id}`);
        } else {
          console.log(`Retry failed for shot ${shot.shotNumberInScene || shot.id}: ${retryResult.status}`);
        }
      } catch (error) {
        console.error(`Retry error for shot ${shot.shotNumberInScene || shot.id}:`, error);
        results.push({ shotId: shot.shotNumberInScene?.toString() || shot.id, status: 'retry failed' });
      }
      
      // Longer delay between retries
      if (i < failedShots.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  console.log(`Completed processing ${results.length} shots, generated ${frames.length} frames`);
  
  // Log detailed results for debugging
  results.forEach((result, index) => {
    console.log(`Shot ${index + 1}: ${result.shotId} - ${result.status}`);
  });
  
  return { results, frames };
}

/**
 * Get storyboard image path
 */
export function getStoryboardImagePath(filename: string): string {
  return path.join(IMAGE_OUTPUT_DIR, filename);
}