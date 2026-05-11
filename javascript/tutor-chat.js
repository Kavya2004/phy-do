let isProcessing = false;
let context = [
	{
		role: 'system',
		content: `You are an AI physics tutor operating exclusively in Adversarial Learning Mode. You MUST follow every rule below without exception on every single response.

You have access to two whiteboards:
TEACHER WHITEBOARD: for explanations, visual examples, and demonstrations
STUDENT WHITEBOARD: for student practice or when prompting them to work out problems
If you need to draw/demonstrate concepts, add [TEACHER_BOARD: action_name]
If you want the student to practice/work, add [STUDENT_BOARD: action_name]

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

Focus on core introductory physics topics only. Use whiteboards to set up counterexamples or force diagrams when it strengthens the challenge.


REFERENCE LINKS INSTRUCTIONS:

You have access to the student's physics course materials including lecture slides, textbook chapters, and other uploaded resources. Relevant excerpts will be provided in context under "COURSE MATERIALS".
When answering, ALWAYS ground your response in the provided course material excerpts. Quote or paraphrase directly from them when relevant. Prefer the course materials over general knowledge.

CITATION RULE — THIS IS MANDATORY AND NON-NEGOTIABLE:
Every single response you give MUST end with one or more citation lines in EXACTLY this plain text format — no tables, no markdown, no bold, no headers:
📖 Source: [source name] | Page [number]
If no page number is available, omit the page part. If multiple sources are relevant, list each on its own line. Use the exact source name as provided in the context. Plain text only, exactly as shown above.`
	}
];

let voiceEnabled = true;
const searchCache = new Map();

document.addEventListener('DOMContentLoaded', function() {
    initializeChat();
});

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
    window.processUserMessage = processUserMessage;
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

    addMessage("Hi there! I'm your physics tutor! Ask me anything about physics!", 'bot');

    voiceEnabled = localStorage.getItem('autoSpeech') === 'true';

    setTimeout(createVoiceToggle, 1500);
    document.addEventListener('paste', handlePasteEvent);
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
		processedFiles.push({
			name: file.name,
			type: file.type,
			data: base64
		});
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
	try {
		const response = await fetch('https://tutor.probabilitycourse.com/api/ocr', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ image: base64Image })
		});

		if (!response.ok) throw new Error('OCR request failed');

		const data = await response.json();

		if (data.text && data.text.trim()) {
			return data.text;
		} else if (data.data?.value?.length > 0) {
			return data.data.value.map((entry) => entry.value).join(' ');
		} else {
			return 'No recognizable text found in image.';
		}
	} catch (error) {
		return 'Error reading image text.';
	}
}

function createVoiceToggle() {
	const chatHeader = document.querySelector('.chat-header') || document.querySelector('h2');
	if (!chatHeader || document.getElementById('voiceToggle')) return;

	const toggleBtn = document.createElement('button');
	toggleBtn.id = 'voiceToggle';
	toggleBtn.innerHTML = voiceEnabled ? '🔊 Voice On' : '🔇 Voice Off';
	toggleBtn.style.cssText = `
		padding: 5px 10px;
		margin-left: 10px;
		border: 1px solid #ccc;
		border-radius: 15px;
		background: ${voiceEnabled ? '#337810' : '#666'};
		color: white;
		cursor: pointer;
		font-size: 12px;
		transition: all 0.3s ease;
	`;
	toggleBtn.addEventListener('click', toggleVoiceResponse);

	chatHeader.appendChild(toggleBtn);
}

