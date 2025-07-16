import { storage } from '../storage';
import { promptRewriter } from './promptRewriter';
import { generateImageData } from './imageGenerator';
import { generateValidFallbackImage } from './fallbackImageGenerator';

/**
 * Recovery service for failed shots - automatically fixes shots with null imageData
 */
export class ShotRecoveryService {
  
  /**
   * Recover all failed shots for a specific scene
   */
  async recoverFailedShots(parseJobId: number, sceneIndex: number, userId: string, userTier: string): Promise<void> {
    try {
      console.log(`🔄 Starting shot recovery for parseJobId: ${parseJobId}, sceneIndex: ${sceneIndex}`);
      
      // Get all shots for this scene
      const shots = await storage.getShots(parseJobId, sceneIndex);
      
      // Find shots that failed (null imageData or error messages)
      const failedShots = shots.filter(shot => 
        !shot.imageData || 
        shot.imageData === null || 
        shot.imagePromptText?.includes('API_UNAVAILABLE') ||
        shot.imagePromptText?.includes('GENERATION_ERROR') ||
        shot.imagePromptText?.includes('CONTENT_POLICY_ERROR')
      );
      
      console.log(`📊 Found ${failedShots.length} failed shots out of ${shots.length} total shots`);
      
      if (failedShots.length === 0) {
        console.log('✅ No failed shots found - recovery not needed');
        return;
      }
      
      // Process each failed shot
      for (const shot of failedShots) {
        await this.recoverSingleShot(shot, userId, userTier);
        
        // Add delay between shots to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      console.log(`✅ Shot recovery completed for ${failedShots.length} shots`);
      
    } catch (error) {
      console.error('❌ Shot recovery failed:', error);
    }
  }
  
  /**
   * Recover a single failed shot
   */
  private async recoverSingleShot(shot: any, userId: string, userTier: string): Promise<void> {
    try {
      console.log(`🔧 Recovering shot ${shot.id}: "${shot.shotDescription}"`);
      
      // Generate a comprehensive prompt for this shot
      const originalPrompt = this.generatePromptFromShot(shot);
      console.log(`📝 Original prompt: "${originalPrompt}"`);
      
      // Use LLM to rewrite the prompt for maximum success
      const rewriteResult = await promptRewriter.rewritePromptForImageGeneration(originalPrompt);
      
      let finalPrompt = originalPrompt;
      if (rewriteResult.success && rewriteResult.confidence > 0.6) {
        finalPrompt = rewriteResult.rewrittenPrompt;
        console.log(`✅ Shot ${shot.id} - LLM rewrite successful (confidence: ${rewriteResult.confidence})`);
        console.log(`🎯 Final prompt: "${finalPrompt}"`);
      } else {
        console.log(`⚠️ Shot ${shot.id} - LLM rewrite failed, using basic sanitization`);
        finalPrompt = this.basicSanitizePrompt(originalPrompt);
      }
      
      // Try to generate the image
      const imageData = await generateImageData(finalPrompt, 1, userId, userTier);
      
      if (imageData && imageData !== 'GENERATION_ERROR' && imageData !== 'CONTENT_POLICY_ERROR') {
        // Success! Update the shot with the new image
        await storage.updateShotImage(shot.id, imageData, finalPrompt);
        console.log(`✅ Shot ${shot.id} - Recovery successful!`);
      } else {
        // Still failed, try ultra-safe prompt
        const ultraSafePrompt = this.generateUltraSafePrompt(shot);
        console.log(`🛡️ Shot ${shot.id} - Trying ultra-safe prompt: "${ultraSafePrompt}"`);
        
        const safeImageData = await generateImageData(ultraSafePrompt, 1, userId, userTier);
        
        if (safeImageData && safeImageData !== 'GENERATION_ERROR' && safeImageData !== 'CONTENT_POLICY_ERROR') {
          await storage.updateShotImage(shot.id, safeImageData, ultraSafePrompt);
          console.log(`✅ Shot ${shot.id} - Recovery successful with ultra-safe prompt!`);
        } else {
          // Final fallback - use a valid placeholder
          console.log(`📦 Shot ${shot.id} - Using fallback placeholder`);
          const fallbackImage = await generateValidFallbackImage(shot.shotDescription || 'film scene');
          await storage.updateShotImage(shot.id, fallbackImage, `RECOVERY_FALLBACK: ${finalPrompt}`);
        }
      }
      
    } catch (error) {
      console.error(`❌ Failed to recover shot ${shot.id}:`, error);
      
      // Final safety fallback
      try {
        const fallbackImage = await generateValidFallbackImage(shot.shotDescription || 'film scene');
        await storage.updateShotImage(shot.id, fallbackImage, `RECOVERY_ERROR: ${error.message}`);
      } catch (fallbackError) {
        console.error(`💥 Even fallback failed for shot ${shot.id}:`, fallbackError);
      }
    }
  }
  
  /**
   * Generate a comprehensive prompt from shot data
   */
  private generatePromptFromShot(shot: any): string {
    const shotType = shot.shotType || 'medium shot';
    const description = shot.shotDescription || 'film scene';
    const location = shot.location || 'indoor location';
    const timeOfDay = shot.timeOfDay || 'day';
    const mood = shot.moodAndAmbience || 'neutral';
    const lighting = shot.lighting || 'natural lighting';
    const movement = shot.movement || 'static';
    const lens = shot.lens || '50mm';
    
    return `${shotType.toLowerCase()} showing ${description} in ${location.toLowerCase()} during ${timeOfDay.toLowerCase()}, ${mood.toLowerCase()} mood, ${lighting.toLowerCase()}, ${movement.toLowerCase()} ${lens} camera, professional film production, cinematic composition`;
  }
  
  /**
   * Generate ultra-safe prompt that should always work
   */
  private generateUltraSafePrompt(shot: any): string {
    const shotType = shot.shotType || 'medium shot';
    const location = shot.location || 'indoor location';
    const timeOfDay = shot.timeOfDay || 'day';
    
    return `Professional ${shotType.toLowerCase()} in ${location.toLowerCase()} during ${timeOfDay.toLowerCase()}, clean movie production scene, cinematic lighting, film still, safe for work content, professional filmmaking`;
  }
  
  /**
   * Basic sanitization for prompts
   */
  private basicSanitizePrompt(prompt: string): string {
    return prompt
      .replace(/blood\s+spurting/gi, 'red stage makeup effects')
      .replace(/blood/gi, 'red stage makeup')
      .replace(/stabbing/gi, 'dramatic confrontation')
      .replace(/stab/gi, 'dramatic scene')
      .replace(/knife/gi, 'prop blade')
      .replace(/weapon/gi, 'film prop')
      .replace(/violence/gi, 'dramatic action')
      .replace(/death/gi, 'dramatic conclusion')
      .replace(/murder/gi, 'mystery drama')
      .replace(/kill/gi, 'dramatic scene')
      .replace(/gore/gi, 'special effects')
      .replace(/brutal/gi, 'intense')
      + ', professional film production, cinematic quality';
  }
}

// Export singleton instance
export const shotRecoveryService = new ShotRecoveryService();