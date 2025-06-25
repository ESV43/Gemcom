import React, { useState, useCallback } from 'react';
import { CharacterReference } from '../types';
import { MAX_CHAR_REF_IMAGES } from '../constants';

interface CharacterReferenceInputProps {
  character: CharacterReference;
  onUpdate: (character: CharacterReference) => void;
  onRemove: (characterId: string) => void;
  isGenerating: boolean;
}

const CharacterReferenceInput: React.FC<CharacterReferenceInputProps> = ({ character, onUpdate, onRemove, isGenerating }) => {
  const [name, setName] = useState<string>(character.name);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    onUpdate({ ...character, name: e.target.value });
  };

  const handleImageUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && character.images.length < MAX_CHAR_REF_IMAGES) {
      const file = event.target.files[0];
      if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const newImage = {
            id: Date.now().toString(),
            base64: reader.result as string,
            file: file
          };
          onUpdate({ ...character, images: [...character.images, newImage] });
        };
        reader.readAsDataURL(file);
      } else {
        alert('Please upload a valid image file.');
      }
    } else if (character.images.length >= MAX_CHAR_REF_IMAGES) {
        alert(`Maximum of ${MAX_CHAR_REF_IMAGES} reference images per character reached.`);
    }
    // Reset the input value to allow uploading the same file again
    event.target.value = ''; 
  }, [character, onUpdate]);

  const removeImage = (imageId: string) => {
    onUpdate({ ...character, images: character.images.filter(img => img.id !== imageId) });
  };

  return (
    <div className="p-4 border border-slate-800 rounded-lg bg-slate-900/50 mb-4">
      <div className="flex justify-between items-start mb-3 gap-4">
        <div className="flex-grow">
            <label htmlFor={`char-name-${character.id}`} className="form-label !mb-1">Character Name</label>
            <input
            id={`char-name-${character.id}`}
            type="text"
            value={name}
            onChange={handleNameChange}
            placeholder="E.g., Captain Astro"
            className="pro-input"
            disabled={isGenerating}
            />
        </div>
        <button
          onClick={() => onRemove(character.id)}
          className="pro-button pro-button-danger mt-7"
          disabled={isGenerating}
        >
          Remove
        </button>
      </div>
      <div>
        <label className="form-label">Reference Images ({character.images.length}/{MAX_CHAR_REF_IMAGES})</label>
        {character.images.length < MAX_CHAR_REF_IMAGES && (
            <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-slate-700 file:text-slate-200 hover:file:bg-slate-600 cursor-pointer disabled:cursor-not-allowed"
            disabled={isGenerating}
            />
        )}
      </div>
      {character.images.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 mt-3">
            {character.images.map(img => (
            <div key={img.id} className="relative group aspect-square">
                <img src={img.base64} alt={`Ref ${img.id}`} className="w-full h-full object-cover rounded-md border-2 border-slate-600 group-hover:border-neon-blue" />
                <button
                onClick={() => removeImage(img.id)}
                className="absolute top-1 right-1 bg-black/60 hover:bg-red-600/80 text-white rounded-full p-0.5 w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Remove image"
                disabled={isGenerating}
                >
                ×
                </button>
            </div>
            ))}
        </div>
      )}
    </div>
  );
};

export default CharacterReferenceInput;
