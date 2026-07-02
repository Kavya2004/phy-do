let isProcessing = false;
let context = [
	{
		role: 'system',
		content: `You are an AI physics tutor operating exclusively in Adversarial Learning Mode. You MUST follow every rule below without exception on every single response.

━━━ ADVERSARIAL LEARNING MODE — MANDATORY RULES ━━━

RULE 1 — NEVER CONFIRM WITHOUT CHALLENGING:
You are FORBIDDEN from simply saying an answer is correct and moving on. Every correct answer MUST be followed by a deeper challenge. You MUST ask why the principle applies, or present a scenario where the student's logic would break down.
BANNED responses: "That's right!", "Exactly!", "Correct!", "Great job!", "Yes, that's correct." — never use these alone.
REQUIRED instead: "OK, but why does [principle] apply here and not [alternative]?" or "You're right — now can you tell me under what conditions that would no longer hold?"

RULE 2 — COUNTEREXAMPLE FOR EVERY INCORRECT ANSWER:
When a student gives a wrong answer, you MUST NOT simply correct them. You MUST construct a concrete counterexample that forces them to see the contradiction themselves.
BANNED: "Actually, that's not right. The correct answer is..."
REQUIRED: Pose a scenario that breaks their logic. E.g. if they say heavier objects fall faster: "If that's true, what happens when you tie a heavy and a light ball together — does the combined object fall faster or slower than the heavy one alone?"

RULE 3 — DEMAND JUSTIFICATION FOR EVERY FORMULA OR PRINCIPLE:
Whenever a student states a formula, law, or principle, you MUST ask them to justify why it applies to this specific situation before proceeding.
BANNED: Accepting "F=ma" or "conservation of momentum" without interrogation.
REQUIRED: "You said F=ma — why is that the right equation here? What does each term represent in this specific problem?"

RULE 4 — TONE IS WARM BUT RELENTLESSLY PERSISTENT:
You are intellectually curious and never condescending, but you NEVER let a student off the hook.
You MUST open every challenge with a phrase such as:
- "Interesting argument, but I see a problem..."
- "That's a reasonable instinct — but let me push back on it."
- "OK, but here's what I'm not sure about..."
- "You're on to something, but consider this..."
You MUST NOT use a neutral or validating opener before challenging.

RULE 5 — ONE CHALLENGE PER RESPONSE:
Each response MUST contain exactly one focused challenge, counterexample, or justification demand. Do NOT explain the full concept. Do NOT give the answer. End with a single direct question the student must answer.

RULE 6 — NO UNSOLICITED EXPLANATIONS:
You MUST NOT volunteer the correct explanation unless the student has made at least two genuine attempts and is clearly stuck. Even then, give only a minimal hint, then challenge again.

Focus on core introductory physics topics only.


REFERENCE LINKS INSTRUCTIONS:

You have access to the student's physics course materials including lecture slides, textbook chapters, and other uploaded resources. Relevant excerpts will be provided in context under "COURSE MATERIALS".
When answering, ALWAYS ground your response in the provided course material excerpts. Quote or paraphrase directly from them when relevant. Prefer the course materials over general knowledge.
Do NOT invent, paraphrase, or rename source materials. If you refer to a source in your response text, use its EXACT name as listed in the COURSE MATERIALS context — nothing else.

CITATION RULE: Do NOT write any citation lines or source references in your response. Citations are handled automatically by the system from the provided COURSE MATERIALS context.`
	}
];

const searchCache = new Map();
window.chatInitialized = false;

function maybeInitializeChat() {
    if (!window.chatInitialized) {
        initializeChat();
    }
}

document.addEventListener('DOMContentLoaded', maybeInitializeChat);

if (document.readyState === 'interactive' || document.readyState === 'complete') {
    maybeInitializeChat();
}

function handlePasteEvent(event) {
    const activeElement = document.activeElement;
    const chatInput = document.getElementById('chatInput');
    if (activeElement !== chatInput) return;

    const items = event.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
        if (item.type.indexOf('image') === 0) {
            const file = item.getAsFile();
            if (file) {
                uploadedFiles.push(file);
                addFileToPreview(file);
                const filePreview = document.getElementById('filePreview');
                filePreview.style.display = 'flex';
            }
        }
    }
}

function initializeChat() {
    if (window.chatInitialized) return;
    window.chatInitialized = true;
    window.processUserMessage = processUserMessage;
    window.initializeChat = initializeChat;
    const sendButton = document.getElementById('sendButton');
    const chatInput = document.getElementById('chatInput');

    if (sendButton) {
        sendButton.addEventListener('click', handleSendMessage);
    }

    if (chatInput) {
        chatInput.addEventListener('keypress', handleKeyPress);
    }

    initializeFileUpload();
    initializeDragDrop();
    createChatControls();
    initializeVoiceInput();

    addMessage("Hi there! I'm your physics tutor! Ask me anything about physics!", 'bot');

    document.addEventListener('paste', handlePasteEvent);

    // ── Expose hooks for chat-history-manager ──────────────────────────────

    // Reset context to just the system prompt
    window._resetChatContext = function () {
        context = [context[0]];
    };

    // Add a message to the UI without triggering any DB save (used when replaying history)
    window._addMessageSilent = function (text, sender) {
        _addMessageInternal(text, sender, [], null, /*silent=*/true);
    };

    // Rebuild the AI context from stored message array
    window._rebuildContext = function (messages) {
        context = [context[0]]; // keep system prompt
        messages.forEach(m => {
            context.push({ role: m.role === 'bot' ? 'assistant' : 'user', content: m.content });
        });
        // Trim to max size
        const max = 18;
        if (context.length > max) context = [context[0], ...context.slice(-(max - 1))];
    };
}
let uploadedFiles = [];

function initializeFileUpload() {
	const uploadButton = document.getElementById('uploadButton');
	const fileInput = document.getElementById('fileInput');

	if (uploadButton && fileInput) {
		uploadButton.addEventListener('click', () => fileInput.click());
		fileInput.addEventListener('change', handleFileSelect);
	}
}

function initializeDragDrop() {
	const chatContainer = document.querySelector('.chat-container');
	if (!chatContainer) return;

	chatContainer.addEventListener('dragover', (e) => {
		e.preventDefault();
		chatContainer.style.backgroundColor = '#f0f8ff';
	});

	chatContainer.addEventListener('dragleave', (e) => {
		e.preventDefault();
		chatContainer.style.backgroundColor = '';
	});

	chatContainer.addEventListener('drop', (e) => {
		e.preventDefault();
		chatContainer.style.backgroundColor = '';
		const files = Array.from(e.dataTransfer.files);
		handleDroppedFiles(files);
	});
}

function handleDroppedFiles(files) {
	const filePreview = document.getElementById('filePreview');

	files.forEach((file) => {
		if (isValidFileType(file)) {
			uploadedFiles.push(file);
			addFileToPreview(file);
		} else {
			addMessage(
				`File type "${file.type}" is not supported. Please upload PDF, images, videos, audio, or text files.`,
				'bot'
			);
		}
	});

	if (uploadedFiles.length > 0) {
		filePreview.style.display = 'flex';
	}
}
async function getGeminiResponse(messages, files = []) {
	try {
		const response = await fetch('/api/gemini', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ messages, files })
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
		}

		const data = await response.json();
		return data.response || 'No response received from Gemini.';
	} catch (error) {


		// Provide user-friendly error messages
		if (error.message.includes('fetch')) {
			throw new Error('Unable to connect to the AI service. Please check your internet connection.');
		} else if (error.message.includes('429')) {
			throw new Error('Too many requests. Please wait a moment and try again.');
		} else if (error.message.includes('401')) {
			throw new Error('API authentication failed. Please check your configuration.');
		} else {
			throw new Error('AI service is temporarily unavailable. Please try again.');
		}
	}
}

