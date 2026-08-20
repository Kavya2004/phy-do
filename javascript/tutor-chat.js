let isProcessing = false;
let tutorMode = null; // null = not yet chosen, 'D' = direct, 'S' = step-by-step
let _modePromptSent = false; // true once we've asked the D/S question
let _pendingQuestion = null; // stores the user's first question while waiting for D/S choice

// Expose mode state as window globals so session-manager.js can sync them
// from incoming WebSocket tutor_mode_change / session_info messages.
Object.defineProperty(window, 'tutorMode', {
    get: () => tutorMode,
    set: (v) => { tutorMode = v; },
    configurable: true,
});
Object.defineProperty(window, '_modePromptSent', {
    get: () => _modePromptSent,
    set: (v) => { _modePromptSent = v; },
    configurable: true,
});

let context = [
	{
		role: 'system',
		content: `You are a helpful and knowledgeable AI physics tutor. Your job is to help students understand introductory physics clearly and accurately.

You operate in one of two modes, chosen by the student. The active mode will be specified before every message — always follow it precisely.

MODE D — DIRECT ANSWER:
Give a complete, well-structured answer immediately. State the answer upfront, walk through the full reasoning step by step, show all formulas with every variable defined and units specified, and show full calculations where relevant. End with a concise key takeaway. Never ask the student questions. Never withhold any part of the answer.

MODE S — STEP-BY-STEP WALKTHROUGH (Socratic):
Guide the student to discover the answer themselves. Never give the answer, the formula, or the next step directly. Ask exactly one focused question per response. If they are correct, affirm briefly and ask the next guiding question. If they are wrong, use a concrete scenario or counterexample to expose the flaw — do not correct them outright. Keep responses short: one acknowledgment (if needed) + one question.

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

    // Allow external code (e.g. whiteboard) to inject a File into the upload queue
    window.injectFileIntoChat = function (file) {
        uploadedFiles.push(file);
        addFileToPreview(file);
        const fp = document.getElementById('filePreview');
        if (fp) fp.style.display = 'flex';
    };
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
    // D/S prompt will be shown after the user's first question, not here
    _modePromptSent = false;

    document.addEventListener('paste', handlePasteEvent);

    // ── Expose hooks for chat-history-manager ──────────────────────────────

    // Reset context to just the system prompt
    window._resetChatContext = function () {
        context = [context[0]];
        tutorMode = null;
        _modePromptSent = false;
        _pendingQuestion = null;
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

    // Build citation pill HTML from a citations array — shared with addSharedMessage
    // in session-manager.js so in-class bot messages get the same pills.
    window._buildCitationHTML = function (citation) {
        if (!citation || citation.length === 0) return '';
        return citation.map(c => {
            const pageLabel = c.page ? ` · p.${c.page}` : '';
            const icon = getSourceIcon(c.name);
            const safeName = (c.name || '').replace(/'/g, "\\'");

            if (/video links|lecture video/i.test(c.name || '')) return '';

            const isTextbook = /college physics|textbook|physics.?2e/i.test(c.name || '');
            if (isTextbook && c.page) {
                return `<span class="citation-pill" onclick="showBookRef(${c.page})" style="cursor:pointer" title="View page ${c.page}">${icon} ${c.name}${pageLabel}</span>`;
            }
            if (c.drive_file_id) {
                const driveUrl = `https://drive.google.com/file/d/${c.drive_file_id}/preview${c.page ? `#page=${c.page}` : ''}`;
                return `<span class="citation-pill" onclick="showDriveRef('${driveUrl}','${safeName}',${c.page||'null'})" style="cursor:pointer" title="View source">${icon} ${c.name}${pageLabel}</span>`;
            }
            if (c.url) return '';
            if (c.text) {
                const safeText = c.text.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
                return `<span class="citation-pill" onclick="showTextRef('${safeText}','${safeName}',${c.page||1})" style="cursor:pointer" title="View source">${icon} ${c.name}${pageLabel}</span>`;
            }
            if (!c.name) return '';
            return `<span class="citation-pill" title="Source reference">${icon} ${c.name}${pageLabel}</span>`;
        }).join('');
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

	const quizBtn = document.createElement('button');
	quizBtn.innerHTML = 'Quiz';
	quizBtn.id = 'quizControlBtn';
	quizBtn.style.cssText = `
		padding: 6px 12px;
		border: 1px solid #ddd;
		border-radius: 15px;
		background: #881c1c;
		color: white;
		cursor: pointer;
		font-size: 12px;
		transition: all 0.3s ease;
	`;
	quizBtn.addEventListener('click', () => {
		if (window.quizIntegration) window.quizIntegration.showQuizMenu();
	});

	controlsDiv.appendChild(saveBtn);
	controlsDiv.appendChild(summaryBtn);
	controlsDiv.appendChild(quizBtn);
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
	.replace(/\[IMAGE:data:[^\]]+\]/g, '') // strip embedded image markers from text display
	.replace(/\n/g, '<br>')
	.replace(/<https?:\/\/[^>]+>/g, (match) => {
		const url = match.slice(1, -1);
		return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
	});

	// Render any embedded image markers ([IMAGE:dataurl]) — these come from
	// persisted user messages that included uploaded images.
	const imageMarkerRe = /\[IMAGE:(data:[^\]]+)\]/g;
	let imgMatch;
	while ((imgMatch = imageMarkerRe.exec(displayText)) !== null) {
		const dataUrl = imgMatch[1];
		const imgWrapper = document.createElement('div');
		imgWrapper.style.cssText = 'margin-top: 6px;';
		const img = document.createElement('img');
		img.src = dataUrl;
		img.style.cssText = 'max-width: 220px; max-height: 180px; border-radius: 8px; cursor: pointer; border: 1px solid #ddd;';
		img.title = 'Click to view full size';
		img.onclick = () => {
			const modal = document.createElement('div');
			modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:99999;cursor:pointer;';
			const fullImg = document.createElement('img');
			fullImg.src = dataUrl;
			fullImg.style.cssText = 'max-width:90vw;max-height:90vh;border-radius:8px;';
			modal.appendChild(fullImg);
			modal.onclick = () => modal.remove();
			document.body.appendChild(modal);
		};
		imgWrapper.appendChild(img);
		content.appendChild(imgWrapper);
	}

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
	// In-class (session) mode: all persistence goes through handleSessionMessage
	// via the WebSocket echo path. Messages added locally (welcome greeting, D/S
	// confirmation) should NOT be saved to the shared in-class record because
	// they are UI-only and not part of the shared conversation transcript.
	const _isInSession = window._inClassMode || (window.sessionManager && window.sessionManager.sessionId);
	if (!silent && window.chatHistoryManager && !_isInSession) {
		const userName = (window.sessionManager && window.sessionManager.userName) || '';
		// For user messages that include images, embed the data URLs so they
		// survive the round-trip to the DB and appear in chat history.
		let persistContent = text;
		if (sender === 'user' && files && files.length > 0) {
			const imageMarkers = files
				.filter(f => f.type && f.type.startsWith('image/') && f.data)
				.map(f => `[IMAGE:${f.data}]`)
				.join('');
			if (imageMarkers) persistContent = text + '\n' + imageMarkers;
		}
		window.chatHistoryManager.appendMessage(sender === 'bot' ? 'bot' : 'user', persistContent, userName);
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

	// Use the live session ID from sessionManager (the _inClassSessionId window
	// var is cleared after join, so we read from sessionManager here)
	const sessionId = window.sessionManager && window.sessionManager.sessionId;
	if (!sessionId || !window._inClassMode) return;

	const BACKEND = 'https://phy-do.onrender.com';	try {
		const res = await fetch(`${BACKEND}/api/in-class/chat?sessionId=${encodeURIComponent(sessionId)}`);
		if (!res.ok) return;
		const convos = await res.json();
		if (!convos || convos.length === 0) return;

		// Fetch each conversation's full messages in parallel
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

		// Sort chronologically
		allMessages.sort((a, b) => a.ts - b.ts);

		const historyText = allMessages
			.map(m => {
				const who = m.role === 'bot' ? 'AI Tutor' : (m.userName || 'Student');
				return `${who}: ${m.content}`;
			})
			.join('\n');

		// Insert history right after the system prompt (index 0)
		context.splice(1, 0, {
			role: 'system',
			content: `PREVIOUS CONVERSATION HISTORY for this in-class session (${window._inClassSessionTitle || sessionId}).\nUse this to understand what each student has already discussed so you can build on it and avoid repeating yourself:\n\n${historyText.substring(0, 6000)}\n\n--- End of history ---`,
		});

		console.log(`[in-class] Injected ${allMessages.length} historical messages into context`);
	} catch (e) {
		console.warn('[in-class] Failed to load history:', e.message);
		window._inClassHistoryLoaded = false; // allow retry on next message
	}
}

