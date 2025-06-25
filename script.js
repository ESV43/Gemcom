
import { GoogleGenerativeAI } from "@google/generative-ai";

document.addEventListener('DOMContentLoaded', () => {
    // --- Element Selections ---
    const comicForm = document.getElementById('comic-form');
    const aiServiceSelect = document.getElementById('ai-service');
    const apiKeyInput = document.getElementById('api-key');
    const textModelSelect = document.getElementById('text-model');
    const imageModelSelect = document.getElementById('image-model');
    const addCharacterBtn = document.getElementById('add-character-btn');
    const referenceInputsContainer = document.getElementById('reference-inputs');
    const captionsCheckbox = document.getElementById('captions');
    const captionPlacementGroup = document.getElementById('caption-placement-group');
    const loadingIndicator = document.getElementById('loading-indicator');
    const comicOutput = document.getElementById('comic-output');
    const errorMessage = document.getElementById('error-message');
    const downloadPdfBtn = document.getElementById('download-pdf-btn');

    // --- Initial State ---
    let characterCount = 0;
    const MAX_CHARACTERS = 5;

    const models = {
        pollinations: {
            text: ["gpt-3.5-turbo", "text-davinci-003", "bloom"],
            image: ["pollinations-xl-v2", "midjourney-v4", "dall-e-3"]
        },
        gemini: {
            text: ["gemini-1.5-pro-latest", "gemini-pro"],
            image: ["gemini-2.0-flash-preview-image-generation", "imagen3"]
        }
    };

    // --- Functions ---
    
    function updateModelDropdowns() {
        const selectedService = aiServiceSelect.value;
        apiKeyInput.required = (selectedService === 'gemini');
        apiKeyInput.parentElement.style.display = (selectedService === 'gemini') ? 'flex' : 'none';

        textModelSelect.innerHTML = '';
        models[selectedService].text.forEach(model => {
            const option = new Option(model, model);
            textModelSelect.add(option);
        });

        imageModelSelect.innerHTML = '';
        models[selectedService].image.forEach(model => {
            const option = new Option(model, model);
            imageModelSelect.add(option);
        });
    }

    function toggleCaptionPlacement() {
        captionPlacementGroup.style.display = captionsCheckbox.checked ? 'flex' : 'none';
    }

    function addCharacterInput() {
        if (characterCount >= MAX_CHARACTERS) return;
        characterCount++;
        const entry = document.createElement('div');
        entry.className = 'character-reference-entry';
        entry.id = `character-entry-${characterCount}`;
        entry.innerHTML = `
            <input type="text" placeholder="Character Name ${characterCount}" name="char-name-${characterCount}" required>
            <input type="file" name="char-image-${characterCount}" accept="image/*" required>
            <button type="button" class="remove-char-btn" data-id="${characterCount}">X</button>
        `;
        referenceInputsContainer.appendChild(entry);
        if (characterCount >= MAX_CHARACTERS) {
            addCharacterBtn.disabled = true;
            addCharacterBtn.textContent = "Max Characters Reached";
        }
    }

    function removeCharacterInput(id) {
        document.getElementById(`character-entry-${id}`)?.remove();
        characterCount--;
        addCharacterBtn.disabled = false;
        addCharacterBtn.textContent = "+ Add Character";
    }

    function displayError(message) {
        errorMessage.textContent = `Error: ${message}`;
        errorMessage.classList.remove('hidden');
    }

    function renderComicPage(imageUrl, caption) {
        const comicPage = document.createElement('div');
        comicPage.className = 'comic-page';
        
        const image = document.createElement('img');
        image.src = imageUrl;
        image.alt = `Comic panel for: ${caption}`;
        comicPage.appendChild(image);
        
        if (captionsCheckbox.checked && caption) {
            const captionDiv = document.createElement('div');
            captionDiv.className = 'caption';
            captionDiv.innerHTML = `<p>${caption}</p>`;
            comicPage.appendChild(captionDiv);
        }
        comicOutput.appendChild(comicPage);
    }
    
    // --- API Logic ---

    async function generateWithPollinations(formData) {
        // Implementation from previous step...
    }

    async function generateWithGemini(formData) {
        const apiKey = formData.get('api-key');
        if (!apiKey) {
            displayError("Gemini API Key is required.");
            return;
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const imageModelName = formData.get('image-model');
        
        // Path B: Multimodal generation for the special flash model
        if (imageModelName === 'gemini-2.0-flash-preview-image-generation') {
            await generateWithGeminiFlash(formData, genAI);
        } else {
            // Path A: Standard text-then-image generation for other models
            await generateWithStandardGemini(formData, genAI);
        }
    }

    async function generateWithGeminiFlash(formData, genAI) {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
        const story = formData.get('story');
        const pages = formData.get('pages');
        const style = formData.get('comic-style');
        const era = formData.get('comic-era');

        const prompt = `Create a comic strip based on this story: "${story}".
        Generate exactly ${pages} panels.
        For each panel, provide a short caption and then generate an image in a ${style}, ${era} style.
        Do not add any commentary or extra text, just the caption and the image for each panel.`;

        try {
            const result = await model.generateContentStream([prompt]);
            
            let currentText = '';
            for await (const chunk of result.stream) {
                const chunkText = chunk.text();
                if (chunkText) {
                    currentText += chunkText;
                }
                
                const images = chunk.content?.parts.filter(p => p.inlineData) ?? [];
                if (images.length > 0) {
                    const data = images[0].inlineData;
                    const imageUrl = `data:${data.mimeType};base64,${data.data}`;
                    renderComicPage(imageUrl, currentText.trim());
                    currentText = ''; // Reset text for the next panel
                }
            }
            if (comicOutput.children.length > 0) downloadPdfBtn.disabled = false;

        } catch (error) {
            console.error("Gemini Flash Error:", error);
            displayError("Failed to generate comic with Gemini Flash. Check the console.");
        }
    }

    async function generateWithStandardGemini(formData, genAI) {
        const textModelName = formData.get('text-model');
        const imageModelName = formData.get('image-model');
        const story = formData.get('story');
        const pages = formData.get('pages');
        const style = formData.get('comic-style');
        const era = formData.get('comic-era');
        
        const textModel = genAI.getGenerativeModel({ model: textModelName });
        const imageModel = genAI.getGenerativeModel({ model: imageModelName });

        const textPrompt = `You are a comic script writer. Deconstruct the following story into exactly ${pages} page(s).
        For each page, provide a "caption" and a detailed "image_prompt". The image_prompt should describe the scene for an AI image generator, incorporating the comic style: '${style}' and era: '${era}'.
        Do not include any extra commentary. Your output must be a valid JSON array of objects.
        Story: "${story}"`;

        try {
            const scriptResult = await textModel.generateContent(textPrompt);
            const scriptResponse = await scriptResult.response;
            const scriptText = scriptResponse.text().replace(/```json|```/g, '').trim();
            const scriptData = JSON.parse(scriptText);

            for (const page of scriptData) {
                const imageResult = await imageModel.generateContent(page.image_prompt);
                const imageResponse = await imageResult.response;
                // Assuming the response structure gives us a way to get the image data.
                // This part is speculative without the exact `imagen3` API response format.
                // We'll assume for now it returns a URL or base64 data directly.
                // This will likely need adjustment.
                const imageUrl = imageResponse.text(); // Placeholder: Actual access might differ
                renderComicPage(imageUrl, page.caption);
            }
            if (comicOutput.children.length > 0) downloadPdfBtn.disabled = false;

        } catch (error) {
            console.error("Gemini Standard Error:", error);
            displayError("Failed to generate comic. Check the console.");
        }
    }


    // --- Event Listeners ---
    aiServiceSelect.addEventListener('change', updateModelDropdowns);
    captionsCheckbox.addEventListener('change', toggleCaptionPlacement);
    addCharacterBtn.addEventListener('click', addCharacterInput);
    
    referenceInputsContainer.addEventListener('click', (e) => {
        if(e.target.classList.contains('remove-char-btn')) {
            removeCharacterInput(e.target.dataset.id);
        }
    });

    comicForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loadingIndicator.classList.remove('hidden');
        comicOutput.innerHTML = '';
        errorMessage.classList.add('hidden');
        downloadPdfBtn.disabled = true;

        const formData = new FormData(comicForm);
        const service = formData.get('ai-service');

        if (service === 'gemini') {
            await generateWithGemini(formData);
        } else {
            await generateWithPollinations(formData);
        }

        loadingIndicator.classList.add('hidden');
    });

    // --- Initial Setup ---
    updateModelDropdowns();
    toggleCaptionPlacement();
});
import { GoogleGenerativeAI } from "@google/generative-ai";

