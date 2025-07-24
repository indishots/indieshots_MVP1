import { OpenAI } from "openai";
import { storage } from "../storage";
import { costController } from "./costController";
import { generateValidFallbackImage } from "./fallbackImageGenerator";
import { contentPolicyDetector } from "./contentPolicyDetector";
import { promptAgent } from "./promptAgent";
import { characterAgent } from "./characterAgent";

// Configure OpenAI with cost-optimized settings
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 45000, // Reduced timeout to prevent expensive hanging requests
  maxRetries: 0, // COST SAVINGS: Disable automatic retries to prevent excessive billing
  dangerouslyAllowBrowser: false,
});

/**
 * Robust batch image generation with complete error isolation
 * This function NEVER throws exceptions - all errors are caught and handled
 */
export async function generateStoryboardBatch(
  shots: any[],
  parseJobId: number,
  userId?: string,
  userTier?: string,
): Promise<void> {
  try {
    console.log(
      `🎬 Starting robust batch generation for ${shots.length} shots`,
    );
    console.log(
      `📋 Shot details:`,
      shots.map((s, i) => ({
        index: i,
        id: s.id,
        description: s.shotDescription,
      })),
    );

    // Validate inputs
    if (!shots || shots.length === 0) {
      console.log("❌ No shots to process - batch generation aborted");
      return;
    }

    // COST CONTROL: Check if user can generate images
    if (userId) {
      const costCheck = costController.canGenerateImage(userId, userTier);
      if (!costCheck.allowed) {
        console.log(
          `🔒 COST CONTROL: Image generation blocked - ${costCheck.reason}`,
        );

        // Generate fallback placeholders for all shots
        for (const shot of shots) {
          try {
            const placeholderImage = await generateValidFallbackImage(
              shot.shotDescription || "storyboard frame",
            );
            await storage.updateShotImage(
              shot.id,
              placeholderImage,
              `DAILY_LIMIT_EXCEEDED: ${costCheck.reason}`,
            );
          } catch (error) {
            console.error(
              `Failed to generate placeholder for shot ${shot.id}:`,
              error,
            );
          }
        }
        return;
      }
    }

    // Check OpenAI API key availability and quota
    if (!process.env.OPENAI_API_KEY) {
      console.error(
        "❌ CRITICAL: OpenAI API key not found in environment variables",
      );

      // Generate fallback placeholders for all shots
      console.log("🔄 Generating fallback placeholders for all shots...");
      for (const shot of shots) {
        try {
          const placeholderImage = await generateValidFallbackImage(
            shot.shotDescription || "storyboard frame",
          );
          await storage.updateShotImage(
            shot.id,
            placeholderImage,
            "API_KEY_MISSING: OpenAI API key not configured",
          );
        } catch (error) {
          console.error(
            `Failed to generate placeholder for shot ${shot.id}:`,
            error,
          );
        }
      }
      return;
    }

    // Skip quota testing to save costs - handle quota issues during actual generation
    console.log(
      "🎬 Proceeding directly to image generation with robust error handling...",
    );

    // COST SAVINGS: Reduced batch size to limit concurrent expensive API calls
    const BATCH_SIZE = 1; // Process one shot at a time to prevent billing spikes
    for (let i = 0; i < shots.length; i += BATCH_SIZE) {
      try {
        const batch = shots.slice(i, i + BATCH_SIZE);
        console.log(
          `Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(shots.length / BATCH_SIZE)} (shots ${i + 1}-${Math.min(i + BATCH_SIZE, shots.length)})`,
        );

        // Process each shot in batch independently with complete isolation
        const promises = batch.map(async (shot, batchIndex) => {
          const shotNumber = i + batchIndex + 1;
          try {
            console.log(
              `🎨 Starting generation for shot ${shotNumber}/${shots.length}`,
            );
            await generateSingleShotImage(
              shot,
              parseJobId,
              shotNumber,
              userId,
              userTier,
            );
            console.log(
              `✅ Shot ${shotNumber} completed successfully - image immediately available for frontend polling`,
            );
          } catch (error) {
            console.error(
              `❌ Shot ${shotNumber} failed independently (continuing with remaining shots):`,
              error,
            );

            // Individual failures don't affect the batch - mark as failed and continue
            try {
              await storage.updateShotImage(
                shot.id,
                null,
                `ERROR: ${error instanceof Error ? error.message : "Generation failed"}`,
              );
              console.log(
                `📝 Shot ${shotNumber} marked as failed in database, continuing with batch`,
              );
            } catch (saveError) {
              console.error(
                `Failed to save error state for shot ${shotNumber}:`,
                saveError,
              );
            }
          }
        });

        // Wait for all shots in this batch to complete (successful or failed)
        const results = await Promise.allSettled(promises);
        const successCount = results.filter(
          (r) => r.status === "fulfilled",
        ).length;
        const failedCount = results.filter(
          (r) => r.status === "rejected",
        ).length;
        console.log(
          `Batch ${Math.floor(i / BATCH_SIZE) + 1} completed: ${successCount} successful, ${failedCount} failed - continuing to next batch`,
        );

        // Small delay between batches to prevent overwhelming the API while maintaining real-time feel
        if (i + BATCH_SIZE < shots.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000)); // Balanced delay for API stability
        }
      } catch (batchError) {
        console.error(
          `Batch ${Math.floor(i / BATCH_SIZE) + 1} failed completely:`,
          batchError,
        );

        // Mark all shots in this batch as failed
        const batch = shots.slice(i, i + BATCH_SIZE);
        for (const shot of batch) {
          try {
            await storage.updateShotImage(
              shot.id,
              null,
              `ERROR: Batch processing failed - ${batchError instanceof Error ? batchError.message : "Unknown error"}`,
            );
          } catch (markError) {
            console.error(
              `Failed to mark shot ${shot.id} as failed:`,
              markError,
            );
          }
        }
      }
    }

    console.log(`🎬 Batch generation completed for ${shots.length} shots`);

    // Check if we have multiple failed shots and trigger recovery if needed
    try {
      const finalShots = await storage.getShots(
        parseJobId,
        shots[0]?.sceneIndex || 0,
      );
      const stillFailed = finalShots.filter(
        (shot) =>
          !shot.imageData ||
          shot.imageData === null ||
          shot.imagePromptText?.includes("API_UNAVAILABLE") ||
          shot.imagePromptText?.includes("GENERATION_ERROR"),
      );

      if (stillFailed.length > 0) {
        console.log(
          `🔄 ${stillFailed.length} shots still failed, triggering recovery service...`,
        );

        // Import and run recovery service
        const { shotRecoveryService } = await import("./shotRecoveryService");
        await shotRecoveryService.recoverFailedShots(
          parseJobId,
          shots[0]?.sceneIndex || 0,
          userId || "unknown",
          userTier || "free",
        );

        console.log(
          `✅ Recovery service completed for ${stillFailed.length} failed shots`,
        );
      }
    } catch (recoveryError) {
      console.error("Recovery service failed:", recoveryError);
    }
  } catch (topLevelError) {
    console.error("Top-level batch generation error:", topLevelError);
    console.error(
      "Stack trace:",
      topLevelError instanceof Error ? topLevelError.stack : "No stack trace",
    );

    // Final fallback - mark all shots as failed
    if (shots && Array.isArray(shots)) {
      for (const shot of shots) {
        try {
          await storage.updateShotImage(
            shot.id,
            null,
            `ERROR: System error - ${topLevelError instanceof Error ? topLevelError.message : "Unknown error"}`,
          );
        } catch (finalError) {
          console.error(
            `Final fallback error for shot ${shot.id}:`,
            finalError,
          );
          // At this point, there's nothing more we can do
        }
      }
    }
  }
}

