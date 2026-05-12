// Integration with existing tutor chat system
class QuizIntegration {
    constructor() {
        this.init();
    }

    init() {
        this.addQuizButton();
        this.enhanceChatWithQuizCommands();
    }

    addQuizButton() {
        // Add quiz button to the tutor interface
        const chatContainer = document.querySelector('.chat-input-container');
        if (chatContainer) {
            const quizButton = document.createElement('button');
            quizButton.innerHTML = 'Quiz';
            quizButton.className = 'quiz-trigger-btn';
            quizButton.title = 'Start a quiz';
            quizButton.onclick = () => this.showQuizMenu();
            
            // Insert before the send button
            const sendButton = document.getElementById('sendButton');
            chatContainer.insertBefore(quizButton, sendButton);
            
            // Add styles for the button
            const style = document.createElement('style');
            style.textContent = `
                .quiz-trigger-btn {
                    background: #337810 !important;
                    color: white !important;
                    border: none;
                    padding: 10px 15px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 14px;
                    margin-right: 8px;
                    transition: all 0.2s ease;
                }
                .quiz-trigger-btn:hover {
                    background: #2a6209 !important;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(51, 120, 16, 0.3);
                }
                .quiz-menu {
                    position: absolute;
                    bottom: 60px;
                    right: 0;
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
                    padding: 15px;
                    min-width: 200px;
                    z-index: 100;
                }
                .quiz-menu-item {
                    display: block;
                    width: 100%;
                    padding: 10px 15px;
                    border: none;
                    background: none;
                    text-align: left;
                    cursor: pointer;
                    border-radius: 8px;
                    margin-bottom: 5px;
                    transition: background 0.2s;
                }
                .quiz-menu-item:hover {
                    background: #f0f0f0;
                }
            `;
            document.head.appendChild(style);
        }
    }

    showQuizMenu() {
        // Directly show topic input popup instead of menu
        this.createCustomQuiz();
    }

    enhanceChatWithQuizCommands() {
        // Listen for quiz-related messages in chat
        const originalSendMessage = window.sendMessage;
        if (originalSendMessage) {
            window.sendMessage = (message) => {
                if (this.handleQuizCommands(message)) {
                    return; // Quiz command handled, don't send to chat
                }
                originalSendMessage(message);
            };
        }
    }

    handleQuizCommands(message) {
        const lowerMessage = message.toLowerCase();
        
        if (lowerMessage.includes('quiz') || lowerMessage.includes('test') || lowerMessage.includes('assessment')) {
            // Check for difficulty level in message
            let difficulty = 'easy';
            if (lowerMessage.includes('hard') || lowerMessage.includes('difficult') || lowerMessage.includes('challenging') || lowerMessage.includes('timed')) {
                difficulty = 'hard';
            } else if (lowerMessage.includes('medium') || lowerMessage.includes('intermediate')) {
                difficulty = 'medium';
            }
            
            // Check for chapter-specific requests
            const chapterMatch = this.extractChapterFromMessage(message);
            if (chapterMatch) {
                this.generateAIQuiz(chapterMatch, difficulty);
                return true;
            } else {
                this.showQuizMenu();
                return true;
            }
        }
        
        return false;
    }

