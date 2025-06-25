import React, { useState, useCallback } from 'react';
import { CharacterReference } from '../types';
import { MAX_CHAR_REF_IMAGES } from '../constants';

interface CharacterReferenceInputProps {
  character: CharacterReference;
  onUpdate: (character: CharacterReference) => void;
  onRemove: (characterId: string) => void;
}

const CharacterReferenceInput: React.FC<CharacterReferenceInputProps> = ({ character, onUpdate, onRemove }) => {
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
    // Reset file input to allow uploading the same file again if removed
    event.target.value = ''; 
  }, [character, onUpdate]);

  const removeImage = (imageId: string) => {
    onUpdate({ ...character, images: character.images.filter(img => img.id !== imageId) });
  };

  return (
    <div className="p-4 border border-cyan-700/50 rounded-lg shadow-lg bg-slate-800/50 backdrop-blur-sm mb-4 transition-all duration-300 hover:shadow-cyan-500/20">
      <div className="flex justify-between items-center mb-3">
        <input
          type="text"
          value={name}
          onChange={handleNameChange}
          placeholder="Character Name"
          className="neon-input text-white placeholder-slate-400 p-2 rounded-md flex-grow mr-2"
        />
        <button
          onClick={() => onRemove(character.id)}
          className="neon-button-remove px-3 py-1 text-sm flex-shrink-0"
        >
          Remove
        </button>
      </div>
      <div className="mb-2">
        <label className="block text-sm font-medium text-cyan-300 mb-1">Reference Images ({character.images.length}/{MAX_CHAR_REF_IMAGES}):</label>
        {character.images.length < MAX_CHAR_REF_IMAGES && (
            <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="block w-full text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-cyan-600 file:text-black hover:file:bg-cyan-500 cursor-pointer"
            />
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 mt-2">
        {character.images.map(img => (
          <div key={img.id} className="relative group">
            <img src={img.base64} alt={`Ref ${img.id}`} className="w-full h-24 object-cover rounded-md border-2 border-slate-600 group-hover:border-cyan-500" />
            <button
              onClick={() => removeImage(img.id)}
              className="absolute top-1 right-1 bg-red-600/80 hover:bg-red-500 text-white rounded-full p-0.5 w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Remove image"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CharacterReferenceInput;