function handleFileSelect(event) {
	const files = Array.from(event.target.files);
	const filePreview = document.getElementById('filePreview');

	files.forEach((file) => {
		if (isValidFileType(file)) {
			uploadedFiles.push(file);
			addFileToPreview(file);
		} else {
			addMessage(
				`File type "${file.type}" is not supported. Please upload PDF, images, videos, audio, or text files.`,
				'bot'
			);
		}
	});

	// Show file preview container if files are uploaded
	if (uploadedFiles.length > 0) {
		filePreview.style.display = 'flex';
	}

	event.target.value = '';
}

function isValidFileType(file) {
	const validTypes = [
		'application/pdf',
		'image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif',
		'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm',
		'audio/wav', 'audio/mp3', 'audio/mpeg',
		'text/plain', 'text/html', 'text/css', 'application/javascript'
	];
	return validTypes.includes(file.type);
}

function addFileToPreview(file) {
	const filePreview = document.getElementById('filePreview');
	const fileItem = document.createElement('div');
	fileItem.className = 'file-item';
	fileItem.dataset.fileName = file.name;

	const fileIcon = getFileIcon(file.type);
	const fileName = file.name.length > 20 ? file.name.substring(0, 20) + '...' : file.name;

	fileItem.innerHTML = `
        <span class="file-icon">${fileIcon}</span>
        <span class="file-name" title="${file.name}" onclick="viewFile('${file.name}')" style="cursor: pointer; color: #007bff;">${fileName}</span>
        <button class="remove-file" onclick="removeFile('${file.name}')">×</button>
    `;

	filePreview.appendChild(fileItem);
}

function getFileIcon(fileType) {
	if (fileType === 'application/pdf') return '📄';
	if (fileType.startsWith('image/')) return '🖼️';
	return '📎';
}

function removeFile(fileName) {
	uploadedFiles = uploadedFiles.filter((file) => file.name !== fileName);
	const fileItem = document.querySelector(`.file-item[data-file-name="${fileName}"]`);
	if (fileItem) {
		fileItem.remove();
	}

	// Hide file preview container if no files remain
	const filePreview = document.getElementById('filePreview');
	if (uploadedFiles.length === 0) {
		filePreview.style.display = 'none';
	}
}

function viewFile(fileName) {
	const file = uploadedFiles.find((f) => f.name === fileName);
	if (!file) return;

	const modal = document.createElement('div');
	modal.className = 'file-viewer-modal';
	modal.style.cssText = `
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(0,0,0,0.8);
		z-index: 10000;
		display: flex;
		align-items: center;
		justify-content: center;
	`;

	const content = document.createElement('div');
	content.style.cssText = `
		background: white;
		border-radius: 8px;
		max-width: 90%;
		max-height: 90%;
		overflow: auto;
		position: relative;
	`;

	const closeBtn = document.createElement('button');
	closeBtn.innerHTML = '×';
	closeBtn.style.cssText = `
		position: absolute;
		top: 10px;
		right: 15px;
		background: none;
		border: none;
		font-size: 24px;
		cursor: pointer;
		z-index: 1;
	`;
	closeBtn.onclick = () => modal.remove();

	if (file.type.startsWith('image/')) {
		const img = document.createElement('img');
		img.src = URL.createObjectURL(file);
		img.style.cssText = 'max-width: 100%; max-height: 100%; display: block;';
		content.appendChild(img);
	} else if (file.type === 'application/pdf') {
		const iframe = document.createElement('iframe');
		iframe.src = URL.createObjectURL(file);
		iframe.style.cssText = 'width: 80vw; height: 80vh; border: none;';
		content.appendChild(iframe);
	}

	content.appendChild(closeBtn);
	modal.appendChild(content);
	document.body.appendChild(modal);

	modal.onclick = (e) => {
		if (e.target === modal) modal.remove();
	};
}

async function processFilesForTutor(files) {
	const processedFiles = [];

	for (const file of files) {
		if (file.size > 10 * 1024 * 1024) {
			throw new Error('File too large (max 10MB)');
		}

		const base64 = await fileToBase64(file);
		const fileEntry = {
			name: file.name,
			type: file.type,
			data: base64
		};

		if (file.type.startsWith('image/')) {
			try {
				const ocrText = await getOcrFromImage(base64);
				if (ocrText && ocrText.trim() && ocrText.trim().toLowerCase() !== 'error reading image text.') {
					fileEntry.ocrText = ocrText.trim();
				}
			} catch (ocrError) {
				fileEntry.ocrText = null;
			}
		}

		processedFiles.push(fileEntry);
	}

	return processedFiles;
}

function fileToBase64(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		const timeout = setTimeout(() => {
			reader.abort();
			reject(new Error('File reading timeout'));
		}, 30000); // 30 second timeout
		
		reader.onload = () => {
			clearTimeout(timeout);
			resolve(reader.result);
		};
		
		reader.onerror = () => {
			clearTimeout(timeout);
			reject(new Error('Failed to read file'));
		};
		
		reader.onabort = () => {
			clearTimeout(timeout);
			reject(new Error('File reading was aborted'));
		};
		
		try {
			reader.readAsDataURL(file);
		} catch (error) {
			clearTimeout(timeout);
			reject(error);
		}
	});
}

async function getOcrFromImage(base64Image) {
	const endpoints = ['/api/ocr', 'https://tutor.probabilitycourse.com/api/ocr'];

	for (const endpoint of endpoints) {
		try {
			const response = await fetch(endpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ image: base64Image })
			});

			if (!response.ok) {
				continue;
			}

			const data = await response.json();

			if (data.text && data.text.trim()) {
				return data.text;
			} else if (Array.isArray(data.data) && data.data.length > 0) {
				return data.data.map((entry) => entry.value || '').join(' ');
			} else {
				return 'No recognizable text found in image.';
			}
		} catch (error) {
			continue;
		}
	}

	return 'Error reading image text.';
}

function createChatControls() {
	const chatContainer = document.querySelector('.chat-container');
	const existingControls = document.getElementById('chatControls');
	if (!chatContainer) return;
	if (existingControls) {
		if (!chatContainer.contains(existingControls)) {
			existingControls.remove();
		} else {
			return;
		}
	}

	const controlsDiv = document.createElement('div');
	controlsDiv.id = 'chatControls';
	controlsDiv.style.cssText = `
		display: flex;
		gap: 8px;
		padding: 10px 15px;
		background: #f8f9fa;
		border-bottom: 1px solid #e0e0e0;
		flex-shrink: 0;
	`;

	const saveBtn = document.createElement('button');
	saveBtn.innerHTML = '💾 Save Chat';
	saveBtn.style.cssText = `
		padding: 6px 12px;
		border: 1px solid #ddd;
		border-radius: 15px;
		background: #881c1c;
		color: white;
		cursor: pointer;
		font-size: 12px;
		transition: all 0.3s ease;
	`;
	saveBtn.addEventListener('click', saveChatHistory);

	const summaryBtn = document.createElement('button');
	summaryBtn.innerHTML = '📝 Generate Summary';
	summaryBtn.style.cssText = `
		padding: 6px 12px;
		border: 1px solid #ddd;
		border-radius: 15px;
		background: #881c1c;
		color: white;
		cursor: pointer;
		font-size: 12px;
		transition: all 0.3s ease;
	`;
	summaryBtn.addEventListener('click', generateChatSummary);

	controlsDiv.appendChild(saveBtn);
	controlsDiv.appendChild(summaryBtn);
	chatContainer.insertBefore(controlsDiv, chatContainer.firstChild);
}

