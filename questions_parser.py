from bs4 import BeautifulSoup
from pathlib import Path
import json
import re
from datetime import datetime

def clean_text(text):
    """Clean text by removing extra whitespace and normalizing spaces"""
    if text is None:
        return None
    return ' '.join(text.strip().split())

def parse_value(key, value):
    """Parse specific field values based on their keys"""
    if value is None or value.lower() == 'none':
        return None
        
    if key in ['Tags', 'Companies']:
        try:
            # Handle array-like strings
            cleaned = value.replace("'", '"')  # Replace single quotes with double quotes
            return json.loads(cleaned)
        except:
            return []
            
    elif key == 'Internal Difficulty':
        try:
            return int(value)
        except:
            return None
            
    elif key == 'Last Edited at':
        try:
            # Parse datetime with timezone
            date_part, tz_part = value.rsplit(' ', 1)
            dt = datetime.strptime(date_part, '%Y-%m-%d %H:%M:%S')
            return f"{dt.isoformat()} {tz_part}"
        except:
            return None
            
    return value

def parse_html_content(html_content):
    """Parse HTML content and extract question data"""
    soup = BeautifulSoup(html_content, 'html.parser')
    questions = []
    
    # Find all question containers (div elements with style containing 'max-width: 65%')
    containers = soup.find_all('div', style=lambda x: x and 'max-width: 65%' in x)
    
    for container in containers:
        question = {}
        
        # Get title (h2)
        title = container.find('h2')
        if title:
            question['title'] = clean_text(title.text)
            
        # Get URL
        url_elem = container.find('a')
        if url_elem:
            question['url'] = url_elem['href']
            
        # Get metadata from table
        table = container.find('table')
        if table:
            for row in table.find_all('tr'):
                cells = row.find_all('td')
                if len(cells) == 2:
                    key = clean_text(cells[0].text).replace(':', '')
                    value = clean_text(cells[1].text)
                    parsed_value = parse_value(key, value)
                    question[key] = parsed_value
                    
        # Get task
        task_section = container.find('h3', string='Task')
        if task_section and task_section.find_next('p'):
            question['task'] = clean_text(task_section.find_next('p').text)
            
        # Get hint
        hint_details = container.find('details')
        if hint_details and hint_details.find('p'):
            question['hint'] = clean_text(hint_details.find('p').text)
            
        # Get solution
        solution_details = None
        if hint_details:
            solution_details = hint_details.find_next('details')
        if solution_details and solution_details.find('p'):
            question['solution'] = clean_text(solution_details.find('p').text)
            
        # Get answers
        answer_details = None
        if solution_details:
            answer_details = solution_details.find_next('details')
        if answer_details:
            answers = answer_details.find_all('li')
            question['answers'] = [clean_text(ans.text) for ans in answers]
        
        questions.append(question)
        
    return questions

def process_document(doc_content):
    """Process document content and return questions"""
    # Parse the HTML content
    questions = parse_html_content(doc_content)
    return questions


if __name__ == "__main__":
    all_questions = []

    for file_path in Path('./').glob('*.html'):
        with open(file_path, 'r', encoding='utf-8') as f:
            doc_content = f.read()
        questions = process_document(doc_content)

        all_questions.extend(questions)

    with open('questions.json', 'w', encoding='utf-8') as f:
        json.dump(all_questions, f, ensure_ascii=False, indent=2)

    print(f"Successfully processed {len(all_questions)} questions")