/**
 * Generate image for a single shot with complete error isolation
 */
async function generateSingleShotImage(
  shot: any,
  parseJobId: number,
  shotNumber: number,
  userId?: string,
  userTier?: string,
): Promise<void> {
  const MAX_RETRIES = 1; // COST SAVINGS: Single attempt only to prevent billing multiplication
  let lastError: any = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(
        `🎨 Shot ${shotNumber} - Attempt ${attempt}/${MAX_RETRIES} (30s timeout per attempt)`,
      );

      // Generate prompt with comprehensive content policy detection
      const rawPrompt = await generateSafePrompt(shot);
      if (!rawPrompt) {
        throw new Error("Failed to generate prompt");
      }

      // Apply comprehensive content policy detection and sanitization
      const contentAnalysis =
        await contentPolicyDetector.processPrompt(rawPrompt);
      let prompt = contentAnalysis.sanitizedPrompt;

      // If content is still problematic after basic sanitization, use LLM rewriting
      if (
        contentAnalysis.analysis.isProblematic ||
        contentAnalysis.moderation.flagged
      ) {
        console.log(
          `🧠 Shot ${shotNumber} - Content still problematic after sanitization, using LLM rewriting...`,
        );

        const { promptRewriter } = await import("./promptRewriter");
        const rewriteResult =
          await promptRewriter.rewritePromptForImageGeneration(prompt);

        if (rewriteResult.success && rewriteResult.confidence > 0.7) {
          prompt = rewriteResult.rewrittenPrompt;
          console.log(
            `✅ Shot ${shotNumber} - LLM rewrite successful: "${prompt}"`,
          );
          console.log(
            `📊 Shot ${shotNumber} - Confidence: ${rewriteResult.confidence}`,
          );
        } else {
          console.log(
            `⚠️ Shot ${shotNumber} - LLM rewrite failed or low confidence, using basic sanitization`,
          );
        }
      }

      // Log content policy analysis for debugging
      if (contentAnalysis.analysis.isProblematic) {
        console.log(
          `🔍 Shot ${shotNumber} - Content policy issues detected:`,
          contentAnalysis.analysis.detectedIssues,
        );
        console.log(
          `🛠️ Shot ${shotNumber} - Prompt sanitized for OpenAI compliance`,
        );
      }

      // If moderation API flags content, log it
      if (contentAnalysis.moderation.flagged) {
        console.log(
          `⚠️ Shot ${shotNumber} - OpenAI moderation flagged categories:`,
          contentAnalysis.moderation.categories,
        );
      }

      // Generate image with timeout
      const imageData = await generateImageWithRetry(prompt, attempt);
      if (!imageData) {
        throw new Error("Failed to generate image data");
      }

      // Save to database
      await storage.updateShotImage(shot.id, imageData, prompt);

      // COST CONTROL: Record image generation usage
      if (userId) {
        costController.recordImageGeneration(userId, 0.08); // Record DALL-E 3 cost
      }

      console.log(
        `✅ Shot ${shotNumber} - Real image generated successfully on attempt ${attempt}`,
      );
      return;
    } catch (error: any) {
      lastError = error;
      console.error(
        `❌ Shot ${shotNumber} - Attempt ${attempt} failed:`,
        error.message,
      );

      // Check if it's a timeout, API access issue, or quota issue - fail faster
      if (
        error.message?.includes("timeout") ||
        error.message?.includes("API") ||
        error.message?.includes("QUOTA_EXCEEDED") ||
        error.message?.includes("API_ACCESS_ERROR")
      ) {
        console.log(
          `⏰ Shot ${shotNumber} - API issue detected (${error.message}), failing faster`,
        );
        break; // Don't retry on API issues
      }

      // Wait before retry with shorter delays for faster feedback
      if (attempt < MAX_RETRIES) {
        const delay = 2000; // 2 second delay
        console.log(
          `⏱️ Shot ${shotNumber} - Waiting ${delay / 1000}s before retry ${attempt + 1}`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // Use placeholder when OpenAI is unavailable with specific error messaging
  const errorType = lastError?.message?.includes("API_ACCESS_ERROR")
    ? "API_ACCESS_ERROR"
    : lastError?.message?.includes("QUOTA_EXCEEDED")
      ? "QUOTA_EXCEEDED"
      : "API_UNAVAILABLE";

  console.log(
    `⚠️ Shot ${shotNumber} - OpenAI ${errorType}, using placeholder for immediate feedback`,
  );
  try {
    const placeholderImage = await generateValidFallbackImage(
      shot.shotDescription || "storyboard frame",
    );
    await storage.updateShotImage(
      shot.id,
      placeholderImage,
      `${errorType}: ${lastError?.message || "OpenAI API issue"}`,
    );
    console.log(
      `📦 Shot ${shotNumber} - Placeholder saved with error type: ${errorType}`,
    );
  } catch (dbError) {
    console.error(
      `💥 Shot ${shotNumber} - Failed to save placeholder:`,
      dbError,
    );
  }

  // Don't throw - let batch continue
  console.log(
    `⏭️ Shot ${shotNumber} - Handled with placeholder, continuing processing`,
  );
}

/**
 * Generate enhanced prompt for image generation using PromptAgent and CharacterAgent
 */
async function generateSafePrompt(shot: any): Promise<string | null> {
  try {
    console.log(`🎯 Generating enhanced prompt for shot:`, {
      id: shot.id,
      description: shot.shotDescription,
    });

    // Use PromptAgent to process the shot data comprehensively
    try {
      console.log(`🎬 Using PromptAgent for comprehensive scene analysis...`);
      const enhancedPrompt = await promptAgent.processExcelRow(shot);
      console.log(
        `📝 PromptAgent generated detailed prompt:`,
        enhancedPrompt.substring(0, 200) + "...",
      );

      // Enhance with character consistency using CharacterAgent
      console.log(`🎭 Enhancing prompt with character memory...`);
      const characterEnhancedPrompt =
        await characterAgent.enhancePromptWithCharacters(enhancedPrompt);

      if (characterEnhancedPrompt && characterEnhancedPrompt.length > 10) {
        return sanitizePrompt(characterEnhancedPrompt);
      }

      return sanitizePrompt(enhancedPrompt);
    } catch (promptAgentError: any) {
      console.error("PromptAgent processing failed:", {
        type: promptAgentError.constructor?.name,
        message: promptAgentError.message,
        status: promptAgentError.status,
      });

      // Fallback to original prompt enhancement system
      console.log("🔄 Falling back to basic prompt enhancement...");
      const basicPrompt = buildShotPrompt(shot);

      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [
            {
              role: "system",
              content: `You are a professional film director creating visual prompts for image generation. 
Transform the shot description into a vivid, cinematic visual prompt suitable for DALL-E 3.
Focus on visual composition, lighting, and mood. Keep it safe and professional.`,
            },
            {
              role: "user",
              content: basicPrompt,
            },
          ],
          max_tokens: 200,
          temperature: 0.7,
        });

        const enhancedPrompt = response.choices[0].message.content?.trim();
        if (enhancedPrompt && enhancedPrompt.length > 10) {
          return sanitizePrompt(enhancedPrompt);
        }
      } catch (fallbackError: any) {
        console.error(
          "Fallback prompt enhancement also failed:",
          fallbackError,
        );
      }

      // Final fallback to basic prompt
      return sanitizePrompt(basicPrompt);
    }
  } catch (error: any) {
    console.error("Prompt generation failed completely, using fallback:", {
      type: error.constructor?.name,
      message: error.message,
    });
    return sanitizePrompt(buildShotPrompt(shot));
  }
}

