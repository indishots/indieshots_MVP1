import { Router, Request, Response } from 'express';
import { authMiddleware } from '../authMiddleware';

const router = Router();

/**
 * Debug endpoint to test prompt sanitization and image generation
 */
router.post('/debug/test-sanitization', authMiddleware, async (req: Request, res: Response) => {
  try {
    console.log('🔧 DEBUG: Testing prompt sanitization...');
    
    const testPrompt = req.body.prompt || 'Test shot with "smart quotes" and —special— characters!!! Multiple   spaces...';
    
    // Import sanitization function
    const { sanitizeText } = await import('../services/imageGenerator');
    
    const originalLength = testPrompt.length;
    const sanitized = sanitizeText ? testPrompt : 'Sanitization function not available';
    const sanitizedLength = sanitized.length;
    
    console.log('🔧 SANITIZATION TEST:');
    console.log(`   Original: "${testPrompt}"`);
    console.log(`   Sanitized: "${sanitized}"`);
    console.log(`   Length: ${originalLength} → ${sanitizedLength}`);
    
    res.json({
      success: true,
      original: testPrompt,
      sanitized: sanitized,
      originalLength,
      sanitizedLength,
      changed: testPrompt !== sanitized
    });
    
  } catch (error: any) {
    console.error('Debug sanitization test failed:', error);
    res.status(500).json({ 
      error: 'Debug test failed',
      message: error.message 
    });
  }
});

/**
 * Debug endpoint to test image data validation
 */
router.post('/debug/test-image-data', authMiddleware, async (req: Request, res: Response) => {
  try {
    console.log('🔧 DEBUG: Testing image data validation...');
    
    const testBase64 = req.body.base64 || 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
    
    // Test base64 validation
    const isValidFormat = /^[A-Za-z0-9+/]+=*$/.test(testBase64);
    const length = testBase64.length;
    const isValidLength = length > 100;
    
    // Test if it can be decoded
    let canDecode = false;
    let decodedSize = 0;
    try {
      const buffer = Buffer.from(testBase64, 'base64');
      decodedSize = buffer.length;
      canDecode = buffer.length > 0;
    } catch (error) {
      canDecode = false;
    }
    
    console.log('🔧 IMAGE VALIDATION TEST:');
    console.log(`   Length: ${length}`);
    console.log(`   Valid format: ${isValidFormat}`);
    console.log(`   Can decode: ${canDecode}`);
    console.log(`   Decoded size: ${decodedSize} bytes`);
    
    res.json({
      success: true,
      base64Length: length,
      isValidFormat,
      isValidLength,
      canDecode,
      decodedSize,
      isValidImage: isValidFormat && isValidLength && canDecode,
      preview: testBase64.substring(0, 50) + '...'
    });
    
  } catch (error: any) {
    console.error('Debug image validation test failed:', error);
    res.status(500).json({ 
      error: 'Debug test failed',
      message: error.message 
    });
  }
});

/**
 * Debug endpoint to check storyboard data
 */
router.get('/debug/storyboards/:jobId/:sceneIndex', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { jobId, sceneIndex } = req.params;
    const userId = (req as any).user?.uid || (req as any).user?.id;
    
    console.log(`🔧 DEBUG: Checking storyboard data for job ${jobId}, scene ${sceneIndex}`);
    
    const { storage } = await import('../storage');
    
    // Get shots data
    const shots = await storage.getShots(parseInt(jobId), parseInt(sceneIndex));
    
    const debugData = shots.map((shot, idx) => {
      const hasImage = !!shot.imageData;
      const imageLength = shot.imageData ? shot.imageData.length : 0;
      const isValidBase64 = shot.imageData ? /^[A-Za-z0-9+/]+=*$/.test(shot.imageData) : false;
      
      return {
        shotIndex: idx,
        shotNumber: shot.shotNumberInScene,
        hasImage,
        imageLength,
        isValidBase64,
        description: shot.shotDescription?.substring(0, 50) + '...',
        imagePreview: shot.imageData ? shot.imageData.substring(0, 30) + '...' : null
      };
    });
    
    console.log(`🔧 STORYBOARD DEBUG: Found ${shots.length} shots`);
    debugData.forEach((shot, idx) => {
      console.log(`   Shot ${idx}: hasImage=${shot.hasImage}, validBase64=${shot.isValidBase64}, length=${shot.imageLength}`);
    });
    
    res.json({
      success: true,
      totalShots: shots.length,
      shotsWithImages: debugData.filter(s => s.hasImage).length,
      shotsWithValidImages: debugData.filter(s => s.hasImage && s.isValidBase64).length,
      shots: debugData
    });
    
  } catch (error: any) {
    console.error('Debug storyboard check failed:', error);
    res.status(500).json({ 
      error: 'Debug check failed',
      message: error.message 
    });
  }
});

export default router;