window.MathJax = {
    tex: {
        inlineMath: [['$', '$'], ['\\(', '\\)']],
        displayMath: [['$$', '$$'], ['\\[', '\\]']],
        processEscapes: true
    },
    options: {
        skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre']
    }
};

window.questions = [];
window.currentPage = 1;
window.companies = new Set();
window.solvedProblems = new Set(JSON.parse(localStorage.getItem('solvedProblems') || '[]'));
let activeTimers = {};

const timerIconSVG = `<svg class="timer-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`;


function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function toggleSolved(problemId, checkbox) {
    const cardElement = checkbox.closest('.problem-card');
    if (!cardElement) return;

    const timerDisplayEl = cardElement.querySelector('.problem-timer-display');
    const solveTimeEl = cardElement.querySelector('.problem-solve-time');
    const startBtn = cardElement.querySelector('.start-timer-btn');
    const stopBtn = cardElement.querySelector('.stop-timer-btn');
    const resetBtn = cardElement.querySelector('.reset-timer-btn');

    if (checkbox.checked) {
        window.solvedProblems.add(problemId);

        // Clear Active Timer if it exists
        if (activeTimers[problemId]) {
            clearInterval(activeTimers[problemId]);
            delete activeTimers[problemId];
        }

        // Calculate and Store Solve Time
        const pausedTimeKey = 'pausedTime_' + problemId;
        const pausedTime = localStorage.getItem(pausedTimeKey);
        const startTimeKey = 'startTime_' + problemId;
        const startTime = localStorage.getItem(startTimeKey);
        let solveTimeMs = 0;

        if (pausedTime) {
            solveTimeMs = parseInt(pausedTime, 10);
            localStorage.removeItem(pausedTimeKey); // Clear paused time
            localStorage.removeItem(startTimeKey); // Also clear any original start time, as pausedTime is the final elapsed time
        } else if (startTime) {
            solveTimeMs = Date.now() - parseInt(startTime, 10);
            localStorage.removeItem(startTimeKey); // Clear start time
        }

        if (solveTimeMs > 0) {
            localStorage.setItem('solveTime_' + problemId, solveTimeMs.toString());
            if (solveTimeEl) solveTimeEl.textContent = `Solved in: ${formatTime(solveTimeMs)}`;
            if (timerDisplayEl) timerDisplayEl.style.display = 'none';
        } else {
            // No timer activity or already reset, or time is zero
            if (solveTimeEl) solveTimeEl.textContent = 'Solved (no time recorded)';
            if (timerDisplayEl) timerDisplayEl.style.display = 'none'; // Hide timer if solved
            // Ensure solveTime_ is removed if it was 0 or not set, to prevent issues with avg calculation
            localStorage.removeItem('solveTime_' + problemId); 
        }
        
        // Update Button States
        if (startBtn) startBtn.disabled = true;
        if (stopBtn) stopBtn.disabled = true;
        if (resetBtn) resetBtn.disabled = true;


        // Trigger confetti effect
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.8 }, // Start from near the checkbox
            colors: ['#4ade80', '#2563eb', '#fbbf24'], // Use our theme colors
            disableForReducedMotion: true // Accessibility consideration
        });
        
        setTimeout(() => {
            confetti({
                particleCount: 50,
                spread: 50,
                origin: { y: 0.8 },
                colors: ['#4ade80', '#2563eb', '#fbbf24'],
                disableForReducedMotion: true
            });
        }, 150);

    } else { // Marking as Unsolved
        window.solvedProblems.delete(problemId);

        // Clear Active Timer
        if (activeTimers[problemId]) {
            clearInterval(activeTimers[problemId]);
            delete activeTimers[problemId];
        }

        // Remove Timer Data
        localStorage.removeItem('solveTime_' + problemId);
        localStorage.removeItem('startTime_' + problemId);

        // Update UI on Card
        if (solveTimeEl) solveTimeEl.textContent = '';
        if (timerDisplayEl) {
            timerDisplayEl.textContent = 'Timer: 0s';
            timerDisplayEl.style.display = 'block'; // Or 'flex' if that's its default
        }

        // Update Button States
        if (startBtn) startBtn.disabled = false;
        if (stopBtn) stopBtn.disabled = true;
        if (resetBtn) resetBtn.disabled = false; // Reset should be enabled to allow clearing any implicit start time
    }

    localStorage.setItem('solvedProblems', JSON.stringify([...window.solvedProblems]));
    updateSolvedStats();
}

