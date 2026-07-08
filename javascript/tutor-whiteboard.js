/* tutor-whiteboard.js - student whiteboard */
let teacherCanvas, teacherCtx, studentCanvas, studentCtx;


window.teacherCanvas = null;
window.teacherCtx = null;
window.studentCanvas = null;
window.studentCtx = null;
let isDrawing = false;
let isDrawingMode = false;
let teacherDrawingMode = false;
let studentDrawingMode = false;
let isEraserMode = false;
let teacherEraserMode = false;
let studentEraserMode = false;
let currentPath = [];
let isExpanded = false;
let recogTimer = null;
let isAnythingDrawn = false;
let activeWhiteboard = 'student';
let pendingSymbol = null;


let teacherSymbols = [];
let studentSymbols = [];
let selectedSymbol = null;
let isDragging = false;
let isResizing = false;
let resizeHandle = null;
let dragOffset = { x: 0, y: 0 };


let teacherDrawingData = null;
let studentDrawingData = null;


let resizeTimeout = null;

document.addEventListener('DOMContentLoaded', function () {

	initializeWhiteboards();
	setupWhiteboardControls();
});


if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', function () {
		initializeWhiteboards();
		setupWhiteboardControls();
	});
} else {

	setTimeout(() => {
		initializeWhiteboards();
		setupWhiteboardControls();
	}, 100);
}

function setupWhiteboardControls() {

	
	// Teacher whiteboard controls
	const clearTeacherButton = document.getElementById('clearTeacherButton');
	const drawTeacherButton = document.getElementById('drawTeacherButton');
	const eraserTeacherButton = document.getElementById('eraserTeacherButton');
	const expandTeacherButton = document.getElementById('expandTeacherButton');

	// Student whiteboard controls
	const clearStudentButton = document.getElementById('clearStudentButton');
	const drawStudentButton = document.getElementById('drawStudentButton');
	const eraserStudentButton = document.getElementById('eraserStudentButton');
	const expandStudentButton = document.getElementById('expandStudentButton');



	if (clearTeacherButton) {
		clearTeacherButton.addEventListener('click', () => clearWhiteboard('teacher'));
	}

	if (drawTeacherButton) {

		drawTeacherButton.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();

			toggleDrawing('teacher');
		});
		
		// Also add onclick as backup
		drawTeacherButton.onclick = function(e) {
			e.preventDefault();

			toggleDrawing('teacher');
		};
	} else {

	}

	if (eraserTeacherButton) {
		eraserTeacherButton.addEventListener('click', () => toggleEraser('teacher'));
	}

	if (expandTeacherButton) {
		expandTeacherButton.addEventListener('click', toggleWhiteboardSize);
	}

	if (clearStudentButton) {
		clearStudentButton.addEventListener('click', () => clearWhiteboard('student'));
	}

	if (drawStudentButton) {

		drawStudentButton.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();

			resizeCanvas(studentCanvas, 'student');
			toggleDrawing('student');

		});
		
		// Also add onclick as backup
		drawStudentButton.onclick = function(e) {
			e.preventDefault();

			toggleDrawing('student');
		};
	} else {

	}

	if (eraserStudentButton) {
		eraserStudentButton.addEventListener('click', () => toggleEraser('student'));
	}

	if (expandStudentButton) {
		expandStudentButton.addEventListener('click', toggleWhiteboardSize);
	}

	setupResizeHandle();
}

function getOcrServerUrl() {
	return ''; // ✅ Use same origin (your Vercel app)
}

async function runOcrAndFillChat(boardType) {
	try {


		// Get the correct canvas using the global variables from your whiteboard code
		const canvas = boardType === 'teacher' ? teacherCanvas : studentCanvas;
		if (!canvas) {
	
			return;
		}



		// Check canvas dimensions first
		if (canvas.width === 0 || canvas.height === 0) {

			return;
		}

		// Check if canvas has any content
		const ctx = canvas.getContext('2d');
		const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
		let hasContent = false;
		for (let i = 0; i < imageData.data.length; i += 4) {
			const r = imageData.data[i];
			const g = imageData.data[i + 1];
			const b = imageData.data[i + 2];
			const a = imageData.data[i + 3];

			// Check for any non-white, non-transparent pixels
			if (a > 0 && (r < 250 || g < 250 || b < 250)) {
				hasContent = true;
				break;
			}
		}

		if (!hasContent) {
	
			return;
		}

		// Convert canvas to base64 image
		const dataUrl = canvas.toDataURL('image/png', 0.8);


	
		const serverUrl = getOcrServerUrl();



		const response = await fetch('/api/ocr', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				image: dataUrl
			})
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`OCR request failed: ${response.status} - ${errorText}`);
		}

		const result = await response.json();



		let ocrText = '';
		if (result.text) {
			ocrText = result.text;
		} else if (result.latex_styled) {
			ocrText = result.latex_styled;
		} else if (result.data && Array.isArray(result.data)) {
			ocrText = result.data.map((item) => item.value || '').join(' ');
		} else if (result.error) {

			showOcrError(`OCR Error: ${result.error}`);
			return;
		} else {

			ocrText = JSON.stringify(result); // Fallback to see what we got
		}

		if (ocrText.trim()) {

			await sendOcrToChat(ocrText, boardType);
		} else {

		}
	} catch (error) {

		showOcrError(`Failed to process whiteboard: ${error.message}`);
	}
}