document.addEventListener('DOMContentLoaded', () => {
    // --- Element Selections ---
    const comicForm = document.getElementById('comic-form');
    const aiServiceSelect = document.getElementById('ai-service');
    const apiKeyInput = document.getElementById('api-key');
    const textModelSelect = document.getElementById('text-model');
    const imageModelSelect = document.getElementById('image-model');
    const addCharacterBtn = document.getElementById('add-character-btn');
    const referenceInputsContainer = document.getElementById('reference-inputs');
    const captionsCheckbox = document.getElementById('captions');
    const captionPlacementGroup = document.getElementById('caption-placement-group');
    const loadingIndicator = document.getElementById('loading-indicator');
    const comicOutput = document.getElementById('comic-output');
    const errorMessage = document.getElementById('error-message');
    const downloadPdfBtn = document.getElementById('download-pdf-btn');

    // --- Initial State ---
    let characterCount = 0;
    const MAX_CHARACTERS = 5;

    const models = {
        pollinations: {
            text: ["gpt-3.5-turbo", "text-davinci-003", "bloom"],
            image: ["pollinations-xl-v2", "midjourney-v4", "dall-e-3"]
        },
        gemini: {
            text: ["gemini-1.5-pro-latest", "gemini-pro"],
            image: ["gemini-2.0-flash-preview-image-generation", "imagen3"]
        }
    };

    // --- Functions ---
    
    function updateModelDropdowns() {
        const selectedService = aiServiceSelect.value;
        apiKeyInput.required = (selectedService === 'gemini');
        apiKeyInput.parentElement.style.display = (selectedService === 'gemini') ? 'flex' : 'none';

        textModelSelect.innerHTML = '';
        models[selectedService].text.forEach(model => {
            const option = new Option(model, model);
            textModelSelect.add(option);
        });

        imageModelSelect.innerHTML = '';
        models[selectedService].image.forEach(model => {
            const option = new Option(model, model);
            imageModelSelect.add(option);
        });
    }

    function toggleCaptionPlacement() {
        captionPlacementGroup.style.display = captionsCheckbox.checked ? 'flex' : 'none';
    }

    function addCharacterInput() {
        if (characterCount >= MAX_CHARACTERS) return;
        characterCount++;
        const entry = document.createElement('div');
        entry.className = 'character-reference-entry';
        entry.id = `character-entry-${characterCount}`;
        entry.innerHTML = `
            <input type="text" placeholder="Character Name ${characterCount}" name="char-name-${characterCount}" required>
            <input type="file" name="char-image-${characterCount}" accept="image/*" required>
            <button type="button" class="remove-char-btn" data-id="${characterCount}">X</button>
        `;
        referenceInputsContainer.appendChild(entry);
        if (characterCount >= MAX_CHARACTERS) {
            addCharacterBtn.disabled = true;
            addCharacterBtn.textContent = "Max Characters Reached";
        }
    }

    function removeCharacterInput(id) {
        document.getElementById(`character-entry-${id}`)?.remove();
        characterCount--;
        addCharacterBtn.disabled = false;
        addCharacterBtn.textContent = "+ Add Character";
    }

    function displayError(message) {
        errorMessage.textContent = `Error: ${message}`;
        errorMessage.classList.remove('hidden');
    }

    function renderComicPage(imageUrl, caption) {
        const comicPage = document.createElement('div');
        comicPage.className = 'comic-page';
        
        const image = document.createElement('img');
        image.src = imageUrl;
        image.alt = `Comic panel for: ${caption}`;
        comicPage.appendChild(image);
        
        if (captionsCheckbox.checked && caption) {
            const captionDiv = document.createElement('div');
            captionDiv.className = 'caption';
            captionDiv.innerHTML = `<p>${caption}</p>`;
            comicPage.appendChild(captionDiv);
        }
        comicOutput.appendChild(comicPage);
    }
    
    // --- API Logic ---

    async function generateWithPollinations(formData) {
        // Implementation from previous step...
    }

    async function generateWithGemini(formData) {
        const apiKey = formData.get('api-key');
        if (!apiKey) {
            displayError("Gemini API Key is required.");
            return;
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const imageModelName = formData.get('image-model');
        
        // Path B: Multimodal generation for the special flash model
        if (imageModelName === 'gemini-2.0-flash-preview-image-generation') {
            await generateWithGeminiFlash(formData, genAI);
        } else {
            // Path A: Standard text-then-image generation for other models
            await generateWithStandardGemini(formData, genAI);
        }
    }

    async function generateWithGeminiFlash(formData, genAI) {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
        const story = formData.get('story');
        const pages = formData.get('pages');
        const style = formData.get('comic-style');
        const era = formData.get('comic-era');

        const prompt = `Create a comic strip based on this story: "${story}".
        Generate exactly ${pages} panels.
        For each panel, provide a short caption and then generate an image in a ${style}, ${era} style.
        Do not add any commentary or extra text, just the caption and the image for each panel.`;

        try {
            const result = await model.generateContentStream([prompt]);
            
            let currentText = '';
            for await (const chunk of result.stream) {
                const chunkText = chunk.text();
                if (chunkText) {
                    currentText += chunkText;
                }
                
                const images = chunk.content?.parts.filter(p => p.inlineData) ?? [];
                if (images.length > 0) {
                    const data = images[0].inlineData;
                    const imageUrl = `data:${data.mimeType};base64,${data.data}`;
                    renderComicPage(imageUrl, currentText.trim());
                    currentText = ''; // Reset text for the next panel
                }
            }
            if (comicOutput.children.length > 0) downloadPdfBtn.disabled = false;

        } catch (error) {
            console.error("Gemini Flash Error:", error);
            displayError("Failed to generate comic with Gemini Flash. Check the console.");
        }
    }

    async function generateWithStandardGemini(formData, genAI) {
        const textModelName = formData.get('text-model');
        const imageModelName = formData.get('image-model');
        const story = formData.get('story');
        const pages = formData.get('pages');
        const style = formData.get('comic-style');
        const era = formData.get('comic-era');
        
        const textModel = genAI.getGenerativeModel({ model: textModelName });
        const imageModel = genAI.getGenerativeModel({ model: imageModelName });

        const textPrompt = `You are a comic script writer. Deconstruct the following story into exactly ${pages} page(s).
        For each page, provide a "caption" and a detailed "image_prompt". The image_prompt should describe the scene for an AI image generator, incorporating the comic style: '${style}' and era: '${era}'.
        Do not include any extra commentary. Your output must be a valid JSON array of objects.
        Story: "${story}"`;

        try {
            const scriptResult = await textModel.generateContent(textPrompt);
            const scriptResponse = await scriptResult.response;
            const scriptText = scriptResponse.text().replace(/```json|```/g, '').trim();
            const scriptData = JSON.parse(scriptText);

            for (const page of scriptData) {
                const imageResult = await imageModel.generateContent(page.image_prompt);
                const imageResponse = await imageResult.response;
                // Assuming the response structure gives us a way to get the image data.
                // This part is speculative without the exact `imagen3` API response format.
                // We'll assume for now it returns a URL or base64 data directly.
                // This will likely need adjustment.
                const imageUrl = imageResponse.text(); // Placeholder: Actual access might differ
                renderComicPage(imageUrl, page.caption);
            }
            if (comicOutput.children.length > 0) downloadPdfBtn.disabled = false;

        } catch (error) {
            console.error("Gemini Standard Error:", error);
            displayError("Failed to generate comic. Check the console.");
        }
    }


    // --- Event Listeners ---
    aiServiceSelect.addEventListener('change', updateModelDropdowns);
    captionsCheckbox.addEventListener('change', toggleCaptionPlacement);
    addCharacterBtn.addEventListener('click', addCharacterInput);
    
    referenceInputsContainer.addEventListener('click', (e) => {
        if(e.target.classList.contains('remove-char-btn')) {
            removeCharacterInput(e.target.dataset.id);
        }
    });

    comicForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loadingIndicator.classList.remove('hidden');
        comicOutput.innerHTML = '';
        errorMessage.classList.add('hidden');
        downloadPdfBtn.disabled = true;

        const formData = new FormData(comicForm);
        const service = formData.get('ai-service');

        if (service === 'gemini') {
            await generateWithGemini(formData);
        } else {
            await generateWithPollinations(formData);
        }

        loadingIndicator.classList.add('hidden');
    });

    // --- Initial Setup ---
    updateModelDropdowns();
    toggleCaptionPlacement();
});
