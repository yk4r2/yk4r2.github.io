window.questions = [];
window.currentPage = 1;
window.companies = new Set();

async function loadQuestions() {
    try {
        // Try to fetch GZIP version
        let response = await fetch('questions.json.gz');
        if (response.ok) {
            const compressedData = await response.arrayBuffer();
            const compressed = new Uint8Array(compressedData);
            const decompressed = pako.inflate(compressed);
            const textDecoder = new TextDecoder();
            const jsonString = textDecoder.decode(decompressed);
            window.questions = JSON.parse(jsonString);
            await filterProblems();
            return;
        }

        // Fallback to uncompressed
        response = await fetch('questions.json');
        if (!response.ok) {
            throw new Error('Failed to load questions');
        }
        window.questions = await response.json();

        window.companies.clear();
        window.questions.forEach(question => {
            const companies = typeof question.Companies === 'string' 
                ? JSON.parse(question.Companies.replace(/'/g, '"')) 
                : question.Companies;
            
            if (Array.isArray(companies)) {
                companies.forEach(company => window.companies.add(company));
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
    const companiesSelect = document.getElementById('companies');
    companiesSelect.innerHTML = '<option value="all">All Companies</option>';
    
    // Sort companies alphabetically
    const sortedCompanies = Array.from(window.companies).sort();
    
    sortedCompanies.forEach(company => {
        const option = document.createElement('option');
        option.value = company;
        option.textContent = company;
        companiesSelect.appendChild(option);
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
    const selectedCompanies = Array.from(document.getElementById('companies').selectedOptions)
        .map(option => option.value);
    const problemsContainer = document.getElementById('problems');
    
    if (!window.questions || window.questions.length === 0) {
        await loadQuestions();
        return;
    }
    
    const filteredQuestions = window.questions.filter(problem => {
        // Check difficulty
        const difficultyMatch = difficulty === 'all' || 
            problem.Difficulty.toLowerCase() === difficulty;
        
        // Check companies
        const companies = typeof problem.Companies === 'string'
            ? JSON.parse(problem.Companies.replace(/'/g, '"'))
            : problem.Companies;
            
        const companiesMatch = selectedCompanies.includes('all') ||
            selectedCompanies.length === 0 ||
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

document.getElementById('difficulty').addEventListener('change', () => {
    window.currentPage = 1; // Reset to first page on filter change
    filterProblems();
});

document.getElementById('companies').addEventListener('change', () => {
    window.currentPage = 1; // Reset to first page on filter change
    filterProblems();
});


// Initial load
filterProblems();

window.addEventListener('resize', _.debounce(() => {
    filterProblems();
}, 250));