// Send OCR result to chat system
async function sendOcrToChat(ocrText, boardType) {
	const message = `I wrote on the ${boardType} whiteboard: "${ocrText}"`;



	const chatInput =
		document.querySelector('#chatInput') || // This matches your HTML
		document.querySelector('#messageInput') ||
		document.querySelector('[data-testid="chat-input"]') ||
		document.querySelector('textarea[placeholder*="message"]') ||
		document.querySelector('input[type="text"]') ||
		document.querySelector('textarea');
	if (chatInput) {
		// Add the OCR text to the chat input
		const currentValue = chatInput.value || '';
		const newValue = currentValue ? `${currentValue}\n\n${message}` : message;
		chatInput.value = newValue;

		// Trigger input events to notify React/Vue/etc if needed
		chatInput.dispatchEvent(new Event('input', { bubbles: true }));
		chatInput.dispatchEvent(new Event('change', { bubbles: true }));

		const sendButton =
			document.querySelector('#sendButton') ||
			document.querySelector('[data-testid="send-button"]') ||
			document.querySelector('button[type="submit"]') ||
			document.querySelector('.send-button');
		if (sendButton && !sendButton.disabled) {

			setTimeout(() => sendButton.click(), 100);
		} else {

			// Show a notification that the text was added
			showOcrSuccess(`Text "${ocrText}" added to chat input`);
		}
	} else {


		// Try to call global functions that might exist in your chat system
		if (typeof window.addOcrMessageToChat === 'function') {
			window.addOcrMessageToChat(ocrText, boardType);
		} else if (typeof window.addMessageToChat === 'function') {
			window.addMessageToChat(message);
		} else if (typeof window.sendMessage === 'function') {
			window.sendMessage(message);
		} else {
			// Show the OCR result in a notification
			showOcrSuccess(`Recognized text: "${ocrText}"`);
		}
	}
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
// Show success notification
function showOcrSuccess(message) {
	const notification = document.createElement('div');
	notification.style.cssText = `
		position: fixed;
		top: 20px;
		right: 20px;
		background: #28a745;
		color: white;
		padding: 12px 16px;
		border-radius: 8px;
		z-index: 10000;
		font-size: 14px;
		max-width: 300px;
		box-shadow: 0 4px 6px rgba(0,0,0,0.1);
	`;
	notification.textContent = message;

	document.body.appendChild(notification);

	// Remove after 4 seconds
	setTimeout(() => {
		if (notification.parentNode) {
			notification.parentNode.removeChild(notification);
		}
	}, 4000);
}

// Show error notification
function showOcrError(message) {
	const errorDiv = document.createElement('div');
	errorDiv.style.cssText = `
		position: fixed;
		top: 20px;
		right: 20px;
		background: #dc3545;
		color: white;
		padding: 12px 16px;
		border-radius: 8px;
		z-index: 10000;
		font-size: 14px;
		max-width: 300px;
		box-shadow: 0 4px 6px rgba(0,0,0,0.1);
	`;
	errorDiv.textContent = message;

	document.body.appendChild(errorDiv);

	// Remove after 5 seconds
	setTimeout(() => {
		if (errorDiv.parentNode) {
			errorDiv.parentNode.removeChild(errorDiv);
		}
	}, 5000);
}

// Debug function to help troubleshoot
function debugWhiteboardOcr() {


	// Test OCR on both canvases
	if (teacherCanvas) {

		runOcrAndFillChat('teacher');
	}

	if (studentCanvas) {

		runOcrAndFillChat('student');
	}
}

// Make debug function available globally
window.debugWhiteboardOcr = debugWhiteboardOcr;

// Also export the OCR functions for external use
window.runOcrAndFillChat = runOcrAndFillChat;

// Debug function for drawing issues
function debugDrawing(boardType = 'student') {

	
	const canvas = boardType === 'teacher' ? teacherCanvas : studentCanvas;
	const ctx = boardType === 'teacher' ? teacherCtx : studentCtx;
	
	if (canvas) {

	}
	
	if (ctx) {

	}
	
	// Test drawing a simple line
	if (canvas && ctx) {
		ctx.beginPath();
		ctx.moveTo(50, 50);
		ctx.lineTo(150, 150);
		ctx.stroke();
	}
}

// Make debug function available globally
window.debugDrawing = debugDrawing;

// Manual button test function
function testStudentDrawButton() {
	const button = document.getElementById('drawStudentButton');
	if (button) {
		button.click();
	}
}

// Manual button test function for teacher
function testTeacherDrawButton() {
	const button = document.getElementById('drawTeacherButton');
	if (button) {
		button.click();
	}
}

window.testStudentDrawButton = testStudentDrawButton;
window.testTeacherDrawButton = testTeacherDrawButton;
function initializeWhiteboards() {

	
	// Initialize teacher whiteboard
	teacherCanvas = document.getElementById('teacherWhiteboard');
	if (teacherCanvas) {

		teacherCtx = teacherCanvas.getContext('2d');
		setupCanvas(teacherCanvas, teacherCtx, 'teacher');
		// Make globally accessible
		window.teacherCanvas = teacherCanvas;
		window.teacherCtx = teacherCtx;
	} else {

	}

	// Initialize student whiteboard
	studentCanvas = document.getElementById('studentWhiteboard');
	if (studentCanvas) {

		studentCtx = studentCanvas.getContext('2d');
		setupCanvas(studentCanvas, studentCtx, 'student');
		// Make globally accessible
		window.studentCanvas = studentCanvas;
		window.studentCtx = studentCtx;
	} else {

	}

	if (!teacherCanvas && !studentCanvas) {

		return;
	}

	// Force initial resize after a short delay
	setTimeout(() => {
		resizeCanvases();

	}, 200);
	
	// Debounced resize handler to prevent excessive operations
	let resizeTimeout;
	window.addEventListener('resize', () => {
		clearTimeout(resizeTimeout);
		resizeTimeout = setTimeout(() => {
			resizeCanvases();
		}, 150);
	});

	updateDrawButtons();
	updateExpandButton();
	
	// Save initial empty states
	setTimeout(() => {
		if (teacherCanvas) saveDrawingState('teacher');
		if (studentCanvas) saveDrawingState('student');

	}, 300);
}

function setupCanvas(canvas, ctx, boardType) {

	
	// Remove any existing event listeners first
	canvas.removeEventListener('mousedown', handleMouseDown);
	canvas.removeEventListener('mousemove', handleMouseMove);
	canvas.removeEventListener('mouseup', handleMouseUp);
	canvas.removeEventListener('mouseout', handleMouseUp);
	
	// Add event listeners with proper binding
	canvas.addEventListener('mousedown', (e) => {
		e.preventDefault();
		e.stopPropagation();
	
		handleMouseDown(e, boardType);
	}, { passive: false });
	
	canvas.addEventListener('mousemove', (e) => {
		e.preventDefault();
		handleMouseMove(e, boardType);
	}, { passive: false });
	
	canvas.addEventListener('mouseup', (e) => {
		e.preventDefault();
		handleMouseUp(boardType);
	}, { passive: false });
	
	canvas.addEventListener('mouseout', () => handleMouseUp(boardType));

	// Touch events
	canvas.addEventListener('touchstart', (e) => {
		e.preventDefault();
		e.stopPropagation();
		handleTouchStart(e, boardType);
	}, { passive: false });
	
	canvas.addEventListener('touchmove', (e) => {
		e.preventDefault();
		e.stopPropagation();
		handleTouchMove(e, boardType);
	}, { passive: false });
	
	canvas.addEventListener('touchend', (e) => {
		e.preventDefault();
		handleMouseUp(boardType);
	}, { passive: false });

	// Set initial canvas properties
	ctx.strokeStyle = '#333';
	ctx.lineWidth = 4;
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';
	ctx.globalCompositeOperation = 'source-over';
	
	// Set initial cursor
	canvas.style.cursor = 'default';
	

}

function switchWhiteboard(boardType) {
	// Save current board state before switching
	if (activeWhiteboard === 'teacher' || activeWhiteboard === 'student') {
		saveDrawingState(activeWhiteboard);
	}
  
	const teacherPanel = document.getElementById('teacherPanel');
	const studentPanel = document.getElementById('studentPanel');
	const notesPanel = document.getElementById('notesPanel');
	const teacherTab = document.getElementById('teacherTab');
	const studentTab = document.getElementById('studentTab');
	const notesTab = document.getElementById('notesTab');
  
	// Hide all
	[teacherPanel, studentPanel, notesPanel].forEach(p => {
		if (p) p.classList.remove('active');
	});
	[teacherTab, studentTab, notesTab].forEach(t => {
		if (t) t.classList.remove('active');
	});
  
	// Show selected
	if (boardType === 'teacher') {
		if (teacherPanel) teacherPanel.classList.add('active');
		if (teacherTab) teacherTab.classList.add('active');
	} else if (boardType === 'student') {
		if (studentPanel) studentPanel.classList.add('active');
		if (studentTab) studentTab.classList.add('active');
	} else {
		if (notesPanel) notesPanel.classList.add('active');
		if (notesTab) notesTab.classList.add('active');
		// Trigger notes canvas resize via NotebookManager if available
		setTimeout(() => {
			if (window.notebookManager && window.notebookManager.canvas) {
				const container = window.notebookManager.canvas.parentElement;
				if (container) {
					window.notebookManager.canvas.width = container.clientWidth;
					window.notebookManager.canvas.height = container.clientHeight;
					window.notebookManager.restoreCanvasState();
				}
			}
		}, 100);
	}
  
	activeWhiteboard = boardType;
	
	// Restore canvas content after switching
	if (boardType === 'teacher' || boardType === 'student') {
		setTimeout(() => {
			resizeCanvas(boardType === 'teacher' ? teacherCanvas : studentCanvas, boardType);
			redrawCanvas(boardType);
		}, 50);
	}
}
  

function setupResizeHandle() {
	const chatSection = document.querySelector('.chat-section');
	const whiteboardSection = document.querySelector('.whiteboard-section');

	if (!chatSection || !whiteboardSection) {
		console.error('Chat or whiteboard section not found');
		return;
	}

	let resizeHandle = document.querySelector('.resize-handle');
	if (!resizeHandle) {
		resizeHandle = document.createElement('div');
		resizeHandle.className = 'resize-handle';
		resizeHandle.innerHTML = '⋮⋮';
		chatSection.appendChild(resizeHandle);
	}

	let isResizing = false;
	let startX = 0;
	let startWidth = 0;

	resizeHandle.addEventListener('mousedown', (e) => {
		isResizing = true;
		startX = e.clientX;
		startWidth = parseInt(window.getComputedStyle(chatSection).width, 10);
		document.body.style.cursor = 'col-resize';
		document.body.style.userSelect = 'none';

		resizeHandle.style.background = '#337810';
		resizeHandle.style.color = 'white';

		e.preventDefault();
		e.stopPropagation();
	});

	document.addEventListener('mousemove', (e) => {
		if (!isResizing) return;

		const deltaX = e.clientX - startX;
		const newWidth = startWidth + deltaX;
		const minWidth = 250;
		const maxWidth = window.innerWidth - 300;

		if (newWidth >= minWidth && newWidth <= maxWidth) {
			chatSection.style.flexBasis = newWidth + 'px';
			chatSection.style.width = newWidth + 'px';

			// Debounce the resize during manual resizing
			clearTimeout(resizeTimeout);
			resizeTimeout = setTimeout(() => {
				resizeCanvases();
			}, 50);
		}

		e.preventDefault();
	});

	document.addEventListener('mouseup', () => {
		if (isResizing) {
			isResizing = false;
			document.body.style.cursor = '';
			document.body.style.userSelect = '';
			resizeHandle.style.background = '#ddd';
			resizeHandle.style.color = '#666';
		}
	});
}

function toggleWhiteboardSize() {
	const whiteboardSection = document.querySelector('.whiteboard-section');
	const chatSection = document.querySelector('.chat-section');
	
	if (!whiteboardSection || !chatSection) {
		console.error('Required sections not found');
		return;
	}

	isExpanded = !isExpanded; 

	if (chatSection) {
		chatSection.style.display = isExpanded ? 'none' : 'flex';
	}

	if (isExpanded) {
		whiteboardSection.classList.add('expanded');
	} else {
		whiteboardSection.classList.remove('expanded');
		chatSection.style.flexBasis = '400px';
		chatSection.style.width = '400px';
		chatSection.style.minWidth = '200px';
	}

	updateExpandButton();

	// Use requestAnimationFrame for smoother resize
	requestAnimationFrame(() => {
		setTimeout(() => {
			resizeCanvases();
		}, 100);
	});
}

function updateExpandButton() {
	const expandTeacherButton = document.getElementById('expandTeacherButton');
	const expandStudentButton = document.getElementById('expandStudentButton');

	if (expandTeacherButton) {
		expandTeacherButton.textContent = isExpanded ? '⬅️ Shrink' : '➡️ Expand';
		expandTeacherButton.title = isExpanded ? 'Shrink whiteboard' : 'Expand whiteboard';
	}

	if (expandStudentButton) {
		expandStudentButton.textContent = isExpanded ? '⬅️ Shrink' : '➡️ Expand';
		expandStudentButton.title = isExpanded ? 'Shrink whiteboard' : 'Expand whiteboard';
	}
}

function handleTouchStart(e, boardType) {
	e.preventDefault();
	e.stopPropagation();
	const touch = e.touches[0];
	const canvas = boardType === 'teacher' ? teacherCanvas : studentCanvas;
	const rect = canvas.getBoundingClientRect();
	
	// Create proper touch event with canvas-relative coordinates
	const touchEvent = {
		clientX: touch.clientX,
		clientY: touch.clientY,
		preventDefault: () => {},
		stopPropagation: () => {}
	};
	
	handleMouseDown(touchEvent, boardType);
}

function handleTouchMove(e, boardType) {
	e.preventDefault();
	e.stopPropagation();
	const touch = e.touches[0];
	
	const touchEvent = {
		clientX: touch.clientX,
		clientY: touch.clientY,
		preventDefault: () => {}
	};
	
	handleMouseMove(touchEvent, boardType);
}

function resizeCanvases() {
	resizeCanvas(teacherCanvas, 'teacher');
	resizeCanvas(studentCanvas, 'student');
}

function resizeCanvas(canvas, boardType) {
	if (!canvas) {
		console.warn(`Canvas not found for ${boardType}`);
		return;
	}

	const panel = document.getElementById(boardType + 'Panel');
	if (!panel) {
		console.warn(`Panel not found for ${boardType}`);
		return;
	}

	// Get the whiteboard container dimensions
	const whiteboardSection = document.querySelector('.whiteboard-section');
	const whiteboardContainer = panel.querySelector('.whiteboard-container') || panel;
	
	let containerRect;
	if (whiteboardSection && whiteboardSection.getBoundingClientRect().width > 0) {
		containerRect = whiteboardSection.getBoundingClientRect();
	} else {
		containerRect = whiteboardContainer.getBoundingClientRect();
	}
	
	// Calculate new dimensions with proper margins
	const headerHeight = panel.querySelector('.whiteboard-header')?.offsetHeight || 80;
	const newWidth = Math.max(400, Math.floor(containerRect.width - 40));
	const newHeight = Math.max(300, Math.floor(containerRect.height - headerHeight - 40));



	if (canvas.width !== newWidth || canvas.height !== newHeight) {
		// Save existing content
		let tempCanvas = null;
		if (canvas.width > 0 && canvas.height > 0) {
			tempCanvas = document.createElement('canvas');
			tempCanvas.width = canvas.width;
			tempCanvas.height = canvas.height;
			const tempCtx = tempCanvas.getContext('2d');
			tempCtx.drawImage(canvas, 0, 0);
		}

		// Resize canvas
		canvas.width = newWidth;
		canvas.height = newHeight;

		const ctx = boardType === 'teacher' ? teacherCtx : studentCtx;
		if (ctx) {
			// Reset canvas properties after resize
			ctx.strokeStyle = '#333';
			ctx.lineWidth = 4;
			ctx.lineCap = 'round';
			ctx.lineJoin = 'round';
			ctx.globalCompositeOperation = 'source-over';

			// Restore content if we saved it
			if (tempCanvas && tempCanvas.width > 0 && tempCanvas.height > 0) {
				ctx.drawImage(tempCanvas, 0, 0);
			}
		}
		

	}
}

function clearWhiteboard(boardType) {
	if (
		window.sessionManager &&
		window.sessionManager.sessionId &&
		boardType === 'teacher' &&
		!window.sessionManager.isHost
	) {
		alert('Only the session host can clear the teacher whiteboard');
		return;
	}

	const ctx = boardType === 'teacher' ? teacherCtx : studentCtx;
	const canvas = boardType === 'teacher' ? teacherCanvas : studentCanvas;
	if (!ctx || !canvas) return;

	// Clear the entire canvas
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	
	// Clear diagram data to prevent redrawing
	canvas.diagramData = null;
	
	// Clear drawing data
	if (boardType === 'teacher') {
		teacherDrawingData = null;
	} else {
		studentDrawingData = null;
	}

	if (window.sessionManager && window.sessionManager.sessionId) {
		window.sessionManager.ws.send(
			JSON.stringify({
				type: 'whiteboard_clear',
				targetBoard: boardType,
				userName: window.sessionManager.userName
			})
		);
	}
}
function broadcastDiagramAction(diagramName, boardType = 'teacher') {
	if (window.sessionManager && window.sessionManager.sessionId) {
		window.sessionManager.ws.send(
			JSON.stringify({
				type: 'whiteboard_action',
				action: diagramName,
				targetBoard: boardType,
				userName: window.sessionManager.userName
			})
		);
	}
}

function toggleDrawing(boardType) {

	
	if (boardType === 'teacher') {
		teacherDrawingMode = !teacherDrawingMode;

		
		if (teacherDrawingMode) teacherEraserMode = false;
		
		if (teacherCanvas && teacherCtx) {
			teacherCanvas.style.cursor = teacherDrawingMode ? 'crosshair' : 'default';
			teacherCtx.globalCompositeOperation = 'source-over';
			teacherCtx.strokeStyle = '#333';
			teacherCtx.lineWidth = 4;
			teacherCtx.lineCap = 'round';
			teacherCtx.lineJoin = 'round';

		} else {

		}
	} else {
		studentDrawingMode = !studentDrawingMode;

		
		if (studentDrawingMode) studentEraserMode = false;
		
		if (studentCanvas && studentCtx) {
			studentCanvas.style.cursor = studentDrawingMode ? 'crosshair' : 'default';
			studentCtx.globalCompositeOperation = 'source-over';
			studentCtx.strokeStyle = '#333';
			studentCtx.lineWidth = 4;
			studentCtx.lineCap = 'round';
			studentCtx.lineJoin = 'round';

		} else {

		}
	}

	updateDrawButtons();

	// Only run OCR when stopping drawing mode
	const currentMode = boardType === 'teacher' ? teacherDrawingMode : studentDrawingMode;
	if (!currentMode && isAnythingDrawn) {
		clearTimeout(recogTimer);
		recogTimer = setTimeout(() => {
			runOcrAndFillChat(boardType);
			isAnythingDrawn = false;
		}, 500);
	}
}

function toggleEraser(boardType) {
	if (boardType === 'teacher') {
		teacherEraserMode = !teacherEraserMode;
		if (teacherEraserMode) teacherDrawingMode = false;
		isEraserMode = teacherEraserMode;
		isDrawingMode = teacherDrawingMode;
		if (teacherCanvas && teacherCtx) {
			teacherCanvas.style.cursor = teacherEraserMode ? 'grab' : 'default';
			teacherCtx.globalCompositeOperation = teacherEraserMode ? 'destination-out' : 'source-over';
			teacherCtx.lineWidth = teacherEraserMode ? 20 : 4;
		}
	} else {
		studentEraserMode = !studentEraserMode;
		if (studentEraserMode) studentDrawingMode = false;
		isEraserMode = studentEraserMode;
		isDrawingMode = studentDrawingMode;
		if (studentCanvas && studentCtx) {
			studentCanvas.style.cursor = studentEraserMode ? 'grab' : 'default';
			studentCtx.globalCompositeOperation = studentEraserMode ? 'destination-out' : 'source-over';
			studentCtx.lineWidth = studentEraserMode ? 20 : 4;
		}
	}

	updateDrawButtons();

}

function updateDrawButtons() {
	const drawTeacherButton = document.getElementById('drawTeacherButton');
	const drawStudentButton = document.getElementById('drawStudentButton');
	const eraserTeacherButton = document.getElementById('eraserTeacherButton');
	const eraserStudentButton = document.getElementById('eraserStudentButton');

	if (drawTeacherButton) {
		drawTeacherButton.style.background = teacherDrawingMode ? '#337810' : 'white';
		drawTeacherButton.style.color = teacherDrawingMode ? 'white' : '#333';
		drawTeacherButton.textContent = teacherDrawingMode ? 'Stop Draw' : 'Draw';
	}

	if (drawStudentButton) {
		drawStudentButton.style.background = studentDrawingMode ? '#337810' : 'white';
		drawStudentButton.style.color = studentDrawingMode ? 'white' : '#333';
		drawStudentButton.textContent = studentDrawingMode ? 'Stop Draw' : 'Draw';
	}

	if (eraserTeacherButton) {
		eraserTeacherButton.style.background = teacherEraserMode ? '#dc3545' : 'white';
		eraserTeacherButton.style.color = teacherEraserMode ? 'white' : '#333';
		eraserTeacherButton.textContent = teacherEraserMode ? 'Stop Erase' : 'Eraser';
	}

	if (eraserStudentButton) {
		eraserStudentButton.style.background = studentEraserMode ? '#dc3545' : 'white';
		eraserStudentButton.style.color = studentEraserMode ? 'white' : '#333';
		eraserStudentButton.textContent = studentEraserMode ? 'Stop Erase' : 'Eraser';
	}

	// Show/hide math buttons based on drawing mode
	const teacherMathButtons = document.querySelector('#teacherPanel .math-buttons');
	const studentMathButtons = document.querySelector('#studentPanel .math-buttons');
	
	if (teacherMathButtons) {
		teacherMathButtons.style.display = teacherDrawingMode ? 'flex' : 'none';
	}
	if (studentMathButtons) {
		studentMathButtons.style.display = studentDrawingMode ? 'flex' : 'none';
	}
}

function startDrawing(e, boardType) {

	const canvas = boardType === 'teacher' ? teacherCanvas : studentCanvas;
	const ctx = boardType === 'teacher' ? teacherCtx : studentCtx;
	
	if (!canvas || !ctx) {

		return;
	}
	
	const rect = canvas.getBoundingClientRect();
	const x = e.clientX - rect.left;
	const y = e.clientY - rect.top;


	// If there's a pending symbol, place it at click location
	if (pendingSymbol) {
		ctx.font = '45px Arial';
		ctx.fillStyle = '#333';
		ctx.textAlign = 'center';
		ctx.fillText(pendingSymbol, x, y);
		pendingSymbol = null;
		canvas.style.cursor = 'crosshair';
		isAnythingDrawn = true;
		return;
	}

	const currentDrawMode = boardType === 'teacher' ? teacherDrawingMode : studentDrawingMode;
	const currentEraseMode = boardType === 'teacher' ? teacherEraserMode : studentEraserMode;
	if (!currentDrawMode && !currentEraseMode) {

		return;
	}

	isDrawing = true;
	isAnythingDrawn = true;
	clearTimeout(recogTimer);

	currentPath = [{ x, y }];
	ctx.beginPath();
	ctx.moveTo(x, y);

	if (currentEraseMode) {
		ctx.lineWidth = 20;
		ctx.globalCompositeOperation = 'destination-out';
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
	} else {
		ctx.lineWidth = 4;
		ctx.globalCompositeOperation = 'source-over';
		ctx.strokeStyle = '#333';
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
	}

}

function draw(e, boardType) {
	const currentDrawMode = boardType === 'teacher' ? teacherDrawingMode : studentDrawingMode;
	const currentEraseMode = boardType === 'teacher' ? teacherEraserMode : studentEraserMode;
	if (!isDrawing || (!currentDrawMode && !currentEraseMode)) return;

	const canvas = boardType === 'teacher' ? teacherCanvas : studentCanvas;
	const ctx = boardType === 'teacher' ? teacherCtx : studentCtx;

	if (!canvas || !ctx) {

		return;
	}

	const rect = canvas.getBoundingClientRect();
	const x = e.clientX - rect.left;
	const y = e.clientY - rect.top;

	currentPath.push({ x, y });
	ctx.lineTo(x, y);
	ctx.stroke();

	// Broadcast this point to other participants
	if (window.sessionManager && window.sessionManager.sessionId) {
		window.sessionManager.ws.send(
			JSON.stringify({
				type: 'whiteboard_draw',
				boardType,
				x,
				y,
				userName: window.sessionManager.userName
			})
		);
	}
}

function stopDrawing(boardType) {
	isDrawing = false;
	currentPath = [];
}

// Drawing functions that can work on either whiteboard
function drawProbabilityScale(boardType = 'teacher') {
	const ctx = boardType === 'teacher' ? teacherCtx : studentCtx;
	const canvas = boardType === 'teacher' ? teacherCanvas : studentCanvas;
	if (!ctx || !canvas) return;

	clearWhiteboard(boardType);

	const width = canvas.width;
	const height = canvas.height;
	const centerY = height / 2;
	const scaleLength = width * 0.8;
	const startX = (width - scaleLength) / 2;

	ctx.strokeStyle = '#333';
	ctx.lineWidth = 3;
	ctx.beginPath();
	ctx.moveTo(startX, centerY);
	ctx.lineTo(startX + scaleLength, centerY);
	ctx.stroke();

	ctx.font = '16px Arial';
	ctx.textAlign = 'center';
	ctx.fillStyle = '#333';

	for (let i = 0; i <= 10; i++) {
		const x = startX + (scaleLength * i) / 10;
		const probability = i / 10;

		ctx.beginPath();
		ctx.moveTo(x, centerY - 10);
		ctx.lineTo(x, centerY + 10);
		ctx.stroke();

		ctx.fillText(probability.toFixed(1), x, centerY + 30);
	}

	ctx.font = '18px Arial';
	ctx.fillText('Impossible', startX, centerY - 30);
	ctx.fillText('Certain', startX + scaleLength, centerY - 30);
	ctx.fillText('Probability Scale', width / 2, 50);

	setTimeout(() => {
		drawEventOnScale(startX, scaleLength, centerY, 0.5, 'Fair Coin Heads', '#337810', ctx);
		drawEventOnScale(startX, scaleLength, centerY, 0.167, 'Rolling a 6', '#014148', ctx);
		drawEventOnScale(startX, scaleLength, centerY, 1, 'Sun Rising Tomorrow', '#73c3f6', ctx);
	}, 1000);
}

function drawEventOnScale(startX, scaleLength, centerY, probability, label, color, ctx) {
	if (!ctx) return;
	const x = startX + scaleLength * probability;

	ctx.strokeStyle = color;
	ctx.fillStyle = color;
	ctx.lineWidth = 2;

	ctx.beginPath();
	ctx.moveTo(x, centerY - 50);
	ctx.lineTo(x, centerY - 20);
	ctx.stroke();

	ctx.beginPath();
	ctx.moveTo(x - 5, centerY - 25);
	ctx.lineTo(x, centerY - 20);
	ctx.lineTo(x + 5, centerY - 25);
	ctx.stroke();

	ctx.font = '14px Arial';
	ctx.textAlign = 'center';
	ctx.fillText(label, x, centerY - 60);
}

function drawSampleDistribution(boardType = 'teacher') {
	const ctx = boardType === 'teacher' ? teacherCtx : studentCtx;
	const canvas = boardType === 'teacher' ? teacherCanvas : studentCanvas;
	if (!ctx || !canvas) return;

	clearWhiteboard(boardType);

	const width = canvas.width;
	const height = canvas.height;
	const centerX = width / 2;
	const centerY = height / 2;

	const bars = [
		{ value: 1, frequency: 2, color: '#337810' },
		{ value: 2, frequency: 5, color: '#337810' },
		{ value: 3, frequency: 8, color: '#337810' },
		{ value: 4, frequency: 12, color: '#014148' },
		{ value: 5, frequency: 15, color: '#014148' },
		{ value: 6, frequency: 18, color: '#014148' },
		{ value: 7, frequency: 15, color: '#014148' },
		{ value: 8, frequency: 12, color: '#014148' },
		{ value: 9, frequency: 8, color: '#337810' },
		{ value: 10, frequency: 5, color: '#337810' },
		{ value: 11, frequency: 2, color: '#337810' }
	];

	const barWidth = 60;
	const maxHeight = 150;
	const maxFreq = Math.max(...bars.map((b) => b.frequency));

	ctx.strokeStyle = '#333';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(centerX - 400, centerY + 100);
	ctx.lineTo(centerX + 400, centerY + 100);
	ctx.moveTo(centerX - 350, centerY + 100);
	ctx.lineTo(centerX - 350, centerY - 100);
	ctx.stroke();

	bars.forEach((bar, index) => {
		setTimeout(() => {
			const x = centerX - 300 + index * 55;
			const barHeight = (bar.frequency / maxFreq) * maxHeight;
			const y = centerY + 100 - barHeight;

			ctx.fillStyle = bar.color;
			ctx.fillRect(x, y, 40, barHeight);

			ctx.fillStyle = '#333';
			ctx.font = '14px Arial';
			ctx.textAlign = 'center';
			ctx.fillText(bar.value, x + 20, centerY + 120);
			ctx.fillText(bar.frequency, x + 20, y - 5);
		}, index * 200);
	});

	ctx.fillStyle = '#333';
	ctx.font = '20px Arial';
	ctx.textAlign = 'center';
	ctx.fillText('Sample Distribution', centerX, 50);

	ctx.font = '16px Arial';
	ctx.fillText('Value', centerX, height - 20);

	ctx.save();
	ctx.translate(50, centerY);
	ctx.rotate(-Math.PI / 2);
	ctx.textAlign = 'center';
	ctx.fillText('Frequency', 0, 0);
	ctx.restore();
}

function drawNormalCurve(boardType = 'teacher') {
	broadcastDiagramAction('drawNormalCurve', boardType);
	const ctx = boardType === 'teacher' ? teacherCtx : studentCtx;
	const canvas = boardType === 'teacher' ? teacherCanvas : studentCanvas;
	if (!ctx || !canvas) return;

	clearWhiteboard(boardType);

	const width = canvas.width;
	const height = canvas.height;
	const centerX = width / 2;
	const centerY = height / 2;

	ctx.strokeStyle = '#333';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(centerX - 300, centerY + 100);
	ctx.lineTo(centerX + 300, centerY + 100);
	ctx.moveTo(centerX, centerY + 100);
	ctx.lineTo(centerX, centerY - 150);
	ctx.stroke();

	ctx.strokeStyle = '#014148';
	ctx.lineWidth = 3;
	ctx.beginPath();

	const mean = 0;
	const stdDev = 1;
	const scale = 80;

	for (let x = -4; x <= 4; x += 0.1) {
		const xPixel = centerX + x * scale;
		const y = (1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((x - mean) / stdDev, 2));
		const yPixel = centerY + 100 - y * 200;

		if (x === -4) {
			ctx.moveTo(xPixel, yPixel);
		} else {
			ctx.lineTo(xPixel, yPixel);
		}
	}
	ctx.stroke();

	ctx.strokeStyle = '#337810';
	ctx.lineWidth = 2;
	ctx.setLineDash([5, 5]);

	for (let i = -3; i <= 3; i++) {
		if (i === 0) continue;
		const x = centerX + i * scale;
		ctx.beginPath();
		ctx.moveTo(x, centerY + 100);
		ctx.lineTo(x, centerY - 50);
		ctx.stroke();

		ctx.fillStyle = '#337810';
		ctx.font = '14px Arial';
		ctx.textAlign = 'center';
		ctx.fillText(`${i}σ`, x, centerY + 120);
	}

	ctx.setLineDash([]);

	ctx.fillStyle = '#333';
	ctx.font = '20px Arial';
	ctx.textAlign = 'center';
	ctx.fillText('Normal Distribution Curve', centerX, 50);

	ctx.strokeStyle = '#ff6b6b';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(centerX, centerY + 100);
	ctx.lineTo(centerX, centerY - 50);
	ctx.stroke();

	ctx.fillStyle = '#ff6b6b';
	ctx.fillText('μ (mean)', centerX, centerY + 135);
}

function drawTreeDiagram(boardType = 'teacher') {
	const ctx = boardType === 'teacher' ? teacherCtx : studentCtx;
	const canvas = boardType === 'teacher' ? teacherCanvas : studentCanvas;
	if (!ctx || !canvas) return;

	clearWhiteboard(boardType);

	const width = canvas.width;
	const height = canvas.height;
	const centerX = width / 2;
	const startY = 100;

	ctx.fillStyle = '#333';
	ctx.font = '20px Arial';
	ctx.textAlign = 'center';
	ctx.fillText('Probability Tree Diagram', centerX, 50);

	ctx.fillStyle = '#014148';
	ctx.beginPath();
	ctx.arc(centerX, startY, 8, 0, 2 * Math.PI);
	ctx.fill();

	const firstLevel = [
		{ x: centerX - 200, y: startY + 100, label: 'A (0.6)', prob: '0.6' },
		{ x: centerX + 200, y: startY + 100, label: 'B (0.4)', prob: '0.4' }
	];

	firstLevel.forEach((branch) => {
		ctx.strokeStyle = '#333';
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(centerX, startY);
		ctx.lineTo(branch.x, branch.y);
		ctx.stroke();

		ctx.fillStyle = '#014148';
		ctx.beginPath();
		ctx.arc(branch.x, branch.y, 8, 0, 2 * Math.PI);
		ctx.fill();

		ctx.fillStyle = '#333';
		ctx.font = '16px Arial';
		ctx.textAlign = 'center';
		ctx.fillText(branch.label, branch.x, branch.y - 20);

		const midX = (centerX + branch.x) / 2;
		const midY = (startY + branch.y) / 2;
		ctx.fillText(branch.prob, midX, midY - 10);
	});

	const secondLevel = [
		{ fromX: centerX - 200, fromY: startY + 100, x: centerX - 300, y: startY + 200, label: 'C|A (0.7)', prob: '0.7' },
		{ fromX: centerX - 200, fromY: startY + 100, x: centerX - 100, y: startY + 200, label: 'D|A (0.3)', prob: '0.3' },
		{ fromX: centerX + 200, fromY: startY + 100, x: centerX + 100, y: startY + 200, label: 'C|B (0.2)', prob: '0.2' },
		{ fromX: centerX + 200, fromY: startY + 100, x: centerX + 300, y: startY + 200, label: 'D|B (0.8)', prob: '0.8' }
	];

	secondLevel.forEach((branch) => {
		ctx.strokeStyle = '#337810';
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(branch.fromX, branch.fromY);
		ctx.lineTo(branch.x, branch.y);
		ctx.stroke();

		ctx.fillStyle = '#337810';
		ctx.beginPath();
		ctx.arc(branch.x, branch.y, 6, 0, 2 * Math.PI);
		ctx.fill();

		ctx.fillStyle = '#333';
		ctx.font = '14px Arial';
		ctx.textAlign = 'center';
		ctx.fillText(branch.label, branch.x, branch.y + 25);

		const midX = (branch.fromX + branch.x) / 2;
		const midY = (branch.fromY + branch.y) / 2;
		ctx.fillText(branch.prob, midX + 15, midY);
	});

	const finalProbs = [
		{ x: centerX - 300, y: startY + 250, text: 'P(A∩C) = 0.42' },
		{ x: centerX - 100, y: startY + 250, text: 'P(A∩D) = 0.18' },
		{ x: centerX + 100, y: startY + 250, text: 'P(B∩C) = 0.08' },
		{ x: centerX + 300, y: startY + 250, text: 'P(B∩D) = 0.32' }
	];

	ctx.fillStyle = '#ff6b6b';
	ctx.font = '14px Arial';
	finalProbs.forEach((prob) => {
		ctx.fillText(prob.text, prob.x, prob.y);
	});
}

// Math symbol functions - click to place
function addMathSymbol(symbol, boardType = 'teacher') {
	const currentDrawMode = boardType === 'teacher' ? teacherDrawingMode : studentDrawingMode;
	if (!currentDrawMode) {
		alert('Please enable Draw mode first to add math symbols');
		return;
	}

	pendingSymbol = symbol;
	const canvas = boardType === 'teacher' ? teacherCanvas : studentCanvas;
	if (canvas) {
		canvas.style.cursor = 'crosshair';
	}
}

function saveDrawingState(boardType) {
	const ctx = boardType === 'teacher' ? teacherCtx : studentCtx;
	const canvas = boardType === 'teacher' ? teacherCanvas : studentCanvas;
	if (!ctx || !canvas || canvas.width === 0 || canvas.height === 0) return;
	
	// Simply save the entire canvas state
	const imageData = canvas.toDataURL();
	
	if (boardType === 'teacher') {
		teacherDrawingData = imageData;
	} else {
		studentDrawingData = imageData;
	}
}

function redrawCanvas(boardType) {
	const ctx = boardType === 'teacher' ? teacherCtx : studentCtx;
	const canvas = boardType === 'teacher' ? teacherCanvas : studentCanvas;
	const drawingData = boardType === 'teacher' ? teacherDrawingData : studentDrawingData;
	if (!ctx || !canvas) return;

	// Clear entire canvas
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	
	// Restore drawing if exists
	if (drawingData && drawingData !== 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQIHWNgAAIAAAUAAY27m/MAAAAASUVORK5CYII=') {
		const img = new Image();
		img.onload = () => {
			ctx.drawImage(img, 0, 0);
		};
		img.src = drawingData;
	}
	
	// Redraw diagram if exists
	if (canvas.diagramData && window.diagramRenderer) {
		setTimeout(async () => {
			window.diagramRenderer.setupCanvas(boardType);
			await window.diagramRenderer.renderDiagram(canvas.diagramData);
		}, 200);
	}
}

function getSymbolAt(x, y, boardType) {
	// Simplified - no symbols for now to focus on drawing preservation
	return null;
}

function getResizeHandle(x, y, symbol, ctx) {
	// Simplified - no resize handles for now
	return null;
}

function handleMouseDown(e, boardType) {
	console.log(`Mouse down on ${boardType}, drawing mode:`, boardType === 'student' ? studentDrawingMode : teacherDrawingMode);
	const currentDrawMode = boardType === 'teacher' ? teacherDrawingMode : studentDrawingMode;
	const currentEraseMode = boardType === 'teacher' ? teacherEraserMode : studentEraserMode;
	if (currentDrawMode || currentEraseMode) {
		startDrawing(e, boardType);
	}
}

function handleMouseMove(e, boardType) {
	const currentDrawMode = boardType === 'teacher' ? teacherDrawingMode : studentDrawingMode;
	const currentEraseMode = boardType === 'teacher' ? teacherEraserMode : studentEraserMode;
	if (currentDrawMode || currentEraseMode) {
		draw(e, boardType);
	}
}

function handleMouseUp(boardType) {
	stopDrawing(boardType);
}

function insertPlus(boardType = 'teacher') { addMathSymbol('+', boardType); }
function insertMinus(boardType = 'teacher') { addMathSymbol('−', boardType); }
function insertMultiply(boardType = 'teacher') { addMathSymbol('×', boardType); }
function insertDivide(boardType = 'teacher') { addMathSymbol('÷', boardType); }
function insertEquals(boardType = 'teacher') { addMathSymbol('=', boardType); }
function insertFraction(boardType = 'teacher') { addMathSymbol('½', boardType); }
function insertSquareRoot(boardType = 'teacher') { addMathSymbol('√', boardType); }
function insertPi(boardType = 'teacher') { addMathSymbol('π', boardType); }

// Shape tool functions
function setShapeTool(tool, boardType = 'teacher') {
	if (window.shapeTools) {
		window.shapeTools.setTool(tool);
		updateShapeButtons(tool, boardType);
	}
}

function updateShapeButtons(activeTool, boardType) {
	const panel = document.getElementById(boardType + 'Panel');
	if (!panel) return;
	
	const buttons = panel.querySelectorAll('.shape-btn');
	buttons.forEach(btn => {
		btn.classList.remove('active');
		if (btn.dataset.tool === activeTool) {
			btn.classList.add('active');
		}
	});
}

// Desmos integration functions
async function showDesmosGraph(boardType = 'teacher') {
	if (window.desmosIntegration) {
		await window.desmosIntegration.initialize(boardType);
		window.desmosIntegration.showGraph();
	}
}

async function plotFunction(expression, boardType = 'teacher') {
	if (window.desmosIntegration) {
		window.desmosIntegration.currentBoardType = boardType;
		await window.desmosIntegration.plotFunction(expression);
	}
}

async function captureGraphToBoard(boardType = 'teacher') {
	if (window.desmosIntegration) {
		window.desmosIntegration.currentBoardType = boardType;
		await window.desmosIntegration.captureGraphToCanvas();
		window.desmosIntegration.hideGraph();
	}
}

// ── Nova Canvas AI Image Generation ──────────────────────────
// Placed images per board: { img, x, y, w, h }
const placedImages = { teacher: [], student: [] };
let draggingImage = null, resizingImage = null;
let imgDragOffset = { x: 0, y: 0 };

async function generateAndPlaceImage(boardType = 'teacher') {
	const prompt = window.prompt('Describe the image to generate (e.g. "diagram of a pendulum"):');
	if (!prompt) return;

	const btn = document.getElementById(`aiImage${boardType === 'teacher' ? 'Teacher' : 'Student'}Button`);
	if (btn) { btn.textContent = '⏳ Generating...'; btn.disabled = true; }

	try {
		const res = await fetch('/api/image-gen', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ prompt })
		});
		const data = await res.json();
		if (!res.ok || !data.image) throw new Error(data.error || 'No image returned');

		const img = new Image();
		img.onload = () => {
			const canvas = boardType === 'teacher' ? teacherCanvas : studentCanvas;
			const entry = { img, x: 20, y: 20, w: Math.min(300, canvas.width / 2), h: Math.min(300, canvas.height / 2) };
			placedImages[boardType].push(entry);
			redrawWithImages(boardType);
			setupImageInteraction(boardType);
		};
		img.src = data.image;
	} catch (err) {
		alert('Image generation failed: ' + err.message);
	} finally {
		if (btn) { btn.textContent = '🖼️ AI Image'; btn.disabled = false; }
	}
}

