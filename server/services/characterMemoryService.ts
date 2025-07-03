import { OpenAI } from 'openai';
import * as fs from 'fs';
import * as path from 'path';

const characterClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const CHARACTER_MEMORY_FILE = path.join(process.cwd(), 'memory', 'character_memory.json');

interface CharacterMemory {
  [characterName: string]: string;
}

export class CharacterMemoryService {
  private characterMemory: CharacterMemory = {};

  constructor() {
    this.loadMemory();
  }

  /**
   * Load character memory from file
   */
  private loadMemory(): void {
    try {
      if (fs.existsSync(CHARACTER_MEMORY_FILE)) {
        const content = fs.readFileSync(CHARACTER_MEMORY_FILE, 'utf-8').trim();
        if (content) {
          this.characterMemory = JSON.parse(content);
          console.log(`[CharacterMemory] Loaded ${Object.keys(this.characterMemory).length} characters from memory`);
        } else {
          console.log('[CharacterMemory] Memory file is empty, initializing fresh memory');
          this.characterMemory = {};
        }
      } else {
        console.log('[CharacterMemory] No memory file found, starting with empty memory');
        this.characterMemory = {};
      }
    } catch (error) {
      console.error('[CharacterMemory] Error loading memory, starting fresh:', error);
      this.characterMemory = {};
    }
  }

  /**
   * Save character memory to file
   */
  private saveMemory(): void {
    try {
      // Ensure memory directory exists
      const memoryDir = path.dirname(CHARACTER_MEMORY_FILE);
      if (!fs.existsSync(memoryDir)) {
        fs.mkdirSync(memoryDir, { recursive: true });
      }

      fs.writeFileSync(CHARACTER_MEMORY_FILE, JSON.stringify(this.characterMemory, null, 2));
      console.log(`[CharacterMemory] Saved ${Object.keys(this.characterMemory).length} characters to memory`);
    } catch (error) {
      console.error('[CharacterMemory] Error saving memory:', error);
    }
  }

  /**
   * Extract human character names from scene description using GPT-4
   */
  async extractCharacters(prompt: string): Promise<string[]> {
    try {
      console.log('[CharacterMemory] Extracting characters from prompt...');
      
      const response = await characterClient.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an AI assistant that extracts only the names of human characters from cinematic prompts. Return only a Python list of unique names. No explanations.'
          },
          {
            role: 'user',
            content: `Extract a list of human character names from this scene description:\n\n${prompt}\n\nReturn only the names as a Python list of strings. Example: ['John', 'Alice']`
          }
        ],
        max_tokens: 200,
        temperature: 0.3
      });

      const content = response.choices[0].message.content?.trim();
      if (!content) {
        console.log('[CharacterMemory] No characters extracted');
        return [];
      }

      // Parse the response as a Python list
      try {
        // Clean up the response to ensure it's valid JSON
        const cleanedContent = content
          .replace(/'/g, '"')  // Replace single quotes with double quotes
          .replace(/\[([^\]]+)\]/g, (_match, inside) => {
            // Ensure proper JSON array format
            return `[${inside.split(',').map((item: string) => `"${item.trim().replace(/"/g, '')}"`).join(', ')}]`;
          });

        const characterList = JSON.parse(cleanedContent);
        
        if (Array.isArray(characterList)) {
          console.log(`[CharacterMemory] Extracted characters: ${characterList.join(', ')}`);
          return characterList.filter(name => typeof name === 'string' && name.trim().length > 0);
        }
      } catch (parseError) {
        console.error('[CharacterMemory] Error parsing character list:', parseError);
        // Try to extract names manually as fallback
        const manualExtraction = content.match(/['"]([^'"]+)['"]/g);
        if (manualExtraction) {
          const names = manualExtraction.map(match => match.replace(/['"]/g, ''));
          console.log(`[CharacterMemory] Manual extraction fallback: ${names.join(', ')}`);
          return names;
        }
      }

      return [];
    } catch (error) {
      console.error('[CharacterMemory] Error extracting characters:', error);
      return [];
    }
  }

  /**
   * Get or generate detailed character description
   */
  async getOrGenerateDescription(character: string): Promise<string> {
    // Check if character already exists in memory
    if (this.characterMemory[character]) {
      console.log(`[CharacterMemory] Using existing description for: ${character}`);
      return this.characterMemory[character];
    }

    console.log(`[CharacterMemory] Generating new description for: ${character}`);
    
    try {
      const response = await characterClient.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are a character designer. Generate a detailed vivid visual description of a human character for a cinematic animated graphic novel. Mention gender, outfit, face, and overall vibe in 100-150 words. The character descriptions must be detailed capturing every aspect of their look perfectly. The description should include the look of their eyes, hair, face, age, clothing etc. Based on what the name is, think of a good description that will suit them. Every description should be highly detailed capturing every aspect of their look.`
          },
          {
            role: 'user',
            content: `Describe the appearance of a person named ${character}.`
          }
        ],
        max_tokens: 300,
        temperature: 0.7
      });

      const description = response.choices[0].message.content?.trim();
      if (description && description.length > 10) {
        // Store in memory
        this.characterMemory[character] = description;
        this.saveMemory();
        
        console.log(`[CharacterMemory] Generated and stored description for: ${character}`);
        return description;
      } else {
        console.log(`[CharacterMemory] Generated description too short for: ${character}`);
        return `A person named ${character} with undefined features`;
      }
    } catch (error) {
      console.error(`[CharacterMemory] Error generating description for ${character}:`, error);
      return `A person named ${character} with undefined features`;
    }
  }

  /**
   * Build enhanced prompt with character consistency
   */
  async buildEnhancedPrompt(basePrompt: string): Promise<string> {
    try {
      let characters: string[] = [];
      
      // First, try to extract characters from the Characters: field if it exists
      const charactersMatch = basePrompt.match(/Characters:\s*([^\n]+)/);
      if (charactersMatch && charactersMatch[1].trim() !== 'None') {
        characters = charactersMatch[1]
          .split(',')
          .map(char => char.trim())
          .filter(char => char.length > 0);
        console.log('[CharacterMemory] Found characters in prompt:', characters);
      } else {
        // Fallback to GPT-4 extraction from the full prompt
        characters = await this.extractCharacters(basePrompt);
      }
      
      if (characters.length === 0) {
        console.log('[CharacterMemory] No characters found, using base prompt');
        return basePrompt;
      }

      // Get or generate descriptions for all characters
      const characterDescriptions: string[] = [];
      for (const character of characters) {
        const description = await this.getOrGenerateDescription(character);
        characterDescriptions.push(`${character}: ${description}`);
      }

      // Build enhanced prompt with character block
      const characterBlock = characterDescriptions.join('\n');
      const enhancedPrompt = `${basePrompt}\n\nCharacter Appearances:\n${characterBlock}`;

      console.log(`[CharacterMemory] Enhanced prompt with ${characters.length} characters`);
      return enhancedPrompt;
    } catch (error) {
      console.error('[CharacterMemory] Error building enhanced prompt:', error);
      return basePrompt;
    }
  }

  /**
   * Get memory stats for debugging
   */
  getMemoryStats(): { characterCount: number; characters: string[] } {
    const characters = Object.keys(this.characterMemory);
    return {
      characterCount: characters.length,
      characters: characters
    };
  }
}

// Export singleton instance
export const characterMemoryService = new CharacterMemoryService();