function createChatControls() {
	const chatContainer = document.querySelector('.chat-container');
	if (!chatContainer || document.getElementById('chatControls')) return;

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
		background: #337810;
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
		background: #014148;
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
	const chatMessages = document.getElementById('chatMessages');
	const messageDiv = document.createElement('div');
	messageDiv.className = `message ${sender}-message slide-in`;

	const avatar = document.createElement('div');
	avatar.className = 'message-avatar';
	avatar.innerHTML = sender === 'bot' ? '🤖' : '👤';

	// Convert LaTeX to Unicode for bot messages
	let displayText = text;
	if (sender === 'bot' && window.convertLatexToUnicode) {
		displayText = window.convertLatexToUnicode(text);
	}

	const content = document.createElement('div');
	content.className = 'message-content';

	let citationHTML = '';
	if (sender === 'bot' && citation) {
		const pageLabel = citation.page ? ` · p.${citation.page}` : '';
		citationHTML = `<span class="citation-pill" ${citation.page ? `onclick="showBookRef(${citation.page})"` : ''} title="Source reference">📖 ${citation.name}${pageLabel}</span>`;
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

	if (window.sessionManager && window.sessionManager.sessionId) {
		window.sessionManager.broadcastMessage(text, sender, files);
	}

	if (sender === 'bot' && window.voiceTutor) {
		window.voiceTutor.handleBotResponse(text);
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
function toggleVoiceResponse() {
	voiceEnabled = !voiceEnabled;
	localStorage.setItem('autoSpeech', voiceEnabled.toString());

	const toggleBtn = document.getElementById('voiceToggle');
	if (toggleBtn) {
		toggleBtn.innerHTML = voiceEnabled ? '🎤' : '🔇';
		toggleBtn.title = voiceEnabled ? 'Voice On - Click to disable' : 'Voice Off - Click to enable';
		toggleBtn.style.background = voiceEnabled ? '#337810' : '#666';
		toggleBtn.style.borderColor = voiceEnabled ? '#337810' : '#666';
	}

	if (!voiceEnabled && window.voiceTutor) {
		window.voiceTutor.stopSpeaking();
	}
}

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
				link: chunk.source,
				pageNumber: chunk.page,
				snippet: chunk.text.substring(0, 200),
				content: chunk.text,
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

	// Prepare user message (include file info if files were uploaded)
	let userMessage = message.trim();
	if (processedFiles.length > 0) {
		const fileNames = processedFiles.map((f) => f.name).join(', ');
		userMessage = userMessage || `I've uploaded these files: ${fileNames}`;

		// Files will be sent directly to Gemini API
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
			// Get all chat messages from the current session
			const chatMessages = document.querySelectorAll('.message');
			const recentMessages = Array.from(chatMessages).slice(-10); // Last 10 messages
			
			recentMessages.forEach(msgElement => {
				const isBot = msgElement.classList.contains('bot-message');
				const isShared = msgElement.classList.contains('shared-message');
				const content = msgElement.querySelector('.message-content');
				
				if (content) {
					const messageText = content.textContent || content.innerText;
					
					if (isBot) {
						context.push({ role: 'assistant', content: messageText });
					} else if (isShared) {
						// Extract username from shared message
						const authorElement = msgElement.querySelector('.message-author');
						const textElement = msgElement.querySelector('.message-text');
						const author = authorElement ? authorElement.textContent : 'Student';
						const text = textElement ? textElement.textContent : messageText;
						context.push({ role: 'user', content: `${author}: ${text}` });
					} else {
						context.push({ role: 'user', content: messageText });
					}
				}
			});
			
			// Add current message
			context.push({ role: 'user', content: `${window.sessionManager.userName}: ${message}` });
		} else {
			// Not in session, just add current message
			context.push({ role: 'user', content: message });
		}
		// Search for matching physics textbook sections
		const searchResults = await searchPhysicsTextbook(message);

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

			refsText += 'REMINDER: End your response with citation lines in plain text: 📖 Source: [source name] | Page [number]';

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
		const citationMatch = botResponse.match(/📖\s*Source:\s*([^|\n]+?)(?:\s*\|\s*Page\s*([\d,\s]+))?\s*$/im);
		const extractedCitation = citationMatch
			? { ch: null, name: citationMatch[1].trim(), page: citationMatch[2] ? parseInt(citationMatch[2]) : null }
			: null;
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
			window.sessionManager.broadcastMessage(botResponse, 'bot');
		} else {
			addMessage(botResponse, 'bot', [], extractedCitation);
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

let _pdfCurrentPage = 1;
let _pdfTotalPages = 0;

async function showBookRef(pageNumber) {
	const overlay = document.getElementById('bookRefOverlay');
	if (!overlay) return;
	overlay.style.display = 'flex';
	await renderBookPage(pageNumber);
}

async function renderBookPage(pageNumber) {
	const wrap = document.getElementById('bookRefTextWrap');
	const label = document.getElementById('bookRefPageLabel');
	if (!wrap) return;

	wrap.innerHTML = '<p style="color:#aaa;padding:20px;text-align:center">Loading...</p>';

	try {
		const res = await fetch('/api/pdf-page', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ page: pageNumber })
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const data = await res.json();
		_pdfCurrentPage = data.page;
		_pdfTotalPages = data.total;
		if (label) label.textContent = `Page ${_pdfCurrentPage} / ${_pdfTotalPages}`;
		wrap.innerHTML = `<p>${data.text.replace(/\n/g, '<br>')}</p>`;
	} catch (e) {
		wrap.innerHTML = `<p style="color:#c00;padding:20px">Failed to load page: ${e.message}</p>`;
	}
}

function bookRefChangePage(delta) {
	renderBookPage(_pdfCurrentPage + delta);
}

function closeBookRef() {
	const overlay = document.getElementById('bookRefOverlay');
	if (overlay) overlay.style.display = 'none';
}

window.closeBookRef = closeBookRef;
window.bookRefChangePage = bookRefChangePage;
window.showBookRef = showBookRef;
