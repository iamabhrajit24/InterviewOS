import asyncio
from typing import AsyncGenerator
from groq import AsyncGroq
from app.core.config import settings

# Initialize Groq async client (lazy — only fails at runtime if key is missing)
client = AsyncGroq(api_key=settings.GROQ_API_KEY)

async def generate_interview_response_stream(
    messages: list,
    stop_event: asyncio.Event
) -> AsyncGenerator[str, None]:
    """
    Calls Groq API and streams back the response tokens one by one.
    Immediately stops yielding if stop_event is set (Barge-In / interruption protocol).
    
    Args:
        messages: The conversation history in OpenAI chat format.
        stop_event: asyncio.Event that signals an interruption from the user.
    
    Yields:
        str: Individual text tokens from the AI response stream.
    """
    if not settings.GROQ_API_KEY:
        yield "[Error: GROQ_API_KEY is not set. Please add it to your .env file.]"
        return

    try:
        stream = await client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=messages,
            stream=True,
            max_tokens=1024,
            temperature=0.7,
        )
        async for chunk in stream:
            # Check interruption on every token
            if stop_event.is_set():
                break

            delta = chunk.choices[0].delta
            token = delta.content
            if token:
                yield token

    except Exception as e:
        print(f"[Groq API Error]: {e}")
        yield " [AI Error: Could not reach the AI backend. Please try again.]"
