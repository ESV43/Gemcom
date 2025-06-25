
import React, { useState, useCallback, useEffect } from 'react';
import ConfigForm from './components/ConfigForm';
import ComicPanel from './components/ComicPanel';
import LoadingSpinner from './components/LoadingSpinner';
import {
  ComicConfig, CharacterReference, GeneratedPanel, PanelContent,
  ApiProvider, ModelOption, GenerateContentResponseWithMetadata, GenerateImageResponse
} from './types';
import { generateTextWithGemini, generateImageWithGemini, analyzeCharacterWithGemini } from './services/geminiService';
import { getPollinationsTextModels, getPollinationsImageModels, generateTextWithPollinations, generateImageWithPollinations } from './services/pollinationsService';
import { downloadComicAsPDF } from './services/pdfService';
import {
  ASPECT_RATIOS, GEMINI_FLASH_CHAT_IMAGE_GEN_MODEL_ID, GEMINI_MULTIMODAL_TEXT_MODEL_ID,
  DEFAULT_IMAGE_MODELS, DEFAULT_TEXT_MODELS, GEMINI_API_KEY_ENV_VAR, CHARACTER_ANALYSIS_MODELS
} from './constants';

const App: React.FC = () => {
  const [config, setConfig] = useState<ComicConfig | null>(null);
  const [characters, setCharacters] = useState<CharacterReference[]>([]);
  const [panels, setPanels] = useState<GeneratedPanel[]>([]);
  const [isGeneratingComic, setIsGeneratingComic] = useState<boolean>(false);
  const [isGeneratingInitialPanels, setIsGeneratingInitialPanels] = useState<boolean>(false);
  const [isAnalyzingCharacters, setIsAnalyzingCharacters] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);

  const [allTextModels, setAllTextModels] = useState<ModelOption[]>(DEFAULT_TEXT_MODELS);
  const [allImageModels, setAllImageModels] = useState<ModelOption[]>(DEFAULT_IMAGE_MODELS);
  const [allAnalysisModels, setAllAnalysisModels] = useState<ModelOption[]>(CHARACTER_ANALYSIS_MODELS);
  const [overallProgress, setOverallProgress] = useState<string>('');


  useEffect(() => {
    if (!process.env[GEMINI_API_KEY_ENV_VAR]) {
      setApiKeyError(`Gemini API Key (process.env.${GEMINI_API_KEY_ENV_VAR}) is not set. Gemini models will not work.`);
    }

    const fetchAllModels = async () => {
      try {
        const [pollinationsText, pollinationsImage] = await Promise.all([
          getPollinationsTextModels(),
          getPollinationsImageModels()
        ]);
        
        const combinedTextModels = [...DEFAULT_TEXT_MODELS];
        const existingTextModelIds = new Set(DEFAULT_TEXT_MODELS.map(m => m.id));
        pollinationsText.forEach(pt => {
          if (!existingTextModelIds.has(pt.id)) {
            combinedTextModels.push(pt);
          }
        });
        setAllTextModels(combinedTextModels);

        const combinedImageModels = [...DEFAULT_IMAGE_MODELS];
        const existingImageModelIds = new Set(DEFAULT_IMAGE_MODELS.map(m => m.id));
        pollinationsImage.forEach(pi => {
          if (!existingImageModelIds.has(pi.id)) {
            combinedImageModels.push(pi);
          }
        });
        setAllImageModels(combinedImageModels);
        setAllAnalysisModels(CHARACTER_ANALYSIS_MODELS); // Currently static

      } catch (e) {
        console.error("Failed to load Pollinations models", e);
        setError("Could not load models from Pollinations.ai. Only default models will be available.");
      }
    };
    fetchAllModels();
  }, []);

  const getAspectRatioClass = (aspectRatioKey: string): string => {
    switch (aspectRatioKey) {
      case '16:9': return 'aspect-video';
      case '4:3': return 'aspect-[4/3]';
      case '1:1': return 'aspect-square';
      case '3:4': return 'aspect-[3/4]';
      case '9:16': return 'aspect-[9/16]';
      default: return 'aspect-video';
    }
  };

  const generateAllPanelContents = async (currentConfig: ComicConfig, currentCharacters: CharacterReference[]): Promise<PanelContent[]> => {
    setError(null);
    setIsGeneratingInitialPanels(true);
    setOverallProgress('Generating panel descriptions and dialogues...');

    const characterDetails = currentCharacters.map(c => {
      let imageInfo = c.images.length > 0 ? ` with ${c.images.length} reference image(s)` : '';
      let descInfo = (c.detailedTextDescription && c.detailedTextDescription.trim() !== "") ? ` (textual description available)` : '';
      return `${c.name}${imageInfo}${descInfo}`;
    }).join(', ');
    
    const charPromptPart = currentCharacters.length > 0 ? `\n\nReferenced Characters: ${characterDetails}. If these characters are mentioned in a panel, ensure their descriptions are consistent with any provided image references or generated textual descriptions. If using a multimodal image model that accepts images, these references might be passed directly.` : '';

    const systemInstruction = `You are an expert comic scriptwriter. Your task is to break down the following story into ${currentConfig.numPages} distinct comic panels. For each panel, provide a "sceneDescription" (visual details for the artist, including character actions, expressions, and setting) and a "dialogueOrCaption". The "dialogueOrCaption" MUST contain the speech for characters, thoughts, sound effects, or narrator text for the panel. If there is no direct speech, provide a brief narrator's caption describing the moment or setting the scene. Do not leave "dialogueOrCaption" empty unless absolutely no text is suitable for the panel; in such rare cases, use " " (a single space). ${charPromptPart} Your response MUST be a valid JSON array of objects, where each object has keys "sceneDescription" and "dialogueOrCaption". Do NOT include any explanatory text, comments, markdown, or any characters whatsoever before the opening '[' or after the closing ']' of the JSON array. ONLY THE JSON ARRAY. Example: [{"sceneDescription": "...", "dialogueOrCaption": "..."}]`;
    
    const userPrompt = `Story Script: """${currentConfig.storyScript}"""\n\nGenerate ${currentConfig.numPages} panels.`;

    let rawTextResponse: string = "";
    let jsonStr: string = "";

    try {
      const selectedTextModel = allTextModels.find(m => m.id === currentConfig.textModel);

      if (selectedTextModel?.provider === ApiProvider.GEMINI) {
        if (apiKeyError && currentConfig.textModel.startsWith('gemini')) {
             throw new Error("Gemini API key is not configured. Cannot use Gemini text models.");
        }
        const response: GenerateContentResponseWithMetadata = await generateTextWithGemini(
          currentConfig.textModel,
          userPrompt,
          systemInstruction
        );
        rawTextResponse = response.text;
      } else if (selectedTextModel?.provider === ApiProvider.POLLINATIONS) {
        const fullPollinationsPrompt = `${systemInstruction}\n\n${userPrompt}\n\nReturn ONLY THE JSON array.`;
        rawTextResponse = await generateTextWithPollinations(currentConfig.textModel, fullPollinationsPrompt);
      } else {
        throw new Error(`Unknown text model provider for ${currentConfig.textModel}`);
      }

      jsonStr = rawTextResponse.trim();
      
      const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
      const match = jsonStr.match(fenceRegex);
      if (match && match[2]) {
        jsonStr = match[2].trim();
      }

      try {
        const parsedPanelsAttempt1 = JSON.parse(jsonStr) as PanelContent[];
         if (!Array.isArray(parsedPanelsAttempt1) || !parsedPanelsAttempt1.every(p => p.sceneDescription && (typeof p.dialogueOrCaption !== 'undefined'))) {
            throw new Error("AI did not return valid panel data structure in initial parse.");
        }
        // Ensure dialogueOrCaption is never truly empty
        const processedPanels = parsedPanelsAttempt1.map(p => ({
            ...p,
            dialogueOrCaption: (p.dialogueOrCaption === null || p.dialogueOrCaption === undefined || p.dialogueOrCaption.trim() === "") ? " " : p.dialogueOrCaption,
        }));

        setOverallProgress('Panel content generated. Starting image generation...');
        return processedPanels.slice(0, currentConfig.numPages);
      } catch (parseError1) {
        console.warn("Initial JSON.parse failed. Attempting more aggressive extraction.", parseError1);
        console.log("String after markdown fence removal (Attempt 1):", jsonStr);

        const firstBracket = jsonStr.indexOf('[');
        const lastBracket = jsonStr.lastIndexOf(']');
        if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
          jsonStr = jsonStr.substring(firstBracket, lastBracket + 1);
          console.log("String after aggressive extraction (Attempt 2):", jsonStr);
        } else {
          const firstBrace = jsonStr.indexOf('{');
          const lastBrace = jsonStr.lastIndexOf('}');
           if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace && jsonStr.trim().startsWith("{") && jsonStr.trim().endsWith("}")) {
             console.warn("Ext