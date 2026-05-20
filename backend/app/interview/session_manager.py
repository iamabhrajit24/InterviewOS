import uuid
from typing import Dict, List, Any
from dataclasses import dataclass, field

@dataclass
class InterviewSession:
    session_id: str
    messages: List[Dict[str, str]] = field(default_factory=list)
    summary: str = ""
    skills: List[str] = field(default_factory=list)
    phase: str = "introduction" # introduction, technical, wrap-up
    scores: Dict[str, Any] = field(default_factory=dict)
    report: Dict[str, Any] = field(default_factory=dict)

class SessionManager:
    def __init__(self):
        # In-memory store: session_id -> InterviewSession
        # Used for storing state without a database
        self.sessions: Dict[str, InterviewSession] = {}

    def create_session(self) -> InterviewSession:
        session_id = str(uuid.uuid4())
        session = InterviewSession(
            session_id=session_id,
            messages=[
                {"role": "system", "content": "You are a senior technical interviewer conducting a mock interview. Be professional, concise, and engaging. Ask only one question at a time. React naturally to the user."}
            ]
        )
        self.sessions[session_id] = session
        return session

    def get_session(self, session_id: str) -> InterviewSession:
        return self.sessions.get(session_id)
        
    def end_session(self, session_id: str):
        """Cleans up the in-memory session when the interview concludes."""
        if session_id in self.sessions:
            del self.sessions[session_id]

# Singleton instance
session_manager = SessionManager()
