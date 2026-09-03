"""Public, rate-limited AI chat endpoint used by the portal's AI widgets."""

from __future__ import annotations

import os
from collections import defaultdict, deque
from threading import Lock
from time import monotonic

from fastapi import APIRouter, HTTPException, Request, status

from ..ai import AIConfigurationError, AIProviderRateLimitError, AIProviderUnavailableError, configured_model, generate_ai_reply
from ..schemas import AIRequest

router = APIRouter(prefix="/api/ai", tags=["AI Assistant"])

_request_history: dict[str, deque[float]] = defaultdict(deque)
_history_lock = Lock()


def _setting(name: str, default: int) -> int:
    try:
        return max(1, int(os.getenv(name, str(default))))
    except ValueError:
        return default


def _check_rate_limit(client_id: str) -> None:
    limit = _setting("AI_RATE_LIMIT_REQUESTS", 10)
    window_seconds = _setting("AI_RATE_LIMIT_WINDOW_SECONDS", 300)
    now = monotonic()
    with _history_lock:
        timestamps = _request_history[client_id]
        while timestamps and now - timestamps[0] >= window_seconds:
            timestamps.popleft()
        if len(timestamps) >= limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many AI requests. Please wait a few minutes and try again.",
            )
        timestamps.append(now)


def _raise_ai_http_error(error: Exception) -> None:
    if isinstance(error, AIConfigurationError):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service is not configured yet. Please ask the school administrator to add the server API key.",
        ) from error
    if isinstance(error, AIProviderRateLimitError):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="AI is busy right now. Please try again shortly.",
        ) from error
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="AI service is temporarily unavailable. Please try again shortly.",
    ) from error


@router.post("/chat")
def chat(payload: AIRequest, request: Request) -> dict[str, str]:
    """Answer a general school question without exposing the OpenAI key to the browser."""
    client_id = request.client.host if request.client else "unknown"
    _check_rate_limit(client_id)
    try:
        answer = generate_ai_reply(payload.prompt, payload.audience)
    except (AIConfigurationError, AIProviderRateLimitError, AIProviderUnavailableError) as error:
        _raise_ai_http_error(error)
    return {"answer": answer, "model": configured_model()}
