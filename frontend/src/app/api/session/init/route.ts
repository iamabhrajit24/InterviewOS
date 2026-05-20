import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getUserFromRequest } from '@/lib/auth';
import questionBank from '@/lib/questionBank.json';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    const userId = user?.userId || 'default_mock_user_id';

    const { config, includeWeakTopics } = await request.json();
    const interviewType = config?.type || 'technical'; // technical, hr, mixed, gd, project_defense

    const db = await getDb();

    // 1. Fetch latest resume
    const resumeDoc = await db.collection('resumes').findOne({ userId });
    const latestVersion = resumeDoc?.versions?.[resumeDoc.versions.length - 1];
    const parsedResume = latestVersion?.parsedData;

    // 2. Fetch weak topics if toggle is active
    let weakTopicsToInject: string[] = [];
    if (includeWeakTopics) {
      const lastSession = await db.collection('sessions')
        .findOne({ userId, status: 'completed' }, { sort: { createdAt: -1 } });
      weakTopicsToInject = lastSession?.aiEvaluation?.weakTopics || lastSession?.weakTopics || [];
    }

    let selectedQuestions: any[] = [];

    // 3. PROJECT DEFENSE MODE GENERATION (Generated ONCE at session start using Gemini and cached!)
    if (interviewType === 'project_defense') {
      const projects = parsedResume?.projects || [];
      const skills = parsedResume?.skills || [];
      const projectContext = projects.length > 0
        ? JSON.stringify(projects)
        : "No explicit projects found on resume. Base it on general full-stack engineering projects.";

      const prompt = `You are a strict technical architect conducting a project defense interview.
The candidate has the following projects:
${projectContext}

And technical skills:
${skills.join(', ')}

Generate exactly 6 targeted, highly analytical, deep-dive project defense questions.
Focus areas:
1. Architecture decisions (e.g. why SQL vs NoSQL, why client-side state managers like Zustand).
2. Scalability and caching tradeoffs (e.g. how would they handle a 10x traffic spike).
3. API structures and network layers (e.g. HTTP, WebSockets, or gRPC tradeoffs).
4. Failure states, security, and deployments.

Return JSON array ONLY, containing objects with this exact format:
[
  {
    "id": "pd_1",
    "category": "Project Defense",
    "topic": "Architecture",
    "difficulty": "Medium",
    "question": "question text",
    "expectedKeywords": ["keyword1", "keyword2"],
    "followUpHints": ["hint1", "hint2"]
  }
]
No extra conversational text. Return only valid parsed JSON array.`;

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
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        // Extract JSON block from markdown if present
        const jsonMatch = rawText.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (jsonMatch) {
          selectedQuestions = JSON.parse(jsonMatch[0]);
        } else {
          selectedQuestions = JSON.parse(rawText);
        }
      } catch (err) {
        console.error('Project defense generation failed, falling back to System Design bank questions:', err);
        selectedQuestions = questionBank
          .filter(q => q.category === 'System Design')
          .slice(0, 5)
          .map((q, idx) => ({ ...q, id: `pd_fallback_${idx}`, category: 'Project Defense' }));
      }
    } else {
      // 4. HYBRID INTERVIEW ENGINE: Priority-based selection from question bank
      const resumeSkills = (parsedResume?.skills || []).map((s: string) => s.toLowerCase());
      const resumeDomains = (parsedResume?.domains || []).map((d: string) => d.toLowerCase());

      // Priority categories mapping
      let prioritizedCategories: string[] = [];
      if (resumeDomains.includes('ai_ml')) prioritizedCategories.push('AI_ML');
      if (resumeDomains.includes('mern') || resumeSkills.includes('react')) prioritizedCategories.push('React');
      if (resumeSkills.includes('node') || resumeSkills.includes('express')) prioritizedCategories.push('Node');
      if (resumeDomains.includes('backend')) prioritizedCategories.push('Backend');
      if (resumeDomains.includes('frontend')) prioritizedCategories.push('Frontend');
      if (resumeDomains.includes('systemdesign')) prioritizedCategories.push('System Design');

      // Default fallback ordering
      if (prioritizedCategories.length === 0) {
        prioritizedCategories = ['DSA', 'React', 'Node', 'System Design'];
      }

      // Filter and sort from Question Bank
      let pool = [...questionBank];

      // Score each question in the pool based on matching skills/domains and injected weak topics
      const scoredPool = pool.map(q => {
        let score = 0;

        // Boost if category is in our resume priority list
        if (prioritizedCategories.includes(q.category)) {
          score += 10;
        }

        // Boost if question topic or expected keywords match our resume skills
        const topicLower = q.topic.toLowerCase();
        if (resumeSkills.some((skill: string) => topicLower.includes(skill))) {
          score += 5;
        }

        // Boost if matches injected weak topics (Session Memory!)
        if (weakTopicsToInject.some(topic => q.topic.toLowerCase().includes(topic.toLowerCase()))) {
          score += 25; // High priority boost!
        }

        return { question: q, score };
      });

      // Sort by score descending and pick top 10
      selectedQuestions = scoredPool
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map(item => item.question);
    }

    return NextResponse.json({
      message: 'Questions loaded',
      questions: selectedQuestions,
      resumeVersionUsed: latestVersion?.versionName || 'None'
    }, { status: 200 });

  } catch (error: any) {
    console.error('Session init error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
