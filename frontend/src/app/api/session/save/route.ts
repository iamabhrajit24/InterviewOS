import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getUserFromRequest } from '@/lib/auth';

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    const userId = user?.userId || 'default_mock_user_id';

    const sessionData = await request.json();
    const { 
      category, 
      questions = [], 
      answers = [], 
      aiFollowUps = [], 
      timestamps = [], 
      resumeVersionUsed = 'None',
      fillerWordCount = 0 
    } = sessionData;

    // 1. Build a full session transcript for AI evaluation
    let transcript = "";
    questions.forEach((q: string, idx: number) => {
      transcript += `Interviewer: ${q}\n`;
      if (answers[idx]) transcript += `Candidate: ${answers[idx]}\n`;
      if (aiFollowUps[idx]) transcript += `Follow-up: ${aiFollowUps[idx]}\n`;
      transcript += `\n`;
    });

    // 2. RUN GEMINI EVALUATION (Returns json evaluation containing score, weak topics, and consistency)
    let aiEvaluation = {
      overallScore: 70,
      topicScores: { "Communication": 75, "Technical Depth": 65 },
      weakTopics: ["System design tradeoffs"],
      feedbackSummary: "Good communication skills. Focus on explaining concrete trade-offs in technical architectures.",
      resumeConsistency: "Highly consistent with resume experiences."
    };

    if (GEMINI_API_KEY && transcript.trim()) {
      const evalPrompt = `You are a strict, professional tech industry interviewer and career coach.
Analyze the following interview session transcript and the candidate's answers.

TRANSCRIPT:
${transcript}

Evaluate the performance across the session. 
Return a JSON object ONLY in this exact format:
{
  "overallScore": 85,
  "topicScores": {
    "Communication": 90,
    "Problem Solving": 80,
    "Technical Depth": 85
  },
  "weakTopics": ["MongoDB sharding keys", "React state management"],
  "feedbackSummary": "Brief overview of what they did well and key areas of growth.",
  "resumeConsistency": "Consistency evaluation: 'High', 'Medium', or 'Low' consistency based on resume skills mentioned."
}
Return only valid parsed JSON. No markdown backticks, no extra text.`;

      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        const res = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: evalPrompt }] }]
          })
        });

        const data = await res.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          aiEvaluation = JSON.parse(jsonMatch[0]);
        } else {
          aiEvaluation = JSON.parse(rawText);
        }
      } catch (err) {
        console.error('Gemini Session Evaluation failed, using standard evaluation values:', err);
      }
    }

    // 3. RUN AI COACHING REPORT (Groq first, Gemini fallback)
    let coachingReport = {
      strengths: ["Strong structured communication style", "Clear presentation of logic"],
      improvements: ["Provide more production-grade examples", "Minimize filler word usage"],
      resumeGaps: ["Could expand on cloud services expertise"],
      suggestedTopics: ["System design load balancing", "Database indexing patterns"]
    };

    const coachPrompt = `You are an expert interview preparation coach.
Based on the following session performance:
Score: ${aiEvaluation.overallScore}/100
Weak topics identified: ${aiEvaluation.weakTopics.join(', ')}

Provide a constructive, highly valuable coaching report.
Return JSON ONLY, containing objects with this exact format:
{
  "strengths": ["strength1", "strength2"],
  "improvements": ["improvement1", "improvement2"],
  "resumeGaps": ["gap1", "gap2"],
  "suggestedTopics": ["topic1", "topic2"]
}
No other text. Only JSON.`;

    let successCoach = false;
    if (GROQ_API_KEY) {
      try {
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${GROQ_API_KEY}`
          },
          body: JSON.stringify({
            model: 'llama-3.1-8b-instant',
            messages: [{ role: 'user', content: coachPrompt }],
            temperature: 0.7,
            max_tokens: 400
          })
        });
        const data = await groqRes.json();
        const content = data?.choices?.[0]?.message?.content || '';
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          coachingReport = JSON.parse(jsonMatch[0]);
          successCoach = true;
        }
      } catch (err) {
        console.error('Coaching report Groq failed, falling back to Gemini:', err);
      }
    }

    if (!successCoach && GEMINI_API_KEY) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        const res = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: coachPrompt }] }]
          })
        });
        const data = await res.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          coachingReport = JSON.parse(jsonMatch[0]);
        }
      } catch (err) {
        console.error('Coaching report Gemini failed:', err);
      }
    }

    // 4. Save entire document to MongoDB sessions collection
    const db = await getDb();
    const finishedSession = {
      userId,
      category,
      questions,
      answers,
      aiFollowUps,
      timestamps,
      resumeVersionUsed,
      fillerWordCount,
      aiEvaluation,
      coachingReport,
      status: 'completed',
      createdAt: new Date()
    };

    const result = await db.collection('sessions').insertOne(finishedSession);

    return NextResponse.json({
      message: 'Session saved successfully!',
      sessionId: result.insertedId.toString(),
      evaluation: aiEvaluation,
      coaching: coachingReport
    }, { status: 201 });

  } catch (error: any) {
    console.error('Save session error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
