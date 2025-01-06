from bs4 import BeautifulSoup
import json
from pathlib import Path


def parse_question_file(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        soup = BeautifulSoup(f.read(), "html.parser")

    questions = []

    # Find all question containers
    containers = soup.find_all("div", class_="question-container")

    for container in containers:
        question = {}

        # Get URL
        url_elem = container.find("a")
        question["url"] = url_elem["href"] if url_elem else None

        # Get table data (metadata)
        table = container.find("table")
        if table:
            rows = table.find_all("tr")
            for row in rows:
                cells = row.find_all("td")
                if len(cells) == 2:
                    key = cells[0].text.strip().replace(":", "")
                    value = cells[1].text.strip()

                    # Handle lists for Tags and Companies
                    if key in ["Tags", "Companies"]:
                        try:
                            # Convert string representation of list to actual list
                            value = eval(value) if value != "[]" else []
                        except:
                            value = []

                    # Handle Internal Difficulty as number
                    elif key == "Internal Difficulty":
                        try:
                            value = int(value)
                        except:
                            value = 0

                    # Handle Last Edited at as datetime
                    elif key == "Last Edited at":
                        if value.lower() != "none":
                            from datetime import datetime

                            try:
                                # Parse datetime with timezone
                                date_part, tz_part = value.rsplit(" ", 1)
                                value = datetime.strptime(
                                    date_part, "%Y-%m-%d %H:%M:%S"
                                )
                                value = value.isoformat() + " " + tz_part
                            except:
                                value = None
                        else:
                            value = None
                    question[key] = value

        # Get Task
        task_section = container.find("h3", string="Task")
        if task_section and task_section.find_next("p"):
            question["task"] = task_section.find_next("p").text.strip()

        # Get Hint
        hint_details = container.find("details", recursive=False)
        if hint_details and hint_details.find("p"):
            question["hint"] = hint_details.find("p").text.strip()

        # Get Solution
        solution_details = hint_details.find_next("details") if hint_details else None
        if solution_details and solution_details.find("p"):
            question["solution"] = solution_details.find("p").text.strip()

        # Get Answer
        answer_details = (
            solution_details.find_next("details") if solution_details else None
        )
        if answer_details:
            answers = answer_details.find_all("li")
            question["answers"] = [ans.text.strip() for ans in answers]

        questions.append(question)

    return questions


if __name__ == "__main__":
    all_questions = []

    for file_path in Path("./").glob("*.html"):
        questions = parse_question_file(file_path)
        all_questions.extend(questions)

    with open("questions.json", "w", encoding="utf-8") as f:
        json.dump(all_questions, f, ensure_ascii=False, indent=2)
