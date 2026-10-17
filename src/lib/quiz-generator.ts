import type { Question, QuizMetadata } from '@/components/QuizBuilder';

export function generateHtmlQuiz(questions: Question[], metadata: QuizMetadata): string {
  if (metadata.template === 'modern') {
    return generateModernTemplate(questions, metadata);
  }
  return generateClassicTemplate(questions, metadata);
}

function generateClassicTemplate(questions: Question[], metadata: QuizMetadata): string {
  // Shuffle questions if requested
  let questionsToGenerate = [...questions];
  if (metadata.shuffleQuestions) {
    questionsToGenerate = shuffleArray(questionsToGenerate);
  }

  // Generate question mapping and answer data
  const qMap: { [key: number]: { id: string; section: number } } = {};
  const correctAnswers: { [key: string]: number } = {};
  const marksData: { [key: string]: { positive: number; negative: number } } = {};
  
  questionsToGenerate.forEach((q, index) => {
    qMap[index + 1] = { id: q.id, section: 0 };
    correctAnswers[q.id] = q.correctOptionIndex;
    marksData[q.id] = { positive: q.positiveMarks, negative: q.negativeMarks };
  });

  // Generate questions HTML
  const questionsHtml = questionsToGenerate.map((q, index) => `
    <div class="q-card" id="q${q.id}" data-qnum="${index + 1}" data-section="0">
      <div class="q-header">
        <div class="q-num">${index + 1}</div>
        <div class="q-section">${q.section}</div>
        <div class="q-marks">+${q.positiveMarks}, -${q.negativeMarks}</div>
      </div>
      <div class="q-body">
        ${q.compText ? `<div class="comp-text">${q.compText}</div>` : ''}
        <div class="q-text">${q.questionText}</div>
        <div class="options">
          ${q.options.map((option, optIndex) => `
            <div class="option" data-option="${optIndex}" onclick="selectOption(this, '${q.id}', ${optIndex})" ondblclick="clearSelection('${q.id}')">
              <div class="option-content">
                ${q.optionImages?.[optIndex] ? `<img src="${q.optionImages[optIndex]}" alt="Option ${optIndex + 1}" class="option-image" />` : ''}
                <div class="option-text">${option}</div>
              </div>
              <div class="option-selector">
                <div class="option-circle"></div>
              </div>
            </div>
          `).join('')}
        </div>
        ${q.explanation ? `
        <div class="solution" id="sol-${q.id}">
          <div class="solution-title"><i class="fas fa-lightbulb"></i> Solution</div>
          <div class="solution-content">${q.explanation}</div>
        </div>` : ''}
      </div>
    </div>
  `).join('');

  // Return complete HTML structure
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${metadata.title}</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.2/es5/tex-mml-chtml.min.js"></script>
    <style>
${getQuizStyles()}
    </style>
</head>
<body>
    <header class="header">
        <button id="toggle-nav" class="nav-mobile" onclick="toggleNavPanel()">
            <i class="fas fa-bars"></i>
        </button>
        <h1 class="header-title">${metadata.title}</h1>
        <div class="header-actions">
            ${metadata.timerDuration > 0 ? `
            <div class="timer">
                <i class="fas fa-clock" style="margin-right: 8px;"></i>
                <div id="test-timer">00:00:00</div>
            </div>` : ''}
            <button id="theme-toggle" class="btn" onclick="toggleTheme()">
                <i class="fas fa-moon"></i>
            </button>
            <button class="btn" id="submit-test" onclick="submitTest()">
                <i class="fas fa-check-circle"></i> Submit
            </button>
        </div>
    </header>
    
    <div class="main-wrapper">
        <div class="main-container">
            <p class="text-center text-gray-600 mb-4">${metadata.description}</p>
            <div id="questions-container">
                ${questionsHtml}
            </div>
        </div>
        
        <div class="nav-panel" id="nav-panel">
            <div class="panel-header">
                <h3>Question Navigator</h3>
                <button class="nav-mobile" onclick="toggleNavPanel()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <select class="section-select" id="section-select" onchange="filterBySection()">
                <option value="all">All Sections</option>
                <option value="0">Test</option>
            </select>
            
            <div class="q-grid" id="q-grid">
                <!-- Question navigation buttons will be added dynamically -->
            </div>
        </div>
    </div>
    
    <div class="modal-overlay" id="results-modal">
        <div class="results-card">
            <button class="close-modal" onclick="closeResultsModal()">
                <i class="fas fa-times"></i>
            </button>
            <div class="score-display" id="score-value">0</div>
            <p id="score-display">out of ${questionsToGenerate.length * 5} marks</p>
            
            <div class="stats-grid">
                <div class="stat-box">
                    <div class="stat-value" id="correct-count">0</div>
                    <div>Correct</div>
                </div>
                <div class="stat-box">
                    <div class="stat-value" id="incorrect-count">0</div>
                    <div>Incorrect</div>
                </div>
            </div>
            
            <button class="review-btn" onclick="reviewTest()">
                <i class="fas fa-eye"></i> Review Test
            </button>
        </div>
    </div>
    
    <div class="footer">
        <button class="nav-btn" id="prev-btn" onclick="navigate(-1)">
            <i class="fas fa-chevron-left"></i> Previous
        </button>
        
        <button class="nav-btn" id="next-btn" onclick="navigate(1)">
            Next <i class="fas fa-chevron-right"></i>
        </button>
    </div>
    
    <script>
${getQuizScript(questionsToGenerate, metadata, qMap, correctAnswers, marksData)}
    </script>
</body>
</html>`;
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function getQuizStyles(): string {
  return `
:root {
    --primary: #4361ee;
    --primary-light: rgba(67, 97, 238, 0.1);
    --secondary: #3a0ca3;
    --success: #2ec4b6;
    --danger: #e71d36;
    --warning: #ff9f1c;
    --dark: #1a1a2e;
    --darker: #16213e;
    --light: #f8f9fa;
    --lighter: #ffffff;
    --card: rgba(255, 255, 255, 0.9);
    --card-border: rgba(255, 255, 255, 0.3);
    --text: #2b2d42;
    --text-light: #8d99ae;
    --radius: 12px;
    --shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    --glass: rgba(255, 255, 255, 0.05);
    --glass-border: rgba(255, 255, 255, 0.1);
    --transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

[data-theme=dark] {
    --card: rgba(30, 41, 59, 0.9);
    --card-border: rgba(30, 41, 59, 0.3);
    --text: #f8f9fa;
    --text-light: #94a3b8;
    --darker: #0f172a;
    --glass: rgba(15, 23, 42, 0.5);
    --glass-border: rgba(15, 23, 42, 0.3);
}

* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

body {
    margin: 0;
    padding: 0;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    background: var(--light);
    color: var(--text);
    line-height: 1.6;
    font-size: 1rem;
    background-image: radial-gradient(circle at 10% 20%, rgba(67, 97, 238, 0.05) 0%, rgba(255, 255, 255, 0.05) 90%);
    min-height: 100vh;
}

body[data-theme=dark] {
    background: var(--darker);
    background-image: radial-gradient(circle at 10% 20%, rgba(67, 97, 238, 0.05) 0%, rgba(15, 23, 42, 0.05) 90%);
}

/* Header Styles */
.header {
    position: sticky;
    top: 0;
    z-index: 100;
    background: var(--primary);
    color: var(--lighter);
    padding: 0.75rem 1.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    box-shadow: var(--shadow);
    border-bottom: 1px solid var(--glass-border);
}

.header-title {
    font-size: 1.3rem;
    font-weight: 700;
    margin: 0;
    letter-spacing: -0.5px;
}

.header-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.timer {
    display: flex;
    align-items: center;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 100px;
    padding: 0.35rem 1rem;
    font-weight: 500;
    backdrop-filter: blur(5px);
    -webkit-backdrop-filter: blur(5px);
    border: 1px solid rgba(255, 255, 255, 0.1);
}

.btn {
    background: var(--lighter);
    color: var(--primary);
    border: none;
    border-radius: 100px;
    padding: 0.5rem 1.25rem;
    font-weight: 600;
    cursor: pointer;
    transition: var(--transition);
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.95rem;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
}

.btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
}

.btn:active {
    transform: translateY(0);
}

.btn i {
    font-size: 0.9em;
}

/* Main Layout */
.main-wrapper {
    display: flex;
    max-width: 1400px;
    margin: 0 auto;
    position: relative;
    padding-top: 1rem;
}

.main-container {
    flex: 1;
    padding: 1.5rem;
    max-width: 1000px;
    margin: 0 auto;
    width: 100%;
}

/* Question Card Styles */
.q-card {
    background: var(--card);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    margin-bottom: 1.5rem;
    overflow: hidden;
    border: 1px solid var(--glass-border);
    backdrop-filter: blur(5px);
    -webkit-backdrop-filter: blur(5px);
    display: none;
    transition: var(--transition);
    overflow-wrap: break-word;
    word-wrap: break-word;
    hyphens: auto;
}

.q-card.active {
    display: block;
    animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}

.q-header {
    display: flex;
    align-items: center;
    padding: 0.75rem 1.5rem;
    background: var(--glass);
    border-bottom: 1px solid var(--glass-border);
    backdrop-filter: blur(5px);
    -webkit-backdrop-filter: blur(5px);
}

.q-num {
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 50%;
    background: var(--primary);
    color: var(--lighter);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 0.75rem;
    font-weight: 600;
    flex-shrink: 0;
}

.q-section {
    flex: 1;
    font-size: 0.95rem;
    color: var(--text-light);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.q-marks {
    font-size: 0.95rem;
    font-weight: 500;
    color: var(--text-light);
    white-space: nowrap;
    margin-left: 0.5rem;
}

.q-body {
    padding: 1.5rem;
}

.comp-text {
    background: var(--glass);
    padding: 1rem;
    border-radius: var(--radius);
    margin-bottom: 1.5rem;
    border: 1px solid var(--glass-border);
    backdrop-filter: blur(5px);
    -webkit-backdrop-filter: blur(5px);
}

.q-text {
    margin-bottom: 2rem;
    font-size: 1.05rem;
    line-height: 1.7;
}

.q-text img {
    max-width: 100%;
    height: auto;
    border-radius: var(--radius);
    margin: 0.5rem 0;
}

/* Options Styles */
.options {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-top: 1.5rem;
}

.option {
    padding: 1rem 1.25rem;
    border-radius: var(--radius);
    border: 1px solid var(--glass-border);
    background: var(--glass);
    cursor: pointer;
    transition: var(--transition);
    font-size: 1.05rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    backdrop-filter: blur(5px);
    -webkit-backdrop-filter: blur(5px);
}

.option:hover {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.05);
    border-color: var(--primary);
}

.option-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.option-text {
    flex: 1;
}

.option-image {
    max-width: 120px;
    max-height: 120px;
    object-fit: contain;
    border-radius: 8px;
    border: 1px solid var(--glass-border);
    margin-bottom: 0.5rem;
}

.option-selector {
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 50%;
    border: 2px solid var(--text-light);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: var(--transition);
}

.option-circle {
    width: 0.8rem;
    height: 0.8rem;
    border-radius: 50%;
    background: transparent;
    transition: var(--transition);
}

.selected .option-selector {
    border-color: var(--primary);
    background: var(--primary-light);
}

.selected .option-circle {
    background: var(--primary);
}

.correct .option-selector {
    border-color: var(--success);
    background: rgba(46, 196, 182, 0.1);
}

.correct .option-circle {
    background: var(--success);
}

.incorrect .option-selector {
    border-color: var(--danger);
    background: rgba(231, 29, 54, 0.1);
}

.incorrect .option-circle {
    background: var(--danger);
}

/* Solution Styles */
.solution {
    display: none;
    background: rgba(46, 196, 182, 0.05);
    padding: 1.25rem;
    border-radius: var(--radius);
    margin-top: 1.5rem;
    border: 1px solid rgba(46, 196, 182, 0.2);
    backdrop-filter: blur(5px);
    -webkit-backdrop-filter: blur(5px);
}

.solution-title {
    font-weight: 600;
    color: var(--success);
    margin-bottom: 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.solution-content {
    line-height: 1.7;
}

.solution-content img {
    max-width: 100%;
    height: auto;
    border-radius: var(--radius);
    margin: 0.5rem 0;
}

/* Navigation Panel */
.nav-panel {
    width: 280px;
    background: var(--card);
    box-shadow: -5px 0 20px rgba(0, 0, 0, 0.1);
    padding: 1rem;
    border-left: 1px solid var(--glass-border);
    height: calc(100vh - 110px);
    position: sticky;
    top: 60px;
    overflow-y: auto;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    display: block;
    transition: transform 0.3s ease;
}

.panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--glass-border);
}

