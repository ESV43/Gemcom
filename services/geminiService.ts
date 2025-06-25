import { GoogleGenAI, GenerateContentResponse as GenAIResponseFromSDK, Part, Modality, Candidate as SDKCandidate } from "@google/genai";
import { GenerateContentResponseWithMetadata, GenerateImageResponse } from '../types';
import { GEMINI_MULTIMODAL_TEXT_MODEL_ID, GEMINI_IMAGEN_MODEL_ID, GEMINI_FLASH_CHAT_IMAGE_GEN_MODEL_ID } from '../constants';

const initializeGemini = (apiKey: string): GoogleGenAI => {
  if (!apiKey) {
    throw new Error("Gemini API key is not provided. Please set the API_KEY environment variable or enter it in the UI.");
  }
  return new GoogleGenAI({ apiKey });
};

export const generateTextWithGemini = async (
  apiKey: string,
  modelId: string,
  prompt: string,
  systemInstruction?: string
): Promise<GenerateContentResponseWithMetadata> => {
  const genAI = initializeGemini(apiKey);
  try {
    const result: GenAIResponseFromSDK = await genAI.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        ...(systemInstruction && { systemInstruction }),
        responseMimeType: "application/json",
      }
    });
    return result as GenerateContentResponseWithMetadata;
  } catch (error) {
    console.error("Error generating text with Gemini:", error);
    throw error;
  }
};

export const analyzeCharacterWithGemini = async (
    apiKey: string,
    modelId: string,
    characterName: string,
    referenceImages: { data: string; mimeType: string }[]
): Promise<string> => {
    const genAI = initializeGemini(apiKey);
    const systemInstruction = `You are an expert character artist's assistant. Based on the provided reference images and the name "${characterName}", generate a very detailed visual description of this character. This description is CRITICAL for another AI to draw the character consistently.
Focus specifically on:
1.  **Face:** Shape (e.g., oval, round, square), specific eye color and shape, nose type (e.g., aquiline, button), lip shape, any scars, freckles, or notable facial marks.
2.  **Hair:** Color, style (e.g., short pixie cut, long wavy, bald, specific haircut like 'bob cut' or 'undercut'), texture (e.g., fine, thick, curly, straight).
3.  **Build/Physique:** E.g., slim, athletic, muscular, average, heavy-set, tall, short, petite.
4.  **Clothing Style (if visible and consistent):** Describe the typical attire seen in the images (e.g., 'prefers dark, formal wear', 'casual t-shirts and jeans', 'bohemian style with flowing fabrics'). If clothing varies, note general style or any recurring elements.
5.  **Most Distinctive Features:** What makes this character visually unique? (e.g., a prominent birthmark, a unique tattoo, a specific accessory they always wear like glasses or a hat, an unusual hair color streak).
Output ONLY the detailed description as plain text. Do not include any conversational preamble, sign-off, or markdown.`;
    
    const promptParts: Part[] = [
        { text: `Analyze the character named "${characterName}" using the instructions provided in the system prompt. Reference images are attached.` },
    ];

    referenceImages.forEach(img => {
        promptParts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
    });
    
    try {
        const result = await genAI.models.generateContent({
            model: modelId,
            contents: { parts: promptParts },
            config: {
                 systemInstruction,
            }
        });
        return result.text;
    } catch (error) {
        console.error(`Error analyzing character "${characterName}" with Gemini model ${modelId}:`, error);
        throw new Error(`Failed to analyze character "${characterName}": ${error instanceof Error ? error.message : String(error)}`);
    }
};


