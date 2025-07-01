import { Router } from 'express';
import { Request, Response } from 'express';
import { authMiddleware } from '../auth/jwt';
import { storage } from '../storage';
import { extractScenesFromText } from '../services/sceneProcessor';
import { generateShotsFromScene } from '../services/shotGenerator';
import { generateStoryboards } from '../services/imageGenerator';
import { productionQuotaManager } from '../lib/productionQuotaManager';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();

// In-memory storage for scenes and shots (replace with database in production)
const scenesStorage = new Map<string, any>();
const shotsStorage = new Map<string, any[]>();
const storyboardsStorage = new Map<string, any[]>();

/**
 * GET /api/scenes/:jobId
 * Get scenes for a parse job
 */
router.get('/jobs/:jobId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const userId = (req as any).user?.id;

    // Get the parse job
    const parseJob = await storage.getParseJob(parseInt(jobId));
    if (!parseJob || parseJob.userId !== userId) {
      return res.status(404).json({ error: 'Parse job not found' });
    }

    // Check if scenes are already extracted
    const scenesKey = `job_${jobId}_scenes`;
    if (scenesStorage.has(scenesKey)) {
      const scenes = scenesStorage.get(scenesKey);
      return res.json({ scenes });
    }

    // Get the script content
    const script = await storage.getScript(parseJob.scriptId);
    if (!script) {
      return res.status(404).json({ error: 'Script not found' });
    }

    // Extract scenes from the script content
    if (script.content) {
      const scenes = await extractScenesFromText(script.content);
      
      // Store scenes in memory
      scenesStorage.set(scenesKey, scenes);
      
      return res.json({ scenes });
    } else {
      return res.status(400).json({ error: 'Script content not available' });
    }
  } catch (error) {
    console.error('Error getting scenes:', error);
    res.status(500).json({ error: 'Failed to get scenes' });
  }
});

/**
 * POST /api/shots/generate/:jobId/:sceneIndex
 * Generate shots for a specific scene
 */
router.post('/shots/generate/:jobId/:sceneIndex', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { jobId, sceneIndex } = req.params;
    const userId = (req as any).user?.id;

    console.log(`Shot generation - jobId: ${jobId}, userId: ${userId}`);
    
    // Get the parse job
    const parseJob = await storage.getParseJob(parseInt(jobId));
    console.log(`Parse job found:`, parseJob ? `ID ${parseJob.id}, userId ${parseJob.userId}` : 'null');
    
    if (!parseJob || parseJob.userId !== userId) {
      console.log(`Access denied - parseJob exists: ${!!parseJob}, userIds match: ${parseJob?.userId === userId}`);
      return res.status(404).json({ error: 'Parse job not found' });
    }

    // Get scenes from parse job fullParseData
    const scenes = parseJob.fullParseData?.scenes;
    if (!scenes || !Array.isArray(scenes)) {
      return res.status(404).json({ error: 'Scenes not found. Please extract scenes first.' });
    }

    const scene = scenes[parseInt(sceneIndex)];
    if (!scene) {
      return res.status(404).json({ error: 'Scene not found' });
    }

    // Generate shots using your shot_generator logic
    const shots = await generateShotsFromScene(
      scene.sceneText || scene.rawTextContent || '',
      scene.sceneHeading || '',
      scene.sceneNumber || parseInt(sceneIndex) + 1
    );

    // Check shot limit for free tier users
    const user = (req as any).user;
    const userTier = user?.tier || 'free';
    const userQuota = await productionQuotaManager.getUserQuota(userId, userTier);
    
    let finalShots = shots;
    let tierLimitWarning = null;
    
    if (userQuota.tier === 'free' && shots.length > userQuota.maxShotsPerScene) {
      // Limit shots for free tier users but still store them
      finalShots = shots.slice(0, userQuota.maxShotsPerScene);
      tierLimitWarning = {
        warning: `Free tier limited to ${userQuota.maxShotsPerScene} shots per scene. ${shots.length - userQuota.maxShotsPerScene} shots were truncated. Upgrade to Pro for unlimited shots.`,
        totalGenerated: shots.length,
        limitApplied: true,
        requiresUpgrade: true
      };
    }

    // Convert shots to database format and store in database
    const shotsToStore = finalShots.map((shot: any, index: number) => ({
      parseJobId: parseInt(jobId),
      sceneIndex: parseInt(sceneIndex),
      userId: userId,
      shotNumberInScene: shot.shotNumber || index + 1,
      displayShotNumber: shot.displayShotNumber || `${index + 1}`,
      shotDescription: shot.shotDescription || '',
      shotType: shot.shotType || '',
      lens: shot.lens || '',
      movement: shot.movement || '',
      moodAndAmbience: shot.moodAndAmbience || '',
      lighting: shot.lighting || '',
      props: shot.props || '',
      notes: shot.notes || '',
      soundDesign: shot.soundDesign || '',
      colourTemp: shot.colourTemp || '',
      sceneHeading: shot.sceneHeading || scene.sceneHeading || '',
      location: shot.location || scene.location || '',
      timeOfDay: shot.timeOfDay || scene.timeOfDay || '',
      tone: shot.tone || scene.tone || '',
      characters: shot.characters || '',
      action: shot.action || '',
      dialogue: shot.dialogue || '',
    }));

    // Delete existing shots for this scene and create new ones
    console.log(`About to delete existing shots for job ${jobId}, scene ${sceneIndex}`);
    await storage.deleteShots(parseInt(jobId), parseInt(sceneIndex));
    
    console.log(`About to create ${shotsToStore.length} shots:`, shotsToStore.map(s => ({ 
      parseJobId: s.parseJobId, 
      sceneIndex: s.sceneIndex, 
      userId: s.userId,
      shotDescription: s.shotDescription 
    })));
    
    const createdShots = await storage.createShots(shotsToStore);
    console.log(`Created ${createdShots.length} shots in database`);

    const response = { 
      message: 'Shots generated successfully',
      shotCount: createdShots.length,
      shots: createdShots,
      ...(tierLimitWarning || {})
    };

    res.json(response);
  } catch (error) {
    console.error('Error generating shots:', error);
    res.status(500).json({ error: 'Failed to generate shots' });
  }
});

