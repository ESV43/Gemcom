import { ApiProvider, ModelOption } from './types';

// Standardized environment variable name
export const GEMINI_API_KEY_ENV_VAR = 'GEMINI_API_KEY';

// --- Model Definitions ---
// Text & Multimodal Models
export const GEMINI_1_5_FLASH_LATEST = 'gemini-1.5-flash-latest';
export const GEMINI_1_5_PRO_LATEST = 'gemini-1.5-pro-latest';
// Image Generation Models
export const GEMINI_IMAGEN_3 = 'imagen-3.0-generate-002'; // A placeholder, actual Imagen models might differ

// --- Default Model Lists ---
export const DEFAULT_TEXT_MODELS: ModelOption[] = [
  { id: GEMINI_1_5_FLASH_LATEST, name: `Gemini 1.5 Flash`, provider: ApiProvider.GEMINI, isCharacterAnalyzer: true },
  { id: GEMINI_1_5_PRO_LATEST, name: `Gemini 1.5 Pro`, provider: ApiProvider.GEMINI, isCharacterAnalyzer: true },
];

export const CHARACTER_ANALYSIS_MODELS: ModelOption[] = DEFAULT_TEXT_MODELS.filter(
  model => model.provider === ApiProvider.GEMINI && model.isCharacterAnalyzer
);

export const DEFAULT_IMAGE_MODELS: ModelOption[] = [
  { id: GEMINI_IMAGEN_3, name: `Gemini Imagen 3`, provider: ApiProvider.GEMINI, isMultimodal: false },
  // Gemini 1.5 Flash can generate images and understand image inputs.
  { id: GEMINI_1_5_FLASH_LATEST, name: `Gemini 1.5 Flash (Multimodal)`, provider: ApiProvider.GEMINI, isMultimodal: true },
];

// --- API URLs ---
export const POLLINATIONS_API_BASE_URL_IMAGE = 'https://image.pollinations.ai';
export const POLLINATIONS_API_BASE_URL_TEXT = 'https://text.pollinations.ai';

// --- Form Options ---
export const IMAGE_STYLES: string[] = [
  'Comic Book Art', 'Photorealistic', 'Anime', 'Fantasy Art', 'Sci-Fi Concept Art',
  'Impressionistic', 'Surreal', 'Minimalist', '3D Render', 'Pixel Art', 'Watercolor', 'Sketch'
];
export const COMIC_ERAS: string[] = ['Modern Age (1980s-Present)', 'Golden Age (1930s-50s)', 'Silver Age (1950s-70s)', 'Bronze Age (1970s-80s)', 'Futuristic'];
export const ASPECT_RATIOS: Record<string, { width: number; height: number, label: string }> = {
  '16:9': { width: 1024, height: 576, label: '16:9 (Widescreen)' },
  '1:1': { width: 1024, height: 1024, label: '1:1 (Square)' },
  '3:4': { width: 768, height: 1024, label: '3:4 (Portrait)' },
  '4:3': { width: 1024, height: 768, label: '4:3 (Standard)' },
  '9:16': { width: 576, height: 1024, label: '9:16 (Tall Portrait)' },
};

// --- Generation Constraints & Defaults ---
export const TARGET_POLLINATIONS_RESOLUTION = 2048; // A more reasonable default for speed
export const MAX_PAGES = 200;
export const MIN_STORY_LENGTH = 10;
export const MAX_STORY_LENGTH = 10000;
export const MAX_CHAR_REF_IMAGES = 5;

export const DEFAULT_CONFIG_VALUES = {
  textModel: GEMINI_1_5_FLASH_LATEST,
  imageModel: GEMINI_1_5_FLASH_LATEST,
  characterAnalysisModel: GEMINI_1_5_FLASH_LATEST,
  imageStyle: IMAGE_STYLES[0],
  comicEra: COMIC_ERAS[0],
  aspectRatio: '16:9',
  numPages: 3,
  includeCaptions: true,
  overlayText: false,
};
