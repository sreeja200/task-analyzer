from datetime import date, datetime

# -----------------------------------------------------------
# CYCLE DETECTION — detects circular dependencies using DFS
# -----------------------------------------------------------
# Detect circular dependencies (treat dependencies as indices)
def detect_circular_dependencies(tasks):
    """
    Detect circular dependency. Accepts dependencies as either
    integer indices (0..n-1) or task titles (strings).
    Returns a cycle string like "A → B → C → A" if a cycle is found,
    otherwise returns None.
    """
    n = len(tasks)

    # build title -> index map for string dependencies
    title_to_idx = {}
    for i, t in enumerate(tasks):
        title = t.get("title")
        if isinstance(title, str) and title.strip():
            title_to_idx[title] = i

    # normalize graph to indices (may filter out unknown deps)
    graph = {i: [] for i in range(n)}
    for i, t in enumerate(tasks):
        for dep in t.get("dependencies", []) or []:
            if isinstance(dep, int) and 0 <= dep < n:
                graph[i].append(dep)
            elif isinstance(dep, str):
                idx = title_to_idx.get(dep)
                if idx is not None:
                    graph[i].append(idx)
            # ignore unknown dependency entries

    visited = [0] * n        # 0 = unvisited, 1 = visiting, 2 = visited
    stack = []               # current DFS stack (indices)

    def dfs(u):
        visited[u] = 1
        stack.append(u)
        for v in graph.get(u, []):
            if visited[v] == 0:
                found = dfs(v)
                if found:
                    return found
            elif visited[v] == 1:
                # cycle detected: extract cycle path from stack
                if v in stack:
                    idx = stack.index(v)
                    cycle_idxs = stack[idx:] + [v]
                else:
                    cycle_idxs = [v, v]
                # convert to titles if available else use indices
                def name(i):
                    t = tasks[i].get("title")
                    return t if isinstance(t, str) and t.strip() else str(i)
                cycle_names = " → ".join(name(i) for i in cycle_idxs)
                return cycle_names
        stack.pop()
        visited[u] = 2
        return None

    for i in range(n):
        if visited[i] == 0:
            res = dfs(i)
            if res:
                return res
    return None


# -----------------------------------------------------------
# VALIDATION — checks missing/invalid fields before scoring
# -----------------------------------------------------------
def validate_tasks(tasks):
    errors = []

    required_fields = ["title", "due_date", "estimated_hours", "importance"]

    for i, task in enumerate(tasks):
        # Check required fields
        for field in required_fields:
            if field not in task or task[field] in [None, ""]:
                errors.append({
                    "index": i,
                    "field": field,
                    "problem": "missing or empty"
                })

        # Check due date format
        if "due_date" in task:
            try:
                if isinstance(task["due_date"], str):
                    datetime.fromisoformat(task["due_date"])
            except Exception:
                errors.append({
                    "index": i,
                    "field": "due_date",
                    "problem": "invalid date format, must be YYYY-MM-DD"
                })

        # Check importance range
        if "importance" in task:
            if not isinstance(task["importance"], int) or not (1 <= task["importance"] <= 10):
                errors.append({
                    "index": i,
                    "field": "importance",
                    "problem": "must be an integer 1–10"
                })

        # Check effort
        if "estimated_hours" in task:
            if not isinstance(task["estimated_hours"], int) or task["estimated_hours"] < 0:
                errors.append({
                    "index": i,
                    "field": "estimated_hours",
                    "problem": "must be a positive integer"
                })

    return errors



# -----------------------------------------------------------
# DEFAULT WEIGHTS — used if user does NOT pass custom weights
# -----------------------------------------------------------
DEFAULT_WEIGHTS = {
    "urgency_overdue": 100,    # Task is overdue
    "urgency_due_3": 50,       # Due within 3 days
    "urgency_due_7": 20,       # Due within 7 days
    "importance_mul": 5,       # Weight for importance rating
    "quickwin_bonus": 10,      # Bonus for tasks < 2 hours
    "longtask_penalty": -5,    # Penalty for tasks > 8 hours
    "dependency_mul": 3        # Bonus per dependency (task unblocks others)
}


# -----------------------------------------------------------
# TASK SCORING — supports configurable weighting
# -----------------------------------------------------------
def calculate_task_score(task, weights=None):
    """
    Calculates priority score for a task.
    Higher score = higher priority.
    Uses DEFAULT_WEIGHTS unless custom 'weights' is provided.
    """

    # Merge default weights with user-provided ones (if any)
    w = DEFAULT_WEIGHTS.copy()
    if isinstance(weights, dict):
        w.update(weights)

    score = 0

    # -------------------------------------------------------
    # 1) URGENCY — overdue / due soon / due later
    # -------------------------------------------------------
    due = task.get("due_date")

    # Convert ISO date string to date object
    if isinstance(due, str):
        try:
            due = datetime.fromisoformat(due).date()
        except Exception:
            return -999  # Invalid date → lowest priority

    today = date.today()

    if due < today:
        score += w["urgency_overdue"]
    else:
        days = (due - today).days
        if days <= 3:
            score += w["urgency_due_3"]
        elif days <= 7:
            score += w["urgency_due_7"]

    # -------------------------------------------------------
    # 2) IMPORTANCE — user-provided 1–10 score
    # -------------------------------------------------------
    importance = task.get("importance", 5)
    score += importance * w["importance_mul"]

    # -------------------------------------------------------
    # 3) EFFORT — quick wins vs large tasks
    # -------------------------------------------------------
    effort = task.get("estimated_hours", 1)
    if effort < 2:
        score += w["quickwin_bonus"]
    elif effort > 8:
        score += w["longtask_penalty"]

    # -------------------------------------------------------
    # 4) DEPENDENCIES — task that unlocks others
    # -------------------------------------------------------
    deps = task.get("dependencies", [])
    if deps:
        score += len(deps) * w["dependency_mul"]

    return score

