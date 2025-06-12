let currentOverlay = null;

function addSummarizeButton() {
    const buttonsContainer = document.getElementById('top-level-buttons-computed');
    if (buttonsContainer && !document.getElementById('summarize-btn')) {
        const summarizeButton = document.createElement('button');
        summarizeButton.innerText = 'تلخيص';
        summarizeButton.id = 'summarize-btn';
        summarizeButton.style.cssText = 'background-color:#4CAF50; color:white; padding:10px 15px; border:none; border-radius:20px; cursor:pointer; margin-left:10px; font-size:14px; font-family:inherit;';
        summarizeButton.onclick = handleSummarizeClick;
        buttonsContainer.appendChild(summarizeButton);
    }
}

async function handleSummarizeClick() {
    showOverlay('<strong>جاري استخراج النص...</strong>', false, false);
    try {
        const transcript = await getTranscript();
        if (transcript) {
            updateOverlayContent('<strong>تم استخراج النص! جاري التلخيص...</strong>');
            chrome.runtime.sendMessage({ type: 'summarize', transcript: transcript });
        }
    } catch (error) {
        updateOverlayContent(`<strong>حدث خطأ:</strong> ${error.message}`, true);
    }
}

async function getTranscript() {
    const allButtons = document.querySelectorAll('button, a, yt-button-renderer, tp-yt-paper-button');
    const buttonTexts = ['Show transcript', 'عرض النص'];
    let showTranscriptButton = Array.from(allButtons).find(btn => 
        buttonTexts.some(text => btn.innerText?.trim().toLowerCase() === text.toLowerCase())
    );
    if (!showTranscriptButton) throw new Error('لم أتمكن من العثور على زر "عرض النص" في أي مكان بالصفحة.');
    showTranscriptButton.click();
    const transcriptContainer = await document.querySelector('ytd-transcript-renderer, ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]');
    if (!transcriptContainer) throw new Error("The transcript panel container was not found after clicking the button.");
    const segmentSelector = 'yt-formatted-string.segment-text, .ytd-transcript-segment-renderer';
    await new Promise(res => setTimeout(res, 1000));
    const transcriptSegments = transcriptContainer.querySelectorAll(segmentSelector);
    if (transcriptSegments.length === 0) throw new Error('لوحة النص مفتوحة، لكنها فارغة.');
    const fullTranscript = Array.from(transcriptSegments).map(el => el.textContent.trim()).join(' ');
    return fullTranscript.trim();
}

function showOverlay(initialMessage = '', isError = false, showInput = true, language = 'English') {
    if (currentOverlay) currentOverlay.remove();

    const styleLink = document.createElement('link');
    styleLink.rel = 'stylesheet';
    styleLink.type = 'text/css';
    styleLink.href = chrome.runtime.getURL('overlay.css');
    document.head.appendChild(styleLink);

    const overlay = document.createElement('div');
    overlay.id = 'summary-overlay';
    
    // ** CHANGE IS HERE: Set text direction based on language **
    const textDirection = (language === 'Arabic') ? 'rtl' : 'ltr';

    overlay.innerHTML = `
        <div id="summary-content-box">
            <div id="summary-header">
                <h3>AI Summarizer</h3>
                <button id="summary-close-btn">×</button>
            </div>
            <div id="summary-history" style="direction: ${textDirection};">
                <div class="summary-message model">${initialMessage}</div>
            </div>
            <div id="summary-input-area" style="display: ${showInput ? 'flex' : 'none'}; direction: ${textDirection};">
                <textarea id="summary-input" placeholder="Ask a follow-up question..." rows="1"></textarea>
                <button id="summary-send-btn">Send</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    currentOverlay = overlay;

    document.getElementById('summary-close-btn').onclick = () => {
        currentOverlay.remove();
        currentOverlay = null;
        styleLink.remove();
    };
    
    document.getElementById('summary-send-btn').onclick = handleFollowUp;
    document.getElementById('summary-input').onkeydown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleFollowUp();
        }
    };
}

function updateOverlayContent(htmlContent, isError = false, language = 'English') {
    if (!currentOverlay) return;
    const historyDiv = document.getElementById('summary-history');
    const inputAreaDiv = document.getElementById('summary-input-area');
    
    // ** CHANGE IS HERE: Update text direction **
    const textDirection = (language === 'Arabic') ? 'rtl' : 'ltr';
    historyDiv.style.direction = textDirection;
    inputAreaDiv.style.direction = textDirection;


    const lastMessage = historyDiv.querySelector('.summary-message:last-child');
    if (lastMessage && lastMessage.innerHTML.includes('...')) {
        lastMessage.innerHTML = htmlContent;
        lastMessage.style.color = isError ? '#FF5555' : '#F8F8F2';
    } else {
        const messageDiv = document.createElement('div');
        const messageClass = isError ? 'model' : (historyDiv.querySelectorAll('.summary-message').length % 2 === 0 ? 'model' : 'user');
        messageDiv.className = `summary-message ${messageClass}`;
        if(isError) messageDiv.style.color = '#FF5555';
        messageDiv.innerHTML = htmlContent;
        historyDiv.appendChild(messageDiv);
    }
    historyDiv.scrollTop = historyDiv.scrollHeight;
}

function handleFollowUp() {
    const input = document.getElementById('summary-input');
    const newPrompt = input.value.trim();
    if (!newPrompt) return;
    const historyDiv = document.getElementById('summary-history');
    const userMessageDiv = document.createElement('div');
    userMessageDiv.className = 'summary-message user';
    userMessageDiv.innerText = newPrompt; // Use innerText to prevent HTML injection
    historyDiv.appendChild(userMessageDiv);
    const loadingMessageDiv = document.createElement('div');
    loadingMessageDiv.className = 'summary-message model';
    loadingMessageDiv.innerHTML = 'Thinking...';
    historyDiv.appendChild(loadingMessageDiv);
    historyDiv.scrollTop = historyDiv.scrollHeight;
    input.value = '';
    input.focus();
    chrome.runtime.sendMessage({ type: 'continueConversation', newPrompt: newPrompt });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'summaryResult' || request.type === 'followUpResult') {
        if (!currentOverlay) {
             showOverlay(request.summary, request.isError, true, request.language);
        } else {
            updateOverlayContent(request.summary, request.isError, request.language);
            if (!request.isError) {
                 document.getElementById('summary-input-area').style.display = 'flex';
            }
        }
    }
});

const observer = new MutationObserver(() => {
    if (document.getElementById('top-level-buttons-computed') && !document.getElementById('summarize-btn')) { addSummarizeButton(); }
});
observer.observe(document.body, { childList: true, subtree: true });