function initializeVoiceInput() {
	const micBtn = document.getElementById('voiceInputBtn');
	if (!micBtn || !('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
		if (micBtn) micBtn.style.display = 'none';
		return;
	}

	const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
	const recognition = new SpeechRecognition();
	recognition.continuous = false;
	recognition.interimResults = false;
	recognition.lang = 'en-US';

	let listening = false;

	recognition.onresult = (e) => {
		const transcript = e.results[0][0].transcript;
		const chatInput = document.getElementById('chatInput');
		if (chatInput) chatInput.value = transcript;
	};

	recognition.onend = () => {
		listening = false;
		micBtn.style.background = '';
		micBtn.title = 'Click to speak';
	};

	micBtn.addEventListener('click', () => {
		if (listening) {
			recognition.stop();
		} else {
			recognition.start();
			listening = true;
			micBtn.style.background = 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)';
			micBtn.title = 'Listening... click to stop';
		}
	});
}

function handleKeyPress(event) {
	if (event.key === 'Enter' && !event.shiftKey) {
		event.preventDefault();
		handleSendMessage();
	}
}

function handleSendMessage() {
	const input = document.getElementById('chatInput');
	const message = input.value.trim();

	if ((message || uploadedFiles.length > 0) && !isProcessing) {
		processUserMessage(message);
		input.value = '';
	}
}

function addMessage(text, sender, files = [], citation = null) {
	_addMessageInternal(text, sender, files, citation, false);
}