export const generateImageWithGemini = async (
  apiKey: string,
  modelId: string,
  prompt: string,
  numImages: number = 1,
  seed?: number,
  aspectRatioValue?: { width: number; height: number }, 
  referenceImages?: { data: string; mimeType: string }[],
  outputMimeTypeForImagen?: string,
  highQualityHint: boolean = false
): Promise<GenerateImageResponse> => {
  const genAI = initializeGemini(apiKey);
  let finalPrompt = prompt;
  if (highQualityHint) {
    finalPrompt += " Generate this image at the highest possible quality and resolution, aiming for sharp details suitable for large prints or 4K display if supported by your capabilities.";
  }

  try {
    if (modelId === GEMINI_FLASH_CHAT_IMAGE_GEN_MODEL_ID) {
      const chat = genAI.chats.create({
        model: modelId,
        config: {
          responseModalities: [Modality.IMAGE, Modality.TEXT], 
        },
        history: [],
      });

      const messageParts: Part[] = [{ text: finalPrompt }];
      if (referenceImages && referenceImages.length > 0) {
        referenceImages.forEach(refImg => {
          messageParts.push({
            inlineData: {
              mimeType: refImg.mimeType,
              data: refImg.data,
            }
          });
        });
      }

      if (seed && seed !== 0) {
        const textPartIndex = messageParts.findIndex(part => 'text' in part);
        let currentPromptText = "";
        if (textPartIndex !== -1 && messageParts[textPartIndex].text) {
             currentPromptText = messageParts[textPartIndex].text as string;
             messageParts[textPartIndex].text = `${currentPromptText}\nUse seed: ${seed} for generation if possible.`;
        } else {
             messageParts.unshift({ text: `Use seed: ${seed} for generation if possible.` });
        }
      }

      const result: GenAIResponseFromSDK = await chat.sendMessage({ message: messageParts });

      let imageBytes: string | undefined;
      if (result.candidates && result.candidates.length > 0) {
        const candidate: SDKCandidate = result.candidates[0]; 
        for (const part of candidate.content?.parts ?? []) {
          if (part.inlineData && part.inlineData.data && part.inlineData.mimeType?.startsWith('image/')) {
            imageBytes = part.inlineData.data;
            break;
          }
        }
      }

      if (!imageBytes) {
        console.error(`Model ${modelId} did not return an image. Full response:`, JSON.stringify(result, null, 2));
        throw new Error(`Model ${modelId} did not return an image. Response: ${JSON.stringify(result)}`);
      }

      return {
        generatedImages: [{
          image: { imageBytes }
        }]
      };

    } else { 
      let effectiveModelIdForApiCall = modelId;

      if (modelId === GEMINI_MULTIMODAL_TEXT_MODEL_ID) {
        console.warn(
          `generateImageWithGemini (Imagen path) was called with text model '${GEMINI_MULTIMODAL_TEXT_MODEL_ID}'. Switching to '${GEMINI_IMAGEN_MODEL_ID}'. The prompt should be pre-enhanced.`
        );
        effectiveModelIdForApiCall = GEMINI_IMAGEN_MODEL_ID;
        if (referenceImages && referenceImages.length > 0) {
          console.warn(
            `Reference images provided with assisting text model '${GEMINI_MULTIMODAL_TEXT_MODEL_ID}' will be ignored by 'ai.models.generateImages' API.`
          );
        }
      }
      
      if (seed && seed !== 0) {
        console.warn(
            `A seed value (${seed}) was provided for Imagen model '${effectiveModelIdForApiCall}'. This will be ignored by the 'ai.models.generateImages' API.`
        );
      }
      
      const result = await genAI.models.generateImages({
          model: effectiveModelIdForApiCall,
          prompt: finalPrompt, 
          config: { 
            numberOfImages: numImages,
            outputMimeType: outputMimeTypeForImagen || 'image/png', 
          }
      });

      if (!result.generatedImages || result.generatedImages.length === 0 || !result.generatedImages[0].image?.imageBytes) {
          console.error(`Imagen model (${effectiveModelIdForApiCall}) did not return valid image data. Full response:`, JSON.stringify(result, null, 2));
          throw new Error(`Imagen model (${effectiveModelIdForApiCall}) did not return valid image data. Response: ${JSON.stringify(result)}`);
      }
      
      return result as GenerateImageResponse;
    }

  } catch (error) {
    console.error(`Error generating image with Gemini (model attempted: ${modelId}):`, error);
    if (error instanceof Error) {
        if (error.message.includes("API_KEY_INVALID") || error.message.includes("API key not valid")) {
            throw new Error("Invalid Gemini API Key. Please ensure it is correctly configured and has the necessary API enabled.");
        }
        if (error.message.includes("model is not supported") || error.message.includes("Permission denied") || error.message.includes("model not found")) {
             throw new Error(`The model '${modelId}' may not be supported for image generation with your API key, or it might be an invalid model name. Original error: ${error.message}`);
        }
         if (error.message.includes("inline data parts for IMAGE modality are not supported")) {
            throw new Error(`The model '${modelId}' does not support inline image inputs. Ensure character reference images are only used with compatible models. Original error: ${error.message}`);
         }
    }
    throw error;
  }
};
