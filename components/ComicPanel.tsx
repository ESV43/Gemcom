
import React, { useState, useEffect } from 'react';
import { GeneratedPanel } from '../types';
import LoadingSpinner from './LoadingSpinner';

interface ComicPanelProps {
  panel: GeneratedPanel;
  panelNumber: number;
  overlayTextGlobal: boolean; // Global setting from App state
  aspectRatioClass: string;
}

const ComicPanel: React.FC<ComicPanelProps> = ({ panel, panelNumber, overlayTextGlobal, aspectRatioClass }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageErrorState, setImageErrorState] = useState(false);

  // ID for PDF generation
  const pdfPanelId = `comic-panel-pdf-${panel.id}`;

  useEffect(() => {
    // Reset load/error state if panel imageUrl changes (e.g., regeneration)
    setImageLoaded(false);
    setImageErrorState(false);
  }, [panel.imageUrl]);

  const handleImageLoad = () => {
    setImageLoaded(true);
    setImageErrorState(false);
  };

  const handleImageError = () => {
    setImageLoaded(true); // Stop loading spinner even on error
    setImageErrorState(true);
    console.error(
        `ERROR: Image could not be loaded for panel ${panelNumber}. Problematic URL: ${panel.imageUrl}`,
        'Panel Data:', panel,
        'If this issue persists with a specific image provider (e.g., Pollinations.ai), try selecting a different image model or simplifying the panel\'s scene description.'
      );
  };
  
  const textToShow = panel.dialogueOrCaption || "No text for this panel.";
  const displayImageError = panel.imageError || imageErrorState;

  return (
    <div id={pdfPanelId} className="bg-slate-800/70 p-4 rounded-xl shadow-xl neon-border border-2 border-transparent hover:border-pink-500/70 transition-all duration-300 mb-6 flex flex-col items-center w-full">
      <h3 className="text-xl font-semibold text-pink-400 mb-3 neon-text">Panel {panelNumber}</h3>
      
      <div className={`relative w-full ${aspectRatioClass} bg-slate-700 rounded-lg overflow-hidden flex items-center justify-center mb-3 shadow-inner`}>
        {panel.isGenerating && <LoadingSpinner text="Generating Image..." />}
        
        {!panel.isGenerating && panel.imageUrl && !displayImageError && (
          <img
            src={panel.imageUrl}
            alt={`Comic panel ${panelNumber} - ${panel.sceneDescription.substring(0, 50)}...`}
            className="w-full h-full object-contain"
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
        )}

        {!panel.isGenerating && displayImageError && (
          <div className="w-full h-full flex flex-col items-center justify-center text-red-400 p-4 text-center">
            <p className="text-lg font-semibold">Image Error</p>
            <p className="text-sm">
                {panel.imageError || "Could not load image. Check console for problematic URL and advice."}
            </p>
          </div>
        )}

        {!panel.isGenerating && !panel.imageUrl && !displayImageError && (
             <div className="w-full h-full flex items-center justify-center text-slate-400">Image will appear here.</div>
        )}

        {/* Show loading overlay if image isn't loaded yet but URL exists and no error */}
        {!panel.isGenerating && panel.imageUrl && !imageLoaded && !displayImageError && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-700/50">
                <LoadingSpinner text="Loading Image..." />
            </div>
        )}


        {overlayTextGlobal && panel.imageUrl && !displayImageError && imageLoaded && (
          <div className="absolute bottom-4 left-4 right-4 p-1 md:p-2">
            <div className="speech-bubble speech-bubble-bottom text-sm md:text-base max-h-24 overflow-y-auto">
              {textToShow}
            </div>
          </div>
        )}
      </div>

      {!overlayTextGlobal && (
        <div className="w-full mt-2 p-3 bg-slate-700/50 rounded-md text-slate-200 text-sm italic max-h-32 overflow-y-auto">
          <strong className="text-purple-300 block mb-1">Scene:</strong>
          <p className="mb-2 text-xs">{panel.sceneDescription}</p>
          {panel.dialogueOrCaption && (
            <>
              <strong className="text-green-300 block mb-1">Text:</strong>
              <p className="text-sm">{textToShow}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ComicPanel;