function _addMessageInternal(text, sender, files = [], citation = null, silent = false) {
	// Reset the idle-logout timer on every chat message (user or bot)
	if (window.resetIdleChatTimer) window.resetIdleChatTimer();

	const chatMessages = document.getElementById('chatMessages');
	const messageDiv = document.createElement('div');
	messageDiv.className = `message ${sender}-message slide-in`;

	const avatar = document.createElement('div');
	avatar.className = 'message-avatar';
	avatar.innerHTML = sender === 'bot' ? '🤖' : '👤';

	// Convert LaTeX to Unicode for bot messages
	// Protect $...$ and $$...$$ blocks from unicode conversion so KaTeX can render them
	let displayText = text;
	if (sender === 'bot' && window.convertLatexToUnicode) {
		// Temporarily pull out math blocks before unicode conversion
		const mathBlocks = [];
		let protected_text = displayText
			.replace(/\$\$[\s\S]+?\$\$/g, (m) => { mathBlocks.push(m); return `\x00MATH${mathBlocks.length - 1}\x00`; })
			.replace(/\$[^$\n]+?\$/g,      (m) => { mathBlocks.push(m); return `\x00MATH${mathBlocks.length - 1}\x00`; });
		protected_text = window.convertLatexToUnicode(protected_text);
		// Restore math blocks
		displayText = protected_text.replace(/\x00MATH(\d+)\x00/g, (_, i) => mathBlocks[i]);
	}

	const content = document.createElement('div');
	content.className = 'message-content';

	let citationHTML = '';
	if (sender === 'bot' && citation && citation.length > 0) {
		citationHTML = citation.map(c => {
			const pageLabel = c.page ? ` · p.${c.page}` : '';
			const icon = getSourceIcon(c.name);
			const safeName = (c.name || '').replace(/'/g, "\\'");

			// Skip video/lecture link sources
			if (/video links|lecture video/i.test(c.name || '')) return '';

			// Textbook — show local page image
			const isTextbook = /college physics|textbook|physics.?2e/i.test(c.name || '');
			if (isTextbook && c.page) {
				return `<span class="citation-pill" onclick="showBookRef(${c.page})" style="cursor:pointer" title="View page ${c.page}">${icon} ${c.name}${pageLabel}</span>`;
			}

			// Everything else (slides, notes, YouTube) — open from Google Drive
			if (c.drive_file_id) {
				const driveUrl = `https://drive.google.com/file/d/${c.drive_file_id}/preview${c.page ? `#page=${c.page}` : ''}`;
				return `<span class="citation-pill" onclick="showDriveRef('${driveUrl}','${safeName}',${c.page||'null'})" style="cursor:pointer" title="View source">${icon} ${c.name}${pageLabel}</span>`;
			}

			// Video with URL but no drive ID — skip
			if (c.url) return '';

			// Fallback — show text content
			if (c.text) {
				const safeText = c.text.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
				return `<span class="citation-pill" onclick="showTextRef('${safeText}','${safeName}',${c.page||1})" style="cursor:pointer" title="View source">${icon} ${c.name}${pageLabel}</span>`;
			}

			if (!c.name) return '';
			return `<span class="citation-pill" title="Source reference">${icon} ${c.name}${pageLabel}</span>`;
		}).join('');
	}

	content.innerHTML = displayText
	.replace(/\n/g, '<br>')
	.replace(/<https?:\/\/[^>]+>/g, (match) => {
		const url = match.slice(1, -1);
		return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
	});

	if (citationHTML) {
		const pill = document.createElement('div');
		pill.className = 'citation-wrap';
		pill.innerHTML = citationHTML;
		content.appendChild(pill);
	}


	if (files && files.length > 0) {
		const filesDiv = document.createElement('div');
		filesDiv.className = 'message-files';
		filesDiv.style.cssText = 'margin-top: 8px; display: flex; flex-wrap: wrap; gap: 4px;';

		files.forEach((file) => {
			const fileSpan = document.createElement('span');
			fileSpan.className = 'message-file';
			fileSpan.style.cssText =
				'background: #e3f2fd; padding: 4px 8px; border-radius: 12px; font-size: 12px; cursor: pointer; color: #1976d2;';
			fileSpan.innerHTML = `${getFileIcon(file.type)} ${file.name}`;
			fileSpan.onclick = () => viewUploadedFile(file);
			filesDiv.appendChild(fileSpan);
		});

		content.appendChild(filesDiv);
	}

	messageDiv.appendChild(avatar);
	messageDiv.appendChild(content);
	chatMessages.appendChild(messageDiv);
	chatMessages.scrollTop = chatMessages.scrollHeight;

	// Render LaTeX math in this message using KaTeX
	if (sender === 'bot') {
		const renderKatex = () => {
			if (window.renderMathInElement) {
				renderMathInElement(content, {
					delimiters: [
						{ left: '$$', right: '$$', display: true },
						{ left: '$',  right: '$',  display: false },
						{ left: '\\(', right: '\\)', display: false },
						{ left: '\\[', right: '\\]', display: true }
					],
					throwOnError: false,
					output: 'html'
				});
				chatMessages.scrollTop = chatMessages.scrollHeight;
			}
		};
		// KaTeX scripts are deferred — wait for them if not yet ready
		if (window.renderMathInElement) {
			renderKatex();
		} else {
			window.addEventListener('load', renderKatex, { once: true });
		}
	}

	if (window.sessionManager && window.sessionManager.sessionId) {
		window.sessionManager.broadcastMessage(text, sender, files);
	}

	// Persist to MongoDB (skip when replaying history)
	if (!silent && window.chatHistoryManager) {
		const userName = (window.sessionManager && window.sessionManager.userName) || '';
		window.chatHistoryManager.appendMessage(sender === 'bot' ? 'bot' : 'user', text, userName);
	}

}

function viewUploadedFile(file) {
	if (file.data) {
		const modal = document.createElement('div');
		modal.className = 'file-viewer-modal';
		modal.style.cssText = `
			position: fixed;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			background: rgba(0,0,0,0.8);
			z-index: 10000;
			display: flex;
			align-items: center;
			justify-content: center;
		`;

		const content = document.createElement('div');
		content.style.cssText = `
			background: white;
			border-radius: 8px;
			max-width: 90%;
			max-height: 90%;
			overflow: auto;
			position: relative;
		`;

		const closeBtn = document.createElement('button');
		closeBtn.innerHTML = '×';
		closeBtn.style.cssText = `
			position: absolute;
			top: 10px;
			right: 15px;
			background: none;
			border: none;
			font-size: 24px;
			cursor: pointer;
			z-index: 1;
		`;
		closeBtn.onclick = () => modal.remove();

		if (file.type.startsWith('image/')) {
			const img = document.createElement('img');
			img.src = file.data;
			img.style.cssText = 'max-width: 100%; max-height: 100%; display: block;';
			content.appendChild(img);
		} else if (file.type === 'application/pdf') {
			const iframe = document.createElement('iframe');
			iframe.src = file.data;
			iframe.style.cssText = 'width: 80vw; height: 80vh; border: none;';
			content.appendChild(iframe);
		}

		content.appendChild(closeBtn);
		modal.appendChild(content);
		document.body.appendChild(modal);

		modal.onclick = (e) => {
			if (e.target === modal) modal.remove();
		};
	}
}

let loadingInterval;
let loadingStartTime;
let isLoadingActive = false;

function showLoading() {
	// Clear any existing loading first
	if (loadingInterval) {
		clearInterval(loadingInterval);
		loadingInterval = null;
	}
	
	// Prevent multiple loading instances
	if (isLoadingActive) return;
	
	const loadingIndicator = document.getElementById('loadingIndicator');
	const progressFill = document.getElementById('progressFill');
	const loadingMessage = document.getElementById('loadingMessage');
	const loadingTime = document.getElementById('loadingTime');
	
	if (loadingIndicator) {
		isLoadingActive = true;
		loadingIndicator.style.display = 'flex';
		
		// Reset progress
		if (progressFill) progressFill.style.width = '0%';
		
		// Set initial message
		if (loadingMessage) loadingMessage.textContent = 'Tutor is thinking...';
		if (loadingTime) loadingTime.textContent = 'Estimated time: 5 seconds';
		
		// Start progress animation
		startProgressAnimation();
	}
}

function hideLoading() {
	const loadingIndicator = document.getElementById('loadingIndicator');
	if (loadingIndicator) {
		loadingIndicator.style.display = 'none';
	}
	
	// Clear interval and reset state
	if (loadingInterval) {
		clearInterval(loadingInterval);
		loadingInterval = null;
	}
	isLoadingActive = false;
}

function startProgressAnimation() {
	const progressFill = document.getElementById('progressFill');
	const loadingMessage = document.getElementById('loadingMessage');
	const loadingTime = document.getElementById('loadingTime');
	
	let progress = 0;
	let messageIndex = 0;
	let timeRemaining = 5;
	let tickCount = 0;
	
	const messages = [
		'Tutor is thinking...',
		'Analyzing your question...',
		'Searching knowledge base...',
		'Preparing explanation...',
		'Almost ready...'
	];
	
	loadingInterval = setInterval(() => {
		tickCount++;
		
		// Update progress
		if (progress < 70) {
			progress += Math.random() * 8 + 2;
		} else if (progress < 90) {
			progress += Math.random() * 3 + 1;
		} else {
			progress += Math.random() * 1;
		}
		
		progress = Math.min(progress, 95);
		
		if (progressFill) {
			progressFill.style.width = progress + '%';
		}
		
		// Update message every 7 ticks (1.4 seconds)
		if (tickCount % 7 === 0 && messageIndex < messages.length - 1) {
			messageIndex++;
			if (loadingMessage) {
				loadingMessage.textContent = messages[messageIndex];
			}
		}
		
		// Update countdown every 5 ticks (1 second)
		if (tickCount % 5 === 0 && timeRemaining > 0) {
			timeRemaining--;
		}
		
		if (loadingTime) {
			if (timeRemaining > 0) {
				loadingTime.textContent = `Estimated time: ${timeRemaining} seconds`;
			} else {
				loadingTime.textContent = 'Just a moment...';
			}
		}
		
	}, 200);
}

function showLoadingForQuiz() {
	if (loadingInterval) {
		clearInterval(loadingInterval);
		loadingInterval = null;
	}

	const loadingIndicator = document.getElementById('loadingIndicator');
	const progressFill = document.getElementById('progressFill');
	const loadingMessage = document.getElementById('loadingMessage');
	const loadingTime = document.getElementById('loadingTime');
	
	if (loadingIndicator) {
		loadingIndicator.style.display = 'flex';
		loadingStartTime = Date.now();
		
		// Reset progress
		if (progressFill) progressFill.style.width = '0%';
		
		// Set quiz-specific messages
		if (loadingMessage) loadingMessage.textContent = 'Generating quiz questions...';
		if (loadingTime) loadingTime.textContent = 'Estimated time: 8-12 seconds';
		
		// Start quiz-specific progress animation
		startQuizProgressAnimation();
	}
}

function startQuizProgressAnimation() {
	const progressFill = document.getElementById('progressFill');
	const loadingMessage = document.getElementById('loadingMessage');
	const loadingTime = document.getElementById('loadingTime');
	
	let progress = 0;
	let messageIndex = 0;
	
	const quizMessages = [
		'Generating quiz questions...',
		'Creating multiple choice options...',
		'Reviewing question difficulty...',
		'Finalizing quiz content...',
		'Almost ready...'
	];
	
	loadingInterval = setInterval(() => {
		const elapsed = (Date.now() - loadingStartTime) / 1000;
		
		// Slower progress for quiz generation
		if (progress < 60) {
			progress += Math.random() * 4 + 1;
		} else if (progress < 85) {
			progress += Math.random() * 2 + 0.5;
		} else {
			progress += Math.random() * 0.5;
		}
		
		progress = Math.min(progress, 95);
		
		if (progressFill) {
			progressFill.style.width = progress + '%';
		}
		
		// Update message every 2 seconds for quiz
		if (Math.floor(elapsed / 2) > messageIndex && messageIndex < quizMessages.length - 1) {
			messageIndex++;
			if (loadingMessage) {
				loadingMessage.textContent = quizMessages[messageIndex];
			}
		}
		
		// Update time estimation for quiz
		if (loadingTime) {
			const remaining = Math.max(0, 12 - elapsed);
			if (remaining > 1) {
				loadingTime.textContent = `Estimated time: ${Math.ceil(remaining)} seconds`;
			} else {
				loadingTime.textContent = 'Just a moment...';
			}
		}
		
	}, 300);
}

function completeLoading() {
	const progressFill = document.getElementById('progressFill');
	const loadingMessage = document.getElementById('loadingMessage');
	
	if (progressFill) {
		progressFill.style.width = '100%';
	}
	
	if (loadingMessage) {
		loadingMessage.textContent = 'Ready!';
	}
	
	setTimeout(() => {
		hideLoading();
	}, 500);
}

// Make function globally available
window.showLoadingForQuiz = showLoadingForQuiz;
window.addMessage = addMessage;
function hasWhiteboardContent(board) {
	const canvas = board === 'teacher' ? 
		document.getElementById('teacherWhiteboard') : 
		document.getElementById('studentWhiteboard');
	if (!canvas) return false;
	
	const ctx = canvas.getContext('2d');
	const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
	const data = imageData.data;
	
	// Check if any non-white pixels exist
	for (let i = 0; i < data.length; i += 4) {
		if (data[i] !== 255 || data[i + 1] !== 255 || data[i + 2] !== 255) {
			return true;
		}
	}
	return false;
}

async function getOcrTextFromWhiteboardImage(board) {
	try {
		const canvas =
			board === 'teacher' ? document.getElementById('teacherWhiteboard') : document.getElementById('studentWhiteboard');
		if (!canvas) {
			return null;
		}

		const base64Image = canvas.toDataURL('image/png');
		const text = await getOcrFromImage(base64Image);
		return text;
	} catch (err) {
		return null;
	}
}

async function searchPhysicsTextbook(query) {
	// Check cache first
	const cacheKey = query.toLowerCase().trim();
	if (searchCache.has(cacheKey)) {
		return searchCache.get(cacheKey);
	}
	
	try {
		// Search web pages, PDFs, and Pinecone in parallel
		const [webRes, pdfRes, pineconeRes] = await Promise.all([
			fetch('/api/search', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ query })
			}),
			fetch('/api/pdf-content', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ query })
			}),
			fetch('/api/pinecone', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ query })
			}).catch(() => null)
		]);

		let results = [];
		
		if (webRes.ok) {
			const webData = await webRes.json();
			results = webData.results || [];
		}
		
		if (pdfRes.ok) {
			const pdfData = await pdfRes.json();
			const pdfResults = (pdfData.pdfs || []).map(pdf => ({
				title: pdf.title,
				link: pdf.url,
				pageNumber: pdf.pageNumber,
				snippet: pdf.snippet,
				content: pdf.content
			}));
			results = [...results, ...pdfResults];
		}

		if (pineconeRes && pineconeRes.ok) {
			const pineconeData = await pineconeRes.json();
			const pineconeResults = (pineconeData.chunks || []).map(chunk => ({
				title: chunk.source,
				link: chunk.url || chunk.source,
				pageNumber: chunk.page,
				snippet: chunk.text.substring(0, 200),
				content: chunk.text,
				url: chunk.url,
				embed_url: chunk.embed_url,
				drive_file_id: chunk.drive_file_id,
				file_name: chunk.file_name,
				type: chunk.type,
				fromPinecone: true
			}));
			results = [...pineconeResults, ...results];
		}
		
		// Cache results (limit cache size)
		if (searchCache.size > 50) {
			const firstKey = searchCache.keys().next().value;
			searchCache.delete(firstKey);
		}
		searchCache.set(cacheKey, results);
		
		return results;
	} catch (err) {
		return [];
	}
}

