/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Modality, type Part } from '@google/genai';

// --- DOM ELEMENT REFERENCES ---
const personUploadInput = document.getElementById('person-upload') as HTMLInputElement;
const personUploadBox = document.getElementById('person-upload-box') as HTMLLabelElement;
const personPreview = document.getElementById('person-preview') as HTMLImageElement;
const personPlaceholder = document.getElementById('person-placeholder') as HTMLDivElement;

const clothingUploadInput = document.getElementById('clothing-upload') as HTMLInputElement;
const clothingUploadBox = document.getElementById('clothing-upload-box') as HTMLLabelElement;
const clothingPreview = document.getElementById('clothing-preview') as HTMLImageElement;
const clothingPlaceholder = document.getElementById('clothing-placeholder') as HTMLDivElement;

const tryOnButton = document.getElementById('try-on-button') as HTMLButtonElement;

const resultContainer = document.getElementById('result-container') as HTMLDivElement;
const resultPlaceholder = document.getElementById('result-placeholder') as HTMLDivElement;
const resultImage = document.getElementById('result-image') as HTMLImageElement;
const loader = document.getElementById('loader') as HTMLDivElement;
const errorMessage = document.getElementById('error-message') as HTMLParagraphElement;


// --- APPLICATION STATE ---
interface ImageData {
  base64: string;
  mimeType: string;
}
let personImage: ImageData | null = null;
let clothingImage: ImageData | null = null;

// --- UTILITY FUNCTIONS ---

/**
 * Toggles the visibility of UI elements to show a loading state.
 */
function setLoading(isLoading: boolean) {
  if (isLoading) {
    loader.style.display = 'block';
    resultPlaceholder.style.display = 'none';
    resultImage.style.display = 'none';
    errorMessage.style.display = 'none';
    tryOnButton.disabled = true;
    tryOnButton.textContent = 'Generating...';
  } else {
    loader.style.display = 'none';
    tryOnButton.disabled = false;
    tryOnButton.textContent = 'Try On';
    updateTryOnButtonState();
  }
}

/**
 * Displays an error message to the user.
 */
function showError(message: string) {
  setLoading(false);
  resultImage.style.display = 'none';
  resultPlaceholder.style.display = 'none';
  errorMessage.textContent = `Error: ${message}`;
  errorMessage.style.display = 'block';
}

/**
 * Updates the state of the "Try On" button based on whether both images are uploaded.
 */
function updateTryOnButtonState() {
  tryOnButton.disabled = !(personImage && clothingImage);
}

/**
 * Handles the file upload and UI preview for an image.
 */
async function handleImageUpload(
  file: File,
  type: 'person' | 'clothing'
) {
  if (!file.type.startsWith('image/')) {
    showError('Please upload a valid image file.');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target?.result as string;
    const [header, base64] = dataUrl.split(',');
    const mimeType = header.match(/:(.*?);/)?.[1] || file.type;
    
    const imageData = { base64, mimeType };

    if (type === 'person') {
      personImage = imageData;
      personPreview.src = dataUrl;
      personPreview.style.display = 'block';
      personPlaceholder.style.display = 'none';
    } else {
      clothingImage = imageData;
      clothingPreview.src = dataUrl;
      clothingPreview.style.display = 'block';
      clothingPlaceholder.style.display = 'none';
    }
    updateTryOnButtonState();
  };
  reader.onerror = () => {
    showError(`Failed to read the ${type} image file.`);
  };
  reader.readAsDataURL(file);
}


// --- MAIN LOGIC ---

/**
 * Calls the Gemini API to generate the try-on image.
 */
async function handleTryOn() {
  if (!personImage || !clothingImage) {
    showError('Please upload both a person and a clothing image.');
    return;
  }

  setLoading(true);

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    
    const personImagePart: Part = {
        inlineData: { data: personImage.base64, mimeType: personImage.mimeType },
    };
    const clothingImagePart: Part = {
        inlineData: { data: clothingImage.base64, mimeType: clothingImage.mimeType },
    };
    const textPart: Part = {
        text: "Take the person from the first image and the clothing from the second image. Generate a new, realistic image where the person is wearing the clothing. The person's pose and the clothing's original style should be preserved as much as possible."
    };

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts: [personImagePart, clothingImagePart, textPart] },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });

    setLoading(false);

    const imagePart = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);

    if (imagePart && imagePart.inlineData) {
        const { data, mimeType } = imagePart.inlineData;
        resultImage.src = `data:${mimeType};base64,${data}`;
        resultImage.style.display = 'block';
        resultPlaceholder.style.display = 'none';
        errorMessage.style.display = 'none';
    } else {
        const textResponse = response.text;
        showError(textResponse || 'Could not generate an image. The model did not return image data.');
    }
  } catch (error) {
    console.error(error);
    showError(error instanceof Error ? error.message : 'An unknown error occurred.');
  }
}

// --- EVENT LISTENERS ---
personUploadInput.addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) handleImageUpload(file, 'person');
});

clothingUploadInput.addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) handleImageUpload(file, 'clothing');
});

tryOnButton.addEventListener('click', handleTryOn);

// Drag and drop functionality
function setupDragAndDrop(dropArea: HTMLElement, input: HTMLInputElement, type: 'person' | 'clothing') {
    dropArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropArea.style.borderColor = 'var(--primary-color)';
    });
    dropArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropArea.style.borderColor = 'var(--border-color)';
    });
    dropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        dropArea.style.borderColor = 'var(--border-color)';
        const file = e.dataTransfer?.files?.[0];
        if (file) {
            input.files = e.dataTransfer.files;
            handleImageUpload(file, type);
        }
    });
}

setupDragAndDrop(personUploadBox, personUploadInput, 'person');
setupDragAndDrop(clothingUploadBox, clothingUploadInput, 'clothing');
