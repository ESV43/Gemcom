import React, { useState, useEffect } from 'react';
import { GeneratedPanel } from '../types';
import LoadingSpinner from './LoadingSpinner';

interface ComicPanelProps {
  panel: GeneratedPanel;
  panelNumber: number;
  overlayTextGlobal: boolean; 
  aspectRatioClass: string;
}

const ComicPanel: React.FC<ComicPanelProps> = ({ panel, panelNumber, overlayTextGlobal, aspectRatioClass }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageErrorState, setImageErrorState] = useState(false);

  const pdfPanelId = `comic-panel-pdf-${panel.id}`;

  useEffect(() => {
    setImageLoaded(false);
    setImageErrorState(false);
  }, [panel.imageUrl]);

  const handleImageLoad = () => {
    setImageLoaded(true);
    setImageErrorState(false);
  };

  const handleImageError = () => {
    setImageLoaded(true); 
    setImageErrorState(true);
  };
  
  const textToShow = panel.dialogueOrCaption || " ";
  const displayImageError = panel.imageError || imageErrorState;

  return (
    <div id={pdfPanelId} className="comic-panel-card p-3 flex flex-col w-full space-y-3">
      <h3 className="text-lg font-semibold text-slate-100 text-center">Panel {panelNumber}</h3>
      
      <div className={`relative w-full ${aspectRatioClass} bg-slate-950 rounded-md overflow-hidden flex items-center justify-center shadow-inner`}>
        {panel.isGenerating && <LoadingSpinner text="Generating Image..." />}
        
        {!panel.isGenerating && panel.imageUrl && !displayImageError && (
          <img
            src={panel.imageUrl}
            alt={`Comic panel ${panelNumber}`}
            className="w-full h-full object-contain"
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
        )}

        {!panel.isGenerating && displayImageError && (
          <div className="w-full h-full flex flex-col items-center justify-center text-red-400 p-4 text-center">
            <p className="font-semibold">Image Error</p>
            <p className="text-sm mt-1">{panel.imageError || "Could not load image."}</p>
          </div>
        )}

        {!panel.isGenerating && !panel.imageUrl && !displayImageError && (
             <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm">Image will appear here.</div>
        )}

        {!panel.isGenerating && panel.imageUrl && !imageLoaded && !displayImageError && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80">
                <LoadingSpinner text="Loading Image..." />
            </div>
        )}
      </div>

      {!overlayTextGlobal && (
        <div className="w-full p-3 bg-slate-800/50 rounded-md text-slate-300 text-sm space-y-2">
          <div>
            <strong className="text-slate-400 block text-xs font-medium">Scene:</strong>
            <p className="text-sm">{panel.sceneDescription}</p>
          </div>
          {panel.dialogueOrCaption && panel.dialogueOrCaption.trim() && (
            <div>
              <strong className="text-slate-400 block text-xs font-medium">Text:</strong>
              <p className="text-sm italic">"{textToShow}"</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ComicPanel;