/**
 * Generate image with retry logic
 */
async function generateImageWithRetry(
  prompt: string,
  attempt: number,
): Promise<string | null> {
  try {
    console.log(
      `🎨 Attempting OpenAI image generation (attempt ${attempt})...`,
    );
    console.log(`📸 Using prompt:`, prompt);

    let response;
    try {
      console.log(`📡 Calling OpenAI DALL-E 3 API with 120-second timeout...`);

      // Create a timeout promise that rejects after 30 seconds
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error("OpenAI API timeout after 120 seconds")),
          120000,
        );
      });

      // Race the API call against the timeout
      response = await Promise.race([
        openai.images.generate({
          model: "dall-e-3",
          prompt: prompt,
          size: "1792x1024",
          quality: "standard",
          n: 1,
        }),
        timeoutPromise,
      ]);
      console.log(`✅ OpenAI responded successfully for attempt ${attempt}`);
    } catch (apiError: any) {
      // Handle API failures with detailed logging
      console.error(`OpenAI API error (attempt ${attempt}):`, {
        type: apiError.constructor?.name,
        message: apiError.message,
        status: apiError.status,
        code: apiError.code,
      });

      // Handle quota exceeded errors specifically
      if (apiError.status === 429 || apiError.code === "insufficient_quota") {
        console.log(
          "🚫 OpenAI quota exceeded - failing immediately with quota error",
        );
        throw new Error("QUOTA_EXCEEDED: OpenAI API quota has been exceeded");
      }

      // Handle BadRequestError for image generation
      if (
        apiError.status === 400 &&
        apiError.type === "image_generation_user_error"
      ) {
        console.log(
          "🚫 OpenAI BadRequestError - API key may not have DALL-E 3 access or prompt issue",
        );
        throw new Error(
          "API_ACCESS_ERROR: OpenAI API key does not have DALL-E 3 image generation access",
        );
      }

      // Let other errors bubble up for retry logic
      throw apiError;
    }

    const imageUrl = (response as any).data?.[0]?.url;
    if (!imageUrl) {
      throw new Error("No image URL returned from OpenAI API response");
    }

    console.log(`✅ OpenAI returned image URL, downloading...`);

    // Download image with error handling - deployment safe
    let imageResponse;
    let arrayBuffer;
    try {
      imageResponse = await fetch(imageUrl, {
        headers: {
          "User-Agent": "IndieShots-Server/1.0",
        },
      });
      if (!imageResponse.ok) {
        throw new Error(
          `Failed to download image: ${imageResponse.status} ${imageResponse.statusText}`,
        );
      }

      // Read the response body only once to prevent "body stream already read" error
      arrayBuffer = await imageResponse.arrayBuffer();
    } catch (downloadError: any) {
      throw new Error(`Image download failed: ${downloadError.message}`);
    }

    const imageBuffer = Buffer.from(arrayBuffer);
    const base64Data = imageBuffer.toString("base64");

    console.log(
      `✅ Image converted to base64 (${base64Data.length} characters)`,
    );
    return base64Data;
  } catch (error: any) {
    console.error(`❌ Image generation failed (attempt ${attempt}):`, {
      type: error.constructor?.name,
      message: error.message,
      stack: error.stack?.split("\n")[0],
    });

    // For content policy errors, try with safer prompt (but still real image generation)
    if (error.message?.includes("content_policy")) {
      console.log(
        `🛡️ Content policy issue detected, trying safe fallback prompt for real image...`,
      );
      const safePrompt =
        "Professional film production still, cinematic lighting, artistic composition";
      try {
        const response = await openai.images.generate({
          model: "dall-e-3",
          prompt: safePrompt,
          size: "1792x1024",
          quality: "standard",
          n: 1,
        });

        const imageUrl = (response as any).data?.[0]?.url;
        if (imageUrl) {
          const imageResponse = await fetch(imageUrl, {
            headers: {
              "User-Agent": "IndieShots-Server/1.0",
            },
          });
          if (imageResponse.ok) {
            const arrayBuffer = await imageResponse.arrayBuffer();
            const imageBuffer = Buffer.from(arrayBuffer);
            console.log(`✅ Safe real image generated successfully`);
            return imageBuffer.toString("base64");
          }
        }
      } catch (fallbackError) {
        console.error("Safe image generation also failed:", fallbackError);
        // Only use placeholder as absolute last resort
        throw error; // Let retry logic handle this
      }
    }

    // For other errors, let retry logic handle them - don't immediately fallback
    throw error;
  }
}

