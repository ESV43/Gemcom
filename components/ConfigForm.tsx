
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
}

const ConfigForm: React.FC<ConfigFormProps> = ({ onSubmit, isGenerating, initialConfig, initialCharacters }) => {
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
    let fetchedPollinationsImageModels: ModelOption[] = [];
    try {
      const [pollinationsText, pollinationsImage] = await Promise.all([
        getPollinationsTextModels(),
        getPollinationsImageModels()
      ]);
      fetchedPollinationsImageModels = pollinationsImage;

      const uniqueTextModels = new Map<string, ModelOption>();
      DEFAULT_TEXT_MODELS.forEach(model => uniqueTextModels.set(`${model.provider}-${model.id}`, model));
      pollinationsText.forEach(model => uniqueTextModels.set(`${model.provider}-${model.id}`, model));
      setTextModels(Array.from(uniqueTextModels.values()));

      const uniqueImageModels = new Map<string, ModelOption>();
      DEFAULT_IMAGE_MODELS.forEach(model => uniqueImageModels.set(`${model.provider}-${model.id}`, model));
      fetchedPollinationsImageModels.forEach(model => uniqueImageModels.set(`${model.provider}-${model.id}`, model));
      
      const newImageModelList = Array.from(uniqueImageModels.values());
      setImageModels(newImageModelList);
      
      setAnalysisModels(CHARACTER_ANALYSIS_MODELS); // Analysis models are currently static

      // Sanity check for selected image model
      setConfig(prevConfig => {
        // Check if the currently selected model still exists in the newly fetched list.
        // The filtering in the service layer should have already removed problematic IDs like "0".
        if (newImageModelList.length > 0 && !newImageModelList.some(m => m.id === prevConfig.imageModel && m.provider === (DEFAULT_IMAGE_MODELS.find(dm => dm.id === prevConfig.imageModel)?.provider || ApiProvider.POLLINATIONS ))) {
            console.warn(`Previously selected image model '${prevConfig.imageModel}' is no longer valid or available in the fetched list. Resetting.`);
            
            // Try to find a Pollinations model first, if the original was Pollinations or if no specific provider context
            const firstValidPollinationsModel = newImageModelList.find(m => m.provider === ApiProvider.POLLINATIONS);
            if (firstValidPollinationsModel) {
                return { ...prevConfig, imageModel: firstValidPollinationsModel.id };
            } else if (newImageModelList.length > 0) { // Fallback to first available model from the new list
                return { ...prevConfig, imageModel: newImageModelList[0].id };
            } else { // Ultimate fallback if new list is empty (should not happen if defaults exist)
                 return { ...prevConfig, imageModel: GEMINI_IMAGEN_MODEL_ID };
            }
        }
        return prevConfig;
      });

    } catch (error) {
      console.error("Failed to load Pollinations models", error);
      setTextModels(DEFAULT_TEXT_MODELS);
      setImageModels(DEFAULT_IMAGE_MODELS); 
      setAnalysisModels(CHARACTER_ANALYSIS_MODELS);
    }
    setLoadingModels(false);
  }, []);

  useEffect(() => {
    fetchDynamicModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  // This const is no longer used to gate the entire section, but parts within it.
  // const showCharacterRefsSection = characters.length > 0 || selectedImageModelDetails?.isMultimodal === true; 

  const showCharAnalysisModelDropdown = characters.length > 0 && selectedImageModelDetails?.id !== GEMINI_FLASH_CHAT_IMAGE_GEN_MODEL_ID;


  const renderSelect = (name: string, label: string, value: string | number | undefined, options: {value: string, label: string}[], isLoading?: boolean, customOnChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void) => (
    <div className="mb-4">
      <label htmlFor={name} className="block text-sm font-medium text-cyan-300 mb-1">{label}</label>
      {isLoading ? <div className="h-10 flex items-center"><LoadingSpinner size="sm" /></div> : (
        <select
          id={name}
          name={name}
          value={value}
          onChange={customOnChange || handleChange}
          disabled={isGenerating}
          className="w-full p-2.5 bg-slate-700 border border-slate-600 text-white rounded-lg shadow-sm focus:ring-2 focus:ring-pink-500 focus:border-pink-500 outline-none transition-colors duration-200 neon-button:hover"
        >
          {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      )}
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-6 bg-slate-900/80 backdrop-blur-md rounded-xl shadow-2xl border border-purple-600/50">
      <h2 className="text-3xl font-bold text-center mb-6 text-pink-400 neon-text">Configure Your Comic</h2>

      <div>
        <label htmlFor="storyScript" className="block text-sm font-medium text-cyan-300 mb-1">Story Script ({storyWordCount} words)</label>
        <textarea
          id="storyScript"
          name="storyScript"
          value={config.storyScript}
          onChange={handleChange}
          rows={8}
          placeholder={`Enter your comic story here (${MIN_STORY_LENGTH}-${MAX_STORY_LENGTH} words)...`}
          className="w-full p-2.5 bg-slate-700 border border-slate-600 text-white rounded-lg shadow-sm focus:ring-2 focus:ring-pink-500 focus:border-pink-500 outline-none resize-y neon-button:hover"
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
      
      {/* Container for Character Analysis Model Dropdown - only shown when relevant */}
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
          <label htmlFor="numPages" className="block text-sm font-medium text-cyan-300 mb-1">Number of Pages (1-{MAX_PAGES})</label>
          <input
            type="number"
            id="numPages"
            name="numPages"
            value={config.numPages}
            onChange={handleChange}
            min="1"
            max={MAX_PAGES}
            className="w-full p-2.5 bg-slate-700 border border-slate-600 text-white rounded-lg shadow-sm focus:ring-2 focus:ring-pink-500 focus:border-pink-500 outline-none neon-button:hover"
            disabled={isGenerating}
          />
        </div>
      </div>

        <div>
          <label htmlFor="seed" className="block text-sm font-medium text-cyan-300 mb-1">Image Generation Seed (0 for random)</label>
          <input
            type="number"
            id="seed"
            name="seed"
            value={config.seed}
            onChange={handleChange}
            min="0"
            className="w-full p-2.5 bg-slate-700 border border-slate-600 text-white rounded-lg shadow-sm focus:ring-2 focus:ring-pink-500 focus:border-pink-500 outline-none neon-button:hover"
            disabled={isGenerating}
          />
        </div>

      {/* Character References Section - always visible container */}
      <div className="mt-6 p-4 border border-purple-500/50 rounded-lg bg-slate-800/30">
        <h3 className="text-lg font-semibold text-purple-300 mb-3">Character References</h3>
        <p className="text-sm text-slate-400 mb-3">
          Add characters and reference images.
          {selectedImageModelDetails?.id === GEMINI_FLASH_CHAT_IMAGE_GEN_MODEL_ID ?
            ` The selected image model (${selectedImageModelDetails?.name}) supports direct image inputs for character consistency.` :
            ` For other image models, if you provide reference images, their visual descriptions (generated by the 'Character Analysis AI Model') will be added to image prompts.`
          }
        </p>
        
        {/* Character Analysis Model Dropdown - moved here to be visible if characters are added and model is not direct multimodal */}
        {showCharAnalysisModelDropdown && (
          <div className="mb-4"> {/* Added mb-4 for spacing */}
            {renderSelect(
              "characterAnalysisModel", 
              "Character Analysis AI Model (for Textual Description)", 
              config.characterAnalysisModel, 
              analysisModels.filter(m => m.isCharacterAnalyzer).map(m => ({ value: m.id, label: `${m.provider} - ${m.name}` })), 
              loadingModels || analysisModels.length === 0
            )}
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
          className="neon-button px-4 py-2 rounded-md text-sm transition-transform hover:scale-105"
          disabled={isGenerating}
        >
          Add Character Reference
        </button>
      </div>


      <div className="space-y-3 mt-4">
        <label className="flex items-center space-x-3 cursor-pointer">
          <input type="checkbox" name="includeCaptions" checked={config.includeCaptions} onChange={handleChange} disabled={isGenerating} className="form-checkbox h-5 w-5 text-pink-500 bg-slate-600 border-slate-500 rounded focus:ring-pink-400 focus:ring-offset-slate-800" />
          <span className="text-slate-200">Include Captions/Dialogues</span>
        </label>
        <label className="flex items-center space-x-3 cursor-pointer">
          <input type="checkbox" name="overlayText" checked={config.overlayText} onChange={handleChange} disabled={isGenerating || !config.includeCaptions} className="form-checkbox h-5 w-5 text-pink-500 bg-slate-600 border-slate-500 rounded focus:ring-pink-400 focus:ring-offset-slate-800" />
          <span className="text-slate-200">Overlay Text on Image (Experimental)</span>
        </label>
      </div>

      <div className="mt-8 text-center">
        <button
          type="submit"
          disabled={isGenerating || (storyWordCount > 0 && (storyWordCount < MIN_STORY_LENGTH || storyWordCount > MAX_STORY_LENGTH)) || config.numPages <= 0 || config.numPages > MAX_PAGES}
          className="neon-button text-lg font-bold px-8 py-3 rounded-lg shadow-lg hover:shadow-pink-500/70 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 w-full md:w-auto"
        >
          {isGenerating ? <LoadingSpinner size="sm" text="Generating..." /> : 'Generate Comic'}
        </button>
      </div>
    </form>
  );
};

export default ConfigForm;
