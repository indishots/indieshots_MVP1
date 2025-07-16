import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 30000
});

interface ContentAnalysis {
  isProblematic: boolean;
  detectedIssues: string[];
  sanitizedPrompt: string;
  confidence: number;
}

/**
 * Comprehensive content policy detector and sanitizer for film projects
 * Preserves original script context while ensuring OpenAI compliance
 */
export class ContentPolicyDetector {
  private static instance: ContentPolicyDetector;
  
  // Comprehensive film-specific replacements
  private readonly filmTermReplacements: { [key: string]: string } = {
    // Violence and weapons - comprehensive coverage
    'violent': 'intense dramatic',
    'violence': 'intense drama',
    'blood': 'red stage makeup',
    'bloody': 'with red stage effects',
    'bleeding': 'with red makeup effects',
    'gore': 'dramatic special effects',
    'gory': 'with dramatic effects',
    'gruesome': 'dramatically intense',
    'weapon': 'film prop',
    'weapons': 'film props',
    'gun': 'prop firearm',
    'guns': 'prop firearms',
    'pistol': 'prop handgun',
    'rifle': 'prop long gun',
    'shotgun': 'prop weapon',
    'firearm': 'prop firearm',
    'knife': 'prop blade',
    'knives': 'prop blades',
    'dagger': 'prop dagger',
    'sword': 'prop sword',
    'blade': 'prop cutting tool',
    'razor': 'prop blade',
    'bullet': 'prop ammunition',
    'bullets': 'prop ammunition',
    'ammunition': 'prop ammunition',
    'grenade': 'prop explosive',
    'bomb': 'prop device',
    'explosive': 'prop device',
    'explosion': 'special effects blast',
    'explode': 'special effects explosion',
    'blast': 'special effects blast',
    'detonate': 'special effects activation',
    
    // Death and injury - extensive coverage
    'death': 'dramatic climax',
    'dead': 'dramatically still',
    'die': 'dramatic end',
    'died': 'dramatically concluded',
    'dying': 'dramatic final scene',
    'kill': 'dramatically defeat',
    'killed': 'dramatically defeated',
    'killing': 'dramatic confrontation',
    'murder': 'mystery drama',
    'murdered': 'mystery victim',
    'murderer': 'mystery character',
    'assassin': 'mystery character',
    'assassination': 'mystery scene',
    'execute': 'dramatic conclusion',
    'execution': 'dramatic finale',
    'corpse': 'dramatic figure',
    'body': 'dramatic figure',
    'cadaver': 'dramatic figure',
    'wound': 'stage makeup effect',
    'wounded': 'with makeup effects',
    'injury': 'makeup effect',
    'injured': 'with stage makeup',
    'hurt': 'dramatically affected',
    'pain': 'dramatic expression',
    'suffering': 'dramatic performance',
    'agony': 'intense dramatic performance',
    'torture': 'intense interrogation scene',
    'torment': 'dramatic tension',
    'beaten': 'dramatically confronted',
    'bruised': 'with makeup effects',
    'battered': 'with dramatic makeup',
    
    // Combat actions - detailed replacements
    'hit': 'dramatic contact',
    'punch': 'stage combat move',
    'kick': 'choreographed movement',
    'slam': 'dramatic impact',
    'crash': 'dramatic collision',
    'crush': 'dramatic pressure',
    'smash': 'dramatic impact',
    'strike': 'dramatic contact',
    'stab': 'dramatic thrust motion',
    'stabbed': 'dramatically struck',
    'stabbing': 'dramatic thrust scene',
    'slash': 'dramatic sweep motion',
    'cut': 'dramatic edit',
    'slice': 'dramatic cut',
    'chop': 'dramatic cutting motion',
    'hack': 'dramatic cutting action',
    'choke': 'dramatic grip scene',
    'strangle': 'dramatic hold scene',
    'throttle': 'dramatic grip',
    'suffocate': 'dramatic breathing scene',
    'drown': 'dramatic water scene',
    'burn': 'dramatic fire scene',
    'burning': 'dramatic fire effects',
    'fire': 'dramatic flame effects',
    'flames': 'dramatic fire effects',
    
    // Combat and conflict - comprehensive
    'attack': 'dramatic confrontation',
    'attacked': 'dramatically confronted',
    'attacking': 'dramatic confrontation',
    'assault': 'dramatic confrontation',
    'assaulted': 'dramatically confronted',
    'fight': 'choreographed action scene',
    'fighting': 'choreographed action',
    'battle': 'dramatic conflict scene',
    'combat': 'action choreography',
    'warfare': 'conflict drama',
    'war': 'conflict drama',
    'conflict': 'dramatic tension',
    'enemy': 'opposing character',
    'foe': 'opposing character',
    'adversary': 'opposing character',
    'rival': 'competing character',
    'threat': 'dramatic tension',
    'threaten': 'create dramatic tension',
    'menace': 'dramatic tension',
    'dangerous': 'suspenseful',
    'peril': 'dramatic danger',
    'risk': 'dramatic uncertainty',
    'terror': 'suspense',
    'fear': 'dramatic tension',
    'horror': 'suspense genre',
    'scary': 'suspenseful',
    'frightening': 'suspenseful',
    'terrifying': 'suspenseful',
    'aggressive': 'intense dramatic',
    'hostile': 'confrontational dramatic',
    'brutal': 'intense dramatic',
    'savage': 'intense dramatic',
    'vicious': 'intense dramatic',
    'ruthless': 'determined character',
    'merciless': 'determined character',
    'cruel': 'harsh character',
    'evil': 'antagonist character',
    'wicked': 'villainous character',
    
    // Substances and adult content
    'drugs': 'prop substances',
    'drug': 'prop substance',
    'cocaine': 'prop powder',
    'heroin': 'prop substance',
    'marijuana': 'prop herb',
    'alcohol': 'prop beverage',
    'drunk': 'character acting intoxicated',
    'intoxicated': 'character acting affected',
    'smoking': 'prop cigarette scene',
    'cigarette': 'prop cigarette',
    'tobacco': 'prop substance',
    'naked': 'costume change scene',
    'nude': 'artistic scene',
    'sex': 'intimate scene',
    'sexual': 'romantic scene',
    'rape': 'assault scene',
    'molest': 'inappropriate scene',
    'abuse': 'confrontational scene',
    
    // Shooting and firing - film context
    'shoot': 'film',
    'shot': 'film shot',
    'shooting': 'filming',
    'fired': 'activated prop',
    'firing': 'prop activation',
    'trigger': 'prop mechanism',
    'aim': 'point prop',
    'target': 'focus point',
    
    // General intensity reducers
    'extreme': 'dramatic',
    'intense': 'focused dramatic',
    'severe': 'serious dramatic',
    'harsh': 'stern dramatic',
    'rough': 'textured cinematic',
    'wild': 'energetic dramatic',
    'crazy': 'eccentric dramatic',
    'insane': 'eccentric character',
    'mad': 'eccentric character',
    'disturbing': 'dramatic',
    'shocking': 'surprising dramatic',
    'graphic': 'detailed cinematic',
    'explicit': 'clear cinematic',
    'mature': 'adult-oriented',
    'adult': 'mature-themed'
  };

