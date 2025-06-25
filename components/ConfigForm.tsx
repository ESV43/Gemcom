import React, { useState, useEffect, useCallback } from 'react';
import { ComicConfig, CharacterReference, ModelOption, ApiProvider } from '../types';
import CharacterReferenceInput from './CharacterReferenceInput';
import {
  IMAGE_STYLES, COMIC_ERAS, ASPECT_RATIOS, MAX_PAGES,
  MIN_STORY_LENGTH, MAX_STORY_LENGTH, DEFAULT_TEXT_MODELS,
  DEFAULT_IMAGE_MODELS, DEFAULT_CONFIG_VALUES,
  GEMINI_FLASH_CHAT_IMAGE_GEN_MODEL_ID
} from '../constants';
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
  const [analysisModels, setAnalysisModels] = useState<ModelOption[]>([]); // populated in App.tsx now
  const [storyWordCount, setStoryWordCount] = useState(0);

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

  return (
    <form onSubmit={handleSubmit} className="pro-container space-y-8">
      <div>
        <h2 className="section-header">Configuration</h2>
        <div className="space-y-6">
            <div>
                <label htmlFor="apiKey" className="form-label">Gemini API Key</label>
                <input
                    id="apiKey"
                    name="apiKey"
                    type="password"
                    value={apiKey}
                    onChange={(e) => onApiKeyChange(e.target.value)}
                    placeholder="Enter your Gemini API key"
                    className="pro-input"
                    disabled={isGenerating}
                />
                {apiKeyError && <p className="text-xs mt-2 text-red-400">{apiKeyError}</p>}
            </div>
            <div>
                <label htmlFor="storyScript" className="form-label">Story Script ({storyWordCount} words)</label>
                <textarea
                id="storyScript"
                name="storyScript"
                value={config.storyScript}
                onChange={handleChange}
                rows={8}
                placeholder={`Enter your comic story here (${MIN_STORY_LENGTH}-${MAX_STORY_LENGTH} words)...`}
                className="pro-input resize-y"
                disabled={isGenerating}
                />
                 <p className={`text-xs mt-2 ${storyWordCount > 0 && (storyWordCount < MIN_STORY_LENGTH || storyWordCount > MAX_STORY_LENGTH) ? 'text-red-400' : 'text-slate-400'}`}>
                    Min: {MIN_STORY_LENGTH}, Max: {MAX_STORY_LENGTH}
                </p>
            </div>
        </div>
      </div>

      <div>
        <h3 className="section-header">AI Models & Style</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <label htmlFor="textModel" className="form-label">Text Model</label>
                <select id="textModel" name="textModel" value={config.textModel} onChange={handleChange} disabled={isGenerating} className="pro-input">
                    {textModels.map(m => ({value: m.id, label: `${m.provider} - ${m.name}`})).map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
            </div>
            <div>
                <label htmlFor="imageModel" className="form-label">Image Model</label>
                <select id="imageModel" name="imageModel" value={config.imageModel} onChange={handleChange} disabled={isGenerating} className="pro-input">
                    {imageModels.map(m => ({value: m.id, label: `${m.provider} - ${m.name}`})).map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
            </div>
            <div>
                <label htmlFor="imageStyle" className="form-label">Image Style</label>
                <select id="imageStyle" name="imageStyle" value={config.imageStyle} onChange={handleChange} disabled={isGenerating} className="pro-input">
                    {IMAGE_STYLES.map(s => ({value: s, label: s})).map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
            </div>
            <div>
                <label htmlFor="comicEra" className="form-label">Comic Era</label>
                <select id="comicEra" name="comicEra" value={config.comicEra} onChange={handleChange} disabled={isGenerating} className="pro-input">
                    {COMIC_ERAS.map(e => ({value: e, label: e})).map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
            </div>
        </div>
      </div>

      <div>
          <h3 className="section-header">Output Settings</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <div>
                <label htmlFor="aspectRatio" className="form-label">Aspect Ratio</label>
                <select id="aspectRatio" name="aspectRatio" value={config.aspectRatio} onChange={handleChange} disabled={isGenerating} className="pro-input">
                    {Object.entries(ASPECT_RATIOS).map(([key, val])=> ({value: key, label: val.label})).map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
            </div>
             <div>
                <label htmlFor="numPages" className="form-label">Number of Pages</label>
                <input type="number" id="numPages" name="numPages" value={config.numPages} onChange={handleChange} min="1" max={MAX_PAGES} className="pro-input" disabled={isGenerating}/>
            </div>
            <div>
                <label htmlFor="seed" className="form-label">Image Seed (0 for random)</label>
                <input type="number" id="seed" name="seed" value={config.seed} onChange={handleChange} min="0" className="pro-input" disabled={isGenerating}/>
            </div>
          </div>
          <div className="mt-6 space-y-4">
              <label className="pro-checkbox-wrapper">
                  <input type="checkbox" name="includeCaptions" checked={config.includeCaptions} onChange={handleChange} disabled={isGenerating} className="pro-checkbox" />
                  <span className="text-sm text-slate-200">Include Captions/Dialogues</span>
              </label>
              <label className="pro-checkbox-wrapper">
                  <input type="checkbox" name="overlayText" checked={config.overlayText} onChange={handleChange} disabled={isGenerating || !config.includeCaptions} className="pro-checkbox" />
                  <span className="text-sm text-slate-200">Overlay Text on Image (Experimental)</span>
              </label>
          </div>
      </div>

      <div>
        <h3 className="section-header">Character References</h3>
        <div className="p-4 bg-slate-950 rounded-lg">
            <p className="text-sm text-slate-400 mb-4">
              Add characters and reference images for better consistency. For non-multimodal models, an AI-generated description of the images will be used in the prompt.
            </p>
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
            className="pro-button pro-button-secondary"
            disabled={isGenerating}
            >
            Add Character
            </button>
        </div>
      </div>

      <div className="mt-8 pt-8 border-t border-slate-800 text-right">
        <button
          type="submit"
          disabled={isGenerating || (storyWordCount > 0 && (storyWordCount < MIN_STORY_LENGTH || storyWordCount > MAX_STORY_LENGTH)) || config.numPages <= 0 || config.numPages > MAX_PAGES}
          className="pro-button pro-button-primary w-full md:w-auto text-base"
        >
          {isGenerating ? <LoadingSpinner size="sm" text="Generating..." /> : 'Generate Comic'}
        </button>
      </div>
    </form>
  );
};

export default ConfigForm;
