"""System One HTTP bridge for Laya (SPEC §10.4).

JEVIL treats any endpoint with this shape as a `systemone` connection. This
example is the smallest useful bridge: it exposes `/health` and `/v1/decide`,
answers CORS for the JEVIL origin, and either forwards to Laya's hosted API or
answers deterministically so the UI can be exercised without a key.

Run it locally, add "Local / custom" in JEVIL with `http://localhost:8000`, and
the browser calls this process directly. The key, if any, never leaves this
machine's process.
"""

from __future__ import annotations

import logging
import os
from typing import Any

import requests
from flask import Flask, jsonify, request
from werkzeug.exceptions import HTTPException

LAYAAI_BASE_URL = os.environ.get("LAYAAI_BASE_URL", "https://laya-model.com").rstrip("/")
LAYAAI_API_KEY = os.environ.get("LAYAAI_API_KEY", "").strip()
JEVIL_ORIGIN = os.environ.get("JEVIL_ORIGIN", "http://localhost:5173")
MODEL = os.environ.get("BRIDGE_MODEL", "english")
PORT = int(os.environ.get("PORT", "8000"))

MAX_BYTES = 256 * 1024
TIMEOUT_SECONDS = 15

app = Flask(__name__)
app.logger.setLevel(logging.WARNING)


@app.after_request
def cors(response: Any) -> Any:
    response.headers["Access-Control-Allow-Origin"] = JEVIL_ORIGIN
    response.headers["Access-Control-Allow-Headers"] = "authorization, content-type, x-api-key"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Max-Age"] = "600"
    response.headers["Vary"] = "Origin"
    return response


@app.get("/health")
def health() -> Any:
    return jsonify({"ok": True, "model": MODEL, "capabilities": ["text"]})


@app.route("/v1/decide", methods=["OPTIONS"])
def decide_options() -> Any:
    return ("", 204)


def fallback_answers(questions: dict[str, Any]) -> dict[str, Any]:
    """Deterministic answers so the bridge runs without a provider key."""
    answers: dict[str, Any] = {}

    for question_id, question in questions.items():
        kind = question.get("type")
        if kind == "choice":
            criteria = question.get("criteria") or {}
            if not criteria:
                continue
            first = next(iter(criteria))
            answers[question_id] = {
                "choice": first,
                "confidence": 0.7,
                "probabilities": {first: 1.0},
            }
        elif kind == "score":
            levels = question.get("criteria") or []
            if len(levels) < 2:
                continue
            answers[question_id] = {
                "score": 0.5,
                "confidence": 0.6,
                "level": len(levels) // 2,
                "levels": len(levels),
                "probabilities": {},
            }
        elif kind == "noul":
            answers[question_id] = {"noul": 0.5}

    return answers


def forward(body: dict[str, Any]) -> tuple[dict[str, Any], int]:
    headers = {"content-type": "application/json", "accept": "application/json"}
    if LAYAAI_API_KEY:
        headers["authorization"] = f"Bearer {LAYAAI_API_KEY}"

    try:
        upstream = requests.post(
            f"{LAYAAI_BASE_URL}/v1/decide",
            json=body,
            headers=headers,
            timeout=TIMEOUT_SECONDS,
            allow_redirects=False,
        )
    except requests.RequestException:
        return {"error": "network"}, 502

    if upstream.is_redirect:
        return {"error": "upstream"}, 502
    if upstream.status_code == 401 or upstream.status_code == 403:
        return {"error": "auth"}, 401
    if upstream.status_code == 429:
        return {"error": "rate_limit"}, 429
    if not upstream.ok:
        return {"error": "upstream"}, 502

    declared = upstream.headers.get("content-length")
    if declared:
        try:
            if int(declared) > MAX_BYTES:
                return {"error": "upstream"}, 502
        except ValueError:
            return {"error": "upstream"}, 502

    try:
        payload = upstream.json()
    except ValueError:
        return {"error": "upstream"}, 502

    if not isinstance(payload, dict) or not isinstance(payload.get("answers"), dict):
        return {"error": "upstream"}, 502

    return payload, 200


@app.post("/v1/decide")
def decide() -> Any:
    if request.content_length and request.content_length > MAX_BYTES:
        return jsonify({"error": "too_large"}), 413

    body = request.get_json(silent=True)
    if not isinstance(body, dict) or not isinstance(body.get("questions"), dict):
        return jsonify({"error": "invalid"}), 400

    if LAYAAI_API_KEY:
        payload, status = forward(body)
        return jsonify(payload), status

    answers = fallback_answers(body["questions"])
    return jsonify(
        {
            "model": MODEL,
            "answers": answers,
            "usage": {"input_tokens": 0, "output_tokens": 0, "billed_tokens": 0},
        }
    )


@app.errorhandler(Exception)
def internal(error: Exception) -> Any:
    # Never echo a traceback, a header, or a body to the client.
    if isinstance(error, HTTPException):
        return error
    return jsonify({"error": "internal"}), 500


if __name__ == "__main__":
    # Bind to loopback: the bridge is for this machine, not the network.
    app.run(host="127.0.0.1", port=PORT, debug=False)
