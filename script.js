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
window.tags = new Set();
window.solvedProblems = new Set(JSON.parse(localStorage.getItem('solvedProblems') || '[]'));
window.solveTimes = JSON.parse(localStorage.getItem('solveTimes') || '{}');
window.openTimers = {};
window.timedMode = false;

function parseList(value) {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
        try {
            return JSON.parse(value.replace(/'/g, '"'));
        } catch (error) {
            return [];
        }
    }
    return [];
}


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
    if (checkbox.checked) {
        window.solvedProblems.add(problemId);
        // Trigger confetti effect
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.8 }, // Start from near the checkbox
            colors: ['#4f7a4d', '#2f5d8a', '#b88a2c'], // Use our theme colors
            disableForReducedMotion: true // Accessibility consideration
        });
        
        // Fire another burst for more festivity
        setTimeout(() => {
            confetti({
                particleCount: 50,
                spread: 50,
                origin: { y: 0.8 },
                colors: ['#4f7a4d', '#2f5d8a', '#b88a2c'],
                disableForReducedMotion: true
            });
        }, 150);
        finalizeSolveTime(problemId, checkbox.closest('.problem-card'));
    } else {
        window.solvedProblems.delete(problemId);
        delete window.solveTimes[problemId];
        localStorage.setItem('solveTimes', JSON.stringify(window.solveTimes));
    }
    localStorage.setItem('solvedProblems', JSON.stringify([...window.solvedProblems]));
    renderStatsWidget();
}

