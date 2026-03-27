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
    const loadingText = document.querySelector('.loading-sub');
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    const closeSettingsBtn = document.getElementById('closeSettingsBtn');
    const apiKeyInput = document.getElementById('apiKeyInput');
    const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');

    // State
    let selectedImageDataURL = null;
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

        setTimeout(() => toast.remove(), 3500);
    }

    // ==================== Loading State ====================

    function showLoading(message) {
        loadingOverlay.hidden = false;
        if (loadingText) loadingText.textContent = message || '잠시만 기다려주세요';
    }

    function hideLoading() {
        loadingOverlay.hidden = true;
    }

    // ==================== Image Selection ====================

    imagePickerArea.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Convert to JPEG via canvas to ensure API compatibility (iPhone may use HEIC)
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                canvas.getContext('2d').drawImage(img, 0, 0);
                const jpegDataURL = canvas.toDataURL('image/jpeg', 1.0);

                previewImage.src = jpegDataURL;
                previewImage.classList.add('visible');
                placeholderContent.style.display = 'none';
                imagePickerArea.classList.add('has-image');

                selectedImageDataURL = jpegDataURL;
                updateButtonStates();
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });

    // ==================== Button State Management ====================

    function updateButtonStates() {
        const hasPrompt = promptInput.value.trim().length > 0;
        editBtn.disabled = !selectedImageDataURL || !hasPrompt;
        generateBtn.disabled = !hasPrompt;
    }

    promptInput.addEventListener('input', updateButtonStates);

    // ==================== Grok API Call ====================

    // Helper: call xAI chat completions
    async function xaiRequest(apiKey, model, messages) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000);

        let response;
        try {
            response = await fetch('https://api.x.ai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({ model, messages }),
                signal: controller.signal
            });
        } catch (err) {
            clearTimeout(timeoutId);
            if (err.name === 'AbortError') {
                throw new Error('요청 시간이 초과되었습니다. (2분) 다시 시도해주세요.');
            }
            throw new Error('네트워크 오류: API 서버에 연결할 수 없습니다. 인터넷 연결을 확인해주세요.');
        }
        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            const message = errorData?.error?.message || `HTTP 오류 ${response.status}`;
            if (response.status === 401) throw new Error('API 키가 유효하지 않습니다.');
            if (response.status === 429) throw new Error('API 요청 한도 초과. 잠시 후 다시 시도해주세요.');
            throw new Error(message);
        }

        return await response.json();
    }

    // Extract image URL from API response
    function extractImageURL(data) {
        const choices = data.choices;
        if (!choices || choices.length === 0) {
            throw new Error('응답에서 결과를 찾을 수 없습니다.');
        }

        const messageContent = choices[0].message?.content;

        if (Array.isArray(messageContent)) {
            for (const block of messageContent) {
                if (block.type === 'image_url' && block.image_url?.url) {
                    return block.image_url.url;
                }
            }
        }

        if (typeof messageContent === 'string') {
            const urlMatch = messageContent.match(/https?:\/\/[^\s"']+/);
            if (urlMatch) return urlMatch[0];
        }

        throw new Error('응답에서 이미지를 찾을 수 없습니다.');
    }

    // Extract text from API response
    function extractText(data) {
        const messageContent = data.choices?.[0]?.message?.content;
        if (typeof messageContent === 'string') return messageContent;
        if (Array.isArray(messageContent)) {
            for (const block of messageContent) {
                if (block.type === 'text') return block.text;
            }
        }
        throw new Error('응답에서 텍스트를 찾을 수 없습니다.');
    }

    // Image editing: 2-step (vision to describe → image generation)
    async function editImageWithGrok(apiKey, imageDataURL, editPrompt) {
        // Step 1: Use grok-2-vision to describe the image in detail
        showLoading('이미지 분석 중... (1단계/2단계)');
        const visionData = await xaiRequest(apiKey, 'grok-2-vision', [
            {
                role: 'user',
                content: [
                    {
                        type: 'image_url',
                        image_url: { url: imageDataURL }
                    },
                    {
                        type: 'text',
                        text: 'Describe this image in extreme detail in English. Include every visual element: subject appearance (face, hair, body, clothing, accessories, pose, expression), background details, lighting, colors, style, composition, and mood. Be as specific as possible.'
                    }
                ]
            }
        ]);
        const description = extractText(visionData);

        // Step 2: Use grok-2-image to generate edited version
        showLoading('이미지 생성 중... (2단계/2단계)');
        const genPrompt = `Based on this image description:\n"${description}"\n\nNow generate a new image that is the same as described above, but with this modification: ${editPrompt}\n\nKeep everything else exactly the same. Only change what was requested.`;

        const imageData = await xaiRequest(apiKey, 'grok-2-image', [
            { role: 'user', content: genPrompt }
        ]);

        return extractImageURL(imageData);
    }

    // Text-only image generation
    async function generateImageWithGrok(apiKey, prompt) {
        const data = await xaiRequest(apiKey, 'grok-2-image', [
            { role: 'user', content: prompt }
        ]);
        return extractImageURL(data);
    }

    // ==================== Edit Image ====================

    editBtn.addEventListener('click', async () => {
        const prompt = promptInput.value.trim();
        if (!prompt || !selectedImageDataURL) return;
        const apiKey = getApiKey();
        if (!apiKey) { showToast('설정에서 API 키를 먼저 입력해주세요.', 'error'); return; }

        showLoading('이미지 분석 중... (1단계/2단계)');

        try {
            const imageURL = await editImageWithGrok(apiKey, selectedImageDataURL, prompt);
            resultImageURL = imageURL;
            resultImage.src = imageURL;
            resultImage.crossOrigin = 'anonymous';
            resultSection.hidden = false;
            showToast('이미지 편집 완료!', 'success');
        } catch (error) {
            showToast(error.message, 'error');
        } finally {
            hideLoading();
        }
    });

    // ==================== Generate Image ====================

    generateBtn.addEventListener('click', async () => {
        const prompt = promptInput.value.trim();
        if (!prompt) return;
        const apiKey = getApiKey();
        if (!apiKey) { showToast('설정에서 API 키를 먼저 입력해주세요.', 'error'); return; }

        showLoading('이미지 생성 중... (최대 1~2분)');

        try {
            const imageURL = await generateImageWithGrok(apiKey, prompt);
            resultImageURL = imageURL;
            resultImage.src = imageURL;
            resultImage.crossOrigin = 'anonymous';
            resultSection.hidden = false;
            showToast('이미지 생성 완료!', 'success');
        } catch (error) {
            showToast(error.message, 'error');
        } finally {
            hideLoading();
        }
    });

    // ==================== Save Image ====================

    saveBtn.addEventListener('click', async () => {
        if (!resultImageURL) {
            showToast('저장할 이미지가 없습니다.', 'error');
            return;
        }

        try {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                canvas.getContext('2d').drawImage(img, 0, 0);

                canvas.toBlob((blob) => {
                    if (!blob) {
                        window.open(resultImageURL, '_blank');
                        showToast('이미지를 길게 눌러 저장하세요.', '');
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
                // On iPhone Safari: open image so user can long-press to save
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
