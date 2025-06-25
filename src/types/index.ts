export interface CharacterReference {
  id: string;
  name: string;
  images: { id: string; base64: string; file: File }[];
  detailedTextDescription?: string; // For AI-generated textual description
}

export interface PanelContent {
  sceneDescription: string;
  dialogueOrCaption: string;
}

export interface GeneratedPanel extends PanelContent {
  id: string;
  imageUrl?: string;
  imageError?: string;
  isGenerating?: boolean;
}

export interface ComicConfig {
  storyScript: string;
  textModel: string;
  imageModel: string;
  characterAnalysisModel: string;
  imageStyle: string;
  comicEra: string;
  aspectRatio: string;
  numPages: number;
  includeCaptions: boolean;
  overlayText: boolean;
  seed: number;
}

export enum ApiProvider {
  GEMINI = 'Gemini',
  POLLINATIONS = 'Pollinations',
}

export interface ModelOption {
  id: string;
  name: string;
  provider: ApiProvider;
  isMultimodal?: boolean;
  isCharacterAnalyzer?: boolean;
}

// For Pollinations API responses
export interface PollinationsModel {
  [key: string]: {
    name?: string;
    image?: boolean;
  }
}

// Simplified types for Gemini SDK responses for this app's purpose
export interface GenerateContentResponseWithMetadata {
  text: string;
}

export interface GenerateImageResponse {
  generatedImages: {
    image: {
      imageBytes: string;
    };
  }[];
}
