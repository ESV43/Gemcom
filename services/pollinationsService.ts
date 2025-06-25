
import axios from 'axios';
import { ModelOption, PollinationsModel, ApiProvider } from '../types';
import { POLLINATIONS_API_BASE_URL_IMAGE, POLLINATIONS_API_BASE_URL_TEXT, TARGET_POLLINATIONS_RESOLUTION, ASPECT_RATIOS } from '../constants';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

async function fetchWithRetry<T,>(url: string, retries = MAX_RETRIES): Promise<T> {
  try {
    const response = await axios.get<T>(url, { timeout: 15000 });
    return response.data;
  } catch (error) {
    if (retries > 0) {
      console.warn(`Retrying ${url}, ${retries} retries left...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      return fetchWithRetry(url, retries - 1);
    }
    console.error(`Failed to fetch ${url} after multiple retries:`, error);
    throw error;
  }
}


export const getPollinationsTextModels = async (): Promise<ModelOption[]> => {
  try {
    const modelsData = await fetchWithRetry<PollinationsModel>(`${POLLINATIONS_API_BASE_URL_TEXT}/models`);
    return Object.keys(modelsData)
      .filter(key => {
        if (typeof key !== 'string' || key.trim() === "") return false;
        if (key === "0") return false; // Explicitly filter out "0"
        if (key === 'dream') return false; // Filter out known non-model key
        // Allow other string keys for text models
        return true; 
      })
      .map(key => ({
        id: key,
        name: modelsData[key].name || key,
        provider: ApiProvider.POLLINATIONS,
      }));
  } catch (error) {
    console.error("Error fetching Pollinations text models:", error);
    return [];
  }
};

export const getPollinationsImageModels = async (): Promise<ModelOption[]> => {
  try {
    const modelsData = await fetchWithRetry<PollinationsModel>(`${POLLINATIONS_API_BASE_URL_IMAGE}/models`);
    console.log('Raw Pollinations Image Models Data:', JSON.stringify(modelsData, null, 2)); // Log raw data

    const filteredModels = Object.keys(modelsData)
      .filter(key => {
        if (typeof key !== 'string' || key.trim() === "") return false;
        if (key === "0") return false; // Explicitly filter out "0"
        // Removed purelyNumericRegex filter to be less restrictive.
        // Pollinations might use model IDs like "sdxl-1.0" or even short numeric-like strings that are valid.
        // We rely on "0", "deprecated", "dream" being the primary known invalid keys.
        if (key.includes('deprecated') || key === 'dream') return false; // Filter out known unwanted keys
        return true; 
      })
      .map(key => ({
        id: key,
        name: modelsData[key].name || key,
        provider: ApiProvider.POLLINATIONS,
        generationParams: {
            width: modelsData[key].parameters?.width ? parseInt(modelsData[key].parameters!.width!) : undefined,
            height: modelsData[key].parameters?.height ? parseInt(modelsData[key].parameters!.height!) : undefined,
        }
      }));
      console.log('Filtered Pollinations Image Model IDs being used:', filteredModels.map(m => m.id));
      return filteredModels;
  } catch (error) {
    console.error("Error fetching Pollinations image models:", error);
    return [];
  }
};

export const generateTextWithPollinations = async (modelId: string, prompt: string): Promise<string> => {
  const encodedPrompt = encodeURIComponent(prompt);
  const url = `${POLLINATIONS_API_BASE_URL_TEXT}/${encodedPrompt}?model=${modelId}`;
  try {
    const response = await axios.get(url, { responseType: 'text', timeout: 30000 });
    let textResponse = response.data as string;
    
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = textResponse.match(fenceRegex);
    if (match && match[2]) {
      textResponse = match[2].trim();
    }
    return textResponse;
  } catch (error) {
    console.error("Error generating text with Pollinations:", error);
    throw error;
  }
};


export const generateImageWithPollinations = async (
  modelId: string,
  prompt: string,
  seed: number,
  aspectRatioKey: string // Changed from width, height to aspect ratio key
): Promise<string> => { // Returns image URL
  const encodedPrompt = encodeURIComponent(prompt);
  
  const aspectRatioInfo = ASPECT_RATIOS[aspectRatioKey] || ASPECT_RATIOS['16:9'];
  let targetWidth = TARGET_POLLINATIONS_RESOLUTION;
  let targetHeight = TARGET_POLLINATIONS_RESOLUTION;

  // Calculate width and height based on aspect ratio and target longest side
  const originalRatio = aspectRatioInfo.width / aspectRatioInfo.height;

  if (aspectRatioInfo.width >= aspectRatioInfo.height) { // Landscape or square
    targetWidth = TARGET_POLLINATIONS_RESOLUTION;
    targetHeight = Math.round(TARGET_POLLINATIONS_RESOLUTION / originalRatio);
  } else { // Portrait
    targetHeight = TARGET_POLLINATIONS_RESOLUTION;
    targetWidth = Math.round(TARGET_POLLINATIONS_RESOLUTION * originalRatio);
  }
  
  // Ensure dimensions are reasonable (e.g., divisible by 8 or 64 for some models)
  targetWidth = Math.round(targetWidth / 8) * 8;
  targetHeight = Math.round(targetHeight / 8) * 8;
  if (targetWidth === 0) targetWidth = 8;
  if (targetHeight === 0) targetHeight = 8;

  console.log(`Attempting to use Pollinations image model ID: '${modelId}'`);
  if (modelId === "0" || !modelId ) { 
    console.error(`Invalid Pollinations modelId detected: '${modelId}'. This will likely fail.`);
     // Potentially throw an error here or return a placeholder to prevent API call
  }

  const url = `${POLLINATIONS_API_BASE_URL_IMAGE}/prompt/${encodedPrompt}?model=${modelId}&seed=${seed}&width=${targetWidth}&height=${targetHeight}&nologo=true`;
  console.log(`Pollinations request URL: ${url}`);
  try {
    // We optimistically return the URL and let the browser try to load it.
    // The HEAD request was often timing out or not reflecting the final image availability.
    // Error handling in ComicPanel.tsx will deal with images that don't load.
    return url;
  } catch (error) { // This catch block might not be strictly necessary if we always return url.
    console.warn(`Unexpected error during Pollinations URL construction for ${url}:`, error instanceof Error ? error.message : String(error));
    return url; 
  }
};