function redrawWithImages(boardType) {
	const ctx = boardType === 'teacher' ? teacherCtx : studentCtx;
	const canvas = boardType === 'teacher' ? teacherCanvas : studentCanvas;
	if (!ctx || !canvas) return;
	const imgs = placedImages[boardType];
	imgs.forEach(entry => {
		ctx.drawImage(entry.img, entry.x, entry.y, entry.w, entry.h);
		// Draw resize handle (bottom-right corner)
		ctx.fillStyle = '#337810';
		ctx.fillRect(entry.x + entry.w - 10, entry.y + entry.h - 10, 10, 10);
		// Draw border
		ctx.strokeStyle = '#337810';
		ctx.lineWidth = 1.5;
		ctx.strokeRect(entry.x, entry.y, entry.w, entry.h);
	});
}

function setupImageInteraction(boardType) {
	const canvas = boardType === 'teacher' ? teacherCanvas : studentCanvas;
	if (!canvas || canvas._imgInteractionSetup) return;
	canvas._imgInteractionSetup = true;

	const getPos = (e) => {
		const rect = canvas.getBoundingClientRect();
		return { x: e.clientX - rect.left, y: e.clientY - rect.top };
	};

	const hitImage = (pos) => {
		const imgs = placedImages[boardType];
		for (let i = imgs.length - 1; i >= 0; i--) {
			const e = imgs[i];
			if (pos.x >= e.x + e.w - 12 && pos.x <= e.x + e.w + 2 &&
				pos.y >= e.y + e.h - 12 && pos.y <= e.y + e.h + 2) return { entry: e, mode: 'resize' };
			if (pos.x >= e.x && pos.x <= e.x + e.w && pos.y >= e.y && pos.y <= e.y + e.h) return { entry: e, mode: 'drag' };
		}
		return null;
	};

	canvas.addEventListener('mousedown', (e) => {
		const currentDrawMode = boardType === 'teacher' ? teacherDrawingMode : studentDrawingMode;
		const currentEraseMode = boardType === 'teacher' ? teacherEraserMode : studentEraserMode;
		if (currentDrawMode || currentEraseMode) return;
		const pos = getPos(e);
		const hit = hitImage(pos);
		if (!hit) return;
		e.stopPropagation();
		if (hit.mode === 'drag') {
			draggingImage = hit.entry;
			imgDragOffset = { x: pos.x - hit.entry.x, y: pos.y - hit.entry.y };
		} else {
			resizingImage = hit.entry;
		}
	}, true);

	canvas.addEventListener('mousemove', (e) => {
		if (!draggingImage && !resizingImage) return;
		const pos = getPos(e);
		if (draggingImage) {
			draggingImage.x = pos.x - imgDragOffset.x;
			draggingImage.y = pos.y - imgDragOffset.y;
		} else if (resizingImage) {
			resizingImage.w = Math.max(40, pos.x - resizingImage.x);
			resizingImage.h = Math.max(40, pos.y - resizingImage.y);
		}
		redrawCanvas(boardType);
		redrawWithImages(boardType);
	}, true);

	canvas.addEventListener('mouseup', () => { draggingImage = null; resizingImage = null; }, true);

	// Update cursor
	canvas.addEventListener('mousemove', (e) => {
		const currentDrawMode = boardType === 'teacher' ? teacherDrawingMode : studentDrawingMode;
		if (currentDrawMode) return;
		const pos = getPos(e);
		const hit = hitImage(pos);
		canvas.style.cursor = hit ? (hit.mode === 'resize' ? 'nwse-resize' : 'move') : 'default';
	});
}

