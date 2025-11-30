import json
from django.http import JsonResponse, HttpResponseBadRequest
from django.views.decorators.csrf import csrf_exempt
from .scoring import (
    calculate_task_score,
    detect_circular_dependencies,
    validate_tasks,
)

# =============================================================
# Helper — Build explanation text for each task
# =============================================================
def build_explanation(task):
    parts = []

    # ---- urgency ----
    due = task.get("due_date")
    if due:
        parts.append("due soon")
    else:
        parts.append("no due date")

    # ---- importance ----
    imp = task.get("importance")
    if isinstance(imp, int):
        parts.append(f"importance {imp}/10")

    # ---- effort ----
    eff = task.get("estimated_hours")
    if eff is not None:
        parts.append(f"effort {eff}h")
        if eff < 2:
            parts.append("quick win")
        elif eff > 8:
            parts.append("long task")

    # ---- dependencies ----
    deps = task.get("dependencies", [])
    if deps:
        parts.append(f"{len(deps)} dependencies")

    return "; ".join(parts)


# =============================================================
# ANALYZE TASKS (POST)
# =============================================================
@csrf_exempt
def analyze_tasks(request):
    if request.method != "POST":
        return HttpResponseBadRequest("Use POST with a JSON array or JSON object.")

    # Load JSON body
    try:
        body = json.loads(request.body.decode("utf-8"))

        if isinstance(body, dict):
            tasks = body.get("tasks", [])
            options = body.get("options", {})
            weights = options.get("weights")
        elif isinstance(body, list):
            tasks = body
            weights = None
        else:
            return HttpResponseBadRequest("Invalid JSON format.")
    except Exception:
        return HttpResponseBadRequest("Invalid JSON body.")

    # Validation
    errors = validate_tasks(tasks)
    if errors:
        return JsonResponse({"errors": errors}, status=400)

    # Cycle detection
    cycle = detect_circular_dependencies(tasks)
    if cycle:
        return JsonResponse(
            {"error": f"Circular dependency detected: {cycle}"},
            status=400
        )

    # Scoring + Explanation
    results = []
    for t in tasks:
        t = dict(t)
        score = calculate_task_score(t, weights=weights)
        t["score"] = score
        t["explanation"] = build_explanation(t)
        results.append(t)

    # Sort by score desc
    results.sort(key=lambda x: x["score"], reverse=True)
    return JsonResponse(results, safe=False)


# =============================================================
# SUGGEST TASKS (GET or POST)
# =============================================================
@csrf_exempt
def suggest_tasks(request):

    # ----- GET -----
    if request.method == "GET":
        raw = request.GET.get("tasks")
        if not raw:
            return HttpResponseBadRequest("GET requires ?tasks=<json-array>")
        try:
            tasks = json.loads(raw)
        except Exception:
            return HttpResponseBadRequest("Invalid JSON in query.")
        weights = None

    # ----- POST -----
    elif request.method == "POST":
        try:
            body = json.loads(request.body.decode("utf-8"))
            if isinstance(body, dict):
                tasks = body.get("tasks", [])
                options = body.get("options", {})
                weights = options.get("weights")
            elif isinstance(body, list):
                tasks = body
                weights = None
            else:
                return HttpResponseBadRequest("Invalid JSON format.")
        except Exception:
            return HttpResponseBadRequest("Invalid JSON body.")

    else:
        return HttpResponseBadRequest("Use GET or POST.")

    # Validation
    errors = validate_tasks(tasks)
    if errors:
        return JsonResponse({"errors": errors}, status=400)

    # Circular detection
    cycle = detect_circular_dependencies(tasks)
    if cycle:
        return JsonResponse(
            {"error": f"Circular dependency detected: {cycle}"},
            status=400
        )

    # Score tasks
    scored = []
    for t in tasks:
        t = dict(t)
        score = calculate_task_score(t, weights=weights)
        explanation = build_explanation(t)
        scored.append({**t, "score": score, "explanation": explanation})

    scored.sort(key=lambda x: x["score"], reverse=True)

    # Top 3 only
    top3 = scored[:3]
    suggestions = [
        {
            "title": t["title"],
            "due_date": t.get("due_date"),
            "score": t["score"],
            "why": t["explanation"],
        }
        for t in top3
    ]

    return JsonResponse({"suggestions": suggestions})
