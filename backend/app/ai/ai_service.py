import asyncio
from typing import AsyncGenerator
from app.core.config import settings
from app.ai.groq_service import generate_interview_response_stream as groq_stream
from app.ai.gemini_service import generate_gemini_response_stream as gemini_stream

# Global tracker for the current active provider status
# "green" = Primary running smoothly
# "yellow" = Fell back to Gemini
# "red" = All providers failed
current_status = {
    "primary": settings.AI_PRIMARY,
    "fallback": settings.AI_FALLBACK,
    "active_provider": settings.AI_PRIMARY,
    "status": "green"  # green, yellow, red
}

def get_ai_status():
    """Returns the current status of the AI providers."""
    return current_status

async def generate_interview_response_stream(
    messages: list,
    stop_event: asyncio.Event
) -> AsyncGenerator[str, None]:
    """
    Unified AI stream generator. Uses settings.AI_PRIMARY first.
    Falls back automatically to settings.AI_FALLBACK if the primary fails.
    """
    primary = settings.AI_PRIMARY.lower()
    fallback = settings.AI_FALLBACK.lower()

    async def run_provider(provider_name: str) -> AsyncGenerator[str, None]:
        if provider_name == "groq":
            async for token in groq_stream(messages, stop_event):
                yield token
        elif provider_name == "gemini":
            async for token in gemini_stream(messages, stop_event):
                yield token
        else:
            yield f" [Error: Unknown AI provider '{provider_name}']"

    print(f"[AI Service] Attempting primary provider: {primary}")
    
    # Try primary provider first
    success = False
    tokens_yielded = 0
    
    try:
        async for token in run_provider(primary):
            # Check for generic/specific failure indicator tokens
            if "AI Error" in token or "Error:" in token:
                raise Exception(f"Primary provider '{primary}' yielded error token: {token}")
            
            tokens_yielded += 1
            success = True
            current_status["active_provider"] = primary
            current_status["status"] = "green"
            yield token
            
    except Exception as e:
        print(f"[AI Service] Primary provider '{primary}' failed: {e}")
        
    if not success or tokens_yielded == 0:
        print(f"[AI Service] Primary failed. Falling back to: {fallback}")
        current_status["active_provider"] = fallback
        current_status["status"] = "yellow"
        
        try:
            fallback_success = False
            async for token in run_provider(fallback):
                if "AI Error" in token or "Error:" in token:
                    raise Exception(f"Fallback provider '{fallback}' yielded error token")
                fallback_success = True
                yield token
                
            if not fallback_success:
                raise Exception("Fallback provider yielded zero tokens.")
                
        except Exception as fe:
            print(f"[AI Service] Fallback provider '{fallback}' also failed: {fe}")
            current_status["status"] = "red"
            yield " [Critical Error: Both primary and fallback AI providers are currently unavailable. Please try again later.]"