window.generateAndPlaceImage = generateAndPlaceImage;

// Export functions for external use
window.tutorWhiteboard = {
	clearWhiteboard,
	toggleDrawing,
	toggleEraser,
	toggleWhiteboardSize,
	drawProbabilityScale,
	drawSampleDistribution,
	drawNormalCurve,
	drawTreeDiagram,
	switchWhiteboard,
	insertPlus,
	insertMinus,
	insertMultiply,
	insertDivide,
	insertEquals,
	insertFraction,
	insertSquareRoot,
	insertPi
};

// Quick graph generation function
async function quickGraph(type, boardType = 'teacher') {
	if (!window.smartGraphGenerator) {
		console.error('Smart graph generator not available');
		return;
	}
	
	try {
		let result;
		
		switch (type) {
			case 'linear':
				result = await window.smartGraphGenerator.quickLinear(1, 0, boardType);
				break;
			case 'quadratic':
				result = await window.smartGraphGenerator.quickQuadratic(1, 0, 0, boardType);
				break;
			case 'sine':
				result = await window.smartGraphGenerator.quickTrig('sine', 1, 1, boardType);
				break;
			case 'normal':
				result = await window.smartGraphGenerator.generateFromType('normal', 'normal distribution', boardType);
				break;
			default:
				console.warn('Unknown graph type:', type);
				return;
		}
		
		if (result.success) {
			console.log(`Generated ${type} graph successfully`);
			// Auto-capture to whiteboard after a short delay
			setTimeout(() => {
				captureGraphToBoard(boardType);
			}, 1000);
		} else {
			console.error('Failed to generate graph:', result.message);
		}
	} catch (error) {
		console.error('Error in quickGraph:', error);
	}
}