    createCustomQuiz() {
         // Show a better popup for topic selection with difficulty levels
        const popup = document.createElement('div');
        popup.className = 'topic-popup';
        popup.innerHTML = `
            <div class="topic-popup-content">
                <h3>Create Custom Quiz</h3>
                <p>What topic or chapter would you like to be quizzed on?</p>
                <input type="text" id="topicInput" placeholder="Kinematics, Chapter 6..." />
                <div class="chapter-selection">
                    <h4>Select Chapters:</h4>
                    <div class="chapter-checkboxes">
                        <label><input type="checkbox" value="Chapter 1 - Measurements and Units"><span>Chapter 1</span></label>
                        <label><input type="checkbox" value="Chapter 2 - Motion in One Dimension"><span>Chapter 2</span></label>
                        <label><input type="checkbox" value="Chapter 3 - Vectors and 2D Motion"><span>Chapter 3</span></label>
                        <label><input type="checkbox" value="Chapter 4 - Newton's Laws of Motion"><span>Chapter 4</span></label>
                        <label><input type="checkbox" value="Chapter 5 - Work and Energy"><span>Chapter 5</span></label>
                        <label><input type="checkbox" value="Chapter 6 - Momentum and Collisions"><span>Chapter 6</span></label>
                        <label><input type="checkbox" value="Chapter 7 - Rotational Motion"><span>Chapter 7</span></label>
                        <label><input type="checkbox" value="Chapter 8 - Gravitation"><span>Chapter 8</span></label>
                        <label><input type="checkbox" value="Chapter 9 - Fluids"><span>Chapter 9</span></label>
                        <label><input type="checkbox" value="Chapter 10 - Thermodynamics"><span>Chapter 10</span></label>
                        <label><input type="checkbox" value="Chapter 11 - Waves and Sound"><span>Chapter 11</span></label>
                        <label><input type="checkbox" value="Chapter 12 - Electricity and Magnetism"><span>Chapter 12</span></label>
                    </div>
                </div>
                <div class="difficulty-section">
                    <h4>Select Difficulty Level:</h4>
                    <div class="difficulty-options">
                        <label class="difficulty-option">
                            <input type="radio" name="difficulty" value="easy" checked>
                            <span class="difficulty-label easy">Easy</span>
                            <small>Basic concepts and definitions</small>
                        </label>
                        <label class="difficulty-option">
                            <input type="radio" name="difficulty" value="medium">
                            <span class="difficulty-label medium">Medium</span>
                            <small>Problem-solving and applications</small>
                        </label>
                        <label class="difficulty-option">
                            <input type="radio" name="difficulty" value="hard">
                            <span class="difficulty-label hard">Hard</span>
                            <small>Advanced problems and complex scenarios</small>
                        </label>
                    </div>
                </div>
                <div class="topic-buttons">
                    <button class="topic-btn-secondary" onclick="this.parentElement.parentElement.parentElement.remove();">Cancel</button>
                    <button class="topic-btn-primary" onclick="quizIntegration.handleTopicSubmit();">Create Quiz</button>
                </div>
            </div>
        `;
        
        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .topic-popup {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
            }
            .topic-popup-content {
                background: white;
                padding: 25px;
                border-radius: 15px;
                max-width: 400px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            }
            .topic-popup-content h3 {
                margin: 0 0 15px 0;
                color: #337810;
                text-align: center;
            }
            .topic-popup-content p {
                margin: 0 0 15px 0;
                color: #666;
                text-align: center;
            }
            #topicInput {
                width: 100%;
                padding: 12px;
                border: 2px solid #e0e0e0;
                border-radius: 8px;
                font-size: 14px;
                margin-bottom: 15px;
                box-sizing: border-box;
            }
            #topicInput:focus {
                border-color: #337810;
                outline: none;
            }
            .chapter-selection {
                margin-bottom: 20px;
                background: #f8f9fa;
                padding: 12px;
                border-radius: 8px;
                width: 100%;
                box-sizing: border-box;
            }
            .chapter-selection h4 {
                margin: 0 0 12px 0;
                color: #333;
                font-size: 14px;
            }
            .chapter-checkboxes {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 6px;
                width: 100%;
                box-sizing: border-box;
            }
            .chapter-checkboxes label {
                display: flex;
                align-items: center;
                cursor: pointer;
                padding: 12px 24px;
                background: white;
                border: 1px solid #ddd;
                border-radius: 15px;
                font-size: 12px;
                transition: all 0.2s;
                width: fit-content;
                max-width: 100%;
                min-width: 120px;
                white-space: nowrap;
            }
            .chapter-checkboxes label:hover {
                background: #e9ecef;
                border-color: #337810;
            }
            .chapter-checkboxes input[type="checkbox"]:checked + span {
                color: #337810;
                font-weight: 600;
            }
            .chapter-checkboxes input[type="checkbox"] {
                margin-right: 6px;
            }
            .difficulty-section {
                margin: 20px 0;
                padding: 15px;
                background: #f8f9fa;
                border-radius: 8px;
            }
            .difficulty-section h4 {
                margin: 0 0 12px 0;
                color: #333;
                font-size: 14px;
            }
            .difficulty-options {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }
            .difficulty-option {
                display: flex;
                align-items: center;
                cursor: pointer;
                padding: 8px;
                border-radius: 6px;
                transition: background 0.2s;
            }
            .difficulty-option:hover {
                background: #e9ecef;
            }
            .difficulty-option input[type="radio"] {
                margin-right: 8px;
            }
            .difficulty-label {
                font-weight: 600;
                margin-right: 8px;
            }
            .difficulty-label.easy { color: #28a745; }
            .difficulty-label.medium { color: #ffc107; }
            .difficulty-label.hard { color: #dc3545; }
            .difficulty-option small {
                color: #666;
                font-size: 11px;
            }
            .topic-buttons {
                display: flex;
                gap: 10px;
                justify-content: flex-end;
            }
            .topic-btn-secondary, .topic-btn-primary {
                padding: 10px 20px;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 600;
                transition: all 0.2s;
            }
            .topic-btn-secondary {
                background: #f8f9fa;
                color: #666;
            }
            .topic-btn-secondary:hover {
                background: #e9ecef;
            }
            .topic-btn-primary {
                background: #337810;
                color: white;
            }
            .topic-btn-primary:hover {
                background: #2a6209;
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(popup);
        
        // Focus input
        setTimeout(() => {
            document.getElementById('topicInput').focus();
        }, 100);
        
        // Handle Enter key
        document.getElementById('topicInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleTopicSubmit();
            }
        });
    }
    
    handleTopicSubmit() {
        const selectedChapters = Array.from(document.querySelectorAll('.chapter-checkboxes input[type="checkbox"]:checked'))
            .map(cb => cb.value);
        const customTopic = document.getElementById('topicInput').value.trim();
        const difficulty = document.querySelector('input[name="difficulty"]:checked').value;
        
        let topic;
        if (selectedChapters.length > 0) {
            topic = selectedChapters.length === 1 ? selectedChapters[0] : selectedChapters.join(' + ');
        } else if (customTopic) {
            topic = customTopic;
        } else {
            alert('Please select chapters or enter a custom topic.');
            return;
        }
        
        document.querySelector('.topic-popup').remove();
        this.generateAIQuiz(topic, difficulty);
    }

    async fetchQuestionBankChunks(topic) {
        try {
            const res = await fetch('/api/pinecone', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: `${topic} practice problems exam questions` })
            });
            if (!res.ok) return [];
            const data = await res.json();
            return (data.chunks || []).filter(c => c.text && c.text.length > 20).slice(0, 5);
        } catch {
            return [];
        }
    }

    async generateAIQuiz(topic, difficulty = 'easy') {
        const loadingIndicator = document.getElementById('loadingIndicator');
        try {
            // Check if we have a sample quiz for this topic first
            const chapterKey = window.getChapterKey ? window.getChapterKey(topic) : topic.toLowerCase();
            if (window.sampleQuizzes && window.sampleQuizzes[chapterKey]) {
                quizSystem.startQuiz(window.sampleQuizzes[chapterKey]);
                return;
            }
            
            if (window.showLoadingForQuiz) {
                window.showLoadingForQuiz();
            } else if (loadingIndicator) {
                loadingIndicator.style.display = 'flex';
            }

            // Fetch question bank examples from Pinecone in parallel with nothing else yet
            const bankChunks = await this.fetchQuestionBankChunks(topic);
            const bankContext = bankChunks.length > 0
                ? `\n\nHere are real exam/practice questions from the course question bank for reference. Model your questions after this style, difficulty, and format:\n${bankChunks.map(c => c.text).join('\n---\n')}`
                : '';

            const difficultyInstructions = {
                easy: 'Focus on basic definitions, simple concepts, and straightforward applications.',
                medium: 'Include problem-solving questions that require applying concepts. Mix conceptual and computational questions.',
                hard: 'Create challenging multi-step problems requiring deep understanding and advanced applications.'
            }[difficulty];

            const titleSuffix = `${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}`;
            const promptContent = `Create a 5-question multiple choice quiz STRICTLY about "${topic}" from the physics textbook.

DIFFICULTY: ${difficulty.toUpperCase()}
${difficultyInstructions}${bankContext}

IMPORTANT: ALL questions must be about "${topic}" ONLY. Return ONLY a JSON object:
{
  "title": "${topic} Quiz (${titleSuffix})",
  "difficulty": "${difficulty}",
  "questions": [
    {
      "question": "Question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct": 0,
      "explanation": "Brief explanation"
    }
  ]
}`;

            const response = await fetch('/api/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: [{ role: 'user', content: promptContent }] })
            });

            if (!response.ok) throw new Error(`API error: ${response.status}`);
            const data = await response.json();

            if (window.hideLoading) window.hideLoading();
            else if (loadingIndicator) loadingIndicator.style.display = 'none';

            try {
                let jsonStr = data.response.trim();
                if (jsonStr.includes('```json')) {
                    jsonStr = jsonStr.split('```json')[1].split('```')[0].trim();
                } else if (jsonStr.includes('```')) {
                    jsonStr = jsonStr.split('```')[1].split('```')[0].trim();
                }
                quizSystem.startQuiz(JSON.parse(jsonStr));
            } catch (e) {
                quizSystem.startQuiz(this.parseAIResponseToQuiz(data.response, topic));
            }
        } catch (error) {
            console.error('Error generating AI quiz:', error);
            alert('Sorry, there was an error generating the quiz. Please try again.');
            if (window.hideLoading) window.hideLoading();
            else if (loadingIndicator) loadingIndicator.style.display = 'none';
        }
    }

    parseAIResponseToQuiz(aiResponse, topic) {
        // Simple parser for AI-generated quiz content
        const lines = aiResponse.split('\n').filter(line => line.trim());
        const questions = [];
        
        let currentQuestion = null;
        let options = [];
        
        lines.forEach(line => {
            line = line.trim();
            if (line.match(/^\d+\./)) {
                // New question
                if (currentQuestion) {
                    questions.push({
                        question: currentQuestion,
                        options: [...options],
                        correct: 0 // Default to first option
                    });
                }
                currentQuestion = line.replace(/^\d+\.\s*/, '');
                options = [];
            } else if (line.match(/^[A-D]\)/)) {
                // Option
                options.push(line.replace(/^[A-D]\)\s*/, ''));
            }
        });
        
        // Add last question
        if (currentQuestion && options.length > 0) {
            questions.push({
                question: currentQuestion,
                options: [...options],
                correct: 0
            });
        }
        
        return {
            title: `${topic} Quiz`,
            difficulty: 'easy',
            questions: questions.slice(0, 5) // Limit to 5 questions
        };
    }

    detectChapterRequest(topic) {
        const lowerTopic = topic.toLowerCase();
        return lowerTopic.includes('chapter') || lowerTopic.includes('ch ') || lowerTopic.includes('ch.');
    }

    extractChapterFromMessage(message) {
        const patterns = [
            /chapter\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)/i,
            /ch\s*\.?\s*(\d+)/i,
            /(measurements?|units?|significant figures?)/i,
            /(kinematics?|motion|velocity|acceleration|displacement)/i,
            /(vectors?|projectile|2d motion)/i,
            /(newton'?s? laws?|force|friction|tension)/i,
            /(work|energy|power|conservation of energy)/i,
            /(momentum|impulse|collision)/i,
            /(rotation|torque|angular momentum|moment of inertia)/i,
            /(gravitation|gravity|orbital|kepler)/i,
            /(fluid|pressure|buoyancy|bernoulli)/i,
            /(thermodynamics?|heat|temperature|entropy|ideal gas)/i,
            /(waves?|sound|frequency|wavelength|oscillation)/i,
            /(electricity|magnetism|electric field|magnetic field|circuits?)/i
        ];
        
        for (const pattern of patterns) {
            const match = message.match(pattern);
            if (match) {
                return match[0];
            }
        }
        
        return null;
    }
}

// Initialize quiz integration
const quizIntegration = new QuizIntegration();