.section-select {
    width: 100%;
    padding: 0.6rem 1rem;
    border-radius: var(--radius);
    border: 1px solid var(--glass-border);
    margin-bottom: 1rem;
    background: var(--glass);
    color: var(--text);
    font-family: inherit;
    font-size: 0.95rem;
    transition: var(--transition);
    backdrop-filter: blur(5px);
    -webkit-backdrop-filter: blur(5px);
}

.section-select:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 2px var(--primary-light);
}

.q-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(2.5rem, 1fr));
    gap: 0.5rem;
}

.q-nav-btn {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--glass);
    color: var(--text);
    border: 1px solid var(--glass-border);
    cursor: pointer;
    transition: var(--transition);
    font-weight: 500;
    backdrop-filter: blur(5px);
    -webkit-backdrop-filter: blur(5px);
}

.q-nav-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 3px 8px rgba(0, 0, 0, 0.1);
    border-color: var(--primary);
}

.q-nav-btn.active {
    background: var(--primary);
    color: var(--lighter);
    border-color: var(--primary);
    box-shadow: 0 3px 10px rgba(67, 97, 238, 0.3);
}

.q-nav-btn.answered {
    background: rgba(46, 196, 182, 0.1);
    border-color: rgba(46, 196, 182, 0.3);
}

.q-nav-btn.correct {
    background: rgba(46, 196, 182, 0.2);
    border-color: var(--success);
}

.q-nav-btn.incorrect {
    background: rgba(231, 29, 54, 0.2);
    border-color: var(--danger);
}

/* Footer Navigation */
.footer {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: var(--card);
    padding: 0.75rem 1.5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
    z-index: 10;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border-top: 1px solid var(--glass-border);
}

.nav-btn {
    padding: 0.75rem 1.5rem;
    border-radius: 100px;
    background: var(--primary);
    color: var(--lighter);
    border: none;
    cursor: pointer;
    transition: var(--transition);
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 500;
    font-size: 1rem;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
}

.nav-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
}

.nav-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
}

/* Results Modal */
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    z-index: 900;
    display: none;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(5px);
    -webkit-backdrop-filter: blur(5px);
    animation: fadeIn 0.3s ease-out;
}

.results-card {
    background: var(--card);
    border-radius: var(--radius);
    box-shadow: 0 5px 25px rgba(0, 0, 0, 0.2);
    padding: 2rem;
    width: 90%;
    max-width: 500px;
    text-align: center;
    max-height: 90vh;
    overflow-y: auto;
    position: relative;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid var(--glass-border);
}

.score-display {
    font-size: 3.5rem;
    font-weight: 700;
    background: linear-gradient(90deg, var(--primary), var(--success));
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    margin: 0.5rem 0;
}

.stats-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1.5rem;
    margin: 2rem 0;
}

.stat-box {
    background: var(--glass);
    border-radius: var(--radius);
    padding: 1.5rem;
    text-align: center;
    transition: var(--transition);
    border: 1px solid var(--glass-border);
    backdrop-filter: blur(5px);
    -webkit-backdrop-filter: blur(5px);
}

.stat-box:hover {
    transform: translateY(-3px);
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.05);
}

.stat-value {
    font-size: 2rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
}

.review-btn {
    background: var(--primary);
    color: var(--lighter);
    border: none;
    border-radius: 100px;
    padding: 0.75rem 1.5rem;
    font-weight: 600;
    font-size: 1rem;
    cursor: pointer;
    transition: var(--transition);
    margin-top: 1rem;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
}

.review-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
}

.close-modal {
    position: absolute;
    top: 1rem;
    right: 1rem;
    background: none;
    border: none;
    color: var(--text-light);
    font-size: 1.5rem;
    cursor: pointer;
    transition: var(--transition);
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
}

.close-modal:hover {
    background: var(--glass);
    color: var(--text);
}

/* Mobile Styles */
.nav-mobile {
    display: none;
    background: none;
    border: none;
    color: var(--lighter);
    font-size: 1.25rem;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 50%;
    transition: var(--transition);
}

.nav-mobile:hover {
    background: rgba(255, 255, 255, 0.1);
}

@media (max-width: 992px) {
    .nav-panel {
        display: none;
        position: fixed;
        top: 60px;
        right: -100%;
        bottom: 60px;
        width: 280px;
        z-index: 99;
        transition: all 0.3s ease;
    }
    
    .nav-panel.active {
        right: 0;
        display: block;
    }
    
    .nav-mobile {
        display: block;
    }
    
    .main-container {
        padding: 1rem;
    }
}