function updateSolvedStats() {
    const statsContainer = document.getElementById('solved-stats');
    const solvedByDifficulty = {};
    const totalProblems = {};
    
    // Count total problems by difficulty
    window.questions.forEach(problem => {
        const difficulty = problem.Difficulty.toLowerCase();
        totalProblems[difficulty] = (totalProblems[difficulty] || 0) + 1;
    });
    
    // Count solved problems by difficulty
    window.questions.forEach(problem => {
        if (window.solvedProblems.has(problem.url)) {
            const difficulty = problem.Difficulty.toLowerCase();
            solvedByDifficulty[difficulty] = (solvedByDifficulty[difficulty] || 0) + 1;
        }
    });
    
    // Update stats display
    statsContainer.innerHTML = Object.keys(totalProblems)
        .sort()
        .map(difficulty => `
            <div class="stat-item">
                ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}: 
                ${solvedByDifficulty[difficulty] || 0}/${totalProblems[difficulty]}
            </div>
        `)
        .join('');

    // Calculate and display average solve time
    let totalSolveTime = 0;
    let solvedProblemsCount = 0;

    window.questions.forEach(problem => {
        const solveTime = localStorage.getItem('solveTime_' + problem.url);
        if (solveTime) {
            const solveTimeMs = parseInt(solveTime, 10);
            if (!isNaN(solveTimeMs)) {
                totalSolveTime += solveTimeMs;
                solvedProblemsCount++;
            }
        }
    });

    const averageTimeDisplay = document.getElementById('average-solve-time');
    if (averageTimeDisplay) {
        if (solvedProblemsCount > 0) {
            const averageTime = totalSolveTime / solvedProblemsCount;

            const seconds = Math.floor((averageTime / 1000) % 60);
            const minutes = Math.floor((averageTime / (1000 * 60)) % 60);
            const hours = Math.floor((averageTime / (1000 * 60 * 60)) % 24);

            let timeString = "Avg. Time: ";
            if (hours > 0) {
                timeString += `${hours}h ${minutes}m ${seconds}s`;
            } else if (minutes > 0) {
                timeString += `${minutes}m ${seconds}s`;
            } else {
                timeString += `${seconds}s`;
            }
            averageTimeDisplay.innerHTML = `<div class="stat-item">${timeString}</div>`;
        } else {
            averageTimeDisplay.innerHTML = `<div class="stat-item">Avg. Time: N/A</div>`;
        }
    }
}

function initializeSolvedFilter() {
    const solvedFilter = document.getElementById('solved-filter');
    
    solvedFilter.addEventListener('click', (e) => {
        const filterTag = e.target.closest('.solved-filter-tag');
        if (!filterTag) return;

        document.querySelectorAll('.solved-filter-tag').forEach(tag => {
            tag.classList.remove('active');
        });
        filterTag.classList.add('active');
        
        window.currentPage = 1;
        filterProblems();
    });
}