async function processUserMessage(message) {
	if (isProcessing || (!message.trim() && uploadedFiles.length === 0)) return;

	// Check if this is a quiz request before processing
	if (window.quizIntegration && window.quizIntegration.handleQuizCommands(message)) {
		return; // Quiz command handled, don't process further
	}

	// ── Mode selection handling ──────────────────────────────────────────────────────────────────────────
	// In-class (session) mode: show the D/S prompt after the first question,
	// broadcast any mode change to all students in the same session via WebSocket.
	const _inSession = window._inClassMode || (window.sessionManager && window.sessionManager.sessionId);

	// Handle D/S replies at any point in the conversation (both modes).
	const modeReply = message.trim().toUpperCase();
	if (modeReply === 'D' || modeReply === 'S') {
		tutorMode = modeReply;
		context.push({ role: 'user', content: message });

		let confirmation;
		if (tutorMode === 'D') {
			confirmation = 'Sounds good! I\'ll give you clear, complete answers. Switch to <strong><u>"S"</u></strong> anytime if you want me to walk you through the steps instead.';
		} else {
			confirmation = 'Great choice! Walking through it step by step will really help it stick. And remember, you can always type <strong><u>"D"</u></strong> later if you prefer a direct answer.';
		}
		context.push({ role: 'assistant', content: confirmation });

		if (_inSession && window.sessionManager) {
			// In-class: broadcast both the student's "D"/"S" message and the
			// confirmation so every student sees them in the shared chat.
			window.sessionManager.broadcastMessage(message, 'user');
			window.sessionManager.broadcastMessage(confirmation, 'bot');
			window.sessionManager.broadcastTutorMode(tutorMode);
		} else {
			// At-home: add locally as before.
			addMessage(message, 'user');
			addMessage(confirmation, 'bot');
		}

		if (_pendingQuestion) {
			const q = _pendingQuestion;
			_pendingQuestion = null;
			setTimeout(() => processUserMessage(q), 100);
		}
		return;
	}

	if (tutorMode === null) {
		context.push({ role: 'user', content: message });
		_pendingQuestion = message;

		if (!_modePromptSent) {
			const modePrompt = 'Would you like me to give you the answer directly (reply <strong><u>"D"</u></strong>), or would you prefer me to walk you through it step by step (reply <strong><u>"S"</u></strong>)? <strong><u>IMPORTANT!</u></strong> At any time during our conversation, you can type <strong><u>"D"</u></strong> or <strong><u>"S"</u></strong> to switch between these two conversation modes.';
			context.push({ role: 'assistant', content: modePrompt });
			_modePromptSent = true;
			if (_inSession && window.sessionManager) {
				// In-class: broadcast the student's question and the mode prompt
				// so every student at the table sees both messages.
				window.sessionManager.broadcastMessage(message, 'user');
				window.sessionManager.broadcastMessage(modePrompt, 'bot');
			} else {
				addMessage(message, 'user');
				addMessage(modePrompt, 'bot');
			}
		} else if (_inSession && window.sessionManager) {
			// Mode prompt already sent — just broadcast the user question
			// so it appears in the shared chat for everyone.
			window.sessionManager.broadcastMessage(message, 'user');
		} else {
			addMessage(message, 'user');
		}
		return;
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

	// processUserMessage is only ever called when THIS student submits a message —
	// messages from other students arrive via WebSocket and go through
	// handleSessionMessage, not here. So it's correct that every call to
	// processUserMessage runs the AI, regardless of session mode.

	showLoading();

	try {
		// ── Attach student whiteboard image to this message (at-home mode) ──────
		// In-class mode sends the whiteboard via sendWhiteboardToTutor() which injects
		// a File into the upload queue. In at-home mode we do the same thing inline:
		// composite the canvas + stickers into a PNG and prepend it to processedFiles
		// so Gemini sees the actual image, not just OCR text.
		if (!window.sessionManager || !window.sessionManager.sessionId) {
			const wbCanvas = document.getElementById('studentWhiteboard');
			if (wbCanvas && hasWhiteboardContent('student')) {
				try {
					const snap = document.createElement('canvas');
					snap.width  = wbCanvas.width;
					snap.height = wbCanvas.height;
					const snapCtx = snap.getContext('2d');

					// White background
					snapCtx.fillStyle = '#ffffff';
					snapCtx.fillRect(0, 0, snap.width, snap.height);

					// Draw the whiteboard strokes
					snapCtx.drawImage(wbCanvas, 0, 0);

					// Composite any placed stickers
					const overlay = document.getElementById('stickerOverlay');
					if (overlay) {
						overlay.querySelectorAll('.placed-sticker').forEach(el => {
							const img = el.querySelector('img');
							if (!img || !img.complete || img.naturalWidth === 0) return;
							const left = parseInt(el.style.left) || 0;
							const top  = parseInt(el.style.top)  || 0;
							const w    = el.offsetWidth  || parseInt(el.style.width)  || 80;
							const h    = el.offsetHeight || parseInt(el.style.height) || 80;
							snapCtx.drawImage(img, left, top, w, h);
						});
					}

					// Convert to base64 and build a processed-file object Gemini can read
					const base64 = snap.toDataURL('image/png');
					const wbFile = {
						name: 'student-whiteboard.png',
						type: 'image/png',
						data: base64,
						isWhiteboard: true
					};
					// Prepend so Gemini sees it before any other uploaded files
					processedFiles = [wbFile, ...processedFiles];

					// If the user sent no text, tell Gemini what the image is
					if (!userMessage) {
						userMessage = 'Here is my student whiteboard. Please look at it and help me as my physics tutor.';
					} else {
						userMessage = `[Student whiteboard attached] ${userMessage}`;
					}
				} catch (wbErr) {
					console.warn('[whiteboard] Could not capture whiteboard image:', wbErr);
				}
			}
		}

		// Add user message to context for AI
		if (window.sessionManager && window.sessionManager.sessionId) {
			// In-class shared session:
			// 1. On first message, inject full DB history into context (once)
			// 2. Flush any messages received from other clients via WebSocket
			// 3. Append the current message
			if (!window._inClassHistoryLoaded) {
				await loadInClassHistory();
			}
			// Flush pending context updates from other students' messages
			if (window._pendingContextUpdate && window._pendingContextUpdate.length > 0) {
				window._pendingContextUpdate.forEach(entry => context.push(entry));
				window._pendingContextUpdate = [];
			}
			// Append current message attributed to this student
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

		// Reinforce the active mode right before every call so it's never buried.
		const modeReminder = tutorMode === 'D'
			? `ACTIVE MODE: D — DIRECT ANSWER.
Your job right now is to give a complete, well-structured direct answer. Follow these rules exactly:

1. State the answer clearly upfront — do not make the student wait for it.
2. Walk through the full reasoning step by step so the student can follow the logic.
3. Include every relevant formula. For each formula, define every variable and its units.
4. If numbers are involved, show the full calculation with units at every step.
5. End with a one-sentence summary of the key takeaway or concept.
6. Do NOT ask the student questions. Do NOT withhold any part of the answer.
7. Be thorough but avoid padding — every sentence should add information.`

			: `ACTIVE MODE: S — STEP-BY-STEP WALKTHROUGH (Socratic).
Your job right now is to guide the student to the answer themselves. Follow these rules exactly:

1. NEVER state the answer, the formula, or the next step directly.
2. Ask exactly ONE focused question per response — no more.
3. The question should target the next conceptual gap or the next logical step the student needs to figure out themselves.
4. If the student's response is correct: briefly affirm it (one short sentence), then immediately ask the next guiding question to push them forward.
5. If the student's response is wrong: do NOT say "that's wrong" or correct them directly. Instead, pose a concrete scenario or counterexample that leads them to discover the flaw in their own reasoning, then ask them to reconsider.
6. Never give hints that are so strong they bypass the thinking — make them work for each step.
7. Keep your response short: one acknowledgment sentence (if applicable) + one question. No long explanations.`;
		context.push({
			role: 'system',
			content: modeReminder
		});

		// Get AI response with files (only if files processed successfully)
		let botResponse = await getGeminiResponse(context, processedFiles.length > 0 ? processedFiles : []);

		// Remove the mode reminder from context after use (it's ephemeral)
		if (context[context.length - 1]?.content?.startsWith('ACTIVE MODE:')) {
			context.pop();
		}

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
			// Stash citations so addSharedMessage can pick them up when the
			// WebSocket echo arrives. Keyed by a hash of the message content.
			window._pendingCitations = window._pendingCitations || [];
			window._pendingCitations.push(extractedCitation);
			// Broadcast — citations travel in the payload so all participants see them
			window.sessionManager.broadcastMessage(botResponse, 'bot', [], extractedCitation);
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
	if (!messages.length) return;

	// jsPDF is loaded via CDN alongside jspdf in the page
	const { jsPDF } = window.jspdf;
	if (!jsPDF) {
		alert('PDF library not loaded. Please try again in a moment.');
		return;
	}

	const doc = new jsPDF();
	const pageW = doc.internal.pageSize.width;
	const pageH = doc.internal.pageSize.height;
	const margin = 15;
	const contentW = pageW - margin * 2;
	const timestamp = new Date().toLocaleString();

	// ── Header bar ──────────────────────────────────────────────────────────
	doc.setFillColor(136, 28, 28); // maroon
	doc.rect(0, 0, pageW, 22, 'F');
	doc.setTextColor(255, 255, 255);
	doc.setFontSize(13);
	doc.setFont(undefined, 'bold');
	doc.text('Physics 131 — Tutor Chat Notes', margin, 14);
	doc.setFontSize(8);
	doc.setFont(undefined, 'normal');
	doc.text(`Saved: ${timestamp}`, pageW - margin, 14, { align: 'right' });

	let y = 32;

	const ensureSpace = (needed) => {
		if (y + needed > pageH - 15) {
			doc.addPage();
			y = 15;
		}
	};

	messages.forEach((message) => {
		const isBot = message.classList.contains('bot-message');
		const contentEl = message.querySelector('.message-content');
		if (!contentEl) return;

		// Get text (strip citation pills / file spans which are child elements)
		const textContent = contentEl.innerText || contentEl.textContent || '';
		const label = isBot ? 'Tutor' : 'Student';

		// ── Sender pill ─────────────────────────────────────────────────────
		ensureSpace(12);
		if (isBot) {
			doc.setFillColor(136, 28, 28); // maroon
		} else {
			doc.setFillColor(25, 118, 210); // blue
		}
		doc.roundedRect(margin, y - 6, label.length * 3.2 + 6, 8, 2, 2, 'F');
		doc.setTextColor(255, 255, 255);
		doc.setFontSize(7);
		doc.setFont(undefined, 'bold');
		doc.text(label.toUpperCase(), margin + 3, y);
		y += 6;

		// ── Message text ────────────────────────────────────────────────────
		doc.setTextColor(30, 30, 30);
		doc.setFontSize(9);
		doc.setFont(undefined, 'normal');
		const lines = doc.splitTextToSize(textContent.trim(), contentW);
		lines.forEach(line => {
			ensureSpace(5);
			doc.text(line, margin, y);
			y += 5;
		});

		// ── Embedded images (from [IMAGE:dataurl] markers in stored content) ──
		const imgRe = /\[IMAGE:(data:[^\]]+)\]/g;
		const rawHTML = contentEl.innerHTML || '';
		// Also check <img> tags that were rendered into the DOM from the markers
		contentEl.querySelectorAll('img').forEach(imgEl => {
			try {
				const src = imgEl.src || imgEl.getAttribute('src');
				if (!src || !src.startsWith('data:image')) return;
				const aspect = imgEl.naturalWidth > 0 ? imgEl.naturalHeight / imgEl.naturalWidth : 0.75;
				const imgW = Math.min(contentW, 120);
				const imgH = imgW * aspect;
				ensureSpace(imgH + 6);
				doc.addImage(src, 'PNG', margin, y, imgW, imgH);
				y += imgH + 4;
			} catch (_) {}
		});

		y += 4; // gap between messages
	});

	const filename = `physics-131-chat-${new Date().toISOString().slice(0, 10)}.pdf`;
	doc.save(filename);
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

	const imgUrl = `https://ai-tutor-53f1.onrender.com/api/pdf-image?page=${pageNumber}`;

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