@media (max-width: 768px) {
    .stats-grid {
        grid-template-columns: 1fr;
    }
    
    .header {
        padding: 0.75rem 1rem;
    }
    
    .header-title {
        font-size: 1.1rem;
    }
    
    .timer {
        padding: 0.25rem 0.75rem;
        font-size: 0.9rem;
    }
    
    .btn {
        padding: 0.4rem 1rem;
        font-size: 0.9rem;
    }
    
    .q-body {
        padding: 1rem;
    }
    
    .footer {
        padding: 0.5rem 1rem;
    }
    
    .nav-btn {
        padding: 0.6rem 1rem;
        font-size: 0.95rem;
    }
    
    .option {
        padding: 0.75rem 1rem;
    }
}

@media (max-width: 480px) {
    body {
        font-size: 1.05rem;
    }
    
    .header {
        padding: 0.5rem;
    }
    
    .header-title {
        font-size: 1rem;
    }
    
    .timer {
        padding: 0.2rem 0.5rem;
        font-size: 0.85rem;
    }
    
    .btn {
        padding: 0.3rem 0.75rem;
        font-size: 0.85rem;
    }
    
    .main-container {
        padding: 0.75rem;
    }
    
    .q-header {
        padding: 0.5rem 1rem;
    }
    
    .q-num {
        width: 1.75rem;
        height: 1.75rem;
        font-size: 0.9rem;
        margin-right: 0.5rem;
    }
    
    .q-section, .q-marks {
        font-size: 0.85rem;
    }
    
    .q-nav-btn {
        width: 2rem;
        height: 2rem;
        font-size: 0.85rem;
    }
    
    .option {
        padding: 0.75rem;
        font-size: 1rem;
        gap: 0.75rem;
    }
    
    .option-selector {
        width: 1.25rem;
        height: 1.25rem;
    }
    
    .option-circle {
        width: 0.6rem;
        height: 0.6rem;
    }
    
    .score-display {
        font-size: 2.5rem;
    }
    
    .stat-value {
        font-size: 1.5rem;
    }
    
    .review-btn {
        padding: 0.6rem 1.25rem;
        font-size: 0.95rem;
    }
}

/* Animation for option selection */
@keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.05); }
    100% { transform: scale(1); }
}

.selected {
    animation: pulse 0.3s ease;
}
  `;
}

function getQuizScript(
  questions: Question[], 
  metadata: QuizMetadata,
  qMap: { [key: number]: { id: string; section: number } },
  correctAnswers: { [key: string]: number },
  marksData: { [key: string]: { positive: number; negative: number } }
): string {
  return `
// Test data (dynamically generated)
const test = {
    questions: ${questions.length},
    marks: ${questions.reduce((sum, q) => sum + q.positiveMarks, 0)},
    timer: ${metadata.timerDuration * 60}, // Timer duration in seconds
    timeSpent: 0,
    current: 1,
    answers: {},
    correct: ${JSON.stringify(correctAnswers)},
    marks: ${JSON.stringify(marksData)},
    qMap: ${JSON.stringify(qMap)},
    sections: {"0": {"name": "Test", "start_question": 1, "questions": [${questions.map((_, i) => i + 1).join(', ')}]}},
    currentSection: "all",
    submitted: false
};

// Initialize test
document.addEventListener('DOMContentLoaded', () => {
    // Set up sections dropdown
    setupSections();
    
    // Set up question navigation grid
    setupNavigation();
    
    // Show first question
    showQuestion(1);
    
    // Start timer if configured
    if (test.timer > 0) startTimer();
    
    // Set initial theme based on user preference
    setInitialTheme();
});

// Set initial theme based on user preference
function setInitialTheme() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) {
        document.body.setAttribute('data-theme', 'dark');
        const icon = document.getElementById('theme-toggle').querySelector('i');
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
    }
}

// Setup section dropdown
function setupSections() {
    const select = document.getElementById('section-select');
    // Clear existing options, except 'All Sections' if it's there
    while (select.options.length > 1) {
        select.remove(1);
    }
    
    for (const id in test.sections) {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = test.sections[id].name;
        select.appendChild(option);
    }
}

// Filter questions by section
function filterBySection() {
    const sectionId = document.getElementById('section-select').value;
    test.currentSection = sectionId;
    
    // Update question grid
    setupNavigation();
    
    // Show first question of section
    if (sectionId !== 'all') {
        const firstQuestion = test.sections[sectionId].questions[0];
        if (firstQuestion) showQuestion(firstQuestion);
    } else {
        showQuestion(1); // Show first question if "All Sections" is selected
    }
}

// Setup question navigation grid
function setupNavigation() {
    const grid = document.getElementById('q-grid');
    grid.innerHTML = ''; // Clear existing buttons
    
    for (let i = 1; i <= test.questions; i++) {
        // Skip if filtering by section
        if (test.currentSection !== 'all') {
            const sectionId = test.qMap[i].section;
            if (sectionId != test.currentSection) continue;
        }
        
        const btn = document.createElement('button');
        btn.className = 'q-nav-btn';
        btn.textContent = i;
        btn.onclick = () => {
            showQuestion(i);
            if (window.innerWidth <= 992) toggleNavPanel();
        };
        
        updateButtonStatus(btn, i);
        grid.appendChild(btn);
    }
}

// Update button status
function updateButtonStatus(btn, num) {
    if (!test.qMap[num]) return;
    
    const id = test.qMap[num].id;
    
    btn.classList.remove('active', 'answered', 'correct', 'incorrect');
    
    if (test.answers[id] !== undefined) {
        if (test.submitted) {
            btn.classList.add(test.answers[id] === test.correct[id] ? 'correct' : 'incorrect');
        } else {
            btn.classList.add('answered');
        }
    }
    
    if (num === test.current) {
        btn.classList.add('active');
    }
}