// ── In-class history loader ──────────────────────────────────────────────────
// Fetches all stored messages for this session from the in-class DB and
// injects them into the AI context so the tutor knows every prior exchange.
// Called once per session (guarded by window._inClassHistoryLoaded).
async function loadInClassHistory() {
	window._inClassHistoryLoaded = true; // set early to prevent concurrent calls
	const sessionId = window._inClassSessionId || (window.sessionManager && window.sessionManager.sessionId);
	if (!sessionId || !window._inClassMode) return;

	const BACKEND = 'https://physics-ai-tutor.onrender.com';
	try {
		const res = await fetch(`${BACKEND}/api/in-class/chat?sessionId=${encodeURIComponent(sessionId)}`);
		if (!res.ok) return;
		const convos = await res.json();
		if (!convos || convos.length === 0) return;

		// Fetch each conversation's full messages and build a single history block
		const allMessages = [];
		await Promise.all(convos.map(async (convo) => {
			try {
				const fullRes = await fetch(`${BACKEND}/api/in-class/chat/${convo._id}`);
				if (!fullRes.ok) return;
				const full = await fullRes.json();
				(full.messages || []).forEach(m => {
					allMessages.push({
						ts: new Date(m.timestamp).getTime(),
						role: m.role,
						content: m.content,
						userName: m.userName || '',
					});
				});
			} catch (_) {}
		}));

		if (allMessages.length === 0) return;

		// Sort by timestamp so the history reads in order
		allMessages.sort((a, b) => a.ts - b.ts);

		// Inject as a system block so the AI sees it as background knowledge
		const historyText = allMessages
			.map(m => {
				const who = m.role === 'bot' ? 'AI Tutor' : (m.userName || 'Student');
				return `${who}: ${m.content}`;
			})
			.join('\n');

		context.push({
			role: 'system',
			content: `PREVIOUS CONVERSATION HISTORY for this in-class session (${window._inClassSessionTitle || sessionId}).\nUse this to understand what has already been discussed with each student:\n\n${historyText.substring(0, 6000)}\n\nEnd of history.`,
		});

		console.log(`[in-class] Loaded ${allMessages.length} historical messages into context`);
	} catch (e) {
		console.warn('[in-class] Failed to load history:', e.message);
	}
}

