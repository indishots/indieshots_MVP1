import { OpenAI } from 'openai';

// Create OpenAI client dynamically to pick up fresh environment variables
function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key not found in environment variables');
  }
  return new OpenAI({ apiKey });
}

/**
 * Generate demo shots when OpenAI API is unavailable
 */
function generateDemoShots(prompt: string): string {
  console.log('🎬 Generating professional demo shots for scene analysis');
  
  // Analyze scene content for context
  const isInterior = prompt.toLowerCase().includes('int.') || prompt.toLowerCase().includes('interior');
  const isExterior = prompt.toLowerCase().includes('ext.') || prompt.toLowerCase().includes('exterior');
  const isDialogue = prompt.toLowerCase().includes('dialogue') || prompt.includes(':');
  const isAction = prompt.toLowerCase().includes('action') || prompt.toLowerCase().includes('runs') || prompt.toLowerCase().includes('fight');
  
  // Generate contextual shots based on scene content
  const shotTemplates = [];
  
  // Establishing shot
  if (isExterior) {
    shotTemplates.push("Wide shot establishing exterior location|Wide Shot|24mm|Static|Atmospheric|Natural lighting|Environmental props|Establish location and mood|Ambient environmental sound|Daylight 5600K|Establishing|Location setting|Scene opens|No dialogue");
  } else {
    shotTemplates.push("Wide shot establishing interior space|Wide Shot|28mm|Slow push-in|Intimate|Practical lighting|Room furnishings|Set the scene context|Room tone|Warm 3200K|Establishing|Interior space|Characters enter|No dialogue");
  }
  
  // Character introduction
  shotTemplates.push("Medium shot introducing main character|Medium Shot|50mm|Slight zoom-in|Focused|Key lighting|Character props|Character introduction|Clear audio|Neutral 5600K|Engaging|Main character|Character appears|Character speaks");
  
  // Dialogue coverage if dialogue detected
  if (isDialogue) {
    shotTemplates.push("Over-shoulder shot during conversation|Over-Shoulder|85mm|Static|Conversational|Three-point lighting|Scene props|Dialogue coverage|Clean dialogue|Neutral 5600K|Intimate|Both characters|Conversation unfolds|Main dialogue");
    shotTemplates.push("Reverse angle for dialogue response|Reverse Shot|85mm|Static|Emotional|Soft key lighting|Minimal props|Reaction coverage|Clear speech|Warm 3200K|Responsive|Secondary character|Character reacts|Response dialogue");
  }
  
  // Action shots if action detected
  if (isAction) {
    shotTemplates.push("Dynamic tracking shot following action|Tracking Shot|35mm|Handheld follow|High energy|Available lighting|Action props|Movement dynamics|Action sounds|Variable temp|Energetic|Active characters|Action sequence|Action dialogue");
  }
  
  // Close-up for emotion
  shotTemplates.push("Close-up capturing character emotion|Close-Up|100mm|Static|Emotional intensity|Soft lighting|Minimal props|Emotional beat|Subtle background|Warm 3200K|Emotional|Key character|Emotional moment|Internal thought");
  
  // Insert/detail shot
  shotTemplates.push("Insert shot of important detail|Insert|100mm Macro|Static|Detailed focus|Focused lighting|Key prop|Story element|Minimal sound|Cool 5600K|Mysterious|Object focus|Detail reveals|No dialogue");
  
  // Cutaway shot
  shotTemplates.push("Cutaway shot for context|Cutaway|50mm|Static|Contextual|Natural lighting|Environmental props|Scene context|Ambient sound|Natural temp|Neutral|Scene element|Provides context|No dialogue");
  
  // Select 5-7 shots based on scene type
  const selectedShots = shotTemplates.slice(0, Math.min(7, shotTemplates.length));
  
  return selectedShots.join('\n');
}

export interface ShotData {
  shotNumber: number;
  shotDescription: string;
  shotType: string;
  lens: string;
  movement: string;
  moodAndAmbience: string;
  lighting: string;
  props: string;
  notes: string;
  soundDesign: string;
  colourTemp: string;
  location: string;
  timeOfDay: string;
  tone: string;
  characters: string;
  action: string;
  dialogue: string;
  estimatedDuration?: number;
}

interface Context {
  location: string;
  timeOfDay: string;
  ambience?: string;
  lightingStyle?: string;
  colorScheme?: string;
}

/**
 * Generate GPT-4 response for shot division
 */
async function gpt4Response(prompt: string): Promise<string> {
  // Check if OpenAI API key is available
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log('🎬 Using demo shot generation - no API key configured');
    return generateDemoShots(prompt);
  }
  
  try {
    // Get fresh OpenAI client with current environment variables
    const client = getOpenAIClient();
    
    console.log('🔑 OpenAI API key loaded:', {
      exists: !!apiKey,
      length: apiKey.length,
      prefix: apiKey.substring(0, 15) + '...'
    });

    const response = await client.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a professional cinematographer and shot list expert. Always follow formatting instructions precisely.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 2000,
      temperature: 0.3
    });

    return response.choices[0].message.content?.trim() || '';
  } catch (error: any) {
    console.error('🚨 OpenAI API error details:', {
      message: error.message,
      status: error.status,
      code: error.code,
      type: error.type
    });
    
    // Use demo shots as fallback for any API issues
    console.log('🎬 Using demo shot generation due to API error');
    return generateDemoShots(prompt);
  }
}

