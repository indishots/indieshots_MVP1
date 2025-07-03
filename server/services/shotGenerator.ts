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
  console.log('🎬 Generating demo shots for prompt preview');
  
  // Create realistic shot list response for demonstration
  const demoShots = [
    "Wide shot establishing the scene|Wide Shot|24mm|Static|Dramatic and tense|Natural lighting|Props as per scene|Opening shot to establish location|Ambient room tone|Warm 3200K|Serious|Characters present|Scene action begins|Initial dialogue",
    "Medium shot on main character|Medium Shot|50mm|Slight push-in|Focused and intimate|Key lighting|Character props|Focus on character emotion|Clear dialogue|Neutral 5600K|Contemplative|Main character|Character reaction|Character speaks",
    "Close-up reaction shot|Close-Up|85mm|Static|Emotional intensity|Soft lighting|Minimal props|Capture emotional response|Subtle background|Warm 3200K|Emotional|Secondary character|Emotional reaction|Reaction dialogue",
    "Over-shoulder conversation|Over-Shoulder|50mm|Slow pan|Conversational|Three-point lighting|Scene props|Dialogue coverage|Clean audio|Neutral 5600K|Engaging|Both characters|Conversation continues|Main dialogue exchange",
    "Insert shot detail|Insert|100mm macro|Static|Detailed focus|Focused lighting|Key prop|Important story element|Minimal sound|Cool 5600K|Mysterious|Props focus|Detail reveals information|No dialogue"
  ];
  
  return demoShots.join('\n');
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
  try {
    // Get fresh OpenAI client with current environment variables
    const client = getOpenAIClient();
    
    // Log API key info for debugging
    const apiKey = process.env.OPENAI_API_KEY;
    console.log('🔑 OpenAI API key loaded:', {
      exists: !!apiKey,
      length: apiKey?.length || 0,
      prefix: apiKey?.substring(0, 15) + '...' || 'none'
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
    
    // Check if it's an authentication error
    if (error.status === 401 || error.code === 'invalid_api_key') {
      console.log('🎬 Using demo shot generation due to API key issue');
      return generateDemoShots(prompt);
    }
    
    // For other errors, provide more context
    throw new Error(`OpenAI API error: ${error.message || 'Unknown error'}`);
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