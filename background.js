// Import the Marked.js library
importScripts('marked.min.js');

let conversationHistory = [];

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'summarize') {
        conversationHistory = [];
        handleApiCall(request.transcript, 'summaryResult', true);
    } else if (request.type === 'continueConversation') {
        handleApiCall(request.newPrompt, 'followUpResult', false);
    }
    return true;
});

async function handleApiCall(promptOrTranscript, responseType, isInitialCall) {
    chrome.storage.sync.get(['selectedApi', 'summaryLanguage', 'customPrompt', 'geminiKey', 'openaiKey', 'deepseekKey'], async (settings) => {
        const { selectedApi, summaryLanguage, customPrompt, geminiKey, openaiKey, deepseekKey } = settings;
        
        let finalPrompt;
        if (isInitialCall) {
            const languageInstruction = ` in ${summaryLanguage || 'English'}`;
            finalPrompt = `${customPrompt}${languageInstruction}. Please format the response using Markdown (e.g., use # for titles, * for bullet points, ** for bold). \n\nVideo Transcript:\n"""${promptOrTranscript}"""`;
        } else {
            finalPrompt = promptOrTranscript;
        }
        
        conversationHistory.push({ role: 'user', parts: [{ text: finalPrompt }] });

        let summary = '';
        let error = null;

        try {
            switch (selectedApi) {
                case 'gemini':
                    if (!geminiKey) throw new Error('Gemini API key is missing.');
                    summary = await callGeminiAPI(conversationHistory, geminiKey);
                    break;
                case 'openai':
                    if (!openaiKey) throw new Error('OpenAI API key is missing.');
                    summary = await callOpenAIAPI(conversationHistory, openaiKey);
                    break;
                case 'deepseek':
                    if (!deepseekKey) throw new Error('DeepSeek API key is missing.');
                    summary = await callDeepSeekAPI(conversationHistory, deepseekKey);
                    break;
                default:
                    throw new Error('Invalid AI model selected.');
            }
            conversationHistory.push({ role: 'model', parts: [{ text: summary }] });
            
            const formattedSummary = marked.parse(summary);
            // ** CHANGE IS HERE: Pass the language to the content script **
            sendResultToContentScript(formattedSummary, responseType, summaryLanguage, false);

        } catch (e) {
            error = e.message;
            conversationHistory.pop();
            sendResultToContentScript(`API Error: ${error}`, responseType, summaryLanguage, true);
        }
    });
}

// ... API call functions remain the same ...
async function callGeminiAPI(history, apiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: history })
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    if (!data.candidates || !data.candidates[0].content.parts[0].text) throw new Error('Invalid response from Gemini API.');
    return data.candidates[0].content.parts[0].text;
}
async function callOpenAIAPI(history, apiKey) {
    const url = 'https://api.openai.com/v1/chat/completions';
    const messages = history.map(h => ({ role: h.role === 'model' ? 'assistant' : 'user', content: h.parts[0].text }));
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model: 'gpt-3.5-turbo', messages: messages })
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.choices[0].message.content;
}
async function callDeepSeekAPI(history, apiKey) {
    const url = 'https://api.deepseek.com/chat/completions';
    const messages = history.map(h => ({ role: h.role === 'model' ? 'assistant' : 'user', content: h.parts[0].text }));
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model: 'deepseek-chat', messages: messages })
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.choices[0].message.content;
}


// ** CHANGE IS HERE: The function now accepts the language **
async function sendResultToContentScript(summary, type, language, isError = false) {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab) {
        chrome.tabs.sendMessage(tab.id, {
            type: type,
            summary: summary,
            language: language, // Pass the language
            isError: isError
        });
    }
}