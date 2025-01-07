window.questions = [];
window.currentPage = 1;
window.companies = new Set();
window.solvedProblems = new Set(JSON.parse(localStorage.getItem('solvedProblems') || '[]'));


function toggleSolved(problemId, checkbox) {
    if (checkbox.checked) {
        window.solvedProblems.add(problemId);
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
    
    // Safely parse tags and companies if they're strings, or use them directly if they're arrays
    const tags = typeof problem.Tags === 'string' ? 
        JSON.parse(problem.Tags.replace(/'/g, '"')) : 
        problem.Tags;
    const companies = typeof problem.Companies === 'string' ? 
        JSON.parse(problem.Companies.replace(/'/g, '"')) : 
        problem.Companies;
    
    card.innerHTML = `
        <div class="problem-header">
            <div class="problem-header-top">
                <span class="topic">${problem.Topic}</span>
                <div class="problem-header-right">
                    <span class="difficulty ${problem.Difficulty.toLowerCase()}">${problem.Difficulty}</span>
                    ${problem.url ? `<a href="${problem.url}" class="problem-link" target="_blank">Original Task</a>` : ''}
                </div>
            </div>
            <h2 class="problem-title">${problem.title || ''}</h2>
        </div>
        <div class="problem-task">${problem.task}</div>
        <div class="tags">
            ${Array.isArray(tags) ? tags.map(tag => `<span class="tag">${tag}</span>`).join('') : ''}
            ${Array.isArray(companies) ? companies.map(company => `<span class="tag">${company}</span>`).join('') : ''}
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
    `;

    const solvedCheckbox = document.createElement('div');
    solvedCheckbox.className = 'solved-checkbox';
    solvedCheckbox.innerHTML = `
        <label>
            <input type="checkbox" 
                   ${window.solvedProblems.has(problem.url) ? 'checked' : ''} 
                   onchange="toggleSolved('${problem.url}', this)">
            Mark as solved
        </label>
    `;
    card.appendChild(solvedCheckbox);
        
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
    const selectedDifficulties = Array.from(document.querySelectorAll('.difficulty-tag.active'))
        .map(tag => tag.getAttribute('data-difficulty'));
    const selectedCompanies = Array.from(document.querySelectorAll('.company-tag.active'))
        .map(button => button.getAttribute('data-company'));
    const solvedFilter = document.querySelector('.solved-filter-tag.active')
        .getAttribute('data-solved');

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

    problemsContainer.innerHTML = '';
    currentItems.forEach(problem => {
        problemsContainer.appendChild(createProblemCard(problem));
    });

    if (window.MathJax) {
        try {
            await MathJax.typesetPromise([problemsContainer]);
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
    filterProblems();

    window.addEventListener('resize', _.debounce(() => {
        filterProblems();
    }, 250));
});