/**
 * GET /api/shots/:jobId
 * Get all shots for a job across all scenes
 */
router.get('/shots/:jobId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const userId = (req as any).user?.id;

    console.log(`GET all shots - jobId: ${jobId}, userId: ${userId}`);
    
    // Verify user owns the job
    const parseJob = await storage.getParseJob(parseInt(jobId));
    console.log(`Parse job found:`, parseJob ? `ID ${parseJob.id}, userId ${parseJob.userId}` : 'null');
    
    if (!parseJob || parseJob.userId !== userId) {
      console.log(`Access denied - parseJob exists: ${!!parseJob}, userIds match: ${parseJob?.userId === userId}`);
      return res.status(404).json({ error: 'Parse job not found' });
    }

    // Get all shots from all scenes for this job
    const allShots = [];
    
    // Handle fullParseData which might already be an object or a string
    let parsedData;
    if (typeof parseJob.fullParseData === 'string') {
      try {
        parsedData = JSON.parse(parseJob.fullParseData);
      } catch (error) {
        console.error('Error parsing fullParseData:', error);
        parsedData = parseJob.fullParseData;
      }
    } else {
      parsedData = parseJob.fullParseData;
    }
    
    const scenes = parsedData?.scenes || [];
    console.log(`Found ${scenes.length} scenes in fullParseData`);
    
    for (let sceneIndex = 0; sceneIndex < scenes.length; sceneIndex++) {
      const sceneShots = await storage.getShots(parseInt(jobId), sceneIndex);
      console.log(`Scene ${sceneIndex}: found ${sceneShots.length} shots`);
      allShots.push(...sceneShots);
    }
    
    console.log(`GET all shots - parseJobId: ${jobId}, found ${allShots.length} total shots`);
    
    res.json(allShots);
  } catch (error) {
    console.error('Error getting all shots:', error);
    res.status(500).json({ error: 'Failed to get shots' });
  }
});

/**
 * GET /api/shots/:jobId/:sceneIndex
 * Get shots for a specific scene
 */
router.get('/shots/:jobId/:sceneIndex', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { jobId, sceneIndex } = req.params;
    const userId = (req as any).user?.id;

    console.log(`GET shots - jobId: ${jobId}, userId: ${userId}`);
    
    // Verify user owns the job
    const parseJob = await storage.getParseJob(parseInt(jobId));
    console.log(`Parse job found:`, parseJob ? `ID ${parseJob.id}, userId ${parseJob.userId}` : 'null');
    
    if (!parseJob || parseJob.userId !== userId) {
      console.log(`Access denied - parseJob exists: ${!!parseJob}, userIds match: ${parseJob?.userId === userId}`);
      return res.status(404).json({ error: 'Parse job not found' });
    }

    // Get shots from database instead of memory
    const shots = await storage.getShots(parseInt(jobId), parseInt(sceneIndex));
    
    console.log(`GET shots - parseJobId: ${jobId}, sceneIndex: ${sceneIndex}, found ${shots.length} shots`);
    console.log('First shot sample:', shots[0]);

    res.json({ shots });
  } catch (error) {
    console.error('Error getting shots:', error);
    res.status(500).json({ error: 'Failed to get shots' });
  }
});