/**
 * Build comprehensive shot prompt from shot data - matches PromptAgent structure
 */
function buildShotPrompt(shot: any): string {
  const baseDescription =
    `Scene Breakdown:\n` +
    `- Shot Type: ${shot.shot_type || shot.shotType || shot["Shot Type"] || "Medium Shot"}\n` +
    `- Lens: ${shot.lens || shot["Lens"] || "50mm"}\n` +
    `- Camera Movement: ${shot.camera_movement || shot.cameraMovement || shot["Movement/Equipment"] || "Static"}\n` +
    `- Location: ${shot.location || shot["Location"] || "Interior"} (${shot.time_of_day || shot.timeOfDay || shot["Time of Day"] || "Day"})\n` +
    `- Mood & Ambience: ${shot.mood_and_ambience || shot.moodAndAmbience || shot["Mood & Ambience"] || "Neutral"}\n` +
    `- Tone: ${shot.tone || shot["Tone"] || "Dramatic"}\n` +
    `- Lighting: ${shot.lighting || shot["Lighting"] || "Natural lighting"}\n` +
    `- Key Props: ${shot.props || shot["Props"] || "Scene props"}\n` +
    `- Sound Design: ${shot.sound_design || shot.soundDesign || shot["Sound Design"] || "Ambient sound"}\n` +
    `- Director's Notes: ${shot.notes || shot["Notes"] || "Standard shot"}\n` +
    `- Action: ${shot.shot_description || shot.shotDescription || shot["Shot Description"] || "Scene action"}\n`;

  return (
    baseDescription +
    "\nCinematic composition, professional cinematography for storyboard visualization."
  );
}

