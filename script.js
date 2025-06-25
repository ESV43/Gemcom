
document.addEventListener('DOMContentLoaded', () => {
    // --- Element Selections ---
    const comicForm = document.getElementById('comic-form');
    const aiServiceSelect = document.getElementById('ai-service');
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
            text: ["gemini-pro", "gemini-1.5-pro-latest"],
            image: ["imagen3", "gemini-2.0-flash-preview-image-generation"]
        }
    };

    // --- Functions ---
    
    function updateModelDropdowns() {
        const selectedService = aiServiceSelect.value;
        textModelSelect.innerHTML = '';
        models[selectedService].text.forEach(model => {
            const option = document.createElement('option');
            option.value = model;
            option.textContent = model;
            textModelSelect.appendChild(option);
        });

        imageModelSelect.innerHTML = '';
        models[selectedService].image.forEach(model => {
            const option = document.createElement('option');
            option.value = model;
            option.textContent = model;
            imageModelSelect.appendChild(option);
        });
    }

    function toggleCaptionPlacement() {
        captionPlacementGroup.style.display = captionsCheckbox.checked ? 'flex' : 'none';
    }

    function addCharacterInput() {
        if (characterCount >= MAX_CHARACTERS) {
            addCharacterBtn.disabled = true;
            addCharacterBtn.textContent = "Max Characters Reached";
            return;
        }
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
        const entryToRemove = document.getElementById(`character-entry-${id}`);
        if(entryToRemove) {
            entryToRemove.remove();
            characterCount--;
            addCharacterBtn.disabled = false;
            addCharacterBtn.textContent = "+ Add Character";
        }
    }

    function displayError(message) {
        errorMessage.textContent = `Error: ${message}`;
        errorMessage.classList.remove('hidden');
    }

    async function generateWithPollinations(formData) {
        const story = formData.get('story');
        const pages = formData.get('pages');
        const style = formData.get('comic-style');
        const era = formData.get('comic-era');
        
        // 1. Deconstruct story into pages using the text model
        const textPrompt = `You are a comic script writer. Deconstruct the following story into exactly ${pages} page(s). 
        For each page, provide a "caption" and a detailed "image_prompt". The image_prompt should describe the scene for an AI image generator, incorporating the comic style: '${style}' and era: '${era}'.
        Do not include any extra commentary. Your output must be a valid JSON array of objects.
        Story: "${story}"`;

        try {
            const textResponse = await fetch('https://text.pollinations.ai/', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ prompt: textPrompt, model: 'gpt-3.5-turbo' })
            });

            if (!textResponse.ok) {
                throw new Error(`Text generation failed with status: ${textResponse.status}`);
            }
            
            const textResult = await textResponse.json();
            // The actual content is nested in the response
            const scriptData = JSON.parse(textResult.output[0]);

            // 2. Generate an image for each page description
            comicOutput.innerHTML = ''; // Clear previous/placeholder content
            for (const page of scriptData) {
                const imagePrompt = encodeURIComponent(page.image_prompt);
                const imageUrl = `https://image.pollinations.ai/prompt/${imagePrompt}`;

                const comicPage = document.createElement('div');
                comicPage.className = 'comic-page';
                
                const image = document.createElement('img');
                image.src = imageUrl;
                image.alt = `Comic panel for: ${page.caption}`;
                
                comicPage.appendChild(image);
                
                if (captionsCheckbox.checked) {
                    const captionDiv = document.createElement('div');
                    captionDiv.className = 'caption';
                    captionDiv.innerHTML = `<p>${page.caption}</p>`;
                    comicPage.appendChild(captionDiv);
                }
                
                comicOutput.appendChild(comicPage);
            }
            downloadPdfBtn.disabled = false;

        } catch (error) {
            console.error(error);
            displayError('Failed to generate comic. Please check the console for details.');
        }
    }

    // --- Event Listeners ---
    aiServiceSelect.addEventListener('change', updateModelDropdowns);
    captionsCheckbox.addEventListener('change', toggleCaptionPlacement);
    addCharacterBtn.addEventListener('click', addCharacterInput);
    
    referenceInputsContainer.addEventListener('click', (e) => {
        if(e.target.classList.contains('remove-char-btn')) {
            const id = e.target.dataset.id;
            removeCharacterInput(id);
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

        if (service === 'pollinations') {
            await generateWithPollinations(formData);
        } else {
            // Placeholder for Gemini integration
            displayError("Gemini API integration is not yet implemented.");
        }

        loadingIndicator.classList.add('hidden');
    });

    // --- Initial Setup ---
    updateModelDropdowns();
    toggleCaptionPlacement();
});
