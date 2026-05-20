from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.endpoints.interview import router as interview_router

app = FastAPI(
    title="InterviewOS API",
    description="Backend for the AI Interview Simulator",
    version="1.0.0"
)

# CORS configuration for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Update for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include WebSocket router
app.include_router(interview_router)

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "InterviewOS Backend"}