/**
 * Sanitize prompt to avoid content policy violations while preserving film context
 */
function sanitizePrompt(prompt: string): string {
  let cleaned = prompt;

  // Comprehensive film-specific content replacements
  const replacements: { [key: string]: string } = {
    // Violence and weapons
    violent: "intense dramatic",
    violence: "intense drama",
    blood: "red stage makeup",
    bloody: "with red stage effects",
    bleeding: "with red makeup effects",
    weapon: "film prop",
    weapons: "film props",
    gun: "prop firearm",
    guns: "prop firearms",
    pistol: "prop handgun",
    rifle: "prop long gun",
    knife: "prop blade",
    knives: "prop blades",
    sword: "prop sword",
    blade: "prop cutting tool",
    bullet: "prop ammunition",
    bullets: "prop ammunition",
    grenade: "prop explosive",
    bomb: "prop device",
    explosion: "special effects blast",
    explode: "special effects explosion",
    shot: "film shot",
    shoot: "film",
    shooting: "filming",
    fired: "activated prop",
    trigger: "prop mechanism",

    // Death and injury
    death: "dramatic climax",
    dead: "dramatically still",
    die: "dramatic end",
    died: "dramatically concluded",
    dying: "dramatic final scene",
    kill: "dramatically defeat",
    killed: "dramatically defeated",
    killing: "dramatic confrontation",
    murder: "mystery drama",
    murdered: "mystery victim",
    assassin: "mystery character",
    corpse: "dramatic figure",
    body: "dramatic figure",
    wound: "stage makeup effect",
    wounded: "with makeup effects",
    injury: "makeup effect",
    injured: "with stage makeup",
    pain: "dramatic expression",
    suffering: "dramatic performance",
    torture: "intense interrogation scene",
    beaten: "dramatically confronted",
    hit: "dramatic contact",
    punch: "stage combat move",
    kick: "choreographed movement",
    slam: "dramatic impact",
    crush: "dramatic pressure",
    stab: "dramatic thrust motion",
    stabbed: "dramatically struck",
    stabbing: "dramatic thrust scene",
    slash: "dramatic sweep motion",
    cut: "dramatic edit",
    choke: "dramatic grip scene",
    strangle: "dramatic hold scene",

    // Combat and conflict
    attack: "dramatic confrontation",
    attacked: "dramatically confronted",
    attacking: "dramatic confrontation",
    fight: "choreographed action scene",
    fighting: "choreographed action",
    battle: "dramatic conflict scene",
    war: "conflict drama",
    combat: "action choreography",
    enemy: "opposing character",
    threat: "dramatic tension",
    dangerous: "suspenseful",
    terror: "suspense",
    fear: "dramatic tension",
    horror: "suspense genre",
    scary: "suspenseful",
    frightening: "suspenseful",
    aggressive: "intense dramatic",
    brutal: "intense dramatic",
    savage: "intense dramatic",
    vicious: "intense dramatic",
    ruthless: "determined character",

    // Substances and adult content
    drugs: "prop substances",
    alcohol: "prop beverage",
    drunk: "character acting intoxicated",
    smoking: "prop cigarette scene",
    cigarette: "prop cigarette",
    naked: "costume change scene",
    nude: "artistic scene",
    sex: "intimate scene",
    sexual: "romantic scene",

    // General intensity reducers
    extreme: "dramatic",
    intense: "focused dramatic",
    disturbing: "dramatic",
    shocking: "surprising dramatic",
    graphic: "detailed cinematic",
    explicit: "clear cinematic",
    harsh: "stern dramatic",
    rough: "textured cinematic",
  };

  // Apply replacements with word boundaries to avoid partial matches
  for (const [bad, good] of Object.entries(replacements)) {
    // Use word boundaries to ensure we don't replace parts of words
    cleaned = cleaned.replace(new RegExp(`\\b${bad}\\b`, "gi"), good);
  }

  // Additional safety measures
  cleaned = cleaned.replace(
    /\b(very|extremely|ultra|super)\s+(violent|bloody|graphic|brutal|savage)\b/gi,
    "dramatically intense",
  );
  cleaned = cleaned.replace(
    /\b(gore|gory|gruesome)\b/gi,
    "dramatic special effects",
  );
  cleaned = cleaned.replace(
    /\b(massacre|slaughter|carnage)\b/gi,
    "dramatic conflict scene",
  );

  // Ensure cinematic context is clear
  if (
    cleaned.includes("dramatic") ||
    cleaned.includes("prop") ||
    cleaned.includes("stage")
  ) {
    cleaned = `Professional film production scene: ${cleaned}`;
  }

  return cleaned;
}

/**
 * Generate fallback placeholder image when OpenAI API fails
 * This creates a recognizable placeholder that indicates API unavailability
 */
async function generateFallbackImage(prompt: string): Promise<string> {
  console.log(
    "🔄 Creating fallback placeholder due to OpenAI API unavailability...",
  );

  // Create a recognizable placeholder that indicates this is temporary
  // This is a simple gray rectangle with "API Unavailable" text indicator
  const placeholderBase64 =
    "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAFBSURBVFiFtZe9SwMxFMafS1sHwUVwcHBwcXBwcXBwcHBwcXBwcHBwcXBwcHBwcXBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBawAAAABJRU5ErkJggg==";

  console.log("📦 Fallback placeholder created - API temporarily unavailable");
  return placeholderBase64;
}
