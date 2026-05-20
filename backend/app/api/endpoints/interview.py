import json
import random
import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.ai.ai_service import generate_interview_response_stream, get_ai_status
from app.interview.session_manager import session_manager

router = APIRouter()

@router.get("/api/ai/status")
async def ai_status():
    return get_ai_status()

# ── Default 1-on-1 interviewer prompt ────────────────────────────────────────
SYSTEM_PROMPT = {
    "role": "system",
    "content": (
        "You are Alex, a senior technical interviewer at a top tech company. "
        "Be professional, concise, encouraging, and realistic. "
        "Ask only ONE question at a time. "
        "Adapt your follow-up questions based on what the candidate says. "
        "Start by warmly greeting the candidate and asking them to introduce themselves."
    )
}

# ── GD: Pool of fresh, relevant topics ───────────────────────────────────────
GD_TOPICS = [
    "The Impact of Artificial Intelligence on Modern Software Engineering",
    "Remote Work vs Office Work: The Future of Tech Teams",
    "Open Source vs Proprietary Software: Which drives more innovation?",
    "Is a Computer Science degree still relevant in 2025?",
    "The Ethics of AI in Hiring and Recruitment",
    "Agile Methodology: Does it actually work in large enterprises?",
    "Cloud Computing: Opportunity or Overreliance?",
    "Should social media companies be held legally responsible for misinformation?",
    "The rise of No-Code / Low-Code platforms: A threat to developers?",
    "Work-Life Balance in the Tech Industry: Myth or Reality?",
]

# ── GD: Participant personalities ────────────────────────────────────────────
GD_PARTICIPANTS = [
    {"name": "Sarah", "style": "assertive, pro-technology, challenges assumptions"},
    {"name": "James", "style": "skeptical, data-driven, asks hard questions"},
    {"name": "Priya", "style": "analytical, balanced, bridges opposing views"},
    {"name": "David", "style": "industry-experienced, pragmatic, real-world focused"},
]

def build_gd_system_prompt(topic: str) -> str:
    return f"""You are orchestrating a Group Discussion interview simulation.

TOPIC: "{topic}"

PARTICIPANTS:
- MODERATOR: Facilitates, introduces topic, manages transitions (brief turns only)
- Sarah: Confident, analytical, speaks in structured points
- James: Pragmatic, challenges assumptions, uses examples
- Priya: Empathetic, data-driven, synthesizes others' views
- David: Devil's advocate, provocative but professional

OUTPUT FORMAT — STRICT — Every response MUST have this structure:
Each speaker turn is a separate paragraph starting with the speaker name followed by a colon.

MODERATOR: [1-2 sentences max — introduce or transition only]

Sarah: [3-5 sentences — substantive point on the topic]

MODERATOR: [1 sentence — brief transition to next speaker]

James: [3-5 sentences — response or counter-point]

MODERATOR: [1 sentence — transition]

Priya: [3-5 sentences — her perspective]

MODERATOR: [1 sentence — hand off to David]

David: [3-5 sentences — his angle]

MODERATOR: [1-2 sentences — summarize round and invite the human candidate]

USER_TURN: [Signal that it is now the human's turn to speak]

RULES:
1. MODERATOR speaks ONLY to introduce, transition, and hand off. Never to give opinions.
2. All 4 AI candidates (Sarah, James, Priya, David) MUST speak in every round.
3. The human candidate speaks LAST in every round.
4. Never skip a candidate. Never merge two candidates into one turn.
5. Keep each candidate's turn focused and distinct in style/personality.
6. Total AI output per round should be 250-350 words."""


async def run_stream(websocket, session, stop_event, current_task_ref):
    """Helper to stream AI response and save to session."""
    messages_snapshot = list(session.messages)

    async def _stream(msgs, s_event):
        ai_full_text = ""
        try:
            async for token in generate_interview_response_stream(msgs, s_event):
                if s_event.is_set():
                    break
                ai_full_text += token
                await websocket.send_json({"type": "token", "content": token})

            if not s_event.is_set() and ai_full_text:
                session.messages.append({"role": "assistant", "content": ai_full_text})
                await websocket.send_json({"type": "message_complete"})
            elif s_event.is_set():
                await websocket.send_json({"type": "interrupt_ack"})

        except asyncio.CancelledError:
            pass

    task = asyncio.create_task(_stream(messages_snapshot, stop_event))
    current_task_ref[0] = task
    return task


