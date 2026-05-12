(() => {
    let isDrawing = false;
    let startX, startY;
    let fullPageScreenshotUrl = null;
    let croppedImageBase64 = null;
    let conversationHistory = [];
    if (window.aiAnalyzerInitialized) cleanupUI();
    window.aiAnalyzerInitialized = true;
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "start-markup") {
            fullPageScreenshotUrl = request.img;
            startSelectionPhase();
        }
    });
    function startSelectionPhase() {
        cleanupUI();

        const border = document.createElement('div');
        border.id = "ai-siri-border";
        document.body.appendChild(border);
        setTimeout(() => border.classList.add('active'), 50);

        const island = document.createElement('div');
        island.id = "ai-island-container";
        island.className = "ai-island-container";
        island.innerHTML = `
            <div id="ai-island-status">
                <span class="ai-status-brand">Intelligence</span>
                <span class="ai-status-msg">Select an area</span>
            </div>`;
            // `
            // <div id="ai-island-status">
            //     <span class="ai-status-brand">AI</span>
            //     <span class="ai-status-msg">Select an area</span>
            // </div>`;
        document.body.appendChild(island);
        setTimeout(() => island.classList.add('active'), 50);

        const canvas = document.createElement('canvas');
        canvas.id = "ai-markup-canvas";
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.zIndex = '2147483647';
        canvas.style.cursor = 'crosshair';
        document.body.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        ctx.strokeStyle = "#007aff";
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);

        canvas.onmousedown = (e) => {
            isDrawing = true;
            startX = e.clientX;
            startY = e.clientY;
        };

        canvas.onmousemove = (e) => {
            if (!isDrawing) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.strokeRect(startX, startY, e.clientX - startX, e.clientY - startY);
        };
        canvas.onmouseup = (e) => {
            isDrawing = false;
            const selection = {
                x: Math.min(startX, e.clientX),
                y: Math.min(startY, e.clientY),
                w: Math.abs(e.clientX - startX),
                h: Math.abs(e.clientY - startY)
            };
            if (selection.w < 10) return;
            processSelection(selection);
        };
    }
    function processSelection(coords) {
        const canvas = document.getElementById('ai-markup-canvas');
        if (canvas) canvas.remove();

        const image = new Image();
        image.src = fullPageScreenshotUrl;
        image.onload = () => {
            const dpr = window.devicePixelRatio || 1;
            const cropCanvas = document.createElement('canvas');
            const cropCtx = cropCanvas.getContext('2d');
            cropCanvas.width = coords.w * dpr;
            cropCanvas.height = coords.h * dpr;
            cropCtx.drawImage(image, coords.x * dpr, coords.y * dpr, coords.w * dpr, coords.h * dpr, 0, 0, coords.w * dpr, coords.h * dpr);
            const croppedDataUrl = cropCanvas.toDataURL('image/png');
            croppedImageBase64 = croppedDataUrl.split(',')[1];
            showQuestionUI(croppedDataUrl);
        };
    }
    function showQuestionUI(displayUrl) {
        const island = document.getElementById('ai-island-container');
        island.innerHTML = `
            <div id="ai-island-status">
                <span class="ai-status-brand">Intelligence</span>
            </div>
            <img src="${displayUrl}" id="ai-screencap-preview" />
            <div class="ai-input-wrapper">
            

                <textarea id="ai-prompt-text" placeholder="What's on your mind?" rows="1"></textarea>
            </div>
            <div id="ai-response-area" style="display:none;"></div>
        `;

        const input = document.getElementById('ai-prompt-text');
        input.focus();
        
        input.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const q = input.value.trim();
                if (q) performAIQuery(q);
            }
        });
    }
    async function performAIQuery(question) {
        const island = document.getElementById('ai-island-container');
        const preview = document.getElementById('ai-screencap-preview');
        const inputWrapper = document.querySelector('.ai-input-wrapper');
        const responseArea = document.getElementById('ai-response-area');

        if(preview) preview.classList.add('minimized');
        if(inputWrapper) inputWrapper.style.display = 'none';
        
        island.classList.add('thinking');
        responseArea.style.display = 'block';
        responseArea.innerHTML = `<div class="thinking-glow"></div><div style="color:#86868b; text-align:center; padding:30px; font-size:14px;">Analyzing...</div>`;

        if (conversationHistory.length === 0) {
            conversationHistory.push({ role: 'user', content: question, images: [croppedImageBase64] });
        } else {
            conversationHistory.push({ role: 'user', content: question });
        }

        try {
            const res = await fetch('http://127.0.0.1:11434/api/chat', {
                method: 'POST',
                body: JSON.stringify({ model: 'llava', messages: conversationHistory, stream: false })
            });

            const data = await res.json();
            const answer = data.message.content;
            conversationHistory.push({ role: 'assistant', content: answer });

            island.classList.remove('thinking');
            if(preview) preview.remove();

            responseArea.innerHTML = `
                <div class="ai-answer-text">${answer.replace(/\n/g, '<br>')}</div>
                <div class="ai-followup-container">
                    <textarea class="ai-followup-text" placeholder="Follow up..." rows="1"></textarea>
                </div>`;
            setupFollowup();
        } catch (err) {
            responseArea.innerHTML = `<div style="color:#ff3b30; padding:20px; text-align:center;">Connection Error.</div>`;
        }
    }
    function setupFollowup() {
        const follow = document.querySelector('.ai-followup-text');
        if (!follow) return;
        follow.focus();
        follow.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
        });
        follow.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const q = follow.value.trim();
                if (q) performAIQuery(q);
            }
        });
    }
    function cleanupUI() {
        ['ai-island-container', 'ai-markup-canvas', 'ai-siri-border'].forEach(id => {
            const e = document.getElementById(id);
            if(e) e.remove();
        });
        conversationHistory = [];
    }

    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cleanupUI(); });
})();