/**
 * POST /api/storyboards/generate/:jobId/:sceneIndex
 * Generate storyboards for shots in a scene
 */
router.post('/storyboards/generate/:jobId/:sceneIndex', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { jobId, sceneIndex } = req.params;
    const userId = (req as any).user?.id;
    const user = (req as any).user;
    const userTier = user?.tier || 'free';

    // Check storyboard access with quota manager
    const storyboardAccess = await productionQuotaManager.checkStoryboardAccess(userId, userTier);
    if (!storyboardAccess.allowed) {
      return res.status(403).json({
        message: storyboardAccess.reason,
        requiresUpgrade: true,
        feature: 'storyboards'
      });
    }

    // Verify user owns the job
    const parseJob = await storage.getParseJob(parseInt(jobId));
    if (!parseJob || parseJob.userId !== userId) {
      return res.status(404).json({ error: 'Parse job not found' });
    }

    // Get shots for the scene from database
    let shots = await storage.getShots(parseInt(jobId), parseInt(sceneIndex));
    if (!shots || shots.length === 0) {
      return res.status(404).json({ error: 'No shots found. Please generate shots first.' });
    }

    // Check if this is a force regeneration (clear existing images)
    const forceRegenerate = req.body.forceRegenerate;
    
    if (forceRegenerate) {
      console.log(`Force regenerating storyboards for scene ${sceneIndex} - clearing existing image data`);
      // Instead of deleting/recreating, just clear the image data fields
      for (const shot of shots) {
        if (shot.imageData) {
          await storage.updateShotImage(shot.id, "", "");
        }
      }
      
      // Refresh shots data to get cleared records
      shots = await storage.getShots(parseInt(jobId), parseInt(sceneIndex));
    }

    // Generate fresh storyboards and wait for ALL to complete
    console.log(`Starting generation of ${shots.length} storyboard images...`);
    const { results, frames } = await generateStoryboards(shots);
    
    // Validate all shots have images - retry any missing ones
    const updatedShots = await storage.getShots(parseInt(jobId), parseInt(sceneIndex));
    const missingImageShots = updatedShots.filter(shot => !shot.imageData || shot.imageData === '');
    
    if (missingImageShots.length > 0) {
      console.log(`Found ${missingImageShots.length} shots without images, attempting individual generation...`);
      
      // Try to generate missing images individually
      for (const missingShot of missingImageShots) {
        try {
          console.log(`Attempting to generate missing image for shot ${missingShot.shotNumberInScene}`);
          
          // Generate basic prompt if missing
          const shotPrompt = missingShot.imagePromptText || 
            `${missingShot.shotDescription || 'Scene shot'} in a ${missingShot.shotType || 'medium shot'} style`;
          
          // Use OpenAI to generate the image
          const imageGeneratorModule = await import('../services/imageGenerator');
          const imageData = await imageGeneratorModule.generateImageData(shotPrompt);
          
          if (imageData) {
            await storage.updateShotImage(missingShot.id, imageData, shotPrompt);
            console.log(`Successfully generated missing image for shot ${missingShot.shotNumberInScene}`);
          }
        } catch (error) {
          console.error(`Failed to generate missing image for shot ${missingShot.shotNumberInScene}:`, error);
        }
      }
    }
    
    // Get final shots with all images
    const finalShots = await storage.getShots(parseInt(jobId), parseInt(sceneIndex));
    const finalStoryboards = finalShots.map(shot => ({
      shotNumber: shot.shotNumberInScene,
      description: shot.shotDescription,
      shotType: shot.shotType,
      cameraAngle: shot.lens,
      notes: shot.notes,
      imagePath: shot.imageData ? `data:image/png;base64,${shot.imageData}` : null,
      prompt: shot.imagePromptText,
      hasImage: !!shot.imageData
    }));
    
    const successCount = finalStoryboards.filter(sb => sb.hasImage).length;
    console.log(`Final generation complete: ${successCount}/${shots.length} images generated successfully`);

    res.json({
      message: `Storyboards generated successfully`,
      totalShots: shots.length,
      generatedCount: successCount,
      storyboardCount: finalStoryboards.length,
      storyboards: finalStoryboards,
      results: results
    });
  } catch (error) {
    console.error('Error generating storyboards:', error);
    res.status(500).json({ error: 'Failed to generate storyboards' });
  }
});

