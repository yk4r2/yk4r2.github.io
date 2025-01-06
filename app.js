const { createApp, ref, computed, onMounted } = Vue;

createApp({
    data() {
        return {
            questions: [],
            selectedCompanies: [],
            includedTopics: [],
            excludedTopics: [],
            includedTags: [],
            excludedTags: [],
            selectedDifficulty: '',
            minInternalDifficulty: null,
            maxInternalDifficulty: null,
            addedAfter: null,
            showSolved: true,
            showRepeated: true
        }
    },

    computed: {
        // Unique values for filters
        uniqueCompanies() {
            const companies = new Set();
            this.questions.forEach(q => {
                if (q.companies && Array.isArray(q.companies)) {
                    q.companies.forEach(c => companies.add(c));
                }
            });
            return Array.from(companies).sort();
        },

        uniqueTopics() {
            return [...new Set(this.questions.map(q => q.topic))].sort();
        },

        uniqueTags() {
            const tags = new Set();
            this.questions.forEach(q => {
                if (q.tags && Array.isArray(q.tags)) {
                    q.tags.forEach(t => tags.add(t));
                }
            });
            return Array.from(tags).sort();
        },

        // Stats for topics
       topicStats() {
            const stats = {};
            this.questions.forEach(topic => {
                if (!topic) return;  // Skip if topic is undefined
                const topicName = topic.topic || 'Unknown';  // Use 'Unknown' if topic is missing
                if (!stats[topicName]) {
                    stats[topicName] = {
                        total: 0,
                        unsolved: 0
                    };
                }
                stats[topicName].total++;
                if (!topic.solved) {
                    stats[topicName].unsolved++;
                }
            });
            return stats;
        },

        // Filtered questions
        filteredQuestions() {
            return this.questions.filter(q => {
                // Companies filter
                if (this.selectedCompanies.length > 0) {
                    if (!q.companies || !q.companies.some(c => this.selectedCompanies.includes(c))) {
                        return false;
                    }
                }

                // Topics filter (inclusion and exclusion)
                if (this.includedTopics.length > 0 && !this.includedTopics.includes(q.topic)) {
                    return false;
                }
                if (this.excludedTopics.length > 0 && this.excludedTopics.includes(q.topic)) {
                    return false;
                }

                // Tags filter (inclusion and exclusion)
                if (this.includedTags.length > 0) {
                    if (!q.tags || !this.includedTags.some(t => q.tags.includes(t))) {
                        return false;
                    }
                }

                if (this.excludedTags.length > 0 && 
                    this.excludedTags.some(t => q.tags.includes(t))) {
                    return false;
                }

                // Difficulty filter
                if (this.selectedDifficulty && q.difficulty !== this.selectedDifficulty) {
                    return false;
                }

                // Internal difficulty range
                if (this.minInternalDifficulty !== null && 
                    q.internal_difficulty < this.minInternalDifficulty) {
                    return false;
                }
                if (this.maxInternalDifficulty !== null && 
                    q.internal_difficulty > this.maxInternalDifficulty) {
                    return false;
                }

                // Date filter
                if (this.addedAfter) {
                    const questionDate = new Date(q.last_edited_at);
                    const filterDate = new Date(this.addedAfter);
                    if (questionDate < filterDate) {
                        return false;
                    }
                }

                // Solved/Repeated status
                if (!this.showSolved && q.solved) return false;
                if (!this.showRepeated && q.repeated) return false;

                return true;
            });
        }
    },

    methods: {
        async loadQuestions() {
            try {
                // Use the full path to questions.json
                const response = await fetch('/questions.json');
                if (!response.ok) {
                    // Fallback to relative path if full path fails
                    const fallbackResponse = await fetch('./questions.json');
                    if (!fallbackResponse.ok) {
                        throw new Error('Could not load questions');
                    }
                    this.questions = await fallbackResponse.json();
                } else {
                    this.questions = await response.json();
                }
                
                // Load solved states from localStorage
                const solvedStates = JSON.parse(localStorage.getItem('solvedStates') || '{}');
                this.questions.forEach(q => {
                    const state = solvedStates[q.url] || {};
                    q.solved = state.solved || false;
                    q.repeated = state.repeated || false;
                });
            } catch (error) {
                console.error('Error loading questions:', error);
                document.body.innerHTML = 'Error loading questions. Please ensure questions.json is present.';
            }
        },

        toggleCompany(company) {
            const index = this.selectedCompanies.indexOf(company);
            if (index === -1) {
                this.selectedCompanies.push(company);
            } else {
                this.selectedCompanies.splice(index, 1);
            }
        },

        toggleTopic(topic) {
            if (this.includedTopics.includes(topic)) {
                // Remove from included, add to excluded
                this.includedTopics = this.includedTopics.filter(t => t !== topic);
                this.excludedTopics.push(topic);
            } else if (this.excludedTopics.includes(topic)) {
                // Remove from excluded
                this.excludedTopics = this.excludedTopics.filter(t => t !== topic);
            } else {
                // Add to included
                this.includedTopics.push(topic);
            }
        },

        toggleTag(tag) {
            if (this.includedTags.includes(tag)) {
                // Remove from included, add to excluded
                this.includedTags = this.includedTags.filter(t => t !== tag);
                this.excludedTags.push(tag);
            } else if (this.excludedTags.includes(tag)) {
                // Remove from excluded
                this.excludedTags = this.excludedTags.filter(t => t !== tag);
            } else {
                // Add to included
                this.includedTags.push(tag);
            }
        },

        toggleSolved(question) {
            question.solved = !question.solved;
            this.saveSolvedStates();
        },

        toggleRepeated(question) {
            question.repeated = !question.repeated;
            this.saveSolvedStates();
        },

        saveSolvedStates() {
            const states = {};
            this.questions.forEach(q => {
                states[q.url] = {
                    solved: q.solved,
                    repeated: q.repeated
                };
            });
            localStorage.setItem('solvedStates', JSON.stringify(states));
        },

        formatDate(dateStr) {
            if (!dateStr) return 'N/A';
            return new Date(dateStr).toLocaleDateString();
        }
    },

    mounted() {
        this.loadQuestions();
    }
}).mount('#app');
