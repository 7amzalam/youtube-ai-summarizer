document.addEventListener('DOMContentLoaded', () => {
    const apiSelect = document.getElementById('api-select');
    const languageSelect = document.getElementById('language-select'); // New
    const promptInput = document.getElementById('prompt');
    const geminiKeyInput = document.getElementById('gemini-key');
    const openaiKeyInput = document.getElementById('openai-key');
    const deepseekKeyInput = document.getElementById('deepseek-key');
    const saveBtn = document.getElementById('save-btn');
    const statusEl = document.getElementById('status');

    // Load saved settings
    chrome.storage.sync.get(['selectedApi', 'summaryLanguage', 'customPrompt', 'geminiKey', 'openaiKey', 'deepseekKey'], (data) => {
        if (data.selectedApi) apiSelect.value = data.selectedApi;
        if (data.summaryLanguage) languageSelect.value = data.summaryLanguage; // New
        if (data.customPrompt) promptInput.value = data.customPrompt;
        if (data.geminiKey) geminiKeyInput.value = data.geminiKey;
        if (data.openaiKey) openaiKeyInput.value = data.openaiKey;
        if (data.deepseekKey) deepseekKeyInput.value = data.deepseekKey;
    });

    // Save settings
    saveBtn.addEventListener('click', () => {
        const settings = {
            selectedApi: apiSelect.value,
            summaryLanguage: languageSelect.value, // New
            customPrompt: promptInput.value,
            geminiKey: geminiKeyInput.value,
            openaiKey: openaiKeyInput.value,
            deepseekKey: deepseekKeyInput.value
        };

        chrome.storage.sync.set(settings, () => {
            statusEl.textContent = 'Settings saved!';
            setTimeout(() => {
                statusEl.textContent = '';
            }, 2000);
        });
    });
});