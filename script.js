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
    } else {
        window.solvedProblems.delete(problemId);
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
    element.textContent = content.classList.contains('visible') 
        ? `Hide ${element.dataset.type}` 
        : `Show ${element.dataset.type}`;
}

function createProblemCard(problem) {
    const card = document.createElement('div');
    card.className = 'problem-card';
    
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
    
    return card;
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
});

