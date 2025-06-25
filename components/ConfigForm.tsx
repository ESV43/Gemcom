import React, { useState, useEffect, useCallback } from 'react';
import { ComicConfig, CharacterReference, ModelOption, ApiProvider } from '../types';
import CharacterReferenceInput from './CharacterReferenceInput';
import {
  IMAGE_STYLES, COMIC_ERAS, ASPECT_RATIOS, MAX_PAGES,
  MIN_STORY_LENGTH, MAX_STORY_LENGTH, DEFAULT_TEXT_MODELS,
  DEFAULT_IMAGE_MODELS, DEFAULT_CONFIG_VALUES,
  GEMINI_FLASH_CHAT_IMAGE_GEN_MODEL_ID,
  CHARACTER_ANALYSIS_MODELS,
  GEMINI_IMAGEN_MODEL_ID
} from '../constants';
import { getPollinationsTextModels, getPollinationsImageModels } from '../services/pollinationsService';
import LoadingSpinner from './LoadingSpinner';

interface ConfigFormProps {
  onSubmit: (config: ComicConfig, characters: CharacterReference[]) => void;
  isGenerating: boolean;
  initialConfig?: Partial<ComicConfig>;
  initialCharacters?: CharacterReference[];
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  apiKeyError: string | null;
}

const ConfigForm: React.FC<ConfigFormProps> = ({ onSubmit, isGenerating, initialConfig, initialCharacters, apiKey, onApiKeyChange, apiKeyError }) => {
  const [config, setConfig] = useState<ComicConfig>({
    storyScript: initialConfig?.storyScript || '',
    textModel: initialConfig?.textModel || DEFAULT_CONFIG_VALUES.textModel,
    imageModel: initialConfig?.imageModel || DEFAULT_CONFIG_VALUES.imageModel,
    characterAnalysisModel: initialConfig?.characterAnalysisModel || DEFAULT_CONFIG_VALUES.characterAnalysisModel,
    imageStyle: initialConfig?.imageStyle || DEFAULT_CONFIG_VALUES.imageStyle,
    comicEra: initialConfig?.comicEra || DEFAULT_CONFIG_VALUES.comicEra,
    aspectRatio: initialConfig?.aspectRatio || DEFAULT_CONFIG_VALUES.aspectRatio,
    numPages: initialConfig?.numPages || DEFAULT_CONFIG_VALUES.numPages,
    includeCaptions: initialConfig?.includeCaptions ?? DEFAULT_CONFIG_VALUES.includeCaptions,
    overlayText: initialConfig?.overlayText ?? DEFAULT_CONFIG_VALUES.overlayText,
    seed: initialConfig?.seed || 0,
  });

  const [characters, setCharacters] = useState<CharacterReference[]>(initialCharacters || []);
  const [textModels, setTextModels] = useState<ModelOption[]>(DEFAULT_TEXT_MODELS);
  const [imageModels, setImageModels] = useState<ModelOption[]>(DEFAULT_IMAGE_MODELS);
  const [analysisModels, setAnalysisModels] = useState<ModelOption[]>(CHARACTER_ANALYSIS_MODELS);
  const [loadingModels, setLoadingModels] = useState<boolean>(false);
  const [storyWordCount, setStoryWordCount] = useState(0);

  const fetchDynamicModels = useCallback(async () => {
    setLoadingModels(true);
    try {
      const [pollinationsText, pollinationsImage] = await Promise.all([
        getPollinationsTextModels(),
        getPollinationsImageModels()
      ]);

      const uniqueTextModels = new Map<string, ModelOption>();
      DEFAULT_TEXT_MODELS.forEach(model => uniqueTextModels.set(`${model.provider}-${model.id}`, model));
      pollinationsText.forEach(model => uniqueTextModels.set(`${model.provider}-${model.id}`, model));
      setTextModels(Array.from(uniqueTextModels.values()));

      const uniqueImageModels = new Map<string, ModelOption>();
      DEFAULT_IMAGE_MODELS.forEach(model => uniqueImageModels.set(`${model.provider}-${model.id}`, model));
      pollinationsImage.forEach(model => uniqueImageModels.set(`${model.provider}-${model.id}`, model));
      
      const newImageModelList = Array.from(uniqueImageModels.values());
      setImageModels(newImageModelList);
      
      setAnalysisModels(CHARACTER_ANALYSIS_MODELS); 

      setConfig(prevConfig => {
        if (newImageModelList.length > 0 && !newImageModelList.some(m => m.id === prevConfig.imageModel)) {
            console.warn(`Previously selected image model '${prevConfig.imageModel}' is no longer valid. Resetting.`);
            const firstValidPollinationsModel = newImageModelList.find(m => m.provider === ApiProvider.POLLINATIONS);
            if (firstValidPollinationsModel) {
                return { ...prevConfig, imageModel: firstValidPollinationsModel.id };
            } else {
                 return { ...prevConfig, imageModel: GEMINI_IMAGEN_MODEL_ID };
            }
        }
        return prevConfig;
      });

    } catch (error) {
      console.error("Failed to load Pollinations models", error);
    }
    setLoadingModels(false);
  }, []);

  useEffect(() => {
    fetchDynamicModels();
  }, [fetchDynamicModels]);

  useEffect(() => {
    setStoryWordCount(config.storyScript.trim() ? config.storyScript.trim().split(/\s+/).length : 0);
  }, [config.storyScript]);


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const { checked } = e.target as HTMLInputElement;
      setConfig(prev => ({ ...prev, [name]: checked }));
    } else if (name === "numPages" || name === "seed") {
        setConfig(prev => ({ ...prev, [name]: parseInt(value, 10) || 0 }));
    } else {
      setConfig(prev => ({ ...prev, [name]: value }));
    }
  };

  const addCharacter = () => {
    setCharacters(prev => [...prev, { id: Date.now().toString(), name: `Character ${prev.length + 1}`, images: [] }]);
  };

  const updateCharacter = (updatedChar: CharacterReference) => {
    setCharacters(prev => prev.map(char => char.id === updatedChar.id ? updatedChar : char));
  };

  const removeCharacter = (characterId: string) => {
    setCharacters(prev => prev.filter(char => char.id !== characterId));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (storyWordCount < MIN_STORY_LENGTH || storyWordCount > MAX_STORY_LENGTH) {
      alert(`Story script must be between ${MIN_STORY_LENGTH} and ${MAX_STORY_LENGTH} words. Current: ${storyWordCount}`);
      return;
    }
    if (config.numPages <=0 || config.numPages > MAX_PAGES){
      alert(`Number of pages must be between 1 and ${MAX_PAGES}.`);
      return;
    }
    const currentSeed = config.seed === 0 ? Math.floor(Math.random() * Number.MAX_SAFE_INTEGER) : config.seed;
    onSubmit({...config, seed: currentSeed}, characters);
  };

  const selectedImageModelDetails = imageModels.find(m => m.id === config.imageModel);
  const showCharAnalysisModelDropdown = characters.length > 0 && selectedImageModelDetails?.id !== GEMINI_FLASH_CHAT_IMAGE_GEN_MODEL_ID;


  const renderSelect = (name: string, label: string, value: string | number | undefined, options: {value: string, label: string}[], isLoading?: boolean, customOnChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void) => (
    <div className="mb-4">
      <label htmlFor={name} className="block text-sm font-medium text-slate-300 mb-1">{label}</label>
      {isLoading ? <div className="h-10 flex items-center"><LoadingSpinner size="sm" /></div> : (
        <select
          id={name}
          name={name}
          value={value}
          onChange={customOnChange || handleChange}
          disabled={isGenerating}
          className="w-full p-2.5 dark-input"
        >
          {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      )}
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-6 bg-slate-900/80 backdrop-blur-md rounded-xl shadow-2xl purple-glow-container">
      <h2 className="text-2xl font-bold text-center mb-4 neon-text-header">Configure Your Comic</h2>

      <div>
        <label htmlFor="apiKey" className="block text-sm font-medium text-slate-300 mb-1">Gemini API Key</label>
        <input
            id="apiKey"
            name="apiKey"
            type="password"
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            placeholder="Enter your Gemini API key here"
            className="w-full p-2.5 dark-input"
            disabled={isGenerating}
        />
        {apiKeyError && <p className="text-xs mt-1 text-red-400">{apiKeyError}</p>}
        {!apiKeyError && <p className="text-xs mt-1 text-slate-500">Your key is used directly for API calls and is not stored.</p>}
      </div>

      <div>
        <label htmlFor="storyScript" className="block text-sm font-medium text-slate-300 mb-1">Story Script ({storyWordCount} words)</label>
        <textarea
          id="storyScript"
          name="storyScript"
          value={config.storyScript}
          onChange={handleChange}
          rows={8}
          placeholder={`Enter your comic story here (${MIN_STORY_LENGTH}-${MAX_STORY_LENGTH} words)...`}
          className="w-full p-2.5 dark-input resize-y"
          disabled={isGenerating}
          minLength={MIN_STORY_LENGTH * 4} 
          maxLength={MAX_STORY_LENGTH * 10} 
        />
        <p className={`text-xs mt-1 ${storyWordCount > 0 && (storyWordCount < MIN_STORY_LENGTH || storyWordCount > MAX_STORY_LENGTH) ? 'text-red-400' : 'text-slate-400'}`}>
          Word count: {storyWordCount} (min: {MIN_STORY_LENGTH}, max: {MAX_STORY_LENGTH})
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {renderSelect("textModel", "Text Generation Model", config.textModel, textModels.map(m => ({value: m.id, label: `${m.provider} - ${m.name}`})), loadingModels)}
        {renderSelect("imageModel", "Image Generation Model", config.imageModel, imageModels.map(m => ({value: m.id, label: `${m.provider} - ${m.name}`})), loadingModels)}
      </div>
      
      {showCharAnalysisModelDropdown && (
        <div className="grid md:grid-cols-1 gap-6">
          {renderSelect("characterAnalysisModel", "Character Analysis AI Model (for Textual Description)", config.characterAnalysisModel, analysisModels.filter(m => m.isCharacterAnalyzer).map(m => ({ value: m.id, label: `${m.provider} - ${m.name}` })), loadingModels || analysisModels.length === 0)}
        </div>
      )}


      <div className="grid md:grid-cols-2 gap-6">
        {renderSelect("imageStyle", "Image Style", config.imageStyle, IMAGE_STYLES.map(s => ({value: s, label: s})))}
        {renderSelect("comicEra", "Comic Era", config.comicEra, COMIC_ERAS.map(e => ({value: e, label: e})))}
      </div>
      <div className="grid md:grid-cols-2 gap-6">
         {renderSelect("aspectRatio", "Aspect Ratio", config.aspectRatio, Object.entries(ASPECT_RATIOS).map(([key, val])=> ({value: key, label: val.label})))}
        <div>
          <label htmlFor="numPages" className="block text-sm font-medium text-slate-300 mb-1">Number of Pages (1-{MAX_PAGES})</label>
          <input
            type="number"
            id="numPages"
            name="numPages"
            value={config.numPages}
            onChange={handleChange}
            min="1"
            max={MAX_PAGES}
            className="w-full p-2.5 dark-input"
            disabled={isGenerating}
          />
        </div>
      </div>

        <div>
          <label htmlFor="seed" className="block text-sm font-medium text-slate-300 mb-1">Image Generation Seed (0 for random)</label>
          <input
            type="number"
            id="seed"
            name="seed"
            value={config.seed}
            onChange={handleChange}
            min="0"
            className="w-full p-2.5 dark-input"
            disabled={isGenerating}
          />
        </div>

      <div className="mt-6 p-4 border border-purple-800/50 rounded-lg bg-slate-800/30">
        <h3 className="text-lg font-semibold text-purple-300 mb-3">Character References</h3>
        <p className="text-sm text-slate-400 mb-3">
          Add characters and reference images.
          {selectedImageModelDetails?.id === GEMINI_FLASH_CHAT_IMAGE_GEN_MODEL_ID ?
            ` The selected image model (${selectedImageModelDetails?.name}) supports direct image inputs for character consistency.` :
            ` For other image models, if you provide reference images, their visual descriptions will be added to image prompts.`
          }
        </p>
        
        {showCharAnalysisModelDropdown && (
          <div className="mb-4">
            {renderSelect( "characterAnalysisModel", "Character Analysis AI Model", config.characterAnalysisModel, analysisModels.filter(m => m.isCharacterAnalyzer).map(m => ({ value: m.id, label: `${m.provider} - ${m.name}` })), loadingModels || analysisModels.length === 0 )}
          </div>
        )}

        {characters.map(char => (
          <CharacterReferenceInput
            key={char.id}
            character={char}
            onUpdate={updateCharacter}
            onRemove={removeCharacter}
          />
        ))}
        <button
          type="button"
          onClick={addCharacter}
          className="cyan-button px-4 py-2 text-sm"
          disabled={isGenerating}
        >
          Add Character Reference
        </button>
      </div>


      <div className="space-y-3 mt-4">
        <label className="flex items-center space-x-3 cursor-pointer">
          <input type="checkbox" name="includeCaptions" checked={config.includeCaptions} onChange={handleChange} disabled={isGenerating} className="form-checkbox h-5 w-5 rounded" />
          <span className="text-slate-200">Include Captions/Dialogues</span>
        </label>
        <label className="flex items-center space-x-3 cursor-pointer">
          <input type="checkbox" name="overlayText" checked={config.overlayText} onChange={handleChange} disabled={isGenerating || !config.includeCaptions} className="form-checkbox h-5 w-5 rounded" />
          <span className="text-slate-200">Overlay Text on Image (Experimental)</span>
        </label>
      </div>

      <div className="mt-8 text-center">
        <button
          type="submit"
          disabled={isGenerating || (storyWordCount > 0 && (storyWordCount < MIN_STORY_LENGTH || storyWordCount > MAX_STORY_LENGTH)) || config.numPages <= 0 || config.numPages > MAX_PAGES}
          className="cyan-button text-lg font-bold px-8 py-3 w-full md:w-auto"
        >
          {isGenerating ? <LoadingSpinner size="sm" text="Generating..." /> : 'Generate Comic'}
        </button>
      </div>
    </form>
  );
};

export default ConfigForm;