async function loadQuestions() {
    try {
        let response = await fetch('questions.json.gz');
        if (response.ok) {
            const compressedData = await response.arrayBuffer();
            const compressed = new Uint8Array(compressedData);
            const decompressed = pako.inflate(compressed);
            const textDecoder = new TextDecoder();
            const jsonString = textDecoder.decode(decompressed);
            window.questions = JSON.parse(jsonString);
        } else {
            response = await fetch('questions.json');
            if (!response.ok) {
                throw new Error('Failed to load questions');
            }
            window.questions = await response.json();
        }

        window.companies = new Set();
        window.questions.forEach(question => {
            let companies;
            try {
                companies = typeof question.Companies === 'string' 
                    ? JSON.parse(question.Companies.replace(/'/g, '"')) 
                    : question.Companies;
                
                if (Array.isArray(companies)) {
                    companies.forEach(company => {
                        if (company && company !== '') {
                            window.companies.add(company);
                        }
                    });
                }
            } catch (error) {
                console.error('Error parsing companies for question:', question);
            }
        });

        // Populate company filter
        populateCompanyFilter();
        
        await filterProblems();
    } catch (error) {
        console.error('Error loading questions:', error);
        document.getElementById('problems').innerHTML = 
            '<div class="loading">Error loading problems. Please try again later.</div>';
    }
}

function populateCompanyFilter() {
    const companiesList = document.getElementById('companies-list');
    companiesList.innerHTML = `
        <button class="company-tag all-companies active" data-company="all">
            All Companies
            <span class="remove-company">×</span>
        </button>
    `;
    
    // Sort companies alphabetically
    const sortedCompanies = Array.from(window.companies).sort();
    
    sortedCompanies.forEach(company => {
        if (company && company.trim()) {
            const button = document.createElement('button');
            button.className = 'company-tag';
            button.setAttribute('data-company', company);
            button.innerHTML = `
                ${company}
                <span class="remove-company">×</span>
            `;
            companiesList.appendChild(button);
        }
    });

    // Add click handlers
    companiesList.addEventListener('click', (e) => {
        const companyTag = e.target.closest('.company-tag');
        if (!companyTag) return;

        const company = companyTag.getAttribute('data-company');
        
        if (company === 'all') {
            // Deactivate all other companies
            document.querySelectorAll('.company-tag').forEach(tag => {
                tag.classList.remove('active');
            });
            companyTag.classList.add('active');
        } else {
            // Deactivate "All Companies" if another company is selected
            document.querySelector('.all-companies').classList.remove('active');
            companyTag.classList.toggle('active');
            
            // If no companies are selected, activate "All Companies"
            const activeCompanies = document.querySelectorAll('.company-tag.active:not(.all-companies)');
            if (activeCompanies.length === 0) {
                document.querySelector('.all-companies').classList.add('active');
            }
        }
        
        window.currentPage = 1;
        filterProblems();
    });
}

function initializeCompanySearch() {
    const searchToggle = document.getElementById('search-toggle');
    const searchContainer = document.getElementById('company-search-container');
    const searchInput = document.getElementById('company-search');
    const companiesList = document.getElementById('companies-list');
    
    // Toggle search visibility
    searchToggle.addEventListener('click', () => {
        searchContainer.classList.toggle('visible');
        if (searchContainer.classList.contains('visible')) {
            searchInput.focus();
        } else {
            searchInput.value = '';
            // Reset company visibility
            companiesList.querySelectorAll('.company-tag').forEach(tag => {
                tag.style.display = '';
            });
        }
    });

    // Handle search functionality
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const companyTags = companiesList.querySelectorAll('.company-tag:not(.all-companies)');
        
        companyTags.forEach(tag => {
            const companyName = tag.getAttribute('data-company').toLowerCase();
            if (searchTerm === '') {
                tag.style.display = '';
            } else {
                tag.style.display = companyName.includes(searchTerm) ? '' : 'none';
            }
        });
    });
}

function initializeDifficultyFilter() {
    const difficultiesList = document.getElementById('difficulties-list');
    
    difficultiesList.addEventListener('click', (e) => {
        const difficultyTag = e.target.closest('.difficulty-tag');
        if (!difficultyTag) return;

        const difficulty = difficultyTag.getAttribute('data-difficulty');
        
        if (difficulty === 'all') {
            // Deactivate all other difficulties
            document.querySelectorAll('.difficulty-tag').forEach(tag => {
                tag.classList.remove('active');
            });
            difficultyTag.classList.add('active');
        } else {
            // Deactivate "All Difficulties" if another difficulty is selected
            document.querySelector('.difficulty-tag[data-difficulty="all"]').classList.remove('active');
            difficultyTag.classList.toggle('active');
            
            // If no difficulties are selected, activate "All Difficulties"
            const activeDifficulties = document.querySelectorAll('.difficulty-tag.active:not([data-difficulty="all"])');
            if (activeDifficulties.length === 0) {
                document.querySelector('.difficulty-tag[data-difficulty="all"]').classList.add('active');
            }
        }
        
        window.currentPage = 1;
        filterProblems();
    });
}

