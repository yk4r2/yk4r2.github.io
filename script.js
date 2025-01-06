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
    
    // Trigger MathJax to process the new content
    MathJax.typesetPromise([card]);
    return card;
}

async function filterProblems() {
    const difficulty = document.getElementById('difficulty').value;
    const problemsContainer = document.getElementById('problems');
    
    // Get questions if not already loaded
    if (!window.questions) {
        window.questions = await loadQuestions();
    }
    
    problemsContainer.innerHTML = '';
    
    window.questions
        .filter(problem => difficulty === 'all' || problem.Difficulty.toLowerCase() === difficulty)
        .forEach(problem => {
            problemsContainer.appendChild(createProblemCard(problem));
        });
}

document.getElementById('difficulty').addEventListener('change', filterProblems);

// Initial load
filterProblems();