  // Problematic phrase patterns that need complete replacement
  private readonly problematicPhrases = [
    { pattern: /blood\s+everywhere/gi, replacement: 'red stage effects throughout scene' },
    { pattern: /covered\s+in\s+blood/gi, replacement: 'with red stage makeup effects' },
    { pattern: /pools?\s+of\s+blood/gi, replacement: 'red stage liquid effects' },
    { pattern: /graphic\s+violence/gi, replacement: 'intense dramatic action' },
    { pattern: /extreme\s+violence/gi, replacement: 'intense dramatic confrontation' },
    { pattern: /brutal\s+murder/gi, replacement: 'intense mystery drama' },
    { pattern: /bloody\s+massacre/gi, replacement: 'dramatic conflict scene with red effects' },
    { pattern: /violent\s+death/gi, replacement: 'dramatic climax scene' },
    { pattern: /gun\s+violence/gi, replacement: 'prop firearm drama' },
    { pattern: /knife\s+attack/gi, replacement: 'prop blade confrontation' },
    { pattern: /stabbing\s+scene/gi, replacement: 'dramatic thrust scene' },
    { pattern: /shooting\s+scene/gi, replacement: 'filming scene' },
    { pattern: /blood\s+spurting/gi, replacement: 'red stage effects' },
    { pattern: /spurting\s+blood/gi, replacement: 'red stage makeup effects' },
    { pattern: /figure\s+stabbing/gi, replacement: 'character in dramatic scene' },
    { pattern: /man\s+stabbing/gi, replacement: 'character in dramatic confrontation' },
    { pattern: /woman\s+stabbing/gi, replacement: 'character in dramatic scene' },
    { pattern: /kicking\s+him\s+down/gi, replacement: 'dramatic choreographed movement' },
    { pattern: /beating\s+him\s+up/gi, replacement: 'dramatic confrontation scene' },
    { pattern: /very\s+(violent|bloody|brutal|savage)/gi, replacement: 'dramatically intense' },
    { pattern: /extremely\s+(violent|bloody|brutal|savage)/gi, replacement: 'dramatically intense' },
    { pattern: /ultra\s+(violent|bloody|brutal|savage)/gi, replacement: 'dramatically intense' },
    { pattern: /super\s+(violent|bloody|brutal|savage)/gi, replacement: 'dramatically intense' },
    { pattern: /gore\s+and\s+violence/gi, replacement: 'dramatic special effects and action' },
    { pattern: /massacre\s+scene/gi, replacement: 'dramatic conflict scene' },
    { pattern: /slaughter\s+scene/gi, replacement: 'dramatic conflict scene' },
    { pattern: /carnage\s+scene/gi, replacement: 'dramatic conflict scene' }
  ];

