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

        const reader = new FileReader();
        reader.onload = (event) => {
            const dataURL = event.target.result;
            previewImage.src = dataURL;
            previewImage.classList.add('visible');
            placeholderContent.style.display = 'none';
            imagePickerArea.classList.add('has-image');
            selectedImageDataURL = dataURL;
            updateButtonStates();
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

    // ==================== Grok Imagine API ====================
    // Docs: https://docs.x.ai/docs/guides/image-generations

    // Helper: make xAI API request with timeout and error handling
    async function xaiFetch(apiKey, endpoint, body) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000);

        let response;
        try {
            response = await fetch(`https://api.x.ai/v1${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(body),
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
            const errorText = await response.text().catch(() => '');
            let message = `HTTP ${response.status}`;
            try {
                const errorData = JSON.parse(errorText);
                message = errorData?.error?.message || errorData?.error || errorData?.message || errorText.substring(0, 200);
            } catch {
                message = errorText.substring(0, 200) || `HTTP 오류 ${response.status}`;
            }
            if (response.status === 401) throw new Error('API 키가 유효하지 않습니다.');
            if (response.status === 429) throw new Error('API 요청 한도 초과. 잠시 후 다시 시도해주세요.');
            throw new Error(message);
        }

        return await response.json();
    }

    // Extract image URL from /v1/images/* response
    function extractImageURL(data) {
        // /v1/images/generations and /v1/images/edits return { data: [{ url, b64_json }] }
        if (data.data && data.data.length > 0) {
            if (data.data[0].url) return data.data[0].url;
            if (data.data[0].b64_json) return 'data:image/png;base64,' + data.data[0].b64_json;
        }
        throw new Error('응답에서 이미지를 찾을 수 없습니다.');
    }

    // Image editing: POST /v1/images/edits
    async function editImageWithGrok(apiKey, imageDataURL, editPrompt) {
        const data = await xaiFetch(apiKey, '/images/edits', {
            model: 'grok-imagine-image',
            prompt: editPrompt,
            image: {
                url: imageDataURL
            }
        });
        return extractImageURL(data);
    }

    // Image generation: POST /v1/images/generations
    async function generateImageWithGrok(apiKey, prompt) {
        const data = await xaiFetch(apiKey, '/images/generations', {
            model: 'grok-imagine-image',
            prompt: prompt
        });
        return extractImageURL(data);
    }

    // ==================== Edit Image ====================

    editBtn.addEventListener('click', async () => {
        const prompt = promptInput.value.trim();
        if (!prompt || !selectedImageDataURL) return;
        const apiKey = getApiKey();
        if (!apiKey) { showToast('설정에서 API 키를 먼저 입력해주세요.', 'error'); return; }

        showLoading('이미지 편집 중... (최대 1~2분)');

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