// Enhanced graph processing for chat integration
async function processGraphRequest(message, boardType = 'teacher') {
	if (!window.smartGraphGenerator) {
		return null;
	}
	
	// Check if message contains graph-related keywords
	const graphKeywords = /(?:graph|plot|draw|show|visualize|chart).*(?:function|equation|line|curve|parabola|sine|cosine|exponential|logarithm)/i;
	
	if (graphKeywords.test(message)) {
		try {
			const result = await window.smartGraphGenerator.processUserRequest(message, boardType);
			if (result.success) {
				// Auto-capture to whiteboard
				setTimeout(() => {
					captureGraphToBoard(boardType);
				}, 1500);
				return result;
			}
		} catch (error) {
			console.error('Error processing graph request:', error);
		}
	}
	
	return null;
}

// Make functions globally available
window.switchWhiteboard = switchWhiteboard;
window.insertPlus = insertPlus;
window.insertMinus = insertMinus;
window.insertMultiply = insertMultiply;
window.insertDivide = insertDivide;
window.insertEquals = insertEquals;
window.insertFraction = insertFraction;
window.insertSquareRoot = insertSquareRoot;
window.insertPi = insertPi;
window.toggleDrawing = toggleDrawing;
window.testStudentDrawButton = testStudentDrawButton;