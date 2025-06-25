
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { GeneratedPanel } from '../types';

export const downloadComicAsPDF = async (panels: GeneratedPanel[], comicTitle: string = 'AI_Comic'): Promise<void> => {
  if (panels.length === 0) {
    alert('No panels to download.');
    return;
  }

  const pdf = new jsPDF({
    orientation: 'p', // portrait
    unit: 'px', // use pixels
    format: 'a4', // default, will be adjusted by image size
  });

  const statusElement = document.createElement('div');
  statusElement.innerText = 'Preparing PDF... 0%';
  statusElement.style.position = 'fixed';
  statusElement.style.bottom = '20px';
  statusElement.style.left = '20px';
  statusElement.style.padding = '10px 20px';
  statusElement.style.background = 'rgba(0, 229, 255, 0.9)';
  statusElement.style.color = '#1a1a2e';
  statusElement.style.borderRadius = '5px';
  statusElement.style.zIndex = '10000';
  statusElement.style.boxShadow = '0 0 10px #00e5ff';
  document.body.appendChild(statusElement);

  for (let i = 0; i < panels.length; i++) {
    const panelId = `comic-panel-pdf-${panels[i].id}`;
    const panelElement = document.getElementById(panelId);

    if (panelElement) {
      try {
        // Temporarily ensure visibility for html2canvas if elements are hidden
        const originalDisplay = panelElement.style.display;
        panelElement.style.display = 'block'; 
        
        const canvas = await html2canvas(panelElement, {
          scale: 2, // Increase scale for better quality
          useCORS: true, // Important for external images
          logging: false,
          backgroundColor: '#1a1a2e', // Match app background
        });
        panelElement.style.display = originalDisplay;


        const imgData = canvas.toDataURL('image/png');
        
        const imgProps = pdf.getImageProperties(imgData);
        const pdfPageWidth = pdf.internal.pageSize.getWidth();
        const pdfPageHeight = pdf.internal.pageSize.getHeight();

        const imgWidth = imgProps.width;
        const imgHeight = imgProps.height;

        // Calculate scaling to fit image within A4 page, maintaining aspect ratio
        let newWidth, newHeight;
        if (imgWidth / imgHeight >= pdfPageWidth / pdfPageHeight) {
            newWidth = pdfPageWidth;
            newHeight = (imgHeight * pdfPageWidth) / imgWidth;
        } else {
            newHeight = pdfPageHeight;
            newWidth = (imgWidth * pdfPageHeight) / imgHeight;
        }
        
        // Center image on page
        const x = (pdfPageWidth - newWidth) / 2;
        const y = (pdfPageHeight - newHeight) / 2;


        if (i > 0) {
          pdf.addPage();
        }
        pdf.addImage(imgData, 'PNG', x, y, newWidth, newHeight);
        
        const progress = Math.round(((i + 1) / panels.length) * 100);
        statusElement.innerText = `Preparing PDF... ${progress}%`;

      } catch (error) {
        console.error(`Error processing panel ${panels[i].id} for PDF:`, error);
        alert(`Could not process panel ${i + 1}. Skipping.`);
      }
    } else {
        console.warn(`Panel element with ID ${panelId} not found for PDF generation.`);
    }
  }
  
  statusElement.innerText = 'Downloading PDF...';
  pdf.save(`${comicTitle.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.pdf`);
  document.body.removeChild(statusElement);
};