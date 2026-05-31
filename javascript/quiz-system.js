class QuizSystem {
    constructor() {
        this.currentQuiz = null;
        this.currentQuestionIndex = 0;
        this.userAnswers = [];
        this.hintsUsed = [];
        this.score = 0;
        this.timeStarted = null;
        this.questionTimer = null;
        this.questionTimeLimit = 120;
        this.questionTimeRemaining = 0;
        this.init();
    }

    init() {
        this.createQuizModal();
        this.bindEvents();
    }

    createQuizModal() {
        const modalHTML = `
            <div id="quizModal" class="quiz-modal">
                <div class="quiz-container">
                    <button class="quiz-close" onclick="quizSystem.closeQuiz()">&times;</button>
                    <div class="quiz-header">
                        <h2 class="quiz-title" id="quizTitle">Quiz</h2>
                        <div class="quiz-timer" id="quizTimer" style="display: none;">
                            <span class="timer-icon">⏱️</span>
                            <span class="timer-text" id="timerText">2:00</span>
                        </div>
                        <div class="quiz-progress">
                            <div class="quiz-progress-bar" id="progressBar"></div>
                        </div>
                    </div>
                    <div class="quiz-content" id="quizContent" style="overflow-y: auto; max-height: 70vh;">
                        <!-- Quiz content will be dynamically inserted here -->
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    bindEvents() {

        document.getElementById('quizModal').addEventListener('click', (e) => {
            if (e.target.id === 'quizModal') {
                this.closeQuiz();
            }
        });
    }

    startQuiz(quizData) {
        this.currentQuiz = quizData;
        this.currentQuestionIndex = 0;
        this.userAnswers = [];
        this.hintsUsed = [];
        this.score = 0;
        this.timeStarted = new Date();
        
        document.getElementById('quizTitle').textContent = quizData.title;
        document.getElementById('quizModal').style.display = 'block';
        
        const timerElement = document.getElementById('quizTimer');
        timerElement.style.display = 'none';
        
        this.showQuestion();
    }

    showQuestion() {
        const question = this.currentQuiz.questions[this.currentQuestionIndex];
        const progress = ((this.currentQuestionIndex + 1) / this.currentQuiz.questions.length) * 100;
        
        document.getElementById('progressBar').style.width = progress + '%';
        
        const questionHTML = `
            <div class="question-container">
                <div class="question-number">
                    Question ${this.currentQuestionIndex + 1} of ${this.currentQuiz.questions.length}
                </div>
                <div class="question-text">${question.question}</div>
                <div class="options-container" id="optionsContainer">
                    ${question.options.map((option, index) => `
                        <div class="option" data-index="${index}" onclick="quizSystem.selectOption(${index})">
                            ${option}
                        </div>
                    `).join('')}
                </div>
                <div class="quiz-controls">
                    <button class="quiz-btn quiz-btn-secondary" onclick="quizSystem.previousQuestion()" 
                            ${this.currentQuestionIndex === 0 || this.currentQuiz.difficulty === 'hard' ? 'style="visibility: hidden;"' : ''}>
                        Previous
                    </button>
                    <button class="quiz-btn quiz-btn-hint" id="hintBtn" onclick="quizSystem.showHint()" 
                            ${this.hintsUsed[this.currentQuestionIndex] ? 'style="display: none;"' : ''}>
                        💡 Hint
                    </button>
                    <button class="quiz-btn quiz-btn-primary" id="nextBtn" onclick="quizSystem.nextQuestion()" disabled>
                        ${this.currentQuestionIndex === this.currentQuiz.questions.length - 1 ? 'Finish Quiz' : 'Next'}
                    </button>
                </div>
            </div>
        `;
        
        document.getElementById('quizContent').innerHTML = questionHTML;
        

        if (window.MathJax?.typesetPromise) {
            window.MathJax.typesetPromise([document.getElementById('quizContent')]);
        } else if (window.MathJax?.Hub) {
            window.MathJax.Hub.Queue(["Typeset", window.MathJax.Hub, document.getElementById('quizContent')]);
        }
        

        
        if (this.userAnswers[this.currentQuestionIndex] !== undefined) {
            this.selectOption(this.userAnswers[this.currentQuestionIndex], false);
        }
        

        const hintBtn = document.getElementById('hintBtn');
        if (hintBtn) {
            if (this.hintsUsed[this.currentQuestionIndex]) {
                hintBtn.style.display = 'none';
            } else {
                hintBtn.style.display = 'inline-block';
            }
        }
    }

    selectOption(optionIndex, animate = true) {

        document.querySelectorAll('.option').forEach(opt => opt.classList.remove('selected'));
        

        const selectedOption = document.querySelector(`[data-index="${optionIndex}"]`);
        selectedOption.classList.add('selected');
        
        if (animate) {
            selectedOption.style.transform = 'scale(0.98)';
            setTimeout(() => {
                selectedOption.style.transform = 'scale(1)';
            }, 100);
        }
        

        this.userAnswers[this.currentQuestionIndex] = optionIndex;
        

        document.getElementById('nextBtn').disabled = false;
    }

    nextQuestion() {
        if (this.userAnswers[this.currentQuestionIndex] === undefined && this.currentQuiz.difficulty !== 'hard') return;
        
        this.clearQuestionTimer();
        
        if (this.currentQuestionIndex < this.currentQuiz.questions.length - 1) {
            this.currentQuestionIndex++;
            this.showQuestion();
        } else {
            this.finishQuiz();
        }
    }

    previousQuestion() {
        if (this.currentQuestionIndex > 0) {
            this.clearQuestionTimer();
            this.currentQuestionIndex--;
            this.showQuestion();
        }
    }

    finishQuiz() {
        this.calculateScore();
        this.showResults();
    }

    calculateScore() {
        this.score = 0;
        for (let i = 0; i < this.currentQuiz.questions.length; i++) {
            const answer = this.userAnswers[i];
            if (answer !== undefined && answer === this.currentQuiz.questions[i].correct) {
        
                this.score += this.hintsUsed[i] ? 0.5 : 1;
            }

        }
    }

    showResults() {
        this.clearQuestionTimer();
        document.getElementById('quizTimer').style.display = 'none';
        
        const percentage = Math.round((this.score / this.currentQuiz.questions.length) * 100);
        const timeElapsed = Math.round((new Date() - this.timeStarted) / 1000);
        
        let message = '';
        if (this.currentQuiz.difficulty === 'hard') {
            if (percentage >= 90) message = 'Outstanding! You mastered the hard difficulty! 🏆';
            else if (percentage >= 70) message = 'Great job on the challenging questions! 🎯';
            else if (percentage >= 50) message = 'Good effort on the hard quiz! Keep practicing! 📚';
            else message = 'Hard questions are tough! Review and try again! 💪';
        } else {
            if (percentage >= 90) message = 'Excellent work! 🎉';
            else if (percentage >= 70) message = 'Good job! 👍';
            else if (percentage >= 50) message = 'Not bad, keep practicing! 📚';
            else message = 'Keep studying, you\'ll get there! 💪';
        }
        
        const difficultyBadge = this.currentQuiz.difficulty ? 
            `<div class="difficulty-badge ${this.currentQuiz.difficulty}">${this.currentQuiz.difficulty.toUpperCase()}</div>` : '';
        
        const resultsHTML = `
            <div class="quiz-results">
                <div class="score-display">${percentage}%</div>
                ${difficultyBadge}
                <div class="score-message">${message}</div>
                <div class="results-breakdown">
                    <div class="breakdown-item">
                        <span>Score:</span>
                        <span>${this.score} / ${this.currentQuiz.questions.length}</span>
                    </div>
                    <div class="breakdown-item">
                        <span>Hints Used:</span>
                        <span>${this.hintsUsed.filter(h => h).length}</span>
                    </div>
                    <div class="breakdown-item">
                        <span>Time Taken:</span>
                        <span>${Math.floor(timeElapsed / 60)}:${(timeElapsed % 60).toString().padStart(2, '0')}</span>
                    </div>
                    <div class="breakdown-item">
                        <span>Difficulty:</span>
                        <span>${this.currentQuiz.difficulty ? this.currentQuiz.difficulty.charAt(0).toUpperCase() + this.currentQuiz.difficulty.slice(1) : 'Standard'}</span>
                    </div>
                    <div class="breakdown-item">
                        <span>Accuracy:</span>
                        <span>${percentage}%</span>
                    </div>
                </div>
                <div class="quiz-controls">
                    <button class="quiz-btn quiz-btn-secondary" onclick="quizSystem.reviewAnswers()">
                        Review Answers
                    </button>
                    <button class="quiz-btn quiz-btn-primary" onclick="quizSystem.closeQuiz()">
                        Close Quiz
                    </button>
                </div>
            </div>
        `;
        
        document.getElementById('quizContent').innerHTML = resultsHTML;
        
        // Force MathJax to reprocess results
        if (window.MathJax?.typesetPromise) {
            window.MathJax.typesetPromise([document.getElementById('quizContent')]);
        } else if (window.MathJax?.Hub) {
            window.MathJax.Hub.Queue(["Typeset", window.MathJax.Hub, document.getElementById('quizContent')]);
        }
        
        document.getElementById('progressBar').style.width = '100%';
    }

    reviewAnswers() {
        document.getElementById('quizTimer').style.display = 'none';
        this.currentQuestionIndex = 0;
        this.showReview();
    }

    showReview() {
        const question = this.currentQuiz.questions[this.currentQuestionIndex];
        const userAnswer = this.userAnswers[this.currentQuestionIndex];
        const correctAnswer = question.correct;
        
        const reviewHTML = `
            <div class="question-container">
                <div class="question-number">
                    Review ${this.currentQuestionIndex + 1} of ${this.currentQuiz.questions.length}
                </div>
                <div class="question-text">${question.question}</div>
                <div class="options-container">
                    ${question.options.map((option, index) => {
                        let className = 'option';
                        if (index === correctAnswer) className += ' correct';
                        else if (index === userAnswer && index !== correctAnswer) className += ' incorrect';
                        return `<div class="${className}">${option}</div>`;
                    }).join('')}
                </div>
                ${question.explanation ? `<div class="explanation"><strong>Explanation:</strong> ${question.explanation}</div>` : ''}
                <div class="quiz-controls">
                    <button class="quiz-btn quiz-btn-secondary" onclick="quizSystem.previousReview()" 
                            ${this.currentQuestionIndex === 0 ? 'style="visibility: hidden;"' : ''}>
                        Previous
                    </button>
                    <button class="quiz-btn quiz-btn-primary" onclick="quizSystem.nextReview()">
                        ${this.currentQuestionIndex === this.currentQuiz.questions.length - 1 ? 'Back to Results' : 'Next'}
                    </button>
                </div>
            </div>
        `;
        
        document.getElementById('quizContent').innerHTML = reviewHTML;
        
        // Force MathJax to reprocess explanations
        if (window.MathJax?.typesetPromise) {
            window.MathJax.typesetPromise([document.getElementById('quizContent')]);
        } else if (window.MathJax?.Hub) {
            window.MathJax.Hub.Queue(["Typeset", window.MathJax.Hub, document.getElementById('quizContent')]);
        }
    }

    nextReview() {
        if (this.currentQuestionIndex < this.currentQuiz.questions.length - 1) {
            this.currentQuestionIndex++;
            this.showReview();
        } else {
            this.showResults();
        }
    }

    previousReview() {
        if (this.currentQuestionIndex > 0) {
            this.currentQuestionIndex--;
            this.showReview();
        }
    }

    closeQuiz() {
        this.clearQuestionTimer();
        document.getElementById('quizModal').style.display = 'none';
        this.currentQuiz = null;
        this.currentQuestionIndex = 0;
        this.userAnswers = [];
        this.hintsUsed = [];
        this.score = 0;
    }
    
    async showHint() {
        const question = this.currentQuiz.questions[this.currentQuestionIndex];
        const hintBtn = document.getElementById('hintBtn');
        
        // Mark hint as used
        this.hintsUsed[this.currentQuestionIndex] = true;
        hintBtn.style.display = 'none';
        
        // Show loading state
        const hintContainer = document.createElement('div');
        hintContainer.className = 'hint-container';
        hintContainer.innerHTML = '<div class="hint-loading">💡 Generating hint...</div>';
        
        const optionsContainer = document.getElementById('optionsContainer');
        optionsContainer.parentNode.insertBefore(hintContainer, optionsContainer.nextSibling);
        
        try {
            // Generate hint using AI
            const hint = await this.generateHint(question.question, question.options);
            hintContainer.innerHTML = `<div class="hint-content"><strong>💡 Hint:</strong> ${hint}</div>`;
            
            // Force MathJax to reprocess the content
            if (window.MathJax?.typesetPromise) {
                await window.MathJax.typesetPromise([hintContainer]);
            } else if (window.MathJax?.Hub) {
                window.MathJax.Hub.Queue(["Typeset", window.MathJax.Hub, hintContainer]);
            }
        } catch (error) {
            hintContainer.innerHTML = '<div class="hint-error">Unable to generate hint. Try analyzing the question step by step.</div>';
        }
    }
    
    async generateHint(questionText, options) {
        const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [{
                    role: 'user',
                    content: `Hint for: ${questionText}\nOptions: ${options.join(', ')}\nBrief hint with LaTeX:`
                }]
            })
        });
        
        if (!response.ok) throw new Error('Failed to generate hint');
        const data = await response.json();
        return data.response || 'Consider the fundamental definition and eliminate incorrect options.';
    }
    
    startQuestionTimer() {
        this.questionTimeRemaining = this.questionTimeLimit;
        this.updateTimerDisplay();
        
        this.questionTimer = setInterval(() => {
            this.questionTimeRemaining--;
            this.updateTimerDisplay();
            
            if (this.questionTimeRemaining <= 0) {
                this.handleTimeUp();
            }
        }, 1000);
    }
    
    clearQuestionTimer() {
        if (this.questionTimer) {
            clearInterval(this.questionTimer);
            this.questionTimer = null;
        }
    }
    
    updateTimerDisplay() {
        const minutes = Math.floor(this.questionTimeRemaining / 60);
        const seconds = this.questionTimeRemaining % 60;
        const timerText = document.getElementById('timerText');
        
        if (timerText) {
            timerText.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            
            const timerElement = document.getElementById('quizTimer');
            if (this.questionTimeRemaining <= 30) {
                timerElement.style.color = '#dc3545';
            } else if (this.questionTimeRemaining <= 60) {
                timerElement.style.color = '#ffc107';
            } else {
                timerElement.style.color = '#ffffff';
            }
        }
    }
    
    handleTimeUp() {
        this.clearQuestionTimer();
        
        const timerText = document.getElementById('timerText');
        if (timerText) {
            timerText.textContent = 'Time Up!';
        }
        
        setTimeout(() => {
            if (this.currentQuestionIndex < this.currentQuiz.questions.length - 1) {
                this.currentQuestionIndex++;
                this.showQuestion();
            } else {
                this.finishQuiz();
            }
        }, 1500);
    }
}

// Sample quiz data - physics textbook based
const sampleQuizzes = {
    'test': {
        title: 'Physics Quick Quiz',
        difficulty: 'easy',
        questions: [
            {
                question: 'What is the SI unit of force?',
                options: ['Joule', 'Newton', 'Watt', 'Pascal'],
                correct: 1,
                explanation: 'The Newton (N) is the SI unit of force, defined as kg·m/s².'
            },
            {
                question: 'Which of Newton\'s laws states that F = ma?',
                options: ['First Law', 'Second Law', 'Third Law', 'Law of Gravitation'],
                correct: 1,
                explanation: 'Newton\'s Second Law states that the net force on an object equals its mass times its acceleration: F = ma.'
            }
        ]
    }
}

// Initialize quiz system
const quizSystem = new QuizSystem();

// Configure MathJax for proper LaTeX rendering
if (!window.MathJax) {
    window.MathJax = {
        tex: {
            inlineMath: [['$', '$'], ['\\(', '\\)']],
            displayMath: [['$$', '$$'], ['\\[', '\\]']],
            processEscapes: true,
            processEnvironments: true
        },
        options: {
            skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre']
        }
    };
    
    // Load MathJax if not already loaded
    if (!document.querySelector('script[src*="mathjax"]')) {
        const mathJaxScript = document.createElement('script');
        mathJaxScript.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js';
        mathJaxScript.async = true;
        document.head.appendChild(mathJaxScript);
    }
}

// Add timer and difficulty badge styles
const quizStyles = document.createElement('style');
quizStyles.textContent = `
    .quiz-timer {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: bold;
        font-size: 16px;
        color: #28a745;
        transition: color 0.3s ease;
    }
    .timer-icon {
        font-size: 18px;
    }
    .difficulty-badge {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 15px;
        font-size: 12px;
        font-weight: bold;
        margin: 10px 0;
        text-transform: uppercase;
    }
    .difficulty-badge.easy {
        background: #d4edda;
        color: #155724;
    }
    .difficulty-badge.medium {
        background: #fff3cd;
        color: #856404;
    }
    .difficulty-badge.hard {
        background: #f8d7da;
        color: #721c24;
    }
    .explanation {
        background: #f8f9fa;
        border-left: 4px solid #007bff;
        padding: 12px;
        margin: 15px 0;
        border-radius: 4px;
        font-size: 14px;
        line-height: 1.4;
    }
    .quiz-content {
        overflow-y: auto;
        max-height: 70vh;
    }
`;
document.head.appendChild(quizStyles);

// Make functions and data globally available
window.startQuiz = startQuiz;
window.getChapterKey = getChapterKey;
window.sampleQuizzes = sampleQuizzes;

// Function to start a quiz (can be called from chat or buttons)
function startQuiz(quizType) {
    // Check for chapter-specific quizzes first
    const chapterKey = getChapterKey(quizType);
    if (sampleQuizzes[chapterKey]) {
        quizSystem.startQuiz(sampleQuizzes[chapterKey]);
        return;
    }
    
    if (sampleQuizzes[quizType]) {
        quizSystem.startQuiz(sampleQuizzes[quizType]);
    } else {
    

    }
}

// Helper function to map chapter names to quiz keys
function getChapterKey(input) {
    const lowerInput = input.toLowerCase();
    
    if (lowerInput.includes('chapter 1') || lowerInput.includes('mechanics') || lowerInput.includes('motion')) {
        return 'chapter1';
    }
    if (lowerInput.includes('chapter 2') || lowerInput.includes('force') || lowerInput.includes('newton')) {
        return 'chapter2';
    }
    if (lowerInput.includes('chapter 3') || lowerInput.includes('energy') || lowerInput.includes('work')) {
        return 'chapter3';
    }
    
    return input.toLowerCase();
}