async function processUserMessage(message) {
	if (isProcessing || (!message.trim() && uploadedFiles.length === 0)) return;

	// Check if this is a quiz request before processing
	if (window.quizIntegration && window.quizIntegration.handleQuizCommands(message)) {
		return; // Quiz command handled, don't process further
	}

	isProcessing = true;

	// Process uploaded files if any
	let processedFiles = [];
	let fileData = [];
	if (uploadedFiles.length > 0) {
		try {
			processedFiles = await processFilesForTutor(uploadedFiles);
			fileData = processedFiles;
		} catch (fileError) {
			addMessage('Error processing files. Continuing without files.', 'bot');
		}
		// Clear uploaded files after processing
		uploadedFiles = [];
		const filePreview = document.getElementById('filePreview');
		filePreview.innerHTML = '';
		filePreview.style.display = 'none';
	}

	// Detect if any of the uploaded files are images
	const hasImages = processedFiles.some(f => f.type && f.type.startsWith('image/'));

	// Prepare user message (include file info if files were uploaded)
	let userMessage = message.trim();
	if (processedFiles.length > 0) {
		if (hasImages && !userMessage) {
			// No text provided — give Gemini something to work with in adversarial mode
			userMessage = 'I uploaded an image. Please look at it carefully and engage with it as my physics tutor.';
		} else if (!userMessage) {
			const fileNames = processedFiles.map((f) => f.name).join(', ');
			userMessage = `I've uploaded these files: ${fileNames}`;
		}
		// Files (with base64 data) are sent directly to Gemini API
	}

	// Handle message display/broadcasting (only once!)
	if (window.sessionManager && window.sessionManager.sessionId) {
		// In session mode, broadcast user message
		window.sessionManager.broadcastMessage(userMessage, 'user', fileData);
	} else {
		// Not in session, add message locally
		addMessage(userMessage, 'user', fileData);
	}

	// Always process with AI regardless of session mode
	// This ensures the AI responds to all user messages in sessions

	showLoading();

	try {
		let boardToCheck = 'student'; //hard-coded to student board only.
		// if (/student board|student whiteboard/i.test(message)) {
		// 	boardToCheck = 'student';
		// } else if (/teacher board|teacher whiteboard/i.test(message)) {
		// 	boardToCheck = 'teacher';
		// }

		let ocrText = null;
		if (boardToCheck && hasWhiteboardContent(boardToCheck)) {
			ocrText = await getOcrTextFromWhiteboardImage(boardToCheck);

			if (ocrText && ocrText.trim() && ocrText.trim().toLowerCase() !== 'error reading image text.') {
				context.push({
					role: 'user',
					content: `${boardToCheck} has the text: ${ocrText}`
				});
			} else {
			}
		}

		// Add user message to context for AI
		if (window.sessionManager && window.sessionManager.sessionId) {
			// In-class shared session: build context from the live shared chat
			// plus any stored history for this session from the DB.
			// Only rebuild from DOM if we don't have a pre-loaded history context.
			if (!window._inClassHistoryLoaded) {
				await loadInClassHistory();
			}

			// Append the current live exchange from the DOM (last 20 messages)
			// so the AI sees what has happened in this session so far.
			const chatMessages = document.querySelectorAll('.message');
			const recentMessages = Array.from(chatMessages).slice(-20);

			recentMessages.forEach(msgElement => {
				const isBot    = msgElement.classList.contains('bot-message');
				const isShared = msgElement.classList.contains('shared-message');
				const contentEl = msgElement.querySelector('.message-content');
				if (!contentEl) return;
				const messageText = (contentEl.querySelector('.message-text') || contentEl).textContent.trim();
				if (!messageText) return;

				if (isBot) {
					context.push({ role: 'assistant', content: messageText });
				} else {
					const author = msgElement.querySelector('.message-author')?.textContent?.trim() || 'Student';
					context.push({ role: 'user', content: `${author}: ${messageText}` });
				}
			});

			// Add current message attributed to this student
			context.push({ role: 'user', content: `${window.sessionManager.userName}: ${userMessage}` });
		} else {
			// Not in session — just add current message
			context.push({ role: 'user', content: userMessage });
		}
		// Search for matching physics textbook sections
		const searchResults = await searchPhysicsTextbook(userMessage || message);

		// Build a url lookup map: source name -> url (for YouTube links)
		const sourceUrlMap = {};
		searchResults.forEach(r => { if (r.url) sourceUrlMap[r.title] = r.url; });

		if (searchResults.length > 0) {
			const pineconeChunks = searchResults.filter(r => r.fromPinecone);
			const textbookChunks = searchResults.filter(r => !r.fromPinecone);

			let refsText = 'COURSE MATERIALS — use these as your primary reference:\n';

			pineconeChunks.forEach((r, idx) => {
				refsText += `${idx + 1}. Source: ${r.title}${r.pageNumber ? ` | Page ${r.pageNumber}` : ''}\n${r.content.substring(0, 800)}\n\n`;
			});

			textbookChunks.forEach((r, idx) => {
				const label = r.title || 'College Physics 2e';
				const page = r.pageNumber ? ` | Page ${r.pageNumber}` : '';
				refsText += `${pineconeChunks.length + idx + 1}. Source: ${label}${page}\n${(r.content || r.snippet || '').substring(0, 500)}\n\n`;
			});

			refsText += 'Use the above materials to ground your response. Do NOT mention source names or citations in your response text — citations are handled separately.';

			context.push({
				role: 'system',
				content: refsText
			});

		}

		// Get AI response with files (only if files processed successfully)
		let botResponse = await getGeminiResponse(context, processedFiles.length > 0 ? processedFiles : []);

		// Add bot response to context
		context.push({ role: 'assistant', content: botResponse });

		// Manage context size
		const maxContextMessages = 18;
		if (context.length > maxContextMessages) {
			context = [context[0], ...context.slice(-(maxContextMessages - 1))];
		}

		// Check for whiteboard actions and diagram generation
		let whiteboardAction = null;
		let targetBoard = null;
		let diagramRequest = null;

		const diagramMatch = botResponse.match(/\[GENERATE_DIAGRAM:\s*([^\]]+)\]/);
		const teacherMatch = botResponse.match(/\[TEACHER_BOARD:\s*([^\]]+)\]/);
		const studentMatch = botResponse.match(/\[STUDENT_BOARD:\s*([^\]]+)\]/);

		if (diagramMatch) {
			diagramRequest = diagramMatch[1].trim();
			targetBoard = 'teacher';
			botResponse = botResponse.replace(/\[GENERATE_DIAGRAM:[^\]]+\]/g, '').trim();
		} else if (teacherMatch) {
			// Convert old syntax to new diagram generation
			diagramRequest = teacherMatch[1].trim();
			targetBoard = 'teacher';
			botResponse = botResponse.replace(/\[TEACHER_BOARD:[^\]]+\]/g, '').trim();
		} else if (studentMatch) {
			whiteboardAction = studentMatch[1];
			targetBoard = 'student';
			botResponse = botResponse.replace(/\[STUDENT_BOARD:[^\]]+\]/g, '').trim();
		}
		
		// Clean up any remaining whiteboard tags
		botResponse = botResponse.replace(/\[(?:TEACHER_BOARD|STUDENT_BOARD|GENERATE_DIAGRAM):[^\]]+\]/g, '').trim();

		// Extract citation BEFORE stripping (before convertLatexToUnicode can turn it into a table)
		// Always use actual Pinecone source names — ignore whatever Gemini wrote
		const extractedCitation = searchResults
			.filter(r => r.fromPinecone)
			.filter((r, i, arr) => arr.findIndex(x => x.title === r.title) === i) // dedupe
			.map(r => ({
				name: r.title,
				page: r.pageNumber || null,
				url: r.url || null,
				embed_url: r.embed_url || null,
				drive_file_id: r.drive_file_id || null,
				file_name: r.file_name || null,
				type: r.type || null,
				text: r.content || r.snippet || null
			}));
		// Strip ALL citation formats before any rendering
		botResponse = botResponse
			.replace(/📖\s*Source:[^\n]*/gi, '')
			.replace(/^[-|\s]+$/gm, '')
			.trim();

		// Process bot response for broken links
		if (window.processBotMessageWithLinkValidation) {
			botResponse = await window.processBotMessageWithLinkValidation(botResponse);
		}

		// Complete loading animation
		completeLoading();
		
		// Handle bot response display/broadcasting
		if (window.sessionManager && window.sessionManager.sessionId) {
			// Broadcast to all session participants (they see it via addSharedMessage)
			window.sessionManager.broadcastMessage(botResponse, 'bot');
			// Also save to in-class DB and auto-title from this client
			if (window.chatHistoryManager) {
				window.chatHistoryManager.autoTitle(message, botResponse);
			}
		} else {
			addMessage(botResponse, 'bot', [], extractedCitation);
			// Auto-generate conversation title from the first exchange
			if (window.chatHistoryManager) {
				window.chatHistoryManager.autoTitle(message, botResponse);
			}
		}

		// Execute whiteboard action or generate diagram
		if (diagramRequest && targetBoard) {
			setTimeout(() => generateAIDiagram(diagramRequest, targetBoard), 500);
		} else if (whiteboardAction && targetBoard && window.tutorWhiteboard) {
			setTimeout(() => executeWhiteboardAction(whiteboardAction, targetBoard), 500);
		}
	} catch (error) {

		let errorMessage = 'I apologize, but I encountered an issue. ';

		if (error.message.includes('Cannot reach the API')) {
			errorMessage += 'The API endpoint is not responding. Please check your deployment.';
		} else if (error.message.includes('API endpoint not found')) {
			errorMessage += 'The API endpoint is missing. Make sure /api/gemini.js exists.';
		} else if (error.message.includes('API authentication failed')) {
			errorMessage += 'Please check your GEMINI_API_KEY environment variable.';
		} else if (error.message.includes('Server error')) {
			errorMessage += 'Please check your server logs and API configuration.';
		} else {
			errorMessage += 'Please try again or check the browser console for details.';
		}

		// Add helpful note about textbook references
		errorMessage +=
			'\n\n📚 Note: I can still help explain physics concepts even if College Physics 2e references are temporarily unavailable.';

		// Handle error message display/broadcasting
		if (window.sessionManager && window.sessionManager.sessionId) {
			window.sessionManager.broadcastMessage(errorMessage, 'bot');
		} else {
			addMessage(errorMessage, 'bot');
		}
	}

	// Always hide loading and reset processing state
	if (loadingInterval) {
		clearInterval(loadingInterval);
		loadingInterval = null;
	}
	hideLoading();
	isProcessing = false;
}

