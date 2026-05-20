import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    const userId = user?.userId || 'default_mock_user_id';

    const { question, userAnswer, resumeContext } = await request.json();

    if (!question || !userAnswer) {
      return NextResponse.json({ error: 'Question and User Answer are required' }, { status: 400 });
    }

    const prompt = `You are a professional technical interviewer. 
The candidate was asked this question:
"${question}"

And gave this answer:
"${userAnswer}"

Resume context of candidate:
${JSON.stringify(resumeContext || {})}

Generate exactly ONE follow-up question that pushes them deeper on technical detail, highlights a tradeoff, or corrects a misunderstanding in their answer.
Keep the question extremely concise, natural, conversational, and direct (max 2 sentences).
Do not output any introductory greetings or conversational boilerplate, return only the question.`;

    let followUpQuestion = '';
    let success = false;

    // 1. Try Groq Primary
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
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: 150
          })
        });

        const data = await groqRes.json();
        const content = data?.choices?.[0]?.message?.content;
        if (content) {
          followUpQuestion = content.trim();
          success = true;
          console.log('[Follow-up API] Groq primary succeeded');
        }
      } catch (err) {
        console.error('[Follow-up API] Groq failed, falling back to Gemini:', err);
      }
    }

    // 2. Try Gemini Fallback
    if (!success && GEMINI_API_KEY) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        const res = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        });

        const data = await res.json();
        const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (content) {
          followUpQuestion = content.trim();
          success = true;
          console.log('[Follow-up API] Gemini fallback succeeded');
        }
      } catch (err) {
        console.error('[Follow-up API] Gemini fallback failed too:', err);
      }
    }

    // Default fallback question if both fail
    if (!success) {
      followUpQuestion = "That is an interesting answer. Can you tell me more about the technical challenges you faced in implementing that architecture?";
    }

    return NextResponse.json({ followUp: followUpQuestion }, { status: 200 });

  } catch (error: any) {
    console.error('Followup API error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
