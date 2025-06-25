
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
        
        // Populate Text Models
        textModelSelect.innerHTML = '';
        models[selectedService].text.forEach(model => {
            const option = document.createElement('option');
            option.value = model;
            option.textContent = model;
            textModelSelect.appendChild(option);
        });

        // Populate Image Models
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

    comicForm.addEventListener('submit', (e) => {
        e.preventDefault();
        console.log("--- Form Submitted ---");
        const formData = new FormData(comicForm);
        for (let [key, value] of formData.entries()) {
            if (value instanceof File) {
                console.log(`${key}: ${value.name}`);
            } else {
                console.log(`${key}: ${value}`);
            }
        }
        console.log("----------------------");
        
        const loadingIndicator = document.getElementById('loading-indicator');
        const comicOutput = document.getElementById('comic-output');
        const errorMessage = document.getElementById('error-message');

        loadingIndicator.classList.remove('hidden');
        comicOutput.innerHTML = ''; // Clear previous output
        errorMessage.classList.add('hidden'); // Hide previous errors


        // Simulate an API call with a placeholder comic page
        setTimeout(() => {
            loadingIndicator.classList.add('hidden');
            
            // Example of adding a comic page
            const comicPage = document.createElement('div');
            comicPage.className = 'comic-page';
            comicPage.innerHTML = `
                <img src="https://via.placeholder.com/500" alt="Comic panel placeholder">
                <div class="caption">
                    <p>This is a placeholder for your generated comic panel.</p>
                </div>
            `;
            comicOutput.appendChild(comicPage);

            // Enable download button
            document.getElementById('download-pdf-btn').disabled = false;

        }, 3000);
    });

    // --- Initial Setup ---
    updateModelDropdowns();
    toggleCaptionPlacement();
});