function executeWhiteboardAction(actionType, targetBoard) {
	if (!window.tutorWhiteboard) {
		return;
	}



	// ADD THIS: Broadcast whiteboard action to session
	if (window.sessionManager && window.sessionManager.sessionId) {
		window.sessionManager.ws.send(
			JSON.stringify({
				type: 'whiteboard_action',
				action: actionType,
				targetBoard: targetBoard,
				userName: window.sessionManager.userName
			})
		);
	}

	if (window.switchWhiteboard) {
		window.switchWhiteboard(targetBoard);
	}

	switch (actionType) {
		case 'probability_scale':
			if (window.tutorWhiteboard.drawProbabilityScale) {
				window.tutorWhiteboard.drawProbabilityScale(targetBoard);
			}
			break;
		case 'distribution':
			if (window.tutorWhiteboard.drawSampleDistribution) {
				window.tutorWhiteboard.drawSampleDistribution(targetBoard);
			}
			break;
		case 'normal_curve':
			if (window.tutorWhiteboard.drawNormalCurve) {
				window.tutorWhiteboard.drawNormalCurve(targetBoard);
			}
			break;
		case 'tree_diagram':
			if (window.tutorWhiteboard.drawTreeDiagram) {
				window.tutorWhiteboard.drawTreeDiagram(targetBoard);
			}
			break;
		case 'clear_board':
			if (window.tutorWhiteboard.clearWhiteboard) {
				window.tutorWhiteboard.clearWhiteboard(targetBoard);
			}
			break;
		default:
			break;
	}
}

function handleDiceResult(result) {
	const message = `I rolled a ${result}! What does this tell us about probability?`;
	processUserMessage(message);
}
// AI Diagram Generation Function — uses Gemini image generation
async function generateAIDiagram(description, targetBoard = 'teacher') {
	try {
		if (window.switchWhiteboard) window.switchWhiteboard(targetBoard);

		const res = await fetch('/api/image-gen', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ prompt: `Clear educational physics diagram: ${description}. White background, labeled, simple and clean.` })
		});
		const data = await res.json();
		if (!res.ok || !data.image) throw new Error(data.error || 'No image returned');

		const canvas = targetBoard === 'teacher'
			? document.getElementById('teacherWhiteboard')
			: document.getElementById('studentWhiteboard');
		if (!canvas) throw new Error('Canvas not found');

		const ctx = canvas.getContext('2d');
		const img = new Image();
		img.onload = () => {
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
			const x = (canvas.width - img.width * scale) / 2;
			const y = (canvas.height - img.height * scale) / 2;
			ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
		};
		img.src = data.image;

		if (window.sessionManager && window.sessionManager.sessionId && window.sessionManager.ws) {
			window.sessionManager.ws.send(JSON.stringify({
				type: 'diagram_generated',
				description,
				targetBoard,
				userName: window.sessionManager.userName
			}));
		}
	} catch (error) {
		addMessage('Sorry, I had trouble generating the diagram. Let me explain in text instead.', 'bot');
	}
}

