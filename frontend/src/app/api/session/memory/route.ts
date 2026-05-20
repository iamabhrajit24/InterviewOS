import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    const userId = user?.userId || 'default_mock_user_id';

    const db = await getDb();
    
    // Find the latest finished session to get weak topics
    const lastSession = await db.collection('sessions')
      .findOne(
        { userId, status: 'completed' },
        { sort: { createdAt: -1 } }
      );

    const weakTopics = lastSession?.aiEvaluation?.weakTopics || lastSession?.weakTopics || [];

    return NextResponse.json({
      weakTopics: Array.from(new Set(weakTopics)).slice(0, 5)
    }, { status: 200 });

  } catch (error: any) {
    console.error('Session memory error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