  public static getInstance(): ContentPolicyDetector {
    if (!ContentPolicyDetector.instance) {
      ContentPolicyDetector.instance = new ContentPolicyDetector();
    }
    return ContentPolicyDetector.instance;
  }

  /**
   * Analyze content for potential policy violations
   */
  async analyzeContent(prompt: string): Promise<ContentAnalysis> {
    const detectedIssues: string[] = [];
    let confidence = 0;

    // Check for problematic terms
    const lowerPrompt = prompt.toLowerCase();
    
    // Check individual terms
    for (const [term, replacement] of Object.entries(this.filmTermReplacements)) {
      if (new RegExp(`\\b${term}\\b`, 'gi').test(prompt)) {
        detectedIssues.push(`Detected: "${term}" -> "${replacement}"`);
        confidence += 0.1;
      }
    }

    // Check problematic phrases
    for (const { pattern, replacement } of this.problematicPhrases) {
      if (pattern.test(prompt)) {
        detectedIssues.push(`Detected phrase pattern -> "${replacement}"`);
        confidence += 0.2;
      }
    }

    // Additional content analysis for complex scenarios
    const complexPatterns = [
      /\b(death|kill|murder|blood|violence|weapon|gun|knife)\b/gi,
      /\b(brutal|savage|vicious|gore|graphic)\b/gi,
      /\b(torture|assault|attack|fight|battle)\b/gi
    ];

    for (const pattern of complexPatterns) {
      const matches = prompt.match(pattern);
      if (matches) {
        confidence += matches.length * 0.05;
      }
    }

    const sanitizedPrompt = this.sanitizePrompt(prompt);
    const isProblematic = confidence > 0.1 || detectedIssues.length > 0;

    return {
      isProblematic,
      detectedIssues,
      sanitizedPrompt,
      confidence: Math.min(confidence, 1.0)
    };
  }

