import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface PromptRewriteResult {
  originalPrompt: string;
  rewrittenPrompt: string;
  confidence: number;
  reasoning: string;
  success: boolean;
}

/**
 * Advanced LLM-powered prompt rewriting service for film content
 * Intelligently rewrites problematic prompts to ensure 100% image generation success
 */
export class PromptRewriter {
  
  /**
   * Rewrite a problematic prompt using GPT-4 intelligence
   */
  async rewritePromptForImageGeneration(originalPrompt: string): Promise<PromptRewriteResult> {
    try {
      console.log(`🔄 LLM rewriting prompt: "${originalPrompt}"`);
      
      const systemPrompt = `You are an expert film production prompt rewriter. Your job is to rewrite image generation prompts to ensure they will successfully generate images through OpenAI's DALL-E 3 API while preserving the dramatic intent and cinematic quality.

CRITICAL REQUIREMENTS:
1. Remove ALL violent content (blood, stabbing, shooting, death, weapons, gore, etc.)
2. Replace with film production terminology and stage effects
3. Maintain the dramatic mood and cinematic composition
4. Add professional film production context
5. Use safe, artistic language that conveys the scene's emotional impact
6. Preserve the shot type, lighting, and visual composition

SAFE REPLACEMENTS:
- "blood spurting" → "dramatic red stage makeup effects"
- "stabbing" → "dramatic confrontation scene with prop blade"
- "shooting" → "dramatic action scene with prop firearms"
- "death" → "dramatic collapse scene"
- "violence" → "intense dramatic action"
- "weapons" → "film props and theatrical elements"
- "gore" → "dramatic special effects makeup"

ALWAYS ADD CONTEXT:
- "Professional film production scene"
- "Cinematic lighting and composition"
- "Theatrical staging and performance"
- "Movie set with professional actors"

Your response must be in JSON format with these fields:
{
  "rewrittenPrompt": "The safe, rewritten prompt",
  "confidence": 0.95,
  "reasoning": "Explanation of changes made"
}`;

      const userPrompt = `Please rewrite this film scene prompt to ensure successful image generation while preserving dramatic intent:

"${originalPrompt}"

Remember: The goal is to create a prompt that will definitely generate an image while maintaining the cinematic quality and emotional impact of the original scene.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3, // Lower temperature for more consistent results
        max_tokens: 500
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      // Validate the response
      if (!result.rewrittenPrompt || !result.confidence || !result.reasoning) {
        throw new Error('Invalid response format from LLM');
      }

      console.log(`✅ LLM rewrite successful: "${result.rewrittenPrompt}"`);
      console.log(`📊 Confidence: ${result.confidence}`);
      console.log(`💡 Reasoning: ${result.reasoning}`);

      return {
        originalPrompt,
        rewrittenPrompt: result.rewrittenPrompt,
        confidence: result.confidence,
        reasoning: result.reasoning,
        success: true
      };

    } catch (error) {
      console.error('❌ LLM prompt rewriting failed:', error);
      
      // Fallback to basic sanitization if LLM fails
      const basicSanitized = this.basicSanitization(originalPrompt);
      
      return {
        originalPrompt,
        rewrittenPrompt: basicSanitized,
        confidence: 0.6,
        reasoning: 'LLM rewriting failed, used basic sanitization fallback',
        success: false
      };
    }
  }

  /**
   * Basic sanitization fallback if LLM fails
   */
  private basicSanitization(prompt: string): string {
    let sanitized = prompt;
    
    // Apply aggressive sanitization
    const replacements = [
      { pattern: /blood\s+spurting/gi, replacement: 'dramatic red stage makeup effects' },
      { pattern: /blood[-\s]?soaked/gi, replacement: 'red-stained' },
      { pattern: /blood/gi, replacement: 'red stage makeup' },
      { pattern: /stabbing/gi, replacement: 'dramatic confrontation scene' },
      { pattern: /shooting/gi, replacement: 'dramatic action scene' },
      { pattern: /death/gi, replacement: 'dramatic collapse' },
      { pattern: /violence/gi, replacement: 'intense drama' },
      { pattern: /weapon/gi, replacement: 'film prop' },
      { pattern: /gun/gi, replacement: 'prop firearm' },
      { pattern: /knife/gi, replacement: 'prop blade' },
      { pattern: /murder/gi, replacement: 'mystery drama' },
      { pattern: /kill/gi, replacement: 'dramatic scene' },
      { pattern: /gore/gi, replacement: 'special effects makeup' }
    ];

    replacements.forEach(({ pattern, replacement }) => {
      sanitized = sanitized.replace(pattern, replacement);
    });

    // Add film production context
    sanitized = `Professional film production scene: ${sanitized}, cinematic lighting, theatrical staging`;

    return sanitized;
  }

  /**
   * Batch rewrite multiple prompts
   */
  async rewriteMultiplePrompts(prompts: string[]): Promise<PromptRewriteResult[]> {
    const results: PromptRewriteResult[] = [];
    
    for (const prompt of prompts) {
      const result = await this.rewritePromptForImageGeneration(prompt);
      results.push(result);
      
      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return results;
  }
}

// Export singleton instance
export const promptRewriter = new PromptRewriter();