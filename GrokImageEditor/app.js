(() => {
    'use strict';

    // DOM Elements
    const imagePickerArea = document.getElementById('imagePickerArea');
    const fileInput = document.getElementById('fileInput');
    const placeholderContent = document.getElementById('placeholderContent');
    const previewImage = document.getElementById('previewImage');
    const promptInput = document.getElementById('promptInput');
    const editBtn = document.getElementById('editBtn');
    const generateBtn = document.getElementById('generateBtn');
    const resultSection = document.getElementById('resultSection');
    const resultImage = document.getElementById('resultImage');
    const saveBtn = document.getElementById('saveBtn');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    const closeSettingsBtn = document.getElementById('closeSettingsBtn');
    const apiKeyInput = document.getElementById('apiKeyInput');
    const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');

    // State
    let selectedImageBase64 = null;
    let resultImageURL = null;

    // ==================== API Key Management ====================

    function getApiKey() {
        return localStorage.getItem('grok_api_key') || '';
    }

    function saveApiKey(key) {
        localStorage.setItem('grok_api_key', key);
    }

    // ==================== Toast Notifications ====================

    function showToast(message, type = '') {
        const existing = document.querySelector('.toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => toast.remove(), 2500);
    }

    // ==================== Image Selection ====================

    imagePickerArea.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const dataURL = event.target.result;
            previewImage.src = dataURL;
            previewImage.classList.add('visible');
            placeholderContent.style.display = 'none';
            imagePickerArea.classList.add('has-image');

            // Extract base64 (strip prefix)
            selectedImageBase64 = dataURL.split(',')[1];
            updateButtonStates();
        };
        reader.readAsDataURL(file);
    });

    // ==================== Button State Management ====================

    function updateButtonStates() {
        const hasPrompt = promptInput.value.trim().length > 0;
        editBtn.disabled = !selectedImageBase64 || !hasPrompt;
        generateBtn.disabled = !hasPrompt;
    }

    promptInput.addEventListener('input', updateButtonStates);

    // ==================== Grok API Call ====================

    async function callGrokAPI(prompt, imageBase64 = null) {
        const apiKey = getApiKey();
        if (!apiKey) {
            showToast('설정에서 API 키를 먼저 입력해주세요.', 'error');
            return null;
        }

        const content = [];

        if (imageBase64) {
            content.push({
                type: 'text',
                text: `Edit this image: ${prompt}`
            });
            content.push({
                type: 'image_url',
                image_url: {
                    url: `data:image/jpeg;base64,${imageBase64}`
                }
            });
        } else {
            content.push({
                type: 'text',
                text: prompt
            });
        }

        const body = {
            model: 'grok-2-image',
            messages: [
                {
                    role: 'user',
                    content: imageBase64 ? content : prompt
                }
            ]
        };

        const response = await fetch('https://api.x.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            const message = errorData?.error?.message || `HTTP 오류 ${response.status}`;
            throw new Error(message);
        }

        const data = await response.json();

        // Extract image URL from response
        const choices = data.choices;
        if (!choices || choices.length === 0) {
            throw new Error('응답에서 결과를 찾을 수 없습니다.');
        }

        const messageContent = choices[0].message?.content;

        // Content can be a string or array of blocks
        if (Array.isArray(messageContent)) {
            for (const block of messageContent) {
                if (block.type === 'image_url' && block.image_url?.url) {
                    return block.image_url.url;
                }
            }
        }

        // Try to find URL in string content
        if (typeof messageContent === 'string') {
            const urlMatch = messageContent.match(/https?:\/\/[^\s"']+/);
            if (urlMatch) return urlMatch[0];
        }

        throw new Error('응답에서 이미지를 찾을 수 없습니다.');
    }

    // ==================== Edit Image ====================

    editBtn.addEventListener('click', async () => {
        const prompt = promptInput.value.trim();
        if (!prompt || !selectedImageBase64) return;

        loadingOverlay.hidden = false;

        try {
            const imageURL = await callGrokAPI(prompt, selectedImageBase64);
            if (imageURL) {
                resultImageURL = imageURL;
                resultImage.src = imageURL;
                resultImage.crossOrigin = 'anonymous';
                resultSection.hidden = false;
                showToast('이미지 편집 완료!', 'success');
            }
        } catch (error) {
            showToast(error.message, 'error');
        } finally {
            loadingOverlay.hidden = true;
        }
    });

    // ==================== Generate Image ====================

    generateBtn.addEventListener('click', async () => {
        const prompt = promptInput.value.trim();
        if (!prompt) return;

        loadingOverlay.hidden = false;

        try {
            const imageURL = await callGrokAPI(prompt);
            if (imageURL) {
                resultImageURL = imageURL;
                resultImage.src = imageURL;
                resultImage.crossOrigin = 'anonymous';
                resultSection.hidden = false;
                showToast('이미지 생성 완료!', 'success');
            }
        } catch (error) {
            showToast(error.message, 'error');
        } finally {
            loadingOverlay.hidden = true;
        }
    });

    // ==================== Save Image ====================

    saveBtn.addEventListener('click', async () => {
        if (!resultImageURL) {
            showToast('저장할 이미지가 없습니다.', 'error');
            return;
        }

        try {
            // Try canvas approach for cross-origin images
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);

                canvas.toBlob((blob) => {
                    if (!blob) {
                        // Fallback: open in new tab
                        window.open(resultImageURL, '_blank');
                        return;
                    }
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `grok-image-${Date.now()}.png`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    showToast('이미지가 저장되었습니다!', 'success');
                }, 'image/png');
            };
            img.onerror = () => {
                // Fallback: open in new tab for manual save
                window.open(resultImageURL, '_blank');
                showToast('이미지를 길게 눌러 저장하세요.', '');
            };
            img.src = resultImageURL;
        } catch {
            window.open(resultImageURL, '_blank');
            showToast('이미지를 길게 눌러 저장하세요.', '');
        }
    });

    // ==================== Settings Modal ====================

    settingsBtn.addEventListener('click', () => {
        apiKeyInput.value = getApiKey();
        settingsModal.hidden = false;
    });

    closeSettingsBtn.addEventListener('click', () => {
        settingsModal.hidden = true;
    });

    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            settingsModal.hidden = true;
        }
    });

    saveApiKeyBtn.addEventListener('click', () => {
        const key = apiKeyInput.value.trim();
        if (!key) {
            showToast('API 키를 입력해주세요.', 'error');
            return;
        }
        saveApiKey(key);
        showToast('API 키가 저장되었습니다!', 'success');
        setTimeout(() => {
            settingsModal.hidden = true;
        }, 800);
    });

    // ==================== Service Worker Registration ====================

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(() => {});
    }

    // Initialize button states
    updateButtonStates();
})();