// Show specific question
function showQuestion(num) {
    if (num < 1 || num > test.questions || !test.qMap[num]) return;
    
    test.current = num;
    const id = test.qMap[num].id;
    
    // Hide all questions
    document.querySelectorAll('.q-card').forEach(q => {
        q.style.display = 'none';
        q.classList.remove('active');
    });
    
    // Show current question
    const card = document.getElementById(\`q\${id}\`);
    if (card) {
        card.style.display = 'block';
        setTimeout(() => card.classList.add('active'), 10);
        
        // Update navigation buttons
        document.getElementById('prev-btn').disabled = num <= 1;
        document.getElementById('next-btn').disabled = num >= test.questions;
        
        // Update navigation grid
        document.querySelectorAll('.q-nav-btn').forEach((btn, index) => {
            const btnNum = parseInt(btn.textContent);
            updateButtonStatus(btn, btnNum);
        });
        
        // If test is submitted, show solution
        if (test.submitted) {
            const solution = card.querySelector('.solution');
            // Only show solution if it has content
            if (solution && solution.querySelector('.solution-content').innerHTML.trim() !== '') {
                solution.style.display = 'block';
            }
            
            // Always highlight the correct answer for all questions
            const correctOption = card.querySelector(\`.option[data-option="\${test.correct[id]}"]\`);
            if (correctOption) {
                correctOption.classList.add('correct');
            }
            
            // Mark user's selected answer if they answered
            if (test.answers[id] !== undefined) {
                const isCorrect = test.answers[id] === test.correct[id];
                const selected = card.querySelector(\`.option[data-option="\${test.answers[id]}"]\`);
                if (selected && !isCorrect) {
                    // Only mark as incorrect if it's not the correct answer (to avoid duplicate styling)
                    selected.classList.add('incorrect');
                }
            }
        }
        
        // Process MathJax
        if (typeof MathJax !== 'undefined' && MathJax.typeset) {
            MathJax.typeset([card]);
        }
    }
}

// Navigate between questions
function navigate(direction) {
    let next = test.current + direction;
    
    // Skip questions from other sections if filtering
    if (test.currentSection !== 'all') {
        while (next >= 1 && next <= test.questions) {
            if (!test.qMap[next]) {
                next += direction;
                continue;
            }
            
            const section = test.qMap[next].section;
            if (section == test.currentSection) break;
            next += direction;
        }
    }
    
    if (next >= 1 && next <= test.questions && test.qMap[next]) {
        showQuestion(next);
    }
}

// Toggle navigation panel
function toggleNavPanel() {
    const panel = document.getElementById('nav-panel');
    panel.classList.toggle('active');
    
    // Add overlay when panel is active
    if (panel.classList.contains('active')) {
        const overlay = document.createElement('div');
        overlay.className = 'nav-overlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '60px';
        overlay.style.left = '0';
        overlay.style.right = '0';
        overlay.style.bottom = '60px';
        overlay.style.background = 'rgba(0,0,0,0.5)';
        overlay.style.zIndex = '98';
        overlay.style.backdropFilter = 'blur(2px)';
        overlay.style.webkitBackdropFilter = 'blur(2px)';
        overlay.onclick = toggleNavPanel;
        document.body.appendChild(overlay);
    } else {
        const overlay = document.querySelector('.nav-overlay');
        if (overlay) overlay.remove();
    }
}

// Select an option
function selectOption(element, id, option) {
    if (test.submitted) return;
    
    test.answers[id] = option;
    
    // Remove selection from all options
    element.closest('.q-card').querySelectorAll('.option').forEach(opt => {
        opt.classList.remove('selected');
    });
    
    // Add selection to clicked option
    element.classList.add('selected');
    
    // Update navigation
    updateNavigation();
}

// Clear selection
function clearSelection(id) {
    if (test.submitted) return;
    
    delete test.answers[id];
    
    document.getElementById(\`q\${id}\`).querySelectorAll('.option').forEach(opt => {
        opt.classList.remove('selected');
    });
    
    updateNavigation();
}

// Update navigation after selection
function updateNavigation() {
    const buttons = document.querySelectorAll('.q-nav-btn');
    buttons.forEach(btn => {
        const btnNum = parseInt(btn.textContent);
        if (btnNum && test.qMap[btnNum]) {
            updateButtonStatus(btn, btnNum);
        }
    });
}

// Submit test
function submitTest() {
    if (test.submitted) return;
    
    if (!window.confirm('Are you sure you want to submit the test?')) return;
    
    test.submitted = true;
    
    let correct = 0, incorrect = 0, score = 0;
    
    for (const id in test.correct) {
        const marks = test.marks[id];
        
        if (test.answers[id] !== undefined) {
            if (test.answers[id] === test.correct[id]) {
                correct++;
                score += marks.positive;
            } else {
                incorrect++;
                score -= marks.negative;
            }
        }
    }
    
    score = Math.max(0, score);
    
    document.getElementById('score-value').textContent = score.toFixed(2);
    document.getElementById('correct-count').textContent = correct;
    document.getElementById('incorrect-count').textContent = incorrect;
    
    document.getElementById('results-modal').style.display = 'flex';
    document.getElementById('submit-test').disabled = true;
    
    updateNavigation();
    showQuestion(test.current);
}

// Close results modal
function closeResultsModal() {
    document.getElementById('results-modal').style.display = 'none';
}

// Review test
function reviewTest() {
    showQuestion(1);
    document.getElementById('results-modal').style.display = 'none';
    window.scrollTo(0, 0);
}

// Toggle theme
function toggleTheme() {
    document.body.setAttribute('data-theme', 
        document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    
    const icon = document.getElementById('theme-toggle').querySelector('i');
    icon.classList.toggle('fa-moon');
    icon.classList.toggle('fa-sun');
}

// Timer functionality
function startTimer() {
    const timer = document.getElementById('test-timer');
    let timeLeft = test.timer;
    
    const interval = setInterval(() => {
        if (test.submitted) {
            clearInterval(interval);
            return;
        }
        
        timeLeft--;
        test.timeSpent++;
        
        if (timeLeft <= 0) {
            clearInterval(interval);
            submitTest();
            return;
        }
        
        const h = Math.floor(timeLeft / 3600);
        const m = Math.floor((timeLeft % 3600) / 60);
        const s = timeLeft % 60;
        
        timer.textContent = \`\${h.toString().padStart(2, '0')}:\${m.toString().padStart(2, '0')}:\${s.toString().padStart(2, '0')}\`;
    }, 1000);
}
  `;
}

function generateModernTemplate(questions: Question[], metadata: QuizMetadata): string {
  // Shuffle questions if requested
  let questionsToGenerate = [...questions];
  if (metadata.shuffleQuestions) {
    questionsToGenerate = shuffleArray(questionsToGenerate);
  }

  // Generate questions data for JavaScript
  const questionsJson = questionsToGenerate.map((q, index) => ({
    id: q.id,
    question: q.questionText,
    options: q.options,
    correctAnswer: q.correctOptionIndex,
    explanation: q.explanation || '',
    explanationImageUrl: '',
    compText: q.compText || '',
    optionImages: q.optionImages || [],
    positiveMarks: q.positiveMarks,
    negativeMarks: q.negativeMarks
  }));

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${metadata.title}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
            min-height: 100vh;
            padding: 20px;
            animation: backgroundShift 20s ease infinite;
        }
        
        @keyframes backgroundShift {
            0%, 100% { background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%); }
            50% { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 50%, #667eea 100%); }
        }
        
        .container {
            max-width: 1000px;
            margin: 0 auto;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(20px);
            border-radius: 25px;
            box-shadow: 0 25px 50px rgba(0,0,0,0.15);
            overflow: hidden;
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        .header {
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
            color: white;
            padding: 40px;
            text-align: center;
            position: relative;
            overflow: hidden;
        }
        
        .header::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
            animation: float 6s ease-in-out infinite;
        }
        
        @keyframes float {
            0%, 100% { transform: translate(-50%, -50%) rotate(0deg); }
            50% { transform: translate(-50%, -50%) rotate(180deg); }
        }
        
        .header h1 {
            font-size: 3em;
            margin-bottom: 15px;
            font-weight: 700;
            text-shadow: 0 2px 10px rgba(0,0,0,0.2);
            position: relative;
            z-index: 1;
        }
        
        .header p {
            font-size: 1.2em;
            opacity: 0.95;
            position: relative;
            z-index: 1;
        }
        
        .timer-controls {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 20px;
            margin-top: 25px;
            position: relative;
            z-index: 1;
            flex-wrap: wrap;
        }
        
        .timer {
            background: rgba(255,255,255,0.25);
            backdrop-filter: blur(10px);
            padding: 15px 25px;
            border-radius: 15px;
            font-size: 1.4em;
            font-weight: bold;
            border: 1px solid rgba(255,255,255,0.3);
            min-width: 180px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
        }
        
        .pause-btn {
            background: rgba(255,255,255,0.2);
            border: 2px solid rgba(255,255,255,0.5);
            color: white;
            padding: 12px 20px;
            border-radius: 12px;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.3s ease;
            backdrop-filter: blur(10px);
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .pause-btn:hover {
            background: rgba(255,255,255,0.3);
            transform: translateY(-2px);
        }
        
        .pause-btn.paused {
            background: rgba(255, 193, 7, 0.8);
            border-color: #ffc107;
        }
        
        .stats-bar {
            background: rgba(255,255,255,0.15);
            backdrop-filter: blur(10px);
            padding: 10px 20px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            gap: 20px;
            font-size: 0.95em;
            font-weight: 500;
            border: 1px solid rgba(255,255,255,0.2);
        }
        
        .stat-item {
            display: flex;
            align-items: center;
            gap: 6px;
        }
        
        .timer-icon, .pause-icon {
            font-size: 1.1em;
        }
        
        .content {
            padding: 0;
            position: relative;
            display: flex;
            min-height: 600px;
        }
        
        .sidebar {
            width: 280px;
            background: linear-gradient(180deg, #f8f9fa 0%, #e9ecef 100%);
            border-right: 1px solid rgba(0,0,0,0.1);
            padding: 20px;
            overflow-y: auto;
            position: relative;
        }
        
        .main-content {
            flex: 1;
            padding: 40px;
            background: white;
        }
        
        .start-screen, .results-screen {
            text-align: center;
            padding: 40px;
        }
        
        .exam-screen {
            display: flex;
            height: 100%;
        }
        
        .question-nav {
            margin-bottom: 30px;
        }
        
        .question-nav h3 {
            color: #495057;
            margin-bottom: 15px;
            font-size: 1.1em;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .question-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(40px, 1fr));
            gap: 8px;
            margin-bottom: 20px;
        }
        
        .question-number {
            width: 40px;
            height: 40px;
            border: 2px solid #e9ecef;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            font-weight: 600;
            font-size: 0.9em;
            transition: all 0.3s ease;
            background: white;
        }
        
        .question-number:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        
        .question-number.current {
            background: linear-gradient(135deg, #007bff, #0056b3);
            color: white;
            border-color: #007bff;
            box-shadow: 0 4px 15px rgba(0,123,255,0.3);
        }
        
        .question-number.answered {
            background: linear-gradient(135deg, #28a745, #1e7e34);
            color: white;
            border-color: #28a745;
        }
        
        .question-number.visited {
            background: linear-gradient(135deg, #ffc107, #e0a800);
            color: #212529;
            border-color: #ffc107;
        }
        
        .nav-legend {
            background: rgba(255,255,255,0.8);
            padding: 15px;
            border-radius: 12px;
            margin-top: 20px;
            border: 1px solid rgba(0,0,0,0.1);
        }
        
        .legend-item {
            display: flex;
            align-items: center;
            gap: 8px;
            margin: 8px 0;
            font-size: 0.85em;
        }
        
        .legend-color {
            width: 16px;
            height: 16px;
            border-radius: 4px;
            border: 1px solid rgba(0,0,0,0.2);
        }
        
        .question-container {
            max-width: 800px;
            margin: 0 auto;
        }
        
        .start-screen h2 {
            color: #333;
            margin-bottom: 30px;
            font-size: 2.5em;
            font-weight: 700;
            background: linear-gradient(135deg, #667eea, #764ba2);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        
        .exam-info {
            background: linear-gradient(135deg, #f8f9fa, #e9ecef);
            padding: 30px;
            border-radius: 20px;
            margin: 30px 0;
            text-align: left;
            border: 1px solid rgba(0,0,0,0.1);
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        }
        
        .exam-info h3 {
            color: #495057;
            margin-bottom: 20px;
            font-size: 1.4em;
            font-weight: 600;
        }
        
        .info-item {
            margin: 15px 0;
            padding: 15px;
            background: white;
            border-radius: 12px;
            border-left: 5px solid #007bff;
            box-shadow: 0 2px 10px rgba(0,0,0,0.05);
            transition: all 0.3s ease;
        }
        
        .info-item:hover {
            transform: translateX(5px);
            box-shadow: 0 5px 20px rgba(0,0,0,0.1);
        }
        
        .pause-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            backdrop-filter: blur(10px);
            z-index: 1000;
            display: none;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            color: white;
            text-align: center;
        }
        
        .pause-overlay h2 {
            font-size: 3em;
            margin-bottom: 20px;
            animation: pulse 2s ease-in-out infinite;
        }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
        }
        
        .pause-overlay p {
            font-size: 1.2em;
            margin-bottom: 30px;
        }
        
        .question-nav {
            background: rgba(255,255,255,0.05);
            backdrop-filter: blur(20px);
            border-radius: 20px;
            padding: 20px;
            margin: 20px 0;
            border: 1px solid rgba(255,255,255,0.1);
        }
        
        .nav-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            color: white;
        }
        
        .nav-header h3 {
            font-size: 1.2em;
            font-weight: 600;
        }
        
        .question-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(45px, 1fr));
            gap: 10px;
            margin: 20px 0;
        }
        
        .question-nav-btn {
            width: 45px;
            height: 45px;
            border: 2px solid rgba(255,255,255,0.3);
            background: rgba(255,255,255,0.1);
            color: white;
            border-radius: 12px;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            backdrop-filter: blur(10px);
        }
        
        .question-nav-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        }
        
        .question-nav-btn.current {
            background: #007bff;
            border-color: #007bff;
            box-shadow: 0 0 20px rgba(0,123,255,0.5);
        }
        
        .question-nav-btn.answered {
            background: #28a745;
            border-color: #28a745;
        }
        
        .question-nav-btn.not-visited {
            background: rgba(255,255,255,0.1);
            border-color: rgba(255,255,255,0.3);
        }
        
        .legend {
            display: flex;
            justify-content: space-around;
            margin-top: 20px;
            flex-wrap: wrap;
            gap: 15px;
        }
        
        .legend-item {
            display: flex;
            align-items: center;
            gap: 8px;
            color: white;
            font-size: 0.9em;
        }
        
        .legend-color {
            width: 20px;
            height: 20px;
            border-radius: 6px;
            border: 2px solid rgba(255,255,255,0.3);
        }
        
        .legend-color.current { background: #007bff; border-color: #007bff; }
        .legend-color.answered { background: #28a745; border-color: #28a745; }
        .legend-color.not-visited { background: rgba(255,255,255,0.1); }
        
        .question-container {
            background: linear-gradient(135deg, rgba(255,255,255,0.9), rgba(248,249,250,0.9));
            backdrop-filter: blur(15px);
            padding: 35px;
            border-radius: 20px;
            margin: 30px 0;
            text-align: left;
            border: 1px solid rgba(255,255,255,0.3);
            box-shadow: 0 15px 35px rgba(0,0,0,0.1);
            position: relative;
            overflow: hidden;
        }
        
        .question-container::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
            transition: left 0.8s;
        }
        
        .question-container:hover::before {
            left: 100%;
        }
        
        .question-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 25px;
            position: relative;
            z-index: 1;
        }
        
        .question-number {
            background: linear-gradient(135deg, #007bff, #0056b3);
            color: white;
            padding: 12px 20px;
            border-radius: 25px;
            font-weight: bold;
            font-size: 1.1em;
            box-shadow: 0 5px 15px rgba(0,123,255,0.3);
            position: relative;
            z-index: 1;
        }
        
        .question-marks {
            background: rgba(40, 167, 69, 0.1);
            color: #28a745;
            padding: 8px 15px;
            border-radius: 20px;
            font-weight: 600;
            border: 2px solid rgba(40, 167, 69, 0.2);
        }
        
        .question-text {
            font-size: 1.3em;
            color: #333;
            margin: 25px 0;
            line-height: 1.7;
            position: relative;
            z-index: 1;
            font-weight: 500;
        }
        
        .comp-text {
            background: linear-gradient(135deg, #e9ecef, #f8f9fa);
            padding: 20px;
            border-radius: 15px;
            margin-bottom: 25px;
            border-left: 5px solid #6c757d;
            box-shadow: 0 5px 15px rgba(0,0,0,0.05);
            position: relative;
            z-index: 1;
        }
        
        .options {
            margin: 25px 0;
            position: relative;
            z-index: 1;
        }
        
        .option {
            background: linear-gradient(135deg, white, #f8f9fa);
            border: 2px solid rgba(0,0,0,0.1);
            border-radius: 15px;
            padding: 20px;
            margin: 15px 0;
            cursor: pointer;
            transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
            display: flex;
            align-items: center;
            position: relative;
            overflow: hidden;
            backdrop-filter: blur(10px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.08);
        }
        
        .option::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(0,123,255,0.1), transparent);
            transition: left 0.6s;
        }
        
        .option:hover::before {
            left: 100%;
        }
        
        .option:hover {
            border-color: #007bff;
            transform: translateY(-3px) scale(1.02);
            box-shadow: 0 10px 30px rgba(0,123,255,0.25);
        }
        
        .option.selected {
            border-color: #007bff;
            background: linear-gradient(135deg, #e3f2fd, #bbdefb);
            box-shadow: 0 8px 25px rgba(0,123,255,0.3);
        }
        
        .option.correct {
            border-color: #28a745;
            background: linear-gradient(135deg, #d4edda, #c3e6cb);
            box-shadow: 0 8px 25px rgba(40,167,69,0.3);
        }
        
        .option.incorrect {
            border-color: #dc3545;
            background: linear-gradient(135deg, #f8d7da, #f5c6cb);
            box-shadow: 0 8px 25px rgba(220,53,69,0.3);
        }
        
        .option-letter {
            background: linear-gradient(135deg, #6c757d, #5a6268);
            color: white;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 20px;
            font-weight: bold;
            font-size: 1.1em;
            box-shadow: 0 3px 10px rgba(0,0,0,0.2);
            position: relative;
            z-index: 1;
        }
        
        .option.selected .option-letter {
            background: linear-gradient(135deg, #007bff, #0056b3);
            box-shadow: 0 5px 15px rgba(0,123,255,0.4);
        }
        
        .option.correct .option-letter {
            background: linear-gradient(135deg, #28a745, #1e7e34);
            box-shadow: 0 5px 15px rgba(40,167,69,0.4);
        }
        
        .option.incorrect .option-letter {
            background: linear-gradient(135deg, #dc3545, #c82333);
            box-shadow: 0 5px 15px rgba(220,53,69,0.4);
        }
        
        .option-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        
        .option-image {
            max-width: 120px;
            max-height: 120px;
            object-fit: contain;
            border-radius: 5px;
            border: 1px solid #ddd;
        }
        
        .explanation {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 10px;
            padding: 15px;
            margin: 15px 0;
            border-left: 4px solid #ffc107;
        }
        
        .explanation h4 {
            color: #856404;
            margin-bottom: 10px;
        }
        
        .explanation-image {
            max-width: 100%;
            height: auto;
            border-radius: 5px;
            margin-top: 10px;
        }
        
        .navigation {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin: 40px 0;
            flex-wrap: wrap;
            gap: 15px;
        }
        
        .nav-group {
            display: flex;
            gap: 15px;
            align-items: center;
        }
        
        .btn {
            background: linear-gradient(135deg, #007bff, #0056b3);
            color: white;
            border: none;
            padding: 15px 30px;
            border-radius: 25px;
            cursor: pointer;
            font-size: 1.1em;
            font-weight: 600;
            transition: all 0.3s ease;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            box-shadow: 0 5px 15px rgba(0,123,255,0.3);
            position: relative;
            overflow: hidden;
        }
        
        .btn::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
            transition: left 0.6s;
        }
        
        .btn:hover::before {
            left: 100%;
        }
        
        .btn-submit {
            background: linear-gradient(135deg, #28a745, #1e7e34);
            box-shadow: 0 5px 15px rgba(40,167,69,0.3);
        }
        
        .btn-pause {
            background: linear-gradient(135deg, #ffc107, #e0a800);
            color: #333;
            box-shadow: 0 5px 15px rgba(255,193,7,0.3);
        }
        
        .btn-secondary {
            background: linear-gradient(135deg, #6c757d, #5a6268);
            box-shadow: 0 5px 15px rgba(108,117,125,0.3);
        }
        
        .floating-controls {
            position: fixed;
            bottom: 30px;
            right: 30px;
            display: flex;
            flex-direction: column;
            gap: 15px;
            z-index: 100;
        }
        
        .floating-btn {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            border: none;
            cursor: pointer;
            font-size: 1.2em;
            color: white;
            box-shadow: 0 5px 20px rgba(0,0,0,0.3);
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .floating-btn:hover {
            transform: translateY(-3px) scale(1.1);
        }
        
        .submit-floating {
            background: linear-gradient(135deg, #28a745, #1e7e34);
        }
        
        .pause-floating {
            background: linear-gradient(135deg, #ffc107, #e0a800);
        }
        
        .progress-floating {
            background: linear-gradient(135deg, #17a2b8, #138496);
        }
        
        .btn:hover {
            background: #0056b3;
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0,123,255,0.3);
        }
        
        .btn:disabled {
            background: #6c757d;
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }
        
        .btn-success {
            background: #28a745;
        }
        
        .btn-success:hover {
            background: #1e7e34;
        }
        
        .btn-secondary {
            background: #6c757d;
        }
        
        .btn-secondary:hover {
            background: #545b62;
        }
        
        .results-summary {
            background: #f8f9fa;
            padding: 25px;
            border-radius: 10px;
            margin: 20px 0;
        }
        
        .score {
            font-size: 3em;
            font-weight: bold;
            color: #007bff;
            margin: 20px 0;
        }
        
        .score.excellent { color: #28a745; }
        .score.good { color: #17a2b8; }
        .score.average { color: #ffc107; }
        .score.poor { color: #dc3545; }
        
        .hidden {
            display: none;
        }
        
        .exam-header {
            display: flex;
            flex-direction: column;
            gap: 15px;
            margin-bottom: 20px;
        }
        
        .exam-controls {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .progress-bar {
            background: #e9ecef;
            height: 8px;
            border-radius: 4px;
            overflow: hidden;
            flex: 1;
        }
        
        .progress-fill {
            background: linear-gradient(90deg, #007bff, #0056b3);
            height: 100%;
            transition: width 0.3s ease;
        }
        
        .question-grid {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 20px;
            border: 1px solid #dee2e6;
        }
        
        .grid-container {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(50px, 1fr));
            gap: 8px;
            margin-top: 10px;
        }
        
        .question-btn {
            width: 50px;
            height: 50px;
            border: 2px solid #e9ecef;
            background: white;
            border-radius: 8px;
            cursor: pointer;
            font-weight: bold;
            font-size: 14px;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .question-btn:hover {
            border-color: #007bff;
            transform: translateY(-2px);
            box-shadow: 0 3px 10px rgba(0,123,255,0.2);
        }
        
        .question-btn.current {
            background: #007bff;
            color: white;
            border-color: #007bff;
        }
        
        .question-btn.answered {
            background: #28a745;
            color: white;
            border-color: #28a745;
        }
        
        .question-btn.unanswered {
            background: #ffc107;
            color: #212529;
            border-color: #ffc107;
        }
        
        .navigation {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin: 30px 0;
            gap: 20px;
        }
        
        .nav-center {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
        }
        
        .answered-counter {
            background: #e3f2fd;
            padding: 10px 15px;
            border-radius: 20px;
            margin-bottom: 15px;
            text-align: center;
            border: 1px solid #bbdefb;
        }
        
        .legend {
            display: flex;
            gap: 15px;
            justify-content: center;
            margin-top: 10px;
            flex-wrap: wrap;
        }
        
        .legend-item {
            display: flex;
            align-items: center;
            gap: 5px;
            font-size: 12px;
        }
        
        .legend-color {
            width: 16px;
            height: 16px;
            border-radius: 4px;
        }
        
        @media (max-width: 768px) {
            .container {
                margin: 10px;
                border-radius: 10px;
            }
            
            .header {
                padding: 20px;
            }
            
            .header h1 {
                font-size: 2em;
            }
            
            .content {
                padding: 0;
            }
            
            .exam-screen {
                flex-direction: column;
                height: auto;
            }
            
            .sidebar {
                width: 100%;
                border-right: none;
                border-bottom: 1px solid rgba(0,0,0,0.1);
                padding: 15px;
                order: 2;
            }
            
            .main-content {
                order: 1;
                padding: 20px;
            }
            
            .navigation {
                flex-direction: column;
                gap: 10px;
            }
            
            .btn {
                width: 100%;
                text-align: center;
            }
            
            .question-grid {
                grid-template-columns: repeat(auto-fit, minmax(35px, 1fr));
                gap: 6px;
            }
            
            .question-number {
                width: 35px;
                height: 35px;
                font-size: 0.8em;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${metadata.title}</h1>
            <p>${metadata.description}</p>
            ${metadata.timerDuration > 0 ? `
            <div class="timer-controls hidden" id="timer-controls">
                <div class="timer" id="timer">
                    <i class="fas fa-clock timer-icon"></i>
                    <span id="time-display">${metadata.timerDuration}:00</span>
                </div>
                <button class="pause-btn" id="pause-btn" onclick="togglePause()">
                    <i class="fas fa-pause pause-icon"></i>
                    <span id="pause-text">Pause</span>
                </button>
                <div class="stats-bar">
                    <div class="stat-item">
                        <i class="fas fa-clipboard-list"></i>
                        <span id="attempted-count">0/${questionsToGenerate.length}</span>
                    </div>
                    <div class="stat-item">
                        <i class="fas fa-eye"></i>
                        <span id="visited-count">0/${questionsToGenerate.length}</span>
                    </div>
                </div>
            </div>` : ''}
        </div>
        
        <!-- Pause Overlay -->
        <div class="pause-overlay" id="pause-overlay">
            <h2><i class="fas fa-pause"></i> Test Paused</h2>
            <p>Click Resume to continue your test</p>
            <button class="btn" onclick="togglePause()">
                <i class="fas fa-play"></i> Resume Test
            </button>
        </div>
        
        <div class="content">
            <!-- Start Screen -->
            <div class="start-screen" id="start-screen">
                <h2>Welcome to the Exam</h2>
                <div class="exam-info">
                    <h3>Exam Information</h3>
                    <div class="info-item">
                        <strong>Total Questions:</strong> ${questionsToGenerate.length}
                    </div>
                    ${metadata.timerDuration > 0 ? `
                    <div class="info-item">
                        <strong>Time Limit:</strong> ${metadata.timerDuration} minutes
                    </div>` : ''}
                    <div class="info-item">
                        <strong>Marking Scheme:</strong> +${metadata.defaultPositiveMarks} for correct, -${metadata.defaultNegativeMarks} for incorrect
                    </div>
                    <div class="info-item">
                        <strong>Instructions:</strong> 
                        <ul style="margin-top: 10px; padding-left: 20px;">
                            <li>Read each question carefully</li>
                            <li>Select the best answer for each question</li>
                            <li>You can navigate between questions</li>
                            <li>Submit your exam before time runs out</li>
                        </ul>
                    </div>
                </div>
                <button class="btn" onclick="startExam()">Start Exam</button>
            </div>
            
            <!-- Exam Screen -->
            <div class="exam-screen hidden" id="exam-screen">
                <!-- Sidebar with Question Navigation -->
                <div class="sidebar">
                    <div class="question-nav">
                        <h3>
                            <i class="fas fa-list"></i>
                            Questions
                        </h3>
                        <div class="question-grid" id="question-nav-grid">
                            <!-- Navigation buttons will be generated by JS -->
                        </div>
                    </div>
                    
                    <div class="nav-legend">
                        <h4 style="margin-bottom: 10px; color: #495057; font-size: 0.9em;">Legend</h4>
                        <div class="legend-item">
                            <div class="legend-color" style="background: linear-gradient(135deg, #007bff, #0056b3);"></div>
                            <span>Current</span>
                        </div>
                        <div class="legend-item">
                            <div class="legend-color" style="background: linear-gradient(135deg, #28a745, #1e7e34);"></div>
                            <span>Answered</span>
                        </div>
                        <div class="legend-item">
                            <div class="legend-color" style="background: linear-gradient(135deg, #ffc107, #e0a800);"></div>
                            <span>Visited</span>
                        </div>
                        <div class="legend-item">
                            <div class="legend-color" style="background: #f8f9fa; border: 2px solid #6c757d;"></div>
                            <span>Not Visited</span>
                        </div>
                    </div>
                </div>

                <!-- Main Content Area -->
                <div class="main-content">
                    <div class="question-container" id="question-container">
                        <!-- Question content will be loaded here -->
                    </div>

                    <div class="navigation">
                        <button class="btn btn-secondary" id="prev-btn" onclick="previousQuestion()" disabled>Previous</button>
                        
                        <div class="nav-center">
                            <span id="question-info">Question 1 of ${questionsToGenerate.length}</span>
                        </div>
                        
                        <button class="btn" id="next-btn" onclick="nextQuestion()">Next</button>
                    </div>

                    <div class="navigation" style="justify-content: center;">
                        <button class="btn btn-submit" onclick="submitExam()">
                            <i class="fas fa-check"></i> Submit Exam
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- Results Screen -->
            <div class="results-screen hidden" id="results-screen">
                <h2>Exam Results</h2>
                <div class="results-summary">
                    <div class="score" id="final-score">0%</div>
                    <div id="score-details"></div>
                </div>
                <div id="detailed-results"></div>
                <button class="btn" onclick="restartExam()">Retake Exam</button>
            </div>
        </div>
    </div>

    <script>
        const questions = ${JSON.stringify(questionsJson)};
        let currentQuestion = 0;
        let userAnswers = {};
        let visitedQuestions = new Set();
        let timeRemaining = ${metadata.timerDuration * 60}; // Convert to seconds
        let timerInterval;
        let examStarted = false;
        let isPaused = false;
        let autoSaveInterval;

        function startExam() {
            document.getElementById('start-screen').classList.add('hidden');
            document.getElementById('exam-screen').classList.remove('hidden');
            ${metadata.timerDuration > 0 ? `
            document.getElementById('timer-controls').classList.remove('hidden');
            startTimer();` : ''}
            examStarted = true;
            generateQuestionGrid();
            loadQuestion();
            setupKeyboardNavigation();
            autoSaveAnswers();
        }

        function togglePause() {
            isPaused = !isPaused;
            const overlay = document.getElementById('pause-overlay');
            const pauseBtn = document.getElementById('pause-btn');
            const pauseIcon = pauseBtn.querySelector('.pause-icon');
            const pauseText = document.getElementById('pause-text');
            
            if (isPaused) {
                overlay.style.display = 'flex';
                pauseBtn.classList.add('paused');
                pauseIcon.className = 'fas fa-play pause-icon';
                pauseText.textContent = 'Resume';
                ${metadata.timerDuration > 0 ? 'clearInterval(timerInterval);' : ''}
            } else {
                overlay.style.display = 'none';
                pauseBtn.classList.remove('paused');
                pauseIcon.className = 'fas fa-pause pause-icon';
                pauseText.textContent = 'Pause';
                ${metadata.timerDuration > 0 ? 'if (timeRemaining > 0) startTimer();' : ''}
            }
        }

        function setupKeyboardNavigation() {
            document.addEventListener('keydown', (e) => {
                if (isPaused) return;
                
                if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    previousQuestion();
                } else if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    nextQuestion();
                } else if (e.key >= '1' && e.key <= '4') {
                    e.preventDefault();
                    const optionIndex = parseInt(e.key) - 1;
                    if (optionIndex < questions[currentQuestion].options.length) {
                        selectAnswer(optionIndex);
                    }
                } else if (e.ctrlKey && e.key === 'Enter') {
                    e.preventDefault();
                    if (confirm('Are you sure you want to submit the test?')) {
                        submitExam();
                    }
                }
            });
        }

        function autoSaveAnswers() {
            autoSaveInterval = setInterval(() => {
                if (!isPaused) {
                    // Auto-save logic here (could integrate with localStorage)
                    console.log('Auto-saved answers:', userAnswers);
                }
            }, 5000);
        }

        ${metadata.timerDuration > 0 ? `
        function startTimer() {
            timerInterval = setInterval(() => {
                timeRemaining--;
                updateTimerDisplay();
                
                if (timeRemaining <= 0) {
                    clearInterval(timerInterval);
                    submitExam();
                }
            }, 1000);
        }

        function updateTimerDisplay() {
            const minutes = Math.floor(timeRemaining / 60);
            const seconds = timeRemaining % 60;
            document.getElementById('time-display').textContent = 
                minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
        }` : ''}

        function generateQuestionGrid() {
            const navGrid = document.getElementById('question-nav-grid');
            
            // Generate question navigation buttons
            for (let i = 0; i < questions.length; i++) {
                const btn = document.createElement('button');
                btn.className = 'question-number';
                btn.textContent = i + 1;
                btn.onclick = () => jumpToQuestion(i);
                btn.id = 'q-btn-' + i;
                navGrid.appendChild(btn);
            }
            
            // Add legend
            const legend = document.createElement('div');
            legend.className = 'legend';
            legend.innerHTML = \`
                <div class="legend-item">
                    <div class="legend-color" style="background: #007bff;"></div>
                    <span>Current</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background: #28a745;"></div>
                    <span>Answered</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background: #ffc107;"></div>
                    <span>Unanswered</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background: #f8f9fa; border: 2px solid #6c757d;"></div>
                    <span>Not Visited</span>
                </div>
            \`;
            questionGrid.appendChild(legend);
            
            updateQuestionGrid();
        }

        function jumpToQuestion(index) {
            currentQuestion = index;
            loadQuestion();
            updateQuestionGrid();
        }

        function updateQuestionGrid() {
            for (let i = 0; i < questions.length; i++) {
                const btn = document.getElementById('q-btn-' + i);
                if (btn) {
                    btn.classList.remove('current', 'answered', 'visited');
                    
                    if (i === currentQuestion) {
                        btn.classList.add('current');
                    } else if (userAnswers[i] !== undefined) {
                        btn.classList.add('answered');
                    } else if (visitedQuestions.has(i)) {
                        btn.classList.add('visited');
                    }
                }
            }
        }

        function loadQuestion() {
            const question = questions[currentQuestion];
            const container = document.getElementById('question-container');
            
            // Mark as visited
            visitedQuestions.add(currentQuestion);
            updateStats();
            
            let explanationHtml = '';
            if (question.explanation) {
                explanationHtml = \`
                    <div class="explanation hidden" id="explanation-\${currentQuestion}">
                        <h4><i class="fas fa-lightbulb"></i> Explanation:</h4>
                        <p>\${question.explanation}</p>
                        \${question.explanationImageUrl ? \`<img src="\${question.explanationImageUrl}" alt="Explanation" class="explanation-image">\` : ''}
                    </div>
                \`;
            }
            
            container.innerHTML = \`
                <div class="question-header">
                    <div class="question-number">Question \${currentQuestion + 1}</div>
                    <div class="question-marks">+\${question.positiveMarks}, -\${question.negativeMarks}</div>
                </div>
                \${question.compText ? \`<div class="comp-text"><strong>Passage:</strong> \${question.compText}</div>\` : ''}
                <div class="question-text">\${question.question}</div>
                <div class="options">
                    \${question.options.map((option, index) => \`
                        <div class="option" onclick="selectAnswer(\${index})" id="option-\${index}">
                            <div class="option-letter">\${String.fromCharCode(65 + index)}</div>
                            <div class="option-content">
                                \${question.optionImages && question.optionImages[index] ? \`<img src="\${question.optionImages[index]}" alt="Option \${index + 1}" class="option-image">\` : ''}
                                <span>\${option}</span>
                            </div>
                        </div>
                    \`).join('')}
                </div>
                \${explanationHtml}
            \`;
            
            // Restore previous answer if exists
            if (userAnswers[currentQuestion] !== undefined) {
                document.getElementById(\`option-\${userAnswers[currentQuestion]}\`).classList.add('selected');
            }
            
            updateNavigation();
            updateProgress();
            updateQuestionGrid();
        }

        function updateStats() {
            const attemptedCount = Object.keys(userAnswers).length;
            const visitedCount = visitedQuestions.size;
            
            document.getElementById('attempted-count').textContent = \`\${attemptedCount}/\${questions.length}\`;
            document.getElementById('visited-count').textContent = \`\${visitedCount}/\${questions.length}\`;
        }

        function selectAnswer(optionIndex) {
            // Remove previous selection
            document.querySelectorAll('.option').forEach(opt => opt.classList.remove('selected'));
            
            // Add selection to clicked option
            document.getElementById(\`option-\${optionIndex}\`).classList.add('selected');
            
            // Store answer
            userAnswers[currentQuestion] = optionIndex;
            
            // Save to localStorage
            localStorage.setItem('quiz_answers', JSON.stringify(userAnswers));
            
            updateNavigation();
            updateQuestionGrid();
            updateStats();
        }

        function nextQuestion() {
            if (currentQuestion < questions.length - 1) {
                currentQuestion++;
                loadQuestion();
            }
        }

        function previousQuestion() {
            if (currentQuestion > 0) {
                currentQuestion--;
                loadQuestion();
            }
        }

        function updateNavigation() {
            const prevBtn = document.getElementById('prev-btn');
            const nextBtn = document.getElementById('next-btn');
            const questionInfo = document.getElementById('question-info');
            
            prevBtn.disabled = currentQuestion === 0;
            nextBtn.disabled = currentQuestion === questions.length - 1;
            
            questionInfo.textContent = \`Question \${currentQuestion + 1} of \${questions.length}\`;
        }

        function updateProgress() {
            const progress = ((currentQuestion + 1) / questions.length) * 100;
            document.getElementById('progress-fill').style.width = progress + '%';
        }

        function submitExam() {
            const answered = Object.keys(userAnswers).length;
            const total = questions.length;
            
            if (answered < total) {
                const unanswered = total - answered;
                if (!confirm(\`You have \${unanswered} unanswered question(s). Are you sure you want to submit?\`)) {
                    return;
                }
            }
            
            ${metadata.timerDuration > 0 ? 'clearInterval(timerInterval);' : ''}
            calculateResults();
            showResults();
            localStorage.removeItem('quiz_answers');
        }

        function calculateResults() {
            let correct = 0;
            let score = 0;
            const totalQuestions = questions.length;
            
            for (let i = 0; i < totalQuestions; i++) {
                if (userAnswers[i] !== undefined) {
                    if (userAnswers[i] === questions[i].correctAnswer) {
                        correct++;
                        score += questions[i].positiveMarks;
                    } else {
                        score -= questions[i].negativeMarks;
                    }
                }
            }
            
            score = Math.max(0, score);
            const maxScore = questions.reduce((sum, q) => sum + q.positiveMarks, 0);
            const percentage = Math.round((score / maxScore) * 100);
            
            // Update score display
            const scoreElement = document.getElementById('final-score');
            scoreElement.textContent = percentage + '%';
            
            // Add score class for styling
            if (percentage >= 90) scoreElement.className = 'score excellent';
            else if (percentage >= 75) scoreElement.className = 'score good';
            else if (percentage >= 60) scoreElement.className = 'score average';
            else scoreElement.className = 'score poor';
            
            // Update score details
            document.getElementById('score-details').innerHTML = \`
                <p><strong>Correct Answers:</strong> \${correct} out of \${totalQuestions}</p>
                <p><strong>Score:</strong> \${score} out of \${maxScore} marks</p>
                <p><strong>Percentage:</strong> \${percentage}%</p>
                <p><strong>Grade:</strong> \${getGrade(percentage)}</p>
            \`;
            
            // Generate detailed results
            generateDetailedResults();
        }

        function getGrade(percentage) {
            if (percentage >= 90) return 'A+';
            if (percentage >= 80) return 'A';
            if (percentage >= 70) return 'B';
            if (percentage >= 60) return 'C';
            if (percentage >= 50) return 'D';
            return 'F';
        }

        function generateDetailedResults() {
            const detailedResults = document.getElementById('detailed-results');
            let html = '<h3>Detailed Review</h3>';
            
            questions.forEach((question, index) => {
                const userAnswer = userAnswers[index];
                const isCorrect = userAnswer === question.correctAnswer;
                
                html += \`
                    <div class="question-container">
                        <div class="question-header">
                            <div class="question-number">Question \${index + 1}</div>
                            <div style="color: \${isCorrect ? '#28a745' : '#dc3545'}; font-weight: bold;">
                                \${isCorrect ? '✓ Correct' : '✗ Incorrect'}
                            </div>
                        </div>
                        \${question.compText ? \`<div class="comp-text">\${question.compText}</div>\` : ''}
                        <div class="question-text">\${question.question}</div>
                        <div class="options">
                            \${question.options.map((option, optIndex) => {
                                let className = 'option';
                                if (optIndex === question.correctAnswer) className += ' correct';
                                else if (optIndex === userAnswer && userAnswer !== question.correctAnswer) className += ' incorrect';
                                
                                return \`
                                    <div class="\${className}">
                                        <div class="option-letter">\${String.fromCharCode(65 + optIndex)}</div>
                                        <div class="option-content">
                                            \${question.optionImages && question.optionImages[optIndex] ? \`<img src="\${question.optionImages[optIndex]}" alt="Option \${optIndex + 1}" class="option-image">\` : ''}
                                            <span>\${option}\${optIndex === userAnswer ? ' (Your Answer)' : ''}\${optIndex === question.correctAnswer ? ' (Correct Answer)' : ''}</span>
                                        </div>
                                    </div>
                                \`;
                            }).join('')}
                        </div>
                        \${question.explanation ? \`
                            <div class="explanation">
                                <h4>Explanation:</h4>
                                <p>\${question.explanation}</p>
                            </div>
                        \` : ''}
                    </div>
                \`;
            });
            
            detailedResults.innerHTML = html;
        }

        function showResults() {
            document.getElementById('exam-screen').classList.add('hidden');
            document.getElementById('results-screen').classList.remove('hidden');
        }

        function restartExam() {
            currentQuestion = 0;
            userAnswers = {};
            timeRemaining = ${metadata.timerDuration * 60};
            examStarted = false;
            
            document.getElementById('results-screen').classList.add('hidden');
            document.getElementById('start-screen').classList.remove('hidden');
            ${metadata.timerDuration > 0 ? `document.getElementById('timer').classList.add('hidden');` : ''}
            localStorage.removeItem('quiz_answers');
        }

        function setupKeyboardNavigation() {
            document.addEventListener('keydown', function(event) {
                if (!examStarted) return;
                
                switch(event.key) {
                    case 'ArrowLeft':
                        if (currentQuestion > 0) previousQuestion();
                        break;
                    case 'ArrowRight':
                        if (currentQuestion < questions.length - 1) nextQuestion();
                        break;
                    case '1':
                    case '2':
                    case '3':
                    case '4':
                        const optionIndex = parseInt(event.key) - 1;
                        if (optionIndex < questions[currentQuestion].options.length) {
                            selectAnswer(optionIndex);
                        }
                        break;
                    case 'Enter':
                        if (event.ctrlKey) submitExam();
                        break;
                }
            });
        }

        function autoSaveAnswers() {
            setInterval(() => {
                if (examStarted && !document.getElementById('results-screen').classList.contains('hidden')) return;
                localStorage.setItem('quiz_answers', JSON.stringify({
                    userAnswers: userAnswers,
                    currentQuestion: currentQuestion,
                    timeRemaining: timeRemaining
                }));
            }, 5000); // Auto-save every 5 seconds
        }

        function loadSavedAnswers() {
            const saved = localStorage.getItem('quiz_answers');
            if (saved) {
                try {
                    const data = JSON.parse(saved);
                    userAnswers = data.userAnswers || {};
                    currentQuestion = data.currentQuestion || 0;
                    if (data.timeRemaining && data.timeRemaining < timeRemaining) {
                        timeRemaining = data.timeRemaining;
                    }
                } catch (e) {
                    console.log('Could not load saved answers');
                }
            }
        }

        // Load saved answers on page load
        window.addEventListener('load', loadSavedAnswers);
    </script>
</body>
</html>`;
}