function toggleSpoiler(element, problemId) { // Modified signature
    const content = element.nextElementSibling;
    content.classList.toggle('visible');
    element.textContent = content.classList.contains('visible') 
        ? `Hide ${element.dataset.type}` 
        : `Show ${element.dataset.type}`;

    // Timer logic: Start timer when first spoiler is revealed
    if (content.classList.contains('visible') && problemId) {
        const startTimeKey = 'startTime_' + problemId;
        if (!localStorage.getItem(startTimeKey)) {
            // Only set startTime if it's not already set for this problem
            const isSolved = window.solvedProblems.has(problemId);
            if (!isSolved) { // Only set startTime if the problem isn't already solved
                localStorage.setItem(startTimeKey, Date.now().toString());
            }
        }
        // Reveal task if spoiler is shown
        const cardElement = element.closest('.problem-card');
        if (cardElement) {
            const taskElement = cardElement.querySelector('.problem-task');
            if (taskElement && taskElement.classList.contains('task-hidden')) {
                taskElement.classList.remove('task-hidden');
                localStorage.setItem('taskRevealed_' + problemId, 'true');
            }
        }
    }
}

function createProblemCard(problem) {
    const card = document.createElement('div');
    card.className = 'problem-card';
    
    const tags = typeof problem.Tags === 'string' ? 
        JSON.parse(problem.Tags.replace(/'/g, '"')) : 
        problem.Tags;
    const companies = typeof problem.Companies === 'string' ? 
        JSON.parse(problem.Companies.replace(/'/g, '"')) : 
        problem.Companies;

    const isTaskRevealed = localStorage.getItem('taskRevealed_' + problem.url) === 'true';
    
    card.innerHTML = `
        <div class="problem-header">
            <h2>${problem.title}</h2>
            <div class="problem-header-top">
                <span class="topic">${problem.Topic}</span>
                <div class="problem-header-right">
                    <span class="difficulty ${problem.Difficulty.toLowerCase()}">${problem.Difficulty}</span>
                    ${problem.url ? `<a href="${problem.url}" class="problem-link" target="_blank">Original Task</a>` : ''}
                </div>
            </div>
        </div>
        
        <div class="problem-task ${isTaskRevealed ? '' : 'task-hidden'}">${problem.task}</div>
        
        <div class="tags-section">
            ${Array.isArray(tags) && tags.length > 0 ? `
                <div class="tags-row">
                    ${tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                </div>
            ` : ''}
            ${Array.isArray(companies) && companies.length > 0 ? `
                <div class="tags-row">
                    ${companies.map(company => `<span class="tag company-tag-card">${company}</span>`).join('')}
                </div>
            ` : ''}
        </div>
        
        <div class="spoiler">
            <button class="spoiler-button" data-type="Hint" onclick="toggleSpoiler(this, '${problem.url}')">Show Hint</button>
            <div class="spoiler-content">${problem.hint}</div>
        </div>
        
        <div class="spoiler">
            <button class="spoiler-button" data-type="Solution" onclick="toggleSpoiler(this, '${problem.url}')">Show Solution</button>
            <div class="spoiler-content">${problem.solution}</div>
        </div>
        
        <div class="spoiler">
            <button class="spoiler-button" data-type="Answer" onclick="toggleSpoiler(this, '${problem.url}')">Show Answer</button>
            <div class="spoiler-content">${problem.answers.join(', ')}</div>
        </div>
        
        <div class="solved-checkbox">
            <label>
                <input type="checkbox" 
                       ${window.solvedProblems.has(problem.url) ? 'checked' : ''} 
                       onchange="toggleSolved('${problem.url}', this)">
                Mark as solved
            </label>
        </div>

        <div class="problem-timer-container">
            <div class="problem-timer-display">${timerIconSVG} Timer: 0s</div>
            <div class="problem-solve-time"></div>
            <div class="timer-controls">
                <button class="timer-btn start-timer-btn" data-problem-id="${problem.url}">Start</button>
                <button class="timer-btn pause-resume-btn" data-problem-id="${problem.url}" disabled>Pause</button>
                <button class="timer-btn reset-timer-btn" data-problem-id="${problem.url}">Reset</button>
            </div>
        </div>
    `;

    // Post-innerHTML setup for dynamic content and states
    const timerDisplayEl = card.querySelector('.problem-timer-display');
    const problemSolveTimeEl = card.querySelector('.problem-solve-time');
    const startBtn = card.querySelector('.start-timer-btn');
    const pauseResumeBtn = card.querySelector('.pause-resume-btn');
    const resetBtn = card.querySelector('.reset-timer-btn');
    const taskElement = card.querySelector('.problem-task'); // Already used for task-hidden

    const problemId = problem.url; // Use problem.url for clarity with keys
    const solveTime = localStorage.getItem('solveTime_' + problemId);
    const startTime = localStorage.getItem('startTime_' + problemId);
    const pausedTime = localStorage.getItem('pausedTime_' + problemId);

    // Scenario 1: Problem already solved
    if (solveTime) {
        const solveTimeMs = parseInt(solveTime, 10);
        if (!isNaN(solveTimeMs)) {
            if (problemSolveTimeEl) problemSolveTimeEl.innerHTML = `${timerIconSVG} Solved in: ${formatTime(solveTimeMs)}`;
            if (timerDisplayEl) timerDisplayEl.style.display = 'none';
            if (startBtn) startBtn.disabled = true;
            if (pauseResumeBtn) {
                pauseResumeBtn.disabled = true;
                pauseResumeBtn.textContent = 'Pause';
            }
            if (resetBtn) resetBtn.disabled = true;
            if (taskElement && taskElement.classList.contains('task-hidden')) { // Ensure task is visible if solved
                taskElement.classList.remove('task-hidden');
            }
        }
    } 
    // Scenarios 2, 3, 4: Not solved yet
    else {
        if (timerDisplayEl) timerDisplayEl.style.display = 'flex'; // Ensure display is visible (flex due to icon)
        if (problemSolveTimeEl) problemSolveTimeEl.innerHTML = ''; // Clear solve time

        // Scenario 2: Timer is actively running
        if (activeTimers[problemId] && startTime) {
            // The live update is handled by setInterval, here we set initial state for re-render
            const elapsedSinceStart = Date.now() - parseInt(startTime, 10);
            if (timerDisplayEl) timerDisplayEl.innerHTML = `${timerIconSVG} ${formatTime(elapsedSinceStart)}`;
            if (startBtn) startBtn.disabled = true;
            if (pauseResumeBtn) {
                pauseResumeBtn.textContent = 'Pause';
                pauseResumeBtn.disabled = false;
            }
            if (resetBtn) resetBtn.disabled = false;
        }
        // Scenario 3: Timer is paused
        else if (pausedTime && startTime) { // startTime check helps confirm it was a valid pause
            const pausedTimeMs = parseInt(pausedTime, 10);
            if (timerDisplayEl) timerDisplayEl.innerHTML = `${timerIconSVG} ${formatTime(pausedTimeMs)}`;
            if (startBtn) startBtn.disabled = true;
            if (pauseResumeBtn) {
                pauseResumeBtn.textContent = 'Resume';
                pauseResumeBtn.disabled = false;
            }
            if (resetBtn) resetBtn.disabled = false;
        }
        // Scenario 4: Timer has never run, or was reset (and not solved)
        else {
            if (timerDisplayEl) timerDisplayEl.innerHTML = `${timerIconSVG} Timer: 0s`;
            if (startBtn) startBtn.disabled = false;
            if (pauseResumeBtn) {
                pauseResumeBtn.textContent = 'Pause';
                pauseResumeBtn.disabled = true;
            }
            if (resetBtn) resetBtn.disabled = false; // Or true if preferred initial state until first interaction
        }
    }
    
    return card;
}

function formatTime(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
    } else {
        return `${seconds}s`;
    }
}

function createPagination(currentPage, totalPages) {
    const paginationContainer = document.createElement('div');
    paginationContainer.className = 'pagination';

    const isMobile = window.innerWidth <= 640;
    
    // Always show first page
    paginationContainer.appendChild(createPageButton(1, currentPage));

    if (isMobile) {
        // Mobile layout: Show only key pages
        if (currentPage > 2) {
            paginationContainer.appendChild(createEllipsis());
        }
        
        // Show 1-2 pages before current
        if (currentPage > 1) {
            const prevPage = createPageButton(currentPage - 1, currentPage);
            prevPage.classList.add('mobile-visible');
            paginationContainer.appendChild(prevPage);
        }
        
        if (currentPage !== 1 && currentPage !== totalPages) {
            const currentBtn = createPageButton(currentPage, currentPage);
            currentBtn.classList.add('mobile-visible');
            paginationContainer.appendChild(currentBtn);
        }
        
        // Show 1-2 pages after current
        if (currentPage < totalPages) {
            const nextPage = createPageButton(currentPage + 1, currentPage);
            nextPage.classList.add('mobile-visible');
            paginationContainer.appendChild(nextPage);
        }
        
        if (currentPage < totalPages - 1) {
            paginationContainer.appendChild(createEllipsis());
        }
    } else {
        // Desktop layout: Show more pages
        let startPage = Math.max(1, currentPage - 2);
        let endPage = Math.min(totalPages, currentPage + 2);

        if (startPage > 1) {
            paginationContainer.appendChild(createEllipsis());
        }

        for (let i = startPage; i <= endPage; i++) {
            paginationContainer.appendChild(createPageButton(i, currentPage));
        }

        if (endPage < totalPages) {
            paginationContainer.appendChild(createEllipsis());
        }
    }

    // Always show last page
    if (totalPages > 1) {
        paginationContainer.appendChild(createPageButton(totalPages, currentPage));
    }

    return paginationContainer;
}

function createPageButton(pageNum, currentPage) {
    const button = document.createElement('button');
    button.className = `page-button ${pageNum === currentPage ? 'active' : ''}`;
    button.textContent = pageNum;
    button.addEventListener('click', async () => {
        window.currentPage = pageNum;
        await filterProblems();
    });
    return button;
}

function createEllipsis() {
    const span = document.createElement('span');
    span.className = 'ellipsis';
    span.textContent = '...';
    return span;
}

async function changePage(pageNum) {
    window.currentPage = pageNum;
    await filterProblems();
}

async function filterProblems() {
    const ITEMS_PER_PAGE = 12;
    const problemsContainer = document.getElementById('problems'); // Add this line
    
    if (!problemsContainer) {
        console.error('Problems container not found');
        return;
    }
    
    const selectedDifficulties = Array.from(document.querySelectorAll('.difficulty-tag.active'))
        .map(tag => tag.getAttribute('data-difficulty'));
    const selectedCompanies = Array.from(document.querySelectorAll('.company-tag.active'))
        .map(button => button.getAttribute('data-company'));
    const solvedFilter = document.querySelector('.solved-filter-tag.active')?.getAttribute('data-solved') || 'unsolved';

    if (!window.questions || window.questions.length === 0) {
        await loadQuestions();
        return;
    }

    const filteredQuestions = window.questions.filter(problem => {
        // Check difficulty
        const difficultyMatch = selectedDifficulties.includes('all') || 
            selectedDifficulties.some(d => problem.Difficulty.toLowerCase() === d);
                
        // Check companies
        const companies = typeof problem.Companies === 'string'
            ? JSON.parse(problem.Companies.replace(/'/g, '"'))
            : problem.Companies;
            
        const companiesMatch = selectedCompanies.includes('all') ||
            (Array.isArray(companies) && companies.some(company => 
                selectedCompanies.includes(company)));
        
        // Check solved status
        const isSolved = window.solvedProblems.has(problem.url);
        const solvedMatch = solvedFilter === 'all' || 
            (solvedFilter === 'solved' && isSolved) ||
            (solvedFilter === 'unsolved' && !isSolved);
       
        return difficultyMatch && companiesMatch && solvedMatch;
    });

    const totalPages = Math.ceil(filteredQuestions.length / ITEMS_PER_PAGE);
    window.currentPage = Math.min(window.currentPage, totalPages);

    const startIndex = (window.currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const currentItems = filteredQuestions.slice(startIndex, endIndex);

    // Manage active timers: Clear timers for problems no longer visible
    const visibleProblemIds = new Set(currentItems.map(p => p.url));
    Object.keys(activeTimers).forEach(problemId => {
        if (!visibleProblemIds.has(problemId)) {
            clearInterval(activeTimers[problemId]);
            delete activeTimers[problemId];
            // console.log(`Cleared timer for problemId ${problemId} as it's no longer visible.`); // Optional debug
        }
    });

    problemsContainer.innerHTML = '';
    currentItems.forEach(problem => {
        problemsContainer.appendChild(createProblemCard(problem));
    });

    if (window.MathJax && window.MathJax.typesetPromise) {
        try {
            await window.MathJax.typesetPromise([problemsContainer]);
        } catch (error) {
            console.error('MathJax typesetting failed:', error);
        }
    }

    const paginationContainer = document.getElementById('pagination');
    paginationContainer.innerHTML = '';
    paginationContainer.appendChild(createPagination(window.currentPage, totalPages));

    updateSolvedStats();
}

document.addEventListener('DOMContentLoaded', () => {
    initializeDifficultyFilter();
    initializeSolvedFilter();
    initializeCompanySearch(); // Add this line
    filterProblems();

    window.addEventListener('resize', debounce(() => {
        filterProblems();
    }, 250));

    const problemsContainer = document.getElementById('problems');
    if (problemsContainer) {
        problemsContainer.addEventListener('click', (event) => {
            const target = event.target;
            const problemCard = target.closest('.problem-card');
            if (!problemCard) return;

            const problemId = target.dataset.problemId;
            if (!problemId) return;

            const timerDisplayEl = problemCard.querySelector('.problem-timer-display');
            const solveTimeEl = problemCard.querySelector('.problem-solve-time');
            const startBtn = problemCard.querySelector('.start-timer-btn');
            const pauseResumeBtn = problemCard.querySelector('.pause-resume-btn');
            const resetBtn = problemCard.querySelector('.reset-timer-btn');

            if (target.classList.contains('start-timer-btn')) {
                if (activeTimers[problemId]) {
                    clearInterval(activeTimers[problemId]);
                }
                localStorage.setItem('startTime_' + problemId, Date.now().toString());
                
                // Reveal task on start
                const taskElement = problemCard.querySelector('.problem-task');
                if (taskElement && taskElement.classList.contains('task-hidden')) {
                    taskElement.classList.remove('task-hidden');
                    localStorage.setItem('taskRevealed_' + problemId, 'true');
                }
                
                if (timerDisplayEl) timerDisplayEl.style.display = 'block';
                if (solveTimeEl) solveTimeEl.textContent = '';


                const intervalId = setInterval(() => {
                    const startTime = localStorage.getItem('startTime_' + problemId);
                    if (startTime && timerDisplayEl) {
                        const elapsedTime = Date.now() - parseInt(startTime, 10);
                        timerDisplayEl.textContent = `Timer: ${formatTime(elapsedTime)}`;
                    } else if (!startTime && timerDisplayEl) {
                        // If startTime was removed (e.g. by reset), clear interval and reset display
                        clearInterval(activeTimers[problemId]);
                        delete activeTimers[problemId];
                        timerDisplayEl.textContent = 'Timer: 0s';
                        if(startBtn) startBtn.disabled = false;
                        if(pauseResumeBtn) {
                            pauseResumeBtn.disabled = true;
                            pauseResumeBtn.textContent = 'Pause';
                        }
                    }
                }, 1000);
                activeTimers[problemId] = intervalId;

                if (startBtn) startBtn.disabled = true;
                if (pauseResumeBtn) {
                    pauseResumeBtn.disabled = false;
                    pauseResumeBtn.textContent = 'Pause';
                }
                if (resetBtn) resetBtn.disabled = false;

            } else if (target.classList.contains('pause-resume-btn')) {
                const isTimerRunning = activeTimers[problemId] !== undefined;
                
                if (isTimerRunning) { // PAUSE logic
                    clearInterval(activeTimers[problemId]);
                    delete activeTimers[problemId];
                    const currentStartTime = localStorage.getItem('startTime_' + problemId); // Renamed from startTime to avoid conflict
                    if (currentStartTime) {
                        const elapsedTime = Date.now() - parseInt(currentStartTime, 10);
                        localStorage.setItem('pausedTime_' + problemId, elapsedTime.toString());
                        if (timerDisplayEl) timerDisplayEl.innerHTML = `${timerIconSVG} ${formatTime(elapsedTime)}`; // Update display
                    }
                    if (pauseResumeBtn) pauseResumeBtn.textContent = 'Resume';
                    if (startBtn) startBtn.disabled = true; 
                
                } else { // RESUME logic
                    const currentPausedTime = localStorage.getItem('pausedTime_' + problemId); // Renamed to avoid conflict
                    if (currentPausedTime) {
                        const parsedPausedTime = parseInt(currentPausedTime, 10);
                        const newStartTime = Date.now() - parsedPausedTime;
                        localStorage.setItem('startTime_' + problemId, newStartTime.toString());
                        localStorage.removeItem('pausedTime_' + problemId);

                        const intervalId = setInterval(() => {
                            const latestStartTime = localStorage.getItem('startTime_' + problemId); // Renamed
                            if (latestStartTime && timerDisplayEl) {
                                const elapsedTime = Date.now() - parseInt(latestStartTime, 10);
                                timerDisplayEl.innerHTML = `${timerIconSVG} ${formatTime(elapsedTime)}`;
                            } else if (!latestStartTime && timerDisplayEl) { 
                                clearInterval(activeTimers[problemId]);
                                delete activeTimers[problemId];
                                timerDisplayEl.innerHTML = `${timerIconSVG} Timer: 0s`;
                                if(startBtn) startBtn.disabled = false;
                                if(pauseResumeBtn) {
                                    pauseResumeBtn.disabled = true;
                                    pauseResumeBtn.textContent = 'Pause';
                                }
                            }
                        }, 1000);
                        activeTimers[problemId] = intervalId;
                        if (pauseResumeBtn) pauseResumeBtn.textContent = 'Pause';
                    }
                }
                 if (startBtn) startBtn.disabled = true; 
                 if (resetBtn) resetBtn.disabled = false;


            } else if (target.classList.contains('reset-timer-btn')) {
                if (activeTimers[problemId]) {
                    clearInterval(activeTimers[problemId]);
                    delete activeTimers[problemId];
                }
                localStorage.removeItem('startTime_' + problemId);
                localStorage.removeItem('solveTime_' + problemId);
                localStorage.removeItem('pausedTime_' + problemId); 

                if (timerDisplayEl) {
                    timerDisplayEl.innerHTML = `${timerIconSVG} Timer: 0s`;
                    timerDisplayEl.style.display = 'flex'; // Ensure display is flex for icon
                }
                if (solveTimeEl) solveTimeEl.textContent = '';

                if (startBtn) startBtn.disabled = false;
                if (pauseResumeBtn) {
                    pauseResumeBtn.disabled = true;
                    pauseResumeBtn.textContent = 'Pause';
                }
                // Reset button typically remains enabled, or could be disabled if timer is 0s and no solveTime

                // Uncheck "Mark as solved" if it was checked
                const solvedCheckbox = problemCard.querySelector('.solved-checkbox input[type="checkbox"]');
                if (solvedCheckbox && solvedCheckbox.checked) {
                    solvedCheckbox.checked = false;
                    // Manually trigger the logic from toggleSolved for unchecking
                    window.solvedProblems.delete(problemId);
                    localStorage.setItem('solvedProblems', JSON.stringify([...window.solvedProblems]));
                    // Note: toggleSolved also removes 'solveTime_' and 'startTime_', which we already did.
                    updateSolvedStats();
                }
                 // After reset, ensure the "Start" button is enabled and "Pause/Resume" is disabled.
                if(startBtn) startBtn.disabled = false;
                if(pauseResumeBtn) {
                     pauseResumeBtn.disabled = true;
                     pauseResumeBtn.textContent = 'Pause';
                }
                if(resetBtn) resetBtn.disabled = false; 

                // Refresh the card to reflect the cleared solveTime
                // This is a bit heavy, but ensures consistency if createProblemCard has other logic
                // A lighter approach would be to just manipulate the specific elements
                const problemData = window.questions.find(q => q.url === problemId);
                if (problemData) {
                    const newCard = createProblemCard(problemData);
                    problemCard.parentNode.replaceChild(newCard, problemCard);
                     if (window.MathJax && window.MathJax.typesetPromise) {
                        window.MathJax.typesetPromise([newCard]).catch(console.error);
                    }
                }
            }
        });
    }
});