function renderStatsWidget() {
    const el = document.getElementById('stats-widget');
    if (!el) return;

    const order = ['easy', 'medium', 'hard'];
    const cap = d => d.charAt(0).toUpperCase() + d.slice(1);

    const total = {};
    const solved = {};
    window.questions.forEach(q => {
        const d = (q.Difficulty || '').toLowerCase();
        if (!d) return;
        total[d] = (total[d] || 0) + 1;
        if (window.solvedProblems.has(q.url)) solved[d] = (solved[d] || 0) + 1;
    });
    const present = order.filter(d => total[d]);

    const solvedItems = present
        .map(d => `<span class="stat-chip ${d}">${cap(d)} <b>${solved[d] || 0}/${total[d]}</b></span>`)
        .join('');

    let rows = `
        <div class="stats-widget__row">
            <span class="stats-widget__label">Solved</span>
            <div class="stats-widget__items">${solvedItems}</div>
        </div>`;

    if (window.timedMode) {
        const byUrl = {};
        window.questions.forEach(q => { byUrl[q.url] = q; });
        const clean = Object.entries(window.solveTimes)
            .filter(([, r]) => r && !r.peeked && typeof r.seconds === 'number');

        const diffAgg = {};
        const tagAgg = {};
        clean.forEach(([url, r]) => {
            const q = byUrl[url];
            if (!q) return;
            const d = (q.Difficulty || '').toLowerCase();
            if (d) {
                diffAgg[d] = diffAgg[d] || { sum: 0, n: 0 };
                diffAgg[d].sum += r.seconds; diffAgg[d].n += 1;
            }
            parseList(q.Tags).forEach(tag => {
                tagAgg[tag] = tagAgg[tag] || { sum: 0, n: 0 };
                tagAgg[tag].sum += r.seconds; tagAgg[tag].n += 1;
            });
        });

        const timeItems = present
            .map(d => `<span class="stat-chip ${d}">${cap(d)} <b>${diffAgg[d] ? formatTime(diffAgg[d].sum / diffAgg[d].n) : '—'}</b></span>`)
            .join('');

        const topTags = Object.entries(tagAgg).sort((a, b) => b[1].n - a[1].n).slice(0, 5);
        const tagItems = topTags.length
            ? topTags.map(([tag, a]) => `<span class="stat-chip">${tag} <b>${formatTime(a.sum / a.n)}</b> <em>·${a.n}</em></span>`).join('')
            : '<span class="stats-widget__empty">no clean solves yet</span>';

        rows += `
        <div class="stats-widget__row">
            <span class="stats-widget__label">Avg time</span>
            <div class="stats-widget__items">${timeItems}</div>
        </div>
        <div class="stats-widget__row">
            <span class="stats-widget__label">Top tags</span>
            <div class="stats-widget__items">${tagItems}</div>
        </div>`;
    }

    el.innerHTML = rows;
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
        window.tags = new Set();
        window.questions.forEach(question => {
            parseList(question.Companies).forEach(company => {
                if (company && company.trim()) window.companies.add(company);
            });
            parseList(question.Tags).forEach(tag => {
                if (tag && tag.trim()) window.tags.add(tag);
            });
        });

        // Populate filters
        populateCompanyFilter();
        populateTagFilter();

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

function populateTagFilter() {
    const tagsList = document.getElementById('tags-list');
    if (!tagsList) return;

    tagsList.innerHTML = '<button class="tag-filter-tag active" data-tag="all">All Tags</button>';

    Array.from(window.tags).sort().forEach(tag => {
        const button = document.createElement('button');
        button.className = 'tag-filter-tag';
        button.setAttribute('data-tag', tag);
        button.textContent = tag;
        tagsList.appendChild(button);
    });

    tagsList.addEventListener('click', (e) => {
        const tagButton = e.target.closest('.tag-filter-tag');
        if (!tagButton) return;

        const tag = tagButton.getAttribute('data-tag');

        if (tag === 'all') {
            document.querySelectorAll('.tag-filter-tag').forEach(t => t.classList.remove('active'));
            tagButton.classList.add('active');
        } else {
            tagsList.querySelector('.tag-filter-tag[data-tag="all"]').classList.remove('active');
            tagButton.classList.toggle('active');

            const activeTags = tagsList.querySelectorAll('.tag-filter-tag.active:not([data-tag="all"])');
            if (activeTags.length === 0) {
                tagsList.querySelector('.tag-filter-tag[data-tag="all"]').classList.add('active');
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

function toggleSpoiler(element) {
    const content = element.nextElementSibling;
    content.classList.toggle('visible');
    const opened = content.classList.contains('visible');
    element.textContent = opened ? `Hide ${element.dataset.type}` : `Show ${element.dataset.type}`;
    if (opened && (element.dataset.type === 'Solution' || element.dataset.type === 'Answer')) {
        const card = element.closest('.problem-card');
        if (card) card.dataset.peeked = '1';
    }
}

function formatTime(totalSeconds) {
    const s = Math.max(0, Math.round(totalSeconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function updateCardTimer(card) {
    const timer = card.querySelector('.card-timer');
    const start = window.openTimers[card.dataset.url];
    if (timer && start != null) {
        timer.textContent = '⏱ ' + formatTime((Date.now() - start) / 1000);
    }
}

function applyCardTimedState(card, problem) {
    if (!window.timedMode) return;
    const url = problem.url;

    if (window.openTimers[url] != null) {
        card.classList.add('is-running');
        updateCardTimer(card);
        return;
    }

    card.classList.add('is-closed');
    const record = window.solveTimes[url];
    if (record && typeof record.seconds === 'number') {
        const timer = card.querySelector('.card-timer');
        const hint = card.querySelector('.card-tap-hint');
        if (timer) {
            timer.textContent = '✓ ' + formatTime(record.seconds) + (record.peeked ? ' (peeked)' : '');
            timer.classList.add('card-timer--done');
        }
        if (hint) hint.textContent = 'Tap to review';
    }
}

function openCard(card) {
    if (!window.timedMode || card.classList.contains('flipping') || !card.classList.contains('is-closed')) return;
    const url = card.dataset.url;
    card.classList.add('flipping');
    setTimeout(() => {
        card.classList.remove('is-closed');
        if (!window.solvedProblems.has(url)) {
            window.openTimers[url] = Date.now();
            card.classList.add('is-running');
            updateCardTimer(card);
        }
    }, 150);
    setTimeout(() => card.classList.remove('flipping'), 300);
}

function finalizeSolveTime(url, card) {
    if (window.openTimers[url] == null) return;
    const seconds = (Date.now() - window.openTimers[url]) / 1000;
    const peeked = card?.dataset.peeked === '1';
    window.solveTimes[url] = { seconds, peeked };
    localStorage.setItem('solveTimes', JSON.stringify(window.solveTimes));
    delete window.openTimers[url];
    if (!card) return;
    card.classList.remove('is-running');
    const timer = card.querySelector('.card-timer');
    if (timer) {
        timer.textContent = '✓ Solved in ' + formatTime(seconds) + (peeked ? ' (peeked)' : '');
        timer.classList.add('card-timer--done');
    }
}

function applyTimedMode() {
    const toggle = document.getElementById('timed-toggle');
    document.body.classList.toggle('timed-mode', window.timedMode);
    if (toggle) toggle.setAttribute('aria-checked', window.timedMode ? 'true' : 'false');
    renderStatsWidget();
}

function initializeTimedMode() {
    window.timedMode = localStorage.getItem('timedMode') === '1';
    applyTimedMode();

    const toggle = document.getElementById('timed-toggle');
    if (toggle) {
        toggle.addEventListener('click', () => {
            window.timedMode = !window.timedMode;
            localStorage.setItem('timedMode', window.timedMode ? '1' : '0');
            applyTimedMode();
            window.currentPage = 1;
            filterProblems();
        });
    }

    const problemsContainer = document.getElementById('problems');
    if (problemsContainer) {
        problemsContainer.addEventListener('click', (e) => {
            if (!window.timedMode) return;
            const card = e.target.closest('.problem-card.is-closed');
            if (card) openCard(card);
        });
    }

    setInterval(() => {
        document.querySelectorAll('.problem-card.is-running').forEach(updateCardTimer);
    }, 1000);
}

function initializeFiltersToggle() {
    const toggle = document.getElementById('filters-toggle');
    const panel = document.getElementById('filters-panel');
    if (!toggle || !panel) return;

    toggle.addEventListener('click', () => {
        const willOpen = panel.hasAttribute('hidden');
        panel.toggleAttribute('hidden', !willOpen);
        toggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    });
}

function updateFilterSummary(difficulties, tags, companies, solved) {
    const el = document.getElementById('filters-summary');
    if (!el) return;

    const cap = v => v.charAt(0).toUpperCase() + v.slice(1);
    const list = (vals, capitalize) =>
        vals.includes('all') ? 'All' : (capitalize ? vals.map(cap) : vals).join(', ');
    const solvedLabel = { unsolved: 'Unsolved', solved: 'Solved', all: 'All' }[solved] || cap(solved);

    el.innerHTML = [
        `Difficulties: <b>${list(difficulties, true)}</b>`,
        `Tags: <b>${list(tags, false)}</b>`,
        `Companies: <b>${list(companies, false)}</b>`,
        `Solved: <b>${solvedLabel}</b>`,
    ].join(' · ');
}

function createProblemCard(problem) {
    const card = document.createElement('div');
    card.className = 'problem-card';
    card.dataset.url = problem.url || '';

    const tags = parseList(problem.Tags);
    const companies = parseList(problem.Companies);
    
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
            <div class="card-timer" aria-live="polite"></div>
            <div class="card-tap-hint">Tap to reveal — starts the timer</div>
        </div>

        <div class="problem-task">${problem.task}</div>
        
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
            <button class="spoiler-button" data-type="Hint" onclick="toggleSpoiler(this)">Show Hint</button>
            <div class="spoiler-content">${problem.hint}</div>
        </div>
        
        <div class="spoiler">
            <button class="spoiler-button" data-type="Solution" onclick="toggleSpoiler(this)">Show Solution</button>
            <div class="spoiler-content">${problem.solution}</div>
        </div>
        
        <div class="spoiler">
            <button class="spoiler-button" data-type="Answer" onclick="toggleSpoiler(this)">Show Answer</button>
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
    `;

    applyCardTimedState(card, problem);
    return card;
}

function createPagination(currentPage, totalPages) {
    const paginationContainer = document.createElement('div');
    paginationContainer.className = 'pagination';

    if (totalPages < 1) return paginationContainer;

    const delta = window.innerWidth <= 640 ? 1 : 2;

    const pages = [1];
    const start = Math.max(2, currentPage - delta);
    const end = Math.min(totalPages - 1, currentPage + delta);
    for (let i = start; i <= end; i++) pages.push(i);
    if (totalPages > 1) pages.push(totalPages);

    let prev = 0;
    pages.forEach(page => {
        if (page - prev > 1) paginationContainer.appendChild(createEllipsis());
        paginationContainer.appendChild(createPageButton(page, currentPage));
        prev = page;
    });

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
    const selectedTags = Array.from(document.querySelectorAll('.tag-filter-tag.active'))
        .map(button => button.getAttribute('data-tag'));
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
        const companies = parseList(problem.Companies);
        const companiesMatch = selectedCompanies.includes('all') ||
            companies.some(company => selectedCompanies.includes(company));

        // Check tags
        const tags = parseList(problem.Tags);
        const tagsMatch = selectedTags.includes('all') ||
            tags.some(tag => selectedTags.includes(tag));

        // Check solved status
        const isSolved = window.solvedProblems.has(problem.url);
        const solvedMatch = solvedFilter === 'all' ||
            (solvedFilter === 'solved' && isSolved) ||
            (solvedFilter === 'unsolved' && !isSolved);

        return difficultyMatch && companiesMatch && tagsMatch && solvedMatch;
    });

    const totalPages = Math.ceil(filteredQuestions.length / ITEMS_PER_PAGE);
    window.currentPage = Math.min(window.currentPage, totalPages);

    const startIndex = (window.currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const currentItems = filteredQuestions.slice(startIndex, endIndex);

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

    renderStatsWidget();
    updateFilterSummary(selectedDifficulties, selectedTags, selectedCompanies, solvedFilter);
}

document.addEventListener('DOMContentLoaded', () => {
    initializeDifficultyFilter();
    initializeSolvedFilter();
    initializeCompanySearch(); // Add this line
    initializeTimedMode();
    initializeFiltersToggle();
    filterProblems();

    window.addEventListener('resize', debounce(() => {
        filterProblems();
    }, 250));
});

