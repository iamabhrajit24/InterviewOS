# pyrefly: ignore [missing-import]
import httpx
import json
import asyncio
from typing import AsyncGenerator
from app.core.config import settings

async def generate_gemini_response_stream(
    messages: list,
    stop_event: asyncio.Event
) -> AsyncGenerator[str, None]:
    """
    Calls Gemini API using httpx and streams back individual text tokens in real time.
    """
    if not settings.GEMINI_API_KEY:
        yield " [Gemini Error: GEMINI_API_KEY is not set. Please add it to your .env file.]"
        return

    # Convert standard chat messages format to Gemini format
    # {"role": "system"/"user"/"assistant", "content": "..."} -> {"role": "user"/"model", "parts": [{"text": "..."}]}
    gemini_contents = []
    system_instruction = ""

    for msg in messages:
        role = msg.get("role")
        content = msg.get("content", "")
        
        if role == "system":
            system_instruction = content
        elif role == "user":
            gemini_contents.append({
                "role": "user",
                "parts": [{"text": content}]
            })
        else: # assistant/ai
            gemini_contents.append({
                "role": "model",
                "parts": [{"text": content}]
            })

    # Prepare request payload
    payload = {
        "contents": gemini_contents,
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": 1024,
        }
    }
    if system_instruction:
        payload["systemInstruction"] = {
            "parts": [{"text": system_instruction}]
        }

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?key={settings.GEMINI_API_KEY}"

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            async with client.stream("POST", url, json=payload) as response:
                if response.status_code != 200:
                    error_text = await response.aread()
                    print(f"[Gemini API HTTP Error]: {response.status_code} - {error_text.decode()}")
                    yield " [AI Error: Could not connect to Gemini backend.]"
                    return

                # Read line-by-line (NDJSON/JSON array stream)
                buffer = ""
                async for line in response.aiter_lines():
                    if stop_event.is_set():
                        break

                    line = line.strip()
                    if not line:
                        continue

                    # Clean the streaming brackets if it is a JSON array
                    if line.startswith("[") or line.startswith(","):
                        line = line[1:].strip()
                    if line.endswith("]"):
                        line = line[:-1].strip()

                    try:
                        data = json.loads(line)
                        candidates = data.get("candidates", [])
                        if candidates:
                            parts = candidates[0].get("content", {}).get("parts", [])
                            if parts:
                                token = parts[0].get("text", "")
                                if token:
                                    yield token
                    except Exception:
                        # Sometimes chunks split across lines, accumulate buffer
                        pass

    except Exception as e:
        print(f"[Gemini Exception]: {e}")
        yield " [Gemini Error: Connection failed.]"
