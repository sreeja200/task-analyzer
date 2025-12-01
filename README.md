# 🎯 Smart Task Analyzer

![Smart Task Analyzer](https://github.com/user-attachments/assets/d7390e84-dfb1-44f9-8828-a3001a52e7c3)

A lightweight task-prioritization system built using **Django + Vanilla JS**, scoring tasks based on urgency, importance, effort, and dependencies.

- 🔗 **Frontend (Live):** https://task-analyzer-app.netlify.app/
- 🔗 **Backend (Live):** https://sreejagunnam.pythonanywhere.com/

---

## 🚀 Tech Stack
 
| Layer | Technology |
|-------|-------------|
| Frontend | HTML, CSS, JavaScript |
| Backend | Python, Django |
| API Testing | Postman |
| Deployment (Frontend) | Netlify |
| Deployment (Backend) | PythonAnywhere |

---

## 1. Setup Instructions

### Backend

```bash
git clone https://github.com/sreeja200/task-analyzer.git
cd task-analyzer
python -m venv venv
venv\Scripts\activate    # Windows
pip install -r requirements.txt
python manage.py runserver
```

### Frontend

```bash
frontend/index.html
```
---

## 2. 🔌API Endpoints

### Task Analysis

- POST /api/tasks/analyze/ - Analyze a list of tasks, calculate scores, sort them, and return explanations.
- GET /api/tasks/suggest/ - Return the top 3 tasks with reasoning (Smart Balance scoring).

---

## 3. Algorithm Explanation
The scoring algorithm combines four key factors:

### Urgency
Overdue tasks receive the highest boost. Tasks due in the next few days also get significant weight.
Urgency is weighted more than effort because deadlines impose strict constraints.

### Importance
A user-defined score (1–10), multiplied by a weight to reflect impact.

### Effort
Quick tasks (<2 hours) receive a small bonus. Very long tasks receive a small penalty.

### Dependencies
Tasks that unblock other tasks receive additional points.

###### Core Logic Snippet

```python
if overdue: score += 100
elif due_in_3_days: score += 50
score += importance * 5
if effort < 2: score += 10
score += len(dependencies) * 3
```
Tasks are sorted by their final score in descending order.

---

## 3. Design Decisions
- Gave higher weight to urgency for realistic prioritization
- Added simple explanations for each score
- Implemented validation for missing or invalid fields
- Added circular dependency detection to avoid invalid task graphs
- Kept the frontend minimal and easy to test

---

## 4. Time Breakdown
- Backend Models & Views — 1 hrs
- Scoring Algorithm — 45 min
- Frontend UI + API Integration — 1 hrs
- Deployment — 30 mins
- Debugging & Cleanup — 30 min

---

## 5. Future Improvements
- Eisenhower Matrix view
- Weekend/holiday-aware urgency
- Adaptive scoring based on user feedback
- Dependency graph visualization
- Unit tests for scoring logic

---
