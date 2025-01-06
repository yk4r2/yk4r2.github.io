async function loadQuestions() {
    try {
        const response = await fetch('questions.json');
        if (!response.ok) {
            throw new Error('Failed to load questions');
        }
        return await response.json();
    } catch (error) {
        console.error('Error loading questions:', error);
        document.getElementById('problems').innerHTML = 
            '<div class="loading">Error loading problems. Please try again later.</div>';
        return [];
    }
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
    
    const tags = JSON.parse(problem.Tags.replace(/'/g, '"'));
    const companies = JSON.parse(problem.Companies.replace(/'/g, '"'));
    
    card.innerHTML = `
        <div class="problem-header">
            <span class="topic">${problem.Topic}</span>
            <span class="difficulty ${problem.Difficulty.toLowerCase()}">${problem.Difficulty}</span>
        </div>
        <div>${problem.task}</div>
        <div class="tags">
            ${tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
            ${companies.map(company => `<span class="tag">${company}</span>`).join('')}
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

    let startPage = Math.max(1, currentPage - 5);
    let endPage = Math.min(totalPages, currentPage + 5);

    // Adjust for first pages
    if (currentPage <= 5) {
        endPage = Math.min(totalPages, 10);
    }
    // Adjust for last pages
    if (currentPage > totalPages - 5) {
        startPage = Math.max(1, totalPages - 9);
    }

    // First page
    if (startPage > 1) {
        paginationContainer.appendChild(createPageButton(1, currentPage));
        if (startPage > 2) {
            paginationContainer.appendChild(createEllipsis());
        }
    }

    // Page numbers
    for (let i = startPage; i <= endPage; i++) {
        paginationContainer.appendChild(createPageButton(i, currentPage));
    }

    // Last page
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            paginationContainer.appendChild(createEllipsis());
        }
        paginationContainer.appendChild(createPageButton(totalPages, currentPage));
    }

    return paginationContainer;
}

function createPageButton(pageNum, currentPage) {
    const button = document.createElement('button');
    button.className = `page-button ${pageNum === currentPage ? 'active' : ''}`;
    button.textContent = pageNum;
    button.onclick = () => changePage(pageNum);
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
    const ITEMS_PER_PAGE = 5;
    const difficulty = document.getElementById('difficulty').value;
    const problemsContainer = document.getElementById('problems');
    
    // Get questions if not already loaded
    if (!window.questions) {
        window.questions = await loadQuestions();
    }
    
    // Filter questions by difficulty
    const filteredQuestions = window.questions
        .filter(problem => difficulty === 'all' || problem.Difficulty.toLowerCase() === difficulty);

    // Calculate pagination
    const totalPages = Math.ceil(filteredQuestions.length / ITEMS_PER_PAGE);
    window.currentPage = window.currentPage || 1;
    window.currentPage = Math.min(window.currentPage, totalPages); // Ensure current page is valid

    // Get current page items
    const startIndex = (window.currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const currentItems = filteredQuestions.slice(startIndex, endIndex);

    // Clear and populate container
    problemsContainer.innerHTML = '';
    
    // Add problems
    currentItems.forEach(problem => {
        problemsContainer.appendChild(createProblemCard(problem));
    });

    // Process MathJax for all new content
    MathJax.typesetPromise([problemsContainer]);

    // Update pagination
    const paginationContainer = document.getElementById('pagination');
    paginationContainer.innerHTML = '';
    paginationContainer.appendChild(createPagination(window.currentPage, totalPages));
}

document.getElementById('difficulty').addEventListener('change', () => {
    window.currentPage = 1; // Reset to first page on filter change
    filterProblems();
});

// Initial load
filterProblems();
