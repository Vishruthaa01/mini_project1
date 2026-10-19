"""
Speech-to-Text (STT) Service & Adapters
---------------------------------------
Transcribes voice recordings from Indian artisans speaking in English, Hindi,
or mixed Hinglish.
Provides an adapter pattern so external providers (Groq Whisper, Bhashini, faster-whisper)
can be swapped seamlessly via environment variables.
"""

import os
import io
from typing import Dict, Any

AI_MOCK = os.getenv("AI_MOCK", "true").strip().lower() in ("true", "1", "yes")
STT_PROVIDER = os.getenv("STT_PROVIDER", "mock").strip().lower()
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")


class MockSTTAdapter:
    """Mock Speech-to-Text adapter returning realistic artisan voice transcripts."""
    def transcribe(self, audio_bytes: bytes, filename: str = "audio.webm", language_hint: str = None) -> Dict[str, Any]:
        # Realistic Indian artisan voice note transcript
        return {
            "transcript": "यह शुद्ध रेशमी हाथ से बुनी हुई बनारसी साड़ी है, जिसमें जरी का पारंपरिक काम और लाल-सुनहरा बॉर्डर है।",
            "detectedLanguage": language_hint or "hi"
        }


class GroqWhisperAdapter:
    """Groq Cloud Whisper Large-V3 adapter for ultra-fast, high-accuracy transcription."""
    def __init__(self, api_key: str):
        self.api_key = api_key

    def transcribe(self, audio_bytes: bytes, filename: str = "audio.webm", language_hint: str = None) -> Dict[str, Any]:
        import httpx

        if not self.api_key:
            raise ValueError("GROQ_API_KEY is not configured in environment")

        headers = {
            "Authorization": f"Bearer {self.api_key}"
        }
        files = {
            "file": (filename or "audio.webm", audio_bytes, "audio/webm")
        }
        data = {
            "model": "whisper-large-v3",
            "response_format": "verbose_json"
        }
        if language_hint:
            data["language"] = language_hint

        with httpx.Client(timeout=30.0) as client:
            resp = client.post(
                "https://api.groq.com/openai/v1/audio/transcriptions",
                headers=headers,
                files=files,
                data=data
            )
            resp.raise_for_status()
            result = resp.json()
            return {
                "transcript": result.get("text", "").strip(),
                "detectedLanguage": result.get("language", language_hint or "unknown")
            }


def transcribe_audio(audio_bytes: bytes, filename: str = "audio.webm", language_hint: str = None) -> Dict[str, Any]:
    """
    Main entry point for speech transcription. Delegates to configured adapter.
    """
    if AI_MOCK or STT_PROVIDER == "mock":
        return MockSTTAdapter().transcribe(audio_bytes, filename, language_hint)

    if STT_PROVIDER == "groq":
        return GroqWhisperAdapter(GROQ_API_KEY).transcribe(audio_bytes, filename, language_hint)

    # Fallback to mock adapter if unknown provider specified
    return MockSTTAdapter().transcribe(audio_bytes, filename, language_hint)