/**
 * Extract shots from GPT-4 response text
 */
function extractShotsFromResponse(responseText: string): Partial<ShotData>[] {
  const shots: Partial<ShotData>[] = [];
  
  for (const line of responseText.split('\n')) {
    if (line.trim()) {
      const parts = line.split('|').map(part => part.trim());
      if (parts.length === 14) {
        const [shotDescription, shotType, lens, movement, mood, lighting, props, notes, sound, temp, tone, characters, action, dialogue] = parts;
        
        // Skip header rows or placeholder data
        if (shotDescription === 'Shot Description' || shotType === 'Shot Type' || lens === 'Lens') {
          continue;
        }
        
        shots.push({
          shotDescription,
          shotType,
          lens,
          movement,
          moodAndAmbience: mood,
          lighting,
          props,
          notes,
          soundDesign: sound,
          colourTemp: temp,
          tone,
          characters,
          action,
          dialogue
        });
      }
    }
  }
  
  return shots;
}

/**
 * Split text into paragraphs for processing
 */
function splitIntoParagraphs(text: string): string[] {
  return text.split('\n\n').map(p => p.trim()).filter(p => p.length > 0);
}

/**
 * Process a single paragraph into shots
 */
async function processParagraph(
  paragraph: string, 
  context: Context, 
  sceneHeading: string, 
  sceneNumber: number, 
  startIndex: number
): Promise<ShotData[]> {
  const prompt = `Create cinematic shots for this scene. Use professional filmmaking terminology. Format each shot as a pipe-separated row:

Shot Description | Shot Type | Lens | Movement | Mood & Ambience | Lighting | Props | Notes | Sound Design | Colour Temp | Tone | Characters | Action | Dialogue

Requirements:
- Use clear, descriptive shot descriptions without numbering (e.g., "Woman walking alone in alley" not "Shot 1: Woman walking")
- Use standard shot types: Wide Shot, Medium Shot, Close-up, Over-the-shoulder, Two-shot, etc.
- Use specific lens values: 24mm, 35mm, 50mm, 85mm, 135mm
- Use standard camera movements: Static, Pan, Tilt, Dolly, Handheld, Crane, Tracking
- Be consistent with mood, lighting, and color temperature descriptions
- Provide dramatic tone for each shot: Suspenseful, Mysterious, Romantic, Tense, Peaceful, Dramatic, etc.
- List characters present in each shot (e.g., "Woman, Boy" or "Narrator")
- Describe the main action happening in the shot (e.g., "Walking", "Looking around", "Speaking")
- Include any dialogue spoken in the shot (leave blank if no dialogue)
- Cover all important story beats and character interactions in the scene

Scene Text: ${paragraph}
Scene Heading: ${sceneHeading}
Location: ${context.location}
Time: ${context.timeOfDay}`;

  try {
    const response = await gpt4Response(prompt);
    const shots = extractShotsFromResponse(response);
    
    return shots.map((shot, i) => ({
      shotNumber: startIndex + i + 1,
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
      tone: shot.tone || '',
      characters: shot.characters || '',
      action: shot.action || '',
      dialogue: shot.dialogue || '',
      location: context.location,
      timeOfDay: context.timeOfDay,
      estimatedDuration: 3 // Default duration in seconds
    }));
  } catch (error) {
    console.error('Error processing paragraph:', error);
    return [];
  }
}

/**
 * Extract location and time info from scene heading
 */
function extractSceneHeadingInfo(text: string): { location: string; timeOfDay: string } {
  const firstLine = text.trim().split('\n')[0].toUpperCase();
  const timeKeywords = ['DAY', 'NIGHT', 'EVENING', 'MORNING', 'AFTERNOON', 'DAWN', 'DUSK'];
  
  let location = "Unspecified Location";
  let timeOfDay = "Unspecified";

  const parts = firstLine.replace("EXT.", "").replace("INT.", "").trim().split(/\s+/);
  
  for (const word of parts) {
    if (timeKeywords.includes(word)) {
      timeOfDay = word;
    } else if (location === "Unspecified Location" && word.length > 2) {
      location = word;
    }
  }

  return { 
    location: location.charAt(0) + location.slice(1).toLowerCase(), 
    timeOfDay: timeOfDay.charAt(0) + timeOfDay.slice(1).toLowerCase() 
  };
}

/**
 * Generate shots from scene text using AI
 */
export async function generateShotsFromScene(
  sceneText: string,
  sceneHeading: string,
  sceneNumber: number
): Promise<ShotData[]> {
  try {
    // Extract scene context
    const { location, timeOfDay } = extractSceneHeadingInfo(sceneText);
    const context: Context = {
      location,
      timeOfDay,
      ambience: 'general',
      lightingStyle: 'general',
      colorScheme: 'general'
    };

    // Split scene into paragraphs
    const paragraphs = splitIntoParagraphs(sceneText);
    const allShots: ShotData[] = [];

    // Process paragraphs sequentially to maintain shot numbering
    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i];
      const startIndex = allShots.length;
      
      const shots = await processParagraph(
        paragraph, 
        context, 
        sceneHeading, 
        sceneNumber, 
        startIndex
      );
      
      allShots.push(...shots);
    }

    return allShots;
  } catch (error) {
    console.error('Error generating shots from scene:', error);
    throw new Error('Failed to generate shots from scene');
  }
}