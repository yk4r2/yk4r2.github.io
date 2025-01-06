window.questions = [];
window.currentPage = 1;

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
        await filterProblems();
        
    } catch (error) {
        console.error('Error loading questions:', error);
        document.getElementById('problems').innerHTML = 
            '<div class="loading">Error loading problems. Please try again later.</div>';
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
            <div class="problem-header-top">
                <span class="topic">${problem.Topic}</span>
                <span class="difficulty ${problem.Difficulty.toLowerCase()}">${problem.Difficulty}</span>
            </div>
            ${problem.url ? `<a href="${problem.url}" class="problem-link" target="_blank">View Original Problem →</a>` : ''}
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
    const problemsContainer = document.getElementById('problems');
    
    if (!window.questions || window.questions.length === 0) {
        await loadQuestions();
        return;
    }
    
    const filteredQuestions = window.questions
        .filter(problem => difficulty === 'all' || problem.Difficulty.toLowerCase() === difficulty);

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

// Initial load
filterProblems();