/**
 * GET /api/storyboards/:jobId/:sceneIndex
 * Get storyboards for a specific scene
 */
router.get('/storyboards/:jobId/:sceneIndex', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { jobId, sceneIndex } = req.params;
    const userId = (req as any).user?.id;

    // Verify user owns the job
    const parseJob = await storage.getParseJob(parseInt(jobId));
    if (!parseJob || parseJob.userId !== userId) {
      return res.status(404).json({ error: 'Parse job not found' });
    }

    // Get ALL shots from database and show their current status
    const shots = await storage.getShots(parseInt(jobId), parseInt(sceneIndex));
    const storyboards = shots.map(shot => ({
        shotNumber: shot.shotNumberInScene,
        description: shot.shotDescription,
        shotType: shot.shotType,
        cameraAngle: shot.lens,
        notes: shot.notes,
        imagePath: shot.imageData ? `data:image/png;base64,${shot.imageData}` : null,
        imageData: shot.imageData, // Include raw base64 data for immediate display
        prompt: shot.imagePromptText,
        hasImage: !!shot.imageData
      }));

    // Prevent caching to ensure fresh data after regeneration
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    res.json({ storyboards });
  } catch (error) {
    console.error('Error getting storyboards:', error);
    res.status(500).json({ error: 'Failed to get storyboards' });
  }
});

/**
 * GET /api/storyboards/:jobId/:sceneIndex/download
 * Download storyboards as individual images or ZIP file
 */
