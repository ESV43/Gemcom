// script.js
document.addEventListener('DOMContentLoaded', () => {
    const comicForm = document.getElementById('comicForm');
    const storyInput = document.getElementById('storyInput');
    const geminiApiKeyInput = document.getElementById('geminiApiKey');
    const numPagesInput = document.getElementById('numPages');
    const textModelSelect = document.getElementById('textModelSelect');
    const imageModelSelect = document.getElementById('imageModelSelect');
    const imageStyleSelect = document.getElementById('imageStyleSelect');
    const comicEraSelect = document.getElementById('comicEraSelect');
    const aspectRatioSelect = document.getElementById('aspectRatioSelect');
    const showCaptionsBelow = document.getElementById('showCaptionsBelow');
    const showCaptionsInImage = document.getElementById('showCaptionsInImage');
    const characterImagesContainer = document.getElementById('characterImagesContainer');
    const addCharacterBtn = document.getElementById('addCharacterBtn');
    const downloadPdfBtn = document.getElementById('downloadPdfBtn');
    const comicOutput = document.getElementById('comicOutput');
    const generateBtn = comicForm.querySelector('.generate-btn');

    const POLLINATIONS_TEXT_MODELS_URL = 'https://text.pollinations.ai/models';
    const POLLINATIONS_IMAGE_MODELS_URL = 'https://image.pollinations.ai/models';
    const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models/';

    // --- Dynamic Loading of Pollinations.AI Models ---
    async function loadPollinationsModels() {
        try {
            // Load Text Models
            const textResponse = await fetch(POLLINATIONS_TEXT_MODELS_URL);
            const textModels = await textResponse.json();
            const pollinationTextOptgroup = document.getElementById('pollinationsTextModels');
            textModels.forEach(model => {
                const option = document.createElement('option');
                option.value = model.name; // Assuming 'name' is the model ID
                option.textContent = model.name;
                pollinationTextOptgroup.appendChild(option);
            });

            // Load Image Models
            const imageResponse = await fetch(POLLINATIONS_IMAGE_MODELS_URL);
            const imageModels = await imageResponse.json();
            const pollinationImageOptgroup = document.getElementById('pollinationsImageModels');
            imageModels.forEach(model => {
                const option = document.createElement('option');
                option.value = model.name; // Assuming 'name' is the model ID
                option.textContent = model.name;
                pollinationImageOptgroup.appendChild(option);
            });
            console.log("Pollinations.AI models loaded successfully.");
        } catch (error) {
            console.error('Failed to load Pollinations.AI models:', error);
            const pollinationTextOptgroup = document.getElementById('pollinationsTextModels');
            const pollinationImageOptgroup = document.getElementById('pollinationsImageModels');
            pollinationTextOptgroup.innerHTML = '<option value="" disabled>Failed to load models</option>';
            pollinationImageOptgroup.innerHTML = '<option value="" disabled>Failed to load models</option>';
            alert('Failed to load Pollinations.AI models. Some options may be missing.');
        }
    }

    // --- Character Reference Image Management ---
    let characterIdCounter = 0; // To ensure unique IDs for char image inputs

    function addCharacterRow() {
        characterIdCounter++;
        const row = document.createElement('div');
        row.classList.add('character-upload-row');
        row.innerHTML = `
            <input type="text" placeholder="Character Name" class="char-name-input" required>
            <input type="file" multiple accept="image/*" class="char-image-input" data-char-id="${characterIdCounter}" required>
            <button type="button" class="remove-char-btn">X</button>
        `;
        characterImagesContainer.insertBefore(row, addCharacterBtn);

        row.querySelector('.remove-char-btn').addEventListener('click', () => {
            row.remove();
        });
    }

    addCharacterBtn.addEventListener('click', addCharacterRow);

    // --- Form Submission Handler ---
    comicForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        generateBtn.disabled = true;
        generateBtn.textContent = 'Generating... Please wait!';
        comicOutput.innerHTML = ''; // Clear previous comic
        downloadPdfBtn.style.display = 'none'; // Hide download button until generation is complete

        const story = storyInput.value.trim();
        const geminiApiKey = geminiApiKeyInput.value.trim();
        const numPages = parseInt(numPagesInput.value, 10);
        const textModel = textModelSelect.value;
        const imageModel = imageModelSelect.value;
        const imageStyle = imageStyleSelect.value;
        const comicEra = comicEraSelect.value;
        const aspectRatio = aspectRatioSelect.value;
        let showCaptionsBelowChecked = showCaptionsBelow.checked; // Make mutable for fallback
        const showCaptionsInImageChecked = showCaptionsInImage.checked;

        // --- Input Validation ---
        if (story.length < 10) {
            alert('Please enter a comic story (minimum 10 characters).');
            resetGenerateButton();
            return;
        }
        if (numPages < 1 || numPages > 200) {
            alert('Number of pages must be between 1 and 200.');
            resetGenerateButton();
            return;
        }
        const isGeminiTextModel = textModel.startsWith('gemini');
        const isGeminiImageModel = imageModel.startsWith('imagen') || imageModel.startsWith('gemini-2.0-flash');
        if ((isGeminiTextModel || isGeminiImageModel) && !geminiApiKey) {
            alert('Please provide a Google Gemini API Key if using a Gemini model for text or image generation.');
            resetGenerateButton();
            return;
        }
        if (isGeminiImageModel) {
            alert('WARNING: Directly using Google Gemini API key from the frontend is INSECURE for production apps. A backend proxy is highly recommended to protect your key and handle CORS. Proceeding for demonstration purposes.');
        }

        // --- Gather Character Data ---
        const characters = [];
        document.querySelectorAll('.character-upload-row').forEach(row => {
            const charName = row.querySelector('.char-name-input').value.trim();
            const charImagesInput = row.querySelector('.char-image-input');
            if (charName && charImagesInput.files.length > 0) {
                characters.push({
                    name: charName,
                    files: Array.from(charImagesInput.files), // Store File objects
                    base64Images: [], // Will store base64 for Gemini Flash
                    description: '' // Will store textual description from Vision API
                });
            }
        });

        // --- Pre-process character images for Gemini Vision & Flash ---
        if (characters.length > 0 && geminiApiKey) { // Only process if characters and Gemini API key exist
            generateBtn.textContent = 'Analyzing Characters...';
            for (const char of characters) {
                if (char.files.length > 0) {
                    try {
                        // Use the first image for description and as first multimodal input
                        const primaryImageBase64 = await readFileAsBase64(char.files[0]);
                        char.base64Images.push({
                            mime_type: char.files[0].type,
                            data: primaryImageBase64.split(',')[1]
                        });

                        // Generate textual description for other models
                        const visionModel = 'gemini-1.5-flash'; // Or 'gemini-1.5-pro' for more detail
                        const visionUrl = `${GEMINI_API_BASE_URL}${visionModel}:generateContent?key=${geminiApiKey}`;
                        const visionPayload = {
                            contents: [{
                                parts: [
                                    { text: "Describe this character's appearance in detail, focusing on facial features, hairstyle, clothing, and distinguishing marks, suitable for an AI image generation prompt to maintain consistency." },
                                    { inline_data: char.base64Images[0] }
                                ]
                            }]
                        };

                        const visionResponse = await fetch(visionUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(visionPayload)
                        });
                        const visionData = await visionResponse.json();

                        if (visionData.candidates && visionData.candidates[0] && visionData.candidates[0].content && visionData.candidates[0].content.parts[0]) {
                            char.description = visionData.candidates[0].content.parts[0].text.trim();
                            console.log(`Character ${char.name} description:`, char.description);
                        } else {
                            console.warn(`Could not get description for ${char.name}.`);
                        }

                        // For Gemini Flash Image Model, process all uploaded images for direct input
                        if (imageModel === 'gemini-2.0-flash-preview-image-generation') {
                             for(let i = 1; i < char.files.length; i++) { // Start from second image
                                const additionalImageBase64 = await readFileAsBase64(char.files[i]);
                                char.base64Images.push({
                                    mime_type: char.files[i].type,
                                    data: additionalImageBase64.split(',')[1]
                                });
                            }
                        }

                    } catch (error) {
                        console.error(`Failed to process character ${char.name}:`, error);
                        alert(`Error processing character ${char.name}'s images. Check console.`);
                        resetGenerateButton();
                        return;
                    }
                }
            }
        }


        try {
            // --- Step 1: Text Generation (Comic Script) ---
            let comicScript = []; // Array of { pageNumber: N, visual: "...", dialogue: "...", caption: "..." }

            let fullStoryPrompt = `Create a detailed script for a ${numPages}-page comic based on the following story. Each entry should describe one panel/page. Focus on visual details, character actions, and dialogue. Maintain character consistency.

            Format each page strictly as follows:
            ---PAGE N---
            VISUAL: Detailed description of the scene, character poses, background, lighting. (Consider ${imageStyle} style, ${comicEra} era, ${aspectRatio} aspect ratio for visuals)
            DIALOGUE:
            Character A: "Dialogue line."
            Character B: "Another line."
            CAPTION: (Optional) "Narrative caption."
            ---END PAGE N---

            Story: "${story}"

            Characters involved (if applicable): ${characters.map(c => `${c.name} (${c.description ? c.description : 'description not available'})`).join(', ')}. Ensure character consistency throughout, especially their appearance.
            `;

            console.log("Full Story Prompt for Text Model:\n", fullStoryPrompt);

            if (isGeminiTextModel) {
                const geminiTextUrl = `${GEMINI_API_BASE_URL}${textModel}:generateContent?key=${geminiApiKey}`;
                const geminiTextPayload = {
                    contents: [{
                        parts: [{
                            text: fullStoryPrompt
                        }]
                    }]
                };

                try {
                    const textGenerationResponse = await fetch(geminiTextUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(geminiTextPayload)
                    });
                    const textGenerationData = await textGenerationResponse.json();

                    if (textGenerationData.candidates && textGenerationData.candidates[0] && textGenerationData.candidates[0].content && textGenerationData.candidates[0].content.parts[0]) {
                        const generatedText = textGenerationData.candidates[0].content.parts[0].text;
                        console.log("Gemini Text Response:\n", generatedText);
                        comicScript = parseComicScript(generatedText, numPages);
                    } else {
                        throw new Error("Failed to get valid response from Gemini Text API. Check response structure.");
                    }
                } catch (error) {
                    console.error('Error generating text with Gemini:', error);
                    alert('Error generating comic script with Gemini. Check API key, network, or console for details.');
                    throw error;
                }
            } else {
                // Pollinations.AI Text Generation (using GET for simplicity)
                const encodedPrompt = encodeURIComponent(fullStoryPrompt);
                const pollinationTextUrl = `https://text.pollinations.ai/${textModel ? textModel + '/' : ''}${encodedPrompt}`;

                try {
                    const textResponse = await fetch(pollinationTextUrl);
                    if (!textResponse.ok) {
                        throw new Error(`Pollinations.AI Text API error: ${textResponse.status} ${textResponse.statusText}`);
                    }
                    const generatedText = await textResponse.text();
                    console.log("Pollinations.AI Text Response:\n", generatedText);
                    comicScript = parseComicScript(generatedText, numPages);
                } catch (error) {
                    console.error('Error generating text with Pollinations.AI:', error);
                    alert('Error generating comic script with Pollinations.AI. See console for details.');
                    throw error;
                }
            }

            if (comicScript.length === 0) {
                alert('Failed to generate comic script from your story. Please try a different story or model.');
                throw new Error('No comic script generated or parsing failed.');
            }

            // --- Step 2: Image Generation (Page by Page) ---
            for (let i = 0; i < comicScript.length; i++) {
                const page = comicScript[i];
                let effectiveVisualPrompt = page.visual || `A scene from the story, page ${i+1}.`;
                let imageUrl;

                // Add base prompt elements for style, era, aspect ratio
                let baseImagePrompt = `${comicEra} comic style, ${imageStyle} art, ${aspectRatio} aspect ratio, `;

                // Character Consistency Logic
                let charSpecificPromptParts = [];
                let charImagesForGeminiFlash = [];

                if (characters.length > 0) {
                    // Collect relevant character data
                    characters.forEach(char => {
                        const charNameLower = char.name.toLowerCase();
                        // Check if character name is in the visual prompt for this page
                        if (effectiveVisualPrompt.toLowerCase().includes(charNameLower)) {
                            if (imageModel === 'gemini-2.0-flash-preview-image-generation' && char.base64Images.length > 0) {
                                // For Gemini Flash, use the actual base64 images directly
                                charImagesForGeminiFlash = charImagesForGeminiFlash.concat(char.base64Images);
                            } else if (char.description) {
                                // For other models, use the generated text description
                                charSpecificPromptParts.push(`${char.name}: ${char.description}`);
                            } else {
                                // Fallback if no description available
                                charSpecificPromptParts.push(`featuring ${char.name}`);
                            }
                        }
                    });
                }

                effectiveVisualPrompt = baseImagePrompt + charSpecificPromptParts.join(', ') + (charSpecificPromptParts.length > 0 ? ', ' : '') + effectiveVisualPrompt;
                effectiveVisualPrompt = effectiveVisualPrompt.replace(/, , /g, ', ').replace(/,$/g, '').trim(); // Clean up commas

                console.log(`Generating image for Page ${i + 1} with prompt:`, effectiveVisualPrompt);

                // Add a loading indicator for the current page
                const loadingDiv = document.createElement('div');
                loadingDiv.classList.add('comic-page', 'loading-page');
                loadingDiv.innerHTML = `
                    <div class="spinner"></div>
                    <p>Generating Page ${i + 1}...</p>
                `;
                comicOutput.appendChild(loadingDiv);


                if (isGeminiImageModel) {
                    const geminiImageUrlEndpoint = `${GEMINI_API_BASE_URL}${imageModel}:generateContent?key=${geminiApiKey}`;

                    let parts = [{ text: effectiveVisualPrompt }];
                    if (imageModel === 'gemini-2.0-flash-preview-image-generation' && charImagesForGeminiFlash.length > 0) {
                        charImagesForGeminiFlash.forEach(imgData => {
                            parts.push({ inline_data: imgData });
                        });
                    }

                    const geminiImagePayload = {
                        contents: [{ parts: parts }]
                    };

                    try {
                        const imageGenerationResponse = await fetch(geminiImageUrlEndpoint, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(geminiImagePayload)
                        });
                        const imageGenerationData = await imageGenerationResponse.json();

                        if (imageGenerationData.candidates && imageGenerationData.candidates[0] && imageGenerationData.candidates[0].content && imageGenerationData.candidates[0].content.parts[0] && imageGenerationData.candidates[0].content.parts[0].inline_data) {
                            imageUrl = `data:${imageGenerationData.candidates[0].content.parts[0].inline_data.mime_type};base64,${imageGenerationData.candidates[0].content.parts[0].inline_data.data}`;
                            console.log(`Gemini Image for Page ${i + 1} generated successfully.`);
                        } else {
                            throw new Error("Failed to get valid image from Gemini API response.");
                        }
                    } catch (error) {
                        console.error(`Error generating image with Gemini for page ${i+1}:`, error);
                        imageUrl = 'https://via.placeholder.com/350x250?text=Error+Gemini+Image';
                        // alert(`Error generating image for page ${i+1} with Gemini. Check console.`); // Avoid too many alerts
                    }
                } else {
                    // Pollinations.AI Image Generation
                    const encodedImagePrompt = encodeURIComponent(effectiveVisualPrompt);
                    imageUrl = `https://image.pollinations.ai/prompt/${encodedImagePrompt}`;
                    console.log(`Pollinations.AI Image for Page ${i + 1} URL:`, imageUrl);
                }

                // Replace loading indicator with actual page
                comicOutput.removeChild(loadingDiv); // Remove the loading div

                // Display the generated page
                const comicPageDiv = document.createElement('div');
                comicPageDiv.classList.add('comic-page');

                const imgElement = document.createElement('img');
                imgElement.alt = `Comic Page ${i + 1}`;
                // Set crossOrigin for CORS if images are from external domains for canvas manipulation
                if (!imageUrl.startsWith('data:')) {
                    imgElement.crossOrigin = "Anonymous";
                }

                // Handle in-image captions/dialogues
                let finalImageUrl = imageUrl;
                if (showCaptionsInImageChecked && (page.dialogue || page.caption)) {
                    try {
                        const textToDraw = (page.dialogue ? page.dialogue : '') + (page.caption ? (page.dialogue ? '\n\n' : '') + page.caption : '');
                        finalImageUrl = await drawTextOnImage(imageUrl, textToDraw);
                    } catch (canvasError) {
                        console.error(`Error drawing text on image for page ${i+1}:`, canvasError);
                        alert(`Could not draw text on image for page ${i+1}. Check browser console. Displaying captions below image instead.`);
                        showCaptionsBelowChecked = true; // Fallback
                    }
                }
                imgElement.src = finalImageUrl;
                comicPageDiv.appendChild(imgElement);

                if (showCaptionsBelowChecked && (page.dialogue || page.caption)) {
                    const captionP = document.createElement('p');
                    captionP.classList.add('caption');
                    if (page.dialogue) captionP.innerHTML += `<strong>Dialogue:</strong> ${page.dialogue.replace(/\n/g, '<br>')}<br>`;
                    if (page.caption) captionP.innerHTML += `<strong>Caption:</strong> ${page.caption}`;
                    comicPageDiv.appendChild(captionP);
                }

                comicOutput.appendChild(comicPageDiv);

                // Add a small delay between pages for visual effect and to respect potential rate limits
                await new Promise(resolve => setTimeout(resolve, 1500));
            }

            alert('Comic generation complete!');
            downloadPdfBtn.style.display = 'block';

        } catch (error) {
            console.error('Overall comic generation failed:', error);
            alert('An error occurred during comic generation. Please check the console for details.');
        } finally {
            resetGenerateButton();
        }
    });

    // --- PDF Download Function ---
    downloadPdfBtn.addEventListener('click', async () => {
        const comicPages = document.querySelectorAll('.comic-page');
        if (comicPages.length === 0) {
            alert('No comic pages to download!');
            return;
        }

        downloadPdfBtn.disabled = true;
        downloadPdfBtn.textContent = 'Generating PDF...';

        // Using ES Module for jsPDF (window.jspdf.jsPDF)
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4'); // 'p' for portrait, 'mm' for millimeters, 'a4' for page size

        const pageHeight = pdf.internal.pageSize.getHeight();
        const pageWidth = pdf.internal.pageSize.getWidth();
        const margin = 10; // mm

        for (let i = 0; i < comicPages.length; i++) {
            const pageDiv = comicPages[i];
            try {
                const canvas = await html2canvas(pageDiv, {
                    scale: 2, // Increase scale for better quality
                    useCORS: true, // Important for images loaded from external URLs
                    allowTaint: true // Allow tainted canvases (e.g., from external images)
                });

                const imgData = canvas.toDataURL('image/png');
                const imgWidth = pageWidth - 2 * margin; // Image width based on page width minus margins
                const imgHeight = (canvas.height * imgWidth) / canvas.width; // Maintain aspect ratio

                if (i > 0) {
                    pdf.addPage();
                }

                // Center the image vertically and horizontally
                const x = margin;
                const y = (pageHeight - imgHeight) / 2;

                pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);

            } catch (error) {
                console.error(`Error processing page ${i + 1} for PDF:`, error);
                alert(`Could not add page ${i + 1} to PDF. See console for details. Attempting to continue.`);
            }
        }

        pdf.save('my-ai-comic.pdf');
        downloadPdfBtn.disabled = false;
        downloadPdfBtn.textContent = 'Download Comic as PDF';
        alert('PDF download complete!');
    });


    // --- Utility Functions ---
    function resetGenerateButton() {
        generateBtn.disabled = false;
        generateBtn.textContent = 'Generate Comic';
    }

    // Utility function to read file as Base64 (for Gemini multimodal input)
    function readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
            reader.readAsDataURL(file);
        });
    }

    // Function to parse the comic script generated by the text model
    function parseComicScript(rawText, expectedPages) {
        const pages = [];
        // Regex to capture page number, visual, dialogue, and caption
        const pageRegex = /---PAGE (\d+)---\s*VISUAL:\s*([\s\S]*?)(?=(?:\nDIALOGUE:|\nCAPTION:|---END PAGE \d+---|$))\s*(?:DIALOGUE:\s*([\s\S]*?))?\s*(?:CAPTION:\s*([\s\S]*?))?\s*---END PAGE \d+---/g;
        let match;
        let currentPageNum = 1; // Track expected page number to fill gaps if any

        while ((match = pageRegex.exec(rawText)) !== null && pages.length < expectedPages) {
            const pageNum = parseInt(match[1], 10);
            const visual = (match[2] || '').trim();
            const dialogue = (match[3] || '').trim();
            const caption = (match[4] || '').trim();

            // Fill in missing pages if the script skips numbers
            while (currentPageNum < pageNum && pages.length < expectedPages) {
                console.warn(`Script skipped page ${currentPageNum}. Adding generic page.`);
                pages.push({
                    pageNumber: currentPageNum,
                    visual: `A scene continuing the story from the previous page.`,
                    dialogue: `[Dialogue for page ${currentPageNum}]`,
                    caption: `[Caption for page ${currentPageNum}]`
                });
                currentPageNum++;
            }

            if (pages.length < expectedPages) { // Ensure we don't exceed expectedPages
                pages.push({
                    pageNumber: pageNum,
                    visual: visual,
                    dialogue: dialogue,
                    caption: caption
                });
                currentPageNum = pageNum + 1;
            }
        }

        // Fallback or fill remaining pages if parsing failed or not enough pages were generated
        if (pages.length === 0) {
            console.warn("Could not parse any comic script pages. Generating generic pages.");
        }
        while (pages.length < expectedPages) {
            pages.push({
                pageNumber: pages.length + 1,
                visual: `A new scene from the comic story.`,
                dialogue: `[Dialogue for page ${pages.length + 1}]`,
                caption: `[Caption for page ${pages.length + 1}]`
            });
        }
        return pages.slice(0, expectedPages); // Ensure we don't return more than expected
    }

    // --- Function to draw text on image (for experimental in-image captions) ---
    async function drawTextOnImage(imageUrl, text) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "Anonymous"; // Crucial for CORS if loading from external domain
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');

                ctx.drawImage(img, 0, 0);

                // Text properties
                ctx.font = 'bold 24px Arial, sans-serif';
                ctx.fillStyle = 'white';
                ctx.strokeStyle = 'black';
                ctx.lineWidth = 4; // Outline thickness

                const padding = 20;
                let x = padding;
                let y = img.height - padding; // Start from bottom, move up

                const maxWidth = img.width - 2 * padding;
                const lineHeight = 30;

                // Split text into lines
                const words = text.split(' ');
                let currentLine = '';
                let lines = [];

                for (let n = 0; n < words.length; n++) {
                    const testLine = currentLine + words[n] + ' ';
                    const metrics = ctx.measureText(testLine);
                    const testWidth = metrics.width;
                    if (testWidth > maxWidth && n > 0) {
                        lines.push(currentLine);
                        currentLine = words[n] + ' ';
                    } else {
                        currentLine = testLine;
                    }
                }
                lines.push(currentLine);

                // Draw lines from bottom up
                for (let i = lines.length - 1; i >= 0; i--) {
                    ctx.strokeText(lines[i], x, y);
                    ctx.fillText(lines[i], x, y);
                    y -= lineHeight;
                }

                resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = (e) => {
                console.error("Image loading error for canvas drawing:", e);
                reject(new Error("Failed to load image for text drawing (CORS issue?)."));
            };
            img.src = imageUrl;
        });
    }

    // Load models when the page loads
    loadPollinationsModels();
});