@router.websocket("/ws")
async def interview_websocket(websocket: WebSocket):
    """
    Main WebSocket endpoint. Handles 1-on-1 interviews AND Group Discussions.
    GD mode auto-starts without waiting for user input.
    """
    await websocket.accept()

    session = session_manager.create_session()
    session.messages = [SYSTEM_PROMPT]

    stop_event = asyncio.Event()
    current_task_ref = [None]  # mutable ref to current stream task
    gd_round = [0]             # tracks which GD round we're on

    try:
        while True:
            raw = await websocket.receive_text()
            payload = json.loads(raw)
            action = payload.get("action")

            # ── Session Initialisation ────────────────────────────────────────
            if action == "START_INTERVIEW":
                config = payload.get("config", {})
                session.config = config

                role = config.get("role", "Software Engineer")
                exp = config.get("experienceLevel", "intermediate")
                i_type = config.get("type", "technical")
                skills = ", ".join(config.get("skills", []))

                if i_type == "gd":
                    # Pick a fresh random topic
                    topic = random.choice(GD_TOPICS)
                    session.gd_topic = topic
                    gd_round[0] = 0

                    system_msg = {"role": "system", "content": build_gd_system_prompt(topic)}
                    session.messages = [system_msg]

                    # Send topic to frontend so GD grid can display it
                    await websocket.send_json({
                        "type": "session_initialized",
                        "session_id": session.session_id,
                        "gd_topic": topic,
                    })

                    # ── AUTO-START: GD begins immediately without user input ──
                    gd_round[0] = 1
                    opening_trigger = {
                        "role": "user",
                        "content": f"[SYSTEM] Begin the Group Discussion. Round 1. Introduce the topic '{topic}' as MODERATOR, then have Sarah, James, Priya, and David each give their opening statement. End by inviting the candidate to speak."
                    }
                    session.messages.append(opening_trigger)

                    await run_stream(websocket, session, stop_event, current_task_ref)

                else:
                    if i_type == "hr":
                        dynamic_prompt = (
                            f"You are Alex, an HR Manager conducting a professional behavioral and cultural mock interview for a {role} position. "
                            f"The candidate has '{exp}' experience level. "
                            "1. Focus entirely on HR, behavioral, situational, and cultural questions (e.g., conflict resolution, team collaboration, career goals, work ethic). "
                            "2. Do NOT ask any coding questions, syntax questions, or algorithmic puzzles under any circumstances. "
                            "3. Be extremely supportive and ask ONE question at a time, keeping responses conversational. "
                            "Start by warmly greeting the candidate, introducing yourself, and asking the first behavioral question."
                        )
                    elif i_type == "technical":
                        dynamic_prompt = (
                            f"You are Alex, a senior technical interviewer conducting a technical deep-dive mock interview for a {role} position. "
                            f"The candidate has '{exp}' experience level. "
                            f"Focus areas/Tech Stack: {skills if skills else 'general software engineering'}. "
                            "1. Be professional, concise, and realistic. Ask ONE technical or coding question at a time based on their focus areas. "
                            "2. If the user submits code starting with [CODE_SUBMISSION], you MUST warmly acknowledge their code and explicitly state: "
                            "'I have received your solution and will analyze it thoroughly. The full algorithmic, efficiency, and architectural review will be compiled in your final performance report after the session concludes.' "
                            "Do not write the full code analysis here; keep it in the report and move on to the next question. "
                            "3. Provide helpful hints if they struggle. "
                            "Start by warmly greeting the candidate, noting their tech stack, and asking the first coding or technical question."
                        )
                    else:  # mixed
                        dynamic_prompt = (
                            f"You are Alex, a lead engineer conducting a comprehensive mock interview (mixing technical depth and behavioral culture fit) for a {role} position. "
                            f"The candidate has '{exp}' experience level. "
                            f"Focus areas/Tech Stack: {skills if skills else 'general software engineering'}. "
                            "1. Combine technical coding/system design questions with cultural/behavioral fit scenarios. "
                            "2. If they submit code starting with [CODE_SUBMISSION], acknowledge the submission warmly and let them know that the complete structural code evaluation will be compiled in their final report, then proceed to the next topic. "
                            "3. Ask ONE question at a time. "
                            "Start by warmly greeting the candidate, introducing yourself, and setting the expectation for a combined technical and behavioral session."
                        )
                    session.messages = [{"role": "system", "content": dynamic_prompt}]
                    await websocket.send_json({
                        "type": "session_initialized",
                        "session_id": session.session_id,
                    })

                    # ── AUTO-START: Interviewer introduces themselves first ──
                    intro_trigger = {
                        "role": "user",
                        "content": "[SYSTEM] Start the interview. Greet the candidate and introduce yourself."
                    }
                    session.messages.append(intro_trigger)
                    await run_stream(websocket, session, stop_event, current_task_ref)

            # ── Barge-In / Interrupt ──────────────────────────────────────────
            elif action == "INTERRUPT":
                stop_event.set()
                task = current_task_ref[0]
                if task and not task.done():
                    task.cancel()
                stop_event.clear()
                await websocket.send_json({"type": "interrupt_ack"})

            # ── User sent a message ───────────────────────────────────────────
            elif action == "USER_MESSAGE":
                stop_event.clear()
                user_text = payload.get("text", "").strip()
                if not user_text:
                    continue

                session.messages.append({"role": "user", "content": user_text})

                # Context pruning
                if len(session.messages) > 9:
                    session.messages = [session.messages[0]] + session.messages[-8:]

                i_type = session.config.get("type", "technical") if session.config else "technical"

                if i_type == "gd":
                    gd_round[0] += 1
                    # Pick 1-2 random participants to respond after user speaks
                    responders = random.sample([p["name"] for p in GD_PARTICIPANTS], k=random.randint(1, 2))
                    responder_str = " and ".join(responders)

                    follow_up_trigger = {
                        "role": "user",
                        "content": (
                            f"[SYSTEM] Round {gd_round[0]}. The candidate just spoke. "
                            f"Now have {responder_str} respond naturally to the candidate's point. "
                            "Then the other participants may briefly react. "
                            "End by inviting the candidate to respond again."
                        )
                    }
                    session.messages.append(follow_up_trigger)

                await run_stream(websocket, session, stop_event, current_task_ref)

            # ── Session End ───────────────────────────────────────────────────
            elif action == "END_SESSION":
                session_manager.end_session(session.session_id)
                await websocket.send_json({"type": "session_ended"})
                break

    except WebSocketDisconnect:
        print(f"[WS] Disconnected: {session.session_id}")
    finally:
        session_manager.end_session(session.session_id)