router.get('/storyboards/:jobId/:sceneIndex/download', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { jobId, sceneIndex } = req.params;
    const { format = 'zip' } = req.query;
    const userId = (req as any).user?.id;

    // Verify user owns the job
    const parseJob = await storage.getParseJob(parseInt(jobId));
    if (!parseJob || parseJob.userId !== userId) {
      return res.status(404).json({ error: 'Parse job not found' });
    }

    // Get shots with generated images from database
    const shots = await storage.getShots(parseInt(jobId), parseInt(sceneIndex));
    const shotsWithImages = shots.filter(shot => shot.imageData);

    if (shotsWithImages.length === 0) {
      return res.status(404).json({ error: 'No storyboards found' });
    }

    if (format === 'zip') {
      // Create ZIP file with all images from database
      const archiver = await import('archiver');
      const archive = archiver.default('zip', { zlib: { level: 9 } });
      
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="storyboards_scene${sceneIndex}.zip"`);
      
      archive.pipe(res);
      
      // Add each storyboard image to the ZIP
      for (let i = 0; i < shotsWithImages.length; i++) {
        const shot = shotsWithImages[i];
        if (shot.imageData) {
          const imageBuffer = Buffer.from(shot.imageData, 'base64');
          archive.append(imageBuffer, { 
            name: `shot_${shot.shotNumberInScene}_${shot.shotDescription?.substring(0, 20) || 'storyboard'}.png` 
          });
        }
      }
      
      archive.finalize();
    } else {
      // Return metadata for individual downloads
      const downloadLinks = shotsWithImages.map((shot, index) => ({
        shotNumber: shot.shotNumberInScene || index + 1,
        description: shot.shotDescription || shot.imagePromptText,
        downloadUrl: `/api/storyboards/${jobId}/${sceneIndex}/image/${index}`,
        imagePath: shot.imageData ? 'stored in database' : null
      }));
      
      res.json({ downloads: downloadLinks });
    }
  } catch (error) {
    console.error('Error downloading storyboards:', error);
    res.status(500).json({ error: 'Failed to download storyboards' });
  }
});

/**
 * GET /api/storyboards/:jobId/:sceneIndex/image/:imageIndex
 * Download individual storyboard image
 */
router.get('/storyboards/:jobId/:sceneIndex/image/:imageIndex', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { jobId, sceneIndex, imageIndex } = req.params;
    const userId = (req as any).user?.id;

    // Verify user owns the job
    const parseJob = await storage.getParseJob(parseInt(jobId));
    if (!parseJob || parseJob.userId !== userId) {
      return res.status(404).json({ error: 'Parse job not found' });
    }

    // Get shots from database - use direct index mapping instead of filtering
    const shots = await storage.getShots(parseInt(jobId), parseInt(sceneIndex));
    const shot = shots[parseInt(imageIndex)];

    console.log(`Individual image download - imageIndex: ${imageIndex}, shotId: ${shot?.id}, updated: ${shot?.updatedAt}, hasImage: ${!!shot?.imageData}`);

    if (!shot || !shot.imageData) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Serve the image data from database with no cache for updated images
    const imageBuffer = Buffer.from(shot.imageData, 'base64');
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    const timestamp = shot.updatedAt ? new Date(shot.updatedAt).getTime() : Date.now();
    res.setHeader('Content-Disposition', `attachment; filename="shot_${shot.shotNumberInScene}_${timestamp}.png"`);
    
    res.send(imageBuffer);
  } catch (error) {
    console.error('Error downloading image:', error);
    res.status(500).json({ error: 'Failed to download image' });
  }
});

/**
 * POST /api/storyboards/regenerate/:jobId/:sceneIndex/:shotId
 * Regenerate a specific storyboard image with modifications
 */
router.post('/storyboards/regenerate/:jobId/:sceneIndex/:shotId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { jobId, sceneIndex, shotId } = req.params;
    const { modifications } = req.body;
    const userId = (req as any).user?.id;
    const user = (req as any).user;
    const userTier = user?.tier || 'free';

    // Check storyboard access with quota manager
    const storyboardAccess = await productionQuotaManager.checkStoryboardAccess(userId, userTier);
    if (!storyboardAccess.allowed) {
      return res.status(403).json({
        message: storyboardAccess.reason,
        requiresUpgrade: true,
        feature: 'storyboards'
      });
    }

    console.log(`Starting regeneration - jobId: ${jobId}, sceneIndex: ${sceneIndex}, shotId: ${shotId}`);

    // Verify user owns the job
    const parseJob = await storage.getParseJob(parseInt(jobId));
    if (!parseJob || parseJob.userId !== userId) {
      return res.status(404).json({ error: 'Parse job not found' });
    }

    // Get shots from database
    const shots = await storage.getShots(parseInt(jobId), parseInt(sceneIndex));
    console.log(`Found ${shots.length} total shots`);
    
    // Find shot by storyboard index (shots with images ordered by shotNumberInScene)
    const shotsWithImages = shots.filter(shot => shot.imageData && shot.imageData.length > 0).sort((a, b) => a.shotNumberInScene - b.shotNumberInScene);
    const storyboardIndex = parseInt(shotId);
    const shot = shotsWithImages[storyboardIndex];
    
    console.log(`Looking for storyboard index ${shotId} in ${shotsWithImages.length} shots with images`);
    console.log(`Shots with images:`, shotsWithImages.map(s => ({ id: s.id, shotNumber: s.shotNumberInScene, hasImage: !!s.imageData })));
    console.log(`Requesting storyboard index: ${storyboardIndex}, available indices: 0-${shotsWithImages.length - 1}`);

    if (!shot) {
      console.log(`Shot not found at storyboard index ${shotId}. Available shots: ${shotsWithImages.length}`);
      return res.status(404).json({ 
        error: `Shot not found at storyboard index ${shotId}`,
        debug: {
          requestedIndex: storyboardIndex,
          availableCount: shotsWithImages.length,
          availableIndices: shotsWithImages.map((s, i) => ({ index: i, shotId: s.id, shotNumber: s.shotNumberInScene }))
        }
      });
    }
    
    if (!shot.imageData || shot.imageData.length === 0) {
      console.log(`Shot found but has no image data: ${shot.id}`);
      return res.status(400).json({ error: `Shot ${shot.id} has no image data to regenerate` });
    }
    
    console.log(`Found shot: ${shot.id}, shotNumber: ${shot.shotNumberInScene}`);

    // Recreate the exact same prompt format as original storyboard generation
    const createPrompt = (shotData: any): string => {
      const mood = shotData.moodAndAmbience || 'neutral';
      const shotType = shotData.shotType || 'medium shot';
      const description = shotData.shotDescription || '';
      const location = shotData.location || '';
      const timeOfDay = shotData.timeOfDay || '';
      const lens = shotData.lens || '';
      const movement = shotData.movement || 'static';
      const lighting = shotData.lighting || '';
      const props = shotData.props || '';
      const colorTemp = shotData.colourTemp || '';
      
      let prompt = `In a ${mood.toLowerCase()}, ${shotType.toLowerCase()}, capture ${description}`;
      
      if (location) prompt += ` in ${location.toLowerCase()}`;
      if (timeOfDay) prompt += ` at ${timeOfDay.toLowerCase()}`;
      if (lens) prompt += `, using a ${movement.toLowerCase()} ${lens} lens`;
      if (lighting) prompt += `, with ${lighting.toLowerCase()}`;
      if (props) prompt += `, featuring ${props.toLowerCase()}`;
      if (colorTemp) prompt += `, ${colorTemp.toLowerCase()} color temperature`;
      
      return prompt + '.';
    };
    
    // Use stored prompt if available, otherwise recreate using original logic
    let basePrompt = shot.imagePromptText;
    if (!basePrompt) {
      basePrompt = createPrompt(shot);
    }
    
    // Apply content safety modifications for regeneration
    let modifiedPrompt;
    if (modifications === 'alternative safe prompt') {
      // For content policy issues, create a much safer version of the prompt
      const shotType = shot.shotType || 'medium shot';
      const location = shot.location || 'indoor location';
      const timeOfDay = shot.timeOfDay || 'day';
      
      const safePrompt = `Professional ${shotType.toLowerCase()} in ${location.toLowerCase()} during ${timeOfDay.toLowerCase()}, clean movie production scene, cinematic lighting, film still`;
      modifiedPrompt = safePrompt;
    } else if (modifications === 'retry generation') {
      // For retry, aggressively clean the prompt
      modifiedPrompt = basePrompt
        .replace(/blood[-\s]?soaked/gi, 'red-stained')
        .replace(/blood/gi, 'dramatic red')
        .replace(/police\s+tape/gi, 'yellow barrier')
        .replace(/crime\s+scene/gi, 'investigation area')
        .replace(/violent|death|murder|kill|weapon|gun|knife/gi, 'dramatic')
        .replace(/gore|brutal|torture/gi, 'intense');
      
      // Add safety qualifiers
      modifiedPrompt = `Professional cinematic scene: ${modifiedPrompt}, movie production still, artistic lighting`;
    } else {
      modifiedPrompt = `${basePrompt} ${modifications}`;
    }
    console.log(`Using regeneration prompt: ${modifiedPrompt}`);
    
    // Debug: Test the specific failing prompt
    if (modifiedPrompt.includes('blood-soaked') || modifiedPrompt.includes('blood soaked')) {
      console.log('WARNING: Detected blood-related content in prompt that may trigger content policy');
      console.log('Original shot data:', {
        shotDescription: shot.shotDescription,
        location: shot.location,
        shotType: shot.shotType
      });
    }

    // Use the improved image generation function with retries
    const { generateImageData } = await import('../services/imageGenerator');
    const imageData = await generateImageData(modifiedPrompt, 3); // 3 retry attempts
    
    if (!imageData || imageData === 'GENERATION_FAILED' || imageData === 'CONTENT_POLICY_VIOLATION') {
      const errorType = imageData || 'unknown';
      console.error(`Regeneration failed: ${errorType}`);
      console.error(`Failed prompt was: ${modifiedPrompt}`);
      
      // If this is a content policy issue, try one more time with an ultra-safe prompt
      if (imageData === 'CONTENT_POLICY_VIOLATION' || modifiedPrompt.toLowerCase().includes('blood')) {
        console.log('Attempting emergency ultra-safe regeneration...');
        const emergencyPrompt = `Professional medium shot in indoor location during day, clean movie production scene, cinematic lighting, film still, safe for work content`;
        const emergencyResult = await generateImageData(emergencyPrompt, 1);
        
        if (emergencyResult && emergencyResult !== 'GENERATION_FAILED' && emergencyResult !== 'CONTENT_POLICY_VIOLATION') {
          console.log('Emergency regeneration successful');
          await storage.updateShotImage(shot.id, emergencyResult, emergencyPrompt);
          return res.json({ 
            message: 'Image regenerated with simplified prompt',
            shotId: shot.id,
            newPrompt: emergencyPrompt,
            fallback: true
          });
        }
      }
      
      throw new Error(`Failed to regenerate image: ${errorType}. The content may be too sensitive for AI image generation.`);
    }

    // Update shot with new image data
    await storage.updateShotImage(shot.id, imageData, modifiedPrompt);

    console.log(`Successfully regenerated image for shot ${shot.id}`);

    res.json({ 
      message: 'Image regenerated successfully',
      shotId: shot.id,
      newPrompt: modifiedPrompt
    });

  } catch (error) {
    console.error('Error regenerating image:', error);
    res.status(500).json({ error: 'Failed to regenerate image', details: (error as Error).message });
  }
});

export default router;