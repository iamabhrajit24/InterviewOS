import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    const userId = user?.userId || 'default_mock_user_id';

    const db = await getDb();
    const resumeDoc = await db.collection('resumes').findOne({ userId });

    if (!resumeDoc || !resumeDoc.versions || resumeDoc.versions.length === 0) {
      return NextResponse.json({ versions: [] }, { status: 200 });
    }

    // Return the versions without the rawText to keep the response light
    const versions = resumeDoc.versions.map((v: any, index: number) => ({
      index,
      uploadedAt: v.uploadedAt,
      versionName: v.versionName || `Version ${index + 1} (${new Date(v.uploadedAt).toLocaleDateString()})`,
      parsedData: v.parsedData
    }));

    return NextResponse.json({ versions }, { status: 200 });

  } catch (error: any) {
    console.error('Fetch resume versions error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
