window.questions = [];
window.currentPage = 1;
window.companies = new Set();


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

        // Remove active class from all difficulties
        document.querySelectorAll('.difficulty-tag').forEach(tag => {
            tag.classList.remove('active');
        });
        
        // Add active class to clicked difficulty
        difficultyTag.classList.add('active');
        
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
    const ITEMS_PER_PAGE = 10;
    const difficulty = document.getElementById('difficulty').value;
    const selectedCompanies = Array.from(document.querySelectorAll('.company-tag.active'))
        .map(button => button.getAttribute('data-company'));

    const problemsContainer = document.getElementById('problems');
    
    if (!window.questions || window.questions.length === 0) {
        await loadQuestions();
        return;
    }
    
    const filteredQuestions = window.questions.filter(problem => {
        const selectedDifficulty = document.querySelector('.difficulty-tag.active')
            .getAttribute('data-difficulty');

        const difficultyMatch = selectedDifficulty === 'all' || 
            problem.Difficulty.toLowerCase() === selectedDifficulty;
                
        // Check companies
        const companies = typeof problem.Companies === 'string'
            ? JSON.parse(problem.Companies.replace(/'/g, '"'))
            : problem.Companies;
            
        const companiesMatch = selectedCompanies.includes('all') ||
            (Array.isArray(companies) && companies.some(company => 
                selectedCompanies.includes(company)));
       
        return difficultyMatch && companiesMatch;
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
}

// Initial load
filterProblems();

window.addEventListener('resize', _.debounce(() => {
    filterProblems();
}, 250));

document.addEventListener('DOMContentLoaded', () => {
    initializeDifficultyFilter();
});