function saveChatHistory() {
	const messages = document.querySelectorAll('.message');
	let chatHistory = 'Physics Tutor Chat History\n';
	chatHistory += '================================\n\n';

	messages.forEach((message, index) => {
		const isBot = message.classList.contains('bot-message');
		const content = message.querySelector('.message-content').textContent;
		const sender = isBot ? 'Tutor' : 'Student';
		chatHistory += `${sender}: ${content}\n\n`;
	});

	const blob = new Blob([chatHistory], { type: 'text/plain' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `tutor-chat-${new Date().toISOString().slice(0, 10)}.txt`;
	a.click();
	URL.revokeObjectURL(url);
}

async function generateChatSummary() {
	if (isProcessing) return;

	const messages = document.querySelectorAll('.message');
	if (messages.length <= 1) {
		addMessage('No chat history to summarize yet!', 'bot');
		return;
	}

	isProcessing = true;
	showLoading();

	try {
		let chatContent = '';
		messages.forEach((message) => {
			const isBot = message.classList.contains('bot-message');
			const content = message.querySelector('.message-content').textContent;
			const sender = isBot ? 'Tutor' : 'Student';
			chatContent += `${sender}: ${content}\n`;
		});

		const summaryPrompt = `Please provide a concise summary of this tutoring session, highlighting the main topics discussed, key concepts learned, and any problems solved:\n\n${chatContent}`;

		const summaryResponse = await getGeminiResponse([
			{ role: 'system', content: 'You are summarizing a tutoring session. Be concise and focus on learning outcomes.' },
			{ role: 'user', content: summaryPrompt }
		]);

		addMessage(`📋 **Chat Summary:**\n\n${summaryResponse}`, 'bot');
	} catch (error) {
		addMessage('Sorry, I encountered an issue generating the summary. Please try again.', 'bot');
	}

	hideLoading();
	isProcessing = false;
}

// Global function for whiteboard OCR integration
window.addOcrMessageToChat = function (ocrText, boardType) {
	const message = `I wrote on the ${boardType} whiteboard: "${ocrText}"`;

	// Add to chat input
	const chatInput = document.getElementById('chatInput');
	if (chatInput) {
		const currentValue = chatInput.value || '';
		const newValue = currentValue ? `${currentValue}\n\n${message}` : message;
		chatInput.value = newValue;

		// Trigger events
		chatInput.dispatchEvent(new Event('input', { bubbles: true }));
		chatInput.dispatchEvent(new Event('change', { bubbles: true }));

		// Auto-send if possible
		setTimeout(() => {
			if (!isProcessing) {
				handleSendMessage();
			}
		}, 100);
	}
};

function getSourceIcon(sourceName) {
	if (!sourceName) return '📖';
	const s = sourceName.toLowerCase();
	if (s.includes('youtube') || s.includes('video') || s.includes('lecture video')) return '🎬';
	if (s.includes('slide') || s.includes('ppt')) return '🖥️';
	if (s.includes('textbook') || s.includes('book') || s.includes('college physics')) return '📚';
	if (s.includes('note') || s.includes('summary') || s.includes('review')) return '📝';
	if (s.includes('problem') || s.includes('exercise') || s.includes('hw') || s.includes('homework')) return '✏️';
	if (s.includes('exam') || s.includes('quiz') || s.includes('test') || s.includes('midterm') || s.includes('final')) return '📋';
	if (s.includes('lab') || s.includes('experiment')) return '🔬';
	if (s.includes('lecture') || s.includes('class') || s.includes('lec')) return '🎫';
	return '📄';
}

let _pdfCurrentPage = 1;
let _pdfTotalPages = 0;

function showMediaRef(embedUrl, sourceName, mediaType, page) {
	const existing = document.getElementById('textRefOverlay');
	if (existing) existing.remove();

	const overlay = document.createElement('div');
	overlay.id = 'textRefOverlay';
	overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9000;display:flex;align-items:center;justify-content:center';

	const panel = document.createElement('div');
	panel.style.cssText = 'width:860px;max-width:95vw;height:560px;display:flex;flex-direction:column;border-radius:10px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.45);background:#111';

	const header = document.createElement('div');
	header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#014148;color:white;font-size:13px;font-weight:600;flex-shrink:0';
	const pageLabel = page ? ` · p.${page}` : '';
	header.innerHTML = `<span>${getSourceIcon(sourceName)} ${sourceName}${pageLabel}</span>`;

	const closeBtn = document.createElement('button');
	closeBtn.innerHTML = '×';
	closeBtn.style.cssText = 'background:none;border:none;color:white;font-size:20px;cursor:pointer;line-height:1;padding:0 4px';
	closeBtn.onclick = () => overlay.remove();
	header.appendChild(closeBtn);

	const iframe = document.createElement('iframe');
	iframe.src = embedUrl;
	iframe.style.cssText = 'flex:1;border:none;width:100%';
	iframe.allow = 'autoplay; encrypted-media';
	iframe.allowFullscreen = true;

	panel.appendChild(header);
	panel.appendChild(iframe);
	overlay.appendChild(panel);
	document.body.appendChild(overlay);
	overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
}
window.showMediaRef = showMediaRef;

function showTextRef(text, sourceName, page) {
	const existing = document.getElementById('textRefOverlay');
	if (existing) existing.remove();

	const overlay = document.createElement('div');
	overlay.id = 'textRefOverlay';
	overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9000;display:flex;align-items:center;justify-content:center';

	const panel = document.createElement('div');
	panel.style.cssText = 'width:640px;max-width:92vw;max-height:80vh;display:flex;flex-direction:column;border-radius:10px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.45);background:#f8f9fa';

	const header = document.createElement('div');
	header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#014148;color:white;font-size:13px;font-weight:600';
	header.innerHTML = `<span>${getSourceIcon(sourceName)} ${sourceName}${page ? ` · p.${page}` : ''}</span>`;

	const closeBtn = document.createElement('button');
	closeBtn.innerHTML = '×';
	closeBtn.style.cssText = 'background:none;border:none;color:white;font-size:20px;cursor:pointer;line-height:1;padding:0 4px';
	closeBtn.onclick = () => overlay.remove();
	header.appendChild(closeBtn);

	const body = document.createElement('div');
	body.style.cssText = 'flex:1;overflow-y:auto;padding:20px 24px;background:#fff;font-size:14px;line-height:1.8;color:#222;white-space:pre-wrap;font-family:Georgia,serif';
	body.textContent = text;

	panel.appendChild(header);
	panel.appendChild(body);
	overlay.appendChild(panel);
	document.body.appendChild(overlay);
	overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
}
window.showTextRef = showTextRef;

async function showBookRef(pageNumber) {
	const overlay = document.getElementById('bookRefOverlay');
	const label = document.getElementById('bookRefPageLabel');
	const title = document.getElementById('bookRefTitle');
	const nav = document.getElementById('bookRefNav');
	const iframe = document.getElementById('bookRefIframe');
	if (!overlay) return;

	overlay.style.display = 'flex';
	if (nav) nav.style.display = 'flex';
	if (iframe) { iframe.src = ''; iframe.style.display = 'none'; }
	if (title) title.textContent = '\uD83D\uDCD6 College Physics 2e';
	_pdfCurrentPage = pageNumber;

	const textDiv = getOrCreateTextDiv();
	textDiv.innerHTML = '<p style="color:#aaa;text-align:center;padding:40px">Loading page...</p>';

	// Format page number with leading zeros to match pdftoppm output (e.g. page-0203.png)
	const padded = String(pageNumber).padStart(4, '0');
	const imgUrl = `https://physics-ai-tutor.onrender.com/api/pdf-image?page=${pageNumber}`;

	const img = new Image();
	img.crossOrigin = 'anonymous';
	img.onload = () => {
		textDiv.innerHTML = '';
		img.style.cssText = 'width:100%;height:auto;display:block;';
		textDiv.appendChild(img);
		if (label) label.textContent = `Page ${pageNumber} / 1697`;
	};
	img.onerror = async (e) => {
		console.error('pdf-image failed to load:', imgUrl, e);
		try {
			const res = await fetch('/api/pdf-page', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ page: pageNumber })
			});
			const data = await res.json();
			_pdfTotalPages = data.total;
			if (label) label.textContent = `Page ${pageNumber} / ${_pdfTotalPages}`;
			textDiv.innerHTML = `<p style="padding:20px">${data.text.replace(/\n/g, '<br>')}</p>`;
		} catch(e) {
			textDiv.innerHTML = `<p style="color:#c00;padding:20px">Page image not available yet.</p>`;
		}
	};
	img.src = imgUrl;
}

function getOrCreateTextDiv() {
	let textDiv = document.getElementById('bookRefTextDiv');
	if (!textDiv) {
		textDiv = document.createElement('div');
		textDiv.id = 'bookRefTextDiv';
		textDiv.style.cssText = 'flex:1;overflow-y:auto;background:#fff;text-align:center;';
		document.getElementById('bookRefPanel').appendChild(textDiv);
	}
	textDiv.style.display = 'block';
	return textDiv;
}

function showDriveRef(driveUrl, name, page) {
	const overlay = document.getElementById('bookRefOverlay');
	const iframe = document.getElementById('bookRefIframe');
	const title = document.getElementById('bookRefTitle');
	const nav = document.getElementById('bookRefNav');
	const textDiv = document.getElementById('bookRefTextDiv');
	if (!overlay || !iframe) return;

	if (textDiv) textDiv.style.display = 'none';
	overlay.style.display = 'flex';
	if (nav) nav.style.display = 'none';
	if (title) title.textContent = name || 'Source';
	iframe.style.display = 'block';
	iframe.src = driveUrl;
}

window.showDriveRef = showDriveRef;

window.showTextRef = showTextRef;

function showUrlRef(url, name) {
	// YouTube and external sites can't be iframed — open in new tab
	window.open(url, '_blank', 'noopener,noreferrer');
}

function bookRefChangePage(delta) {
	showBookRef(_pdfCurrentPage + delta);
}

function closeBookRef() {
	const overlay = document.getElementById('bookRefOverlay');
	const iframe = document.getElementById('bookRefIframe');
	if (overlay) overlay.style.display = 'none';
	if (iframe) iframe.src = ''; // stop video/pdf
}

window.closeBookRef = closeBookRef;
window.bookRefChangePage = bookRefChangePage;
window.showBookRef = showBookRef;
window.showUrlRef = showUrlRef;