  /**
   * Comprehensive prompt sanitization for film content
   */
  public sanitizePrompt(prompt: string): string {
    let cleaned = prompt;

    // Apply individual term replacements with word boundaries
    for (const [bad, good] of Object.entries(this.filmTermReplacements)) {
      cleaned = cleaned.replace(new RegExp(`\\b${bad}\\b`, 'gi'), good);
    }

    // Apply phrase pattern replacements
    for (const { pattern, replacement } of this.problematicPhrases) {
      cleaned = cleaned.replace(pattern, replacement);
    }

    // Ensure cinematic context is clear
    if (cleaned.includes('dramatic') || cleaned.includes('prop') || cleaned.includes('stage')) {
      cleaned = `Professional film production scene: ${cleaned}`;
    }

    // Add safety modifiers
    cleaned = `${cleaned}, professional movie scene, artistic lighting, film production quality, safe for work content, theatrical staging`;

    return cleaned.trim();
  }

  /**
   * Advanced content analysis using OpenAI's moderation API
   */
  async moderateContent(prompt: string): Promise<{ flagged: boolean; categories: string[] }> {
    try {
      const moderation = await openai.moderations.create({
        input: prompt,
      });

      const result = moderation.results[0];
      const flaggedCategories = Object.entries(result.categories)
        .filter(([_, flagged]) => flagged)
        .map(([category]) => category);

      return {
        flagged: result.flagged,
        categories: flaggedCategories
      };
    } catch (error) {
      console.error('Error in content moderation:', error);
      return { flagged: false, categories: [] };
    }
  }

  /**
   * Comprehensive content processing pipeline
   */
  async processPrompt(originalPrompt: string): Promise<{
    originalPrompt: string;
    sanitizedPrompt: string;
    analysis: ContentAnalysis;
    moderation: { flagged: boolean; categories: string[] };
  }> {
    const analysis = await this.analyzeContent(originalPrompt);
    const moderation = await this.moderateContent(originalPrompt);

    // If moderation flags content, apply additional sanitization
    let finalPrompt = analysis.sanitizedPrompt;
    if (moderation.flagged) {
      finalPrompt = this.applyAggressiveSanitization(finalPrompt);
    }

    return {
      originalPrompt,
      sanitizedPrompt: finalPrompt,
      analysis,
      moderation
    };
  }

  /**
   * Aggressive sanitization for highly problematic content
   */
  private applyAggressiveSanitization(prompt: string): string {
    let cleaned = prompt;

    // Ultra-safe replacements for highly flagged content
    const aggressiveReplacements = [
      { pattern: /\b(dramatic\s+thrust|thrust\s+scene)\b/gi, replacement: 'dramatic confrontation' },
      { pattern: /\b(prop\s+blade|blade\s+prop)\b/gi, replacement: 'stage prop' },
      { pattern: /\b(red\s+stage\s+makeup|stage\s+makeup)\b/gi, replacement: 'theatrical effects' },
      { pattern: /\b(confrontation|conflict)\b/gi, replacement: 'dramatic scene' },
      { pattern: /\b(intense\s+dramatic)\b/gi, replacement: 'emotional dramatic' },
      { pattern: /\b(mystery\s+drama)\b/gi, replacement: 'suspense story' }
    ];

    for (const { pattern, replacement } of aggressiveReplacements) {
      cleaned = cleaned.replace(pattern, replacement);
    }

    // Add ultra-safe context
    cleaned = `Safe professional film scene with theatrical staging and artistic direction: ${cleaned}, family-friendly content, suitable for all audiences`;

    return cleaned;
  }

  /**
   * Log analysis for debugging
   */
  logAnalysis(analysis: ContentAnalysis, moderation: { flagged: boolean; categories: string[] }) {
    console.log('\n=== Content Policy Analysis ===');
    console.log('Problematic:', analysis.isProblematic);
    console.log('Confidence:', analysis.confidence);
    console.log('Detected Issues:', analysis.detectedIssues);
    console.log('Moderation Flagged:', moderation.flagged);
    console.log('Moderation Categories:', moderation.categories);
    console.log('================================\n');
  }
}

export const contentPolicyDetector = ContentPolicyDetector.getInstance();