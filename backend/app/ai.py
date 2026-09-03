"""Server-side OpenAI integration for the Sheerwood AI assistant."""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from openai import APIConnectionError, APIStatusError, APITimeoutError, AuthenticationError, OpenAI, RateLimitError


# This reads backend/.env for local development without overriding real server variables.
load_dotenv(Path(__file__).resolve().parents[1] / ".env")


class AIConfigurationError(Exception):
    """Raised when the server has not been configured with an OpenAI API key."""


class AIProviderUnavailableError(Exception):
    """Raised when OpenAI cannot be reached or cannot complete the request."""


class AIProviderRateLimitError(Exception):
    """Raised when the OpenAI account rate limit has been reached."""


BASE_INSTRUCTIONS = """
You are Sheerwood AI, the helpful assistant for Sheerwood International School.
Help with admissions, documents, eligibility, application steps, school information,
and general school support. Be warm, concise, and practical. Use short bullet points
when they improve clarity. Do not invent school policies, fees, application decisions,
student records, or deadlines. When a request needs official confirmation, say that the
school admissions office can confirm it. Do not request or repeat passwords, card details,
government IDs, addresses, or other sensitive personal information. Keep replies under
180 words unless the user explicitly asks for a detailed draft.
""".strip()

ROLE_INSTRUCTIONS = {
    "guest": "The visitor is exploring admissions. Offer next steps in clear, parent-friendly language.",
    "parent": "The user is a parent. Focus on admission guidance and explain when the portal or admissions team should be used.",
    "teacher": "The user is a teacher. You may draft lesson ideas, homework, quizzes, feedback, and improvement plans. Treat any class data as illustrative unless it was explicitly provided in the request.",
    "admin": "The user is a school administrator. You may draft operational summaries, document-check checklists, notices, and fee reminder templates. Do not make final admissions or financial decisions.",
}


@lru_cache(maxsize=1)
def get_openai_client() -> OpenAI:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise AIConfigurationError("OPENAI_API_KEY is not configured on the server.")
    return OpenAI(api_key=api_key)


def configured_model() -> str:
    return os.getenv("OPENAI_MODEL", "gpt-5")


def generate_ai_reply(prompt: str, audience: str = "guest") -> str:
    """Send a safe, school-specific prompt to OpenAI and return plain assistant text."""
    instructions = f"{BASE_INSTRUCTIONS}\n\n{ROLE_INSTRUCTIONS.get(audience, ROLE_INSTRUCTIONS['guest'])}"
    try:
        response = get_openai_client().responses.create(
            model=configured_model(),
            instructions=instructions,
            input=prompt.strip(),
            max_output_tokens=550,
            store=False,
        )
    except AuthenticationError as exc:
        raise AIConfigurationError("The configured OpenAI API key is invalid.") from exc
    except RateLimitError as exc:
        raise AIProviderRateLimitError("The OpenAI API rate limit has been reached.") from exc
    except (APIConnectionError, APITimeoutError, APIStatusError) as exc:
        raise AIProviderUnavailableError("The OpenAI service is temporarily unavailable.") from exc

    answer = (response.output_text or "").strip()
    if not answer:
        raise AIProviderUnavailableError("The OpenAI service returned an empty response.")
    return answer
