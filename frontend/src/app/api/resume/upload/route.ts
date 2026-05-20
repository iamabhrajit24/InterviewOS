import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getUserFromRequest } from '@/lib/auth';
import { ObjectId } from 'mongodb';

export async function POST(request: NextRequest) {
  try {
    // 1. Get authenticated user or fallback to mock for demo stability
    const user = getUserFromRequest(request);
    const userId = user?.userId || 'default_mock_user_id';

    // 2. Parse Multipart Form Data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let rawText = '';
    const fileName = file.name.toLowerCase();

    // 3. Dynamic parse depending on type
    if (fileName.endsWith('.pdf')) {
      try {
        const pdf = require('pdf-parse');
        const data = await pdf(buffer);
        rawText = data.text || '';
      } catch (err: any) {
        console.error('pdf-parse failed, using fallback buffer-string scanner:', err);
        // Fallback robust text scanning for PDF binary buffer
        rawText = buffer.toString('utf8').replace(/[^\x20-\x7E\n]/g, '');
      }
    } else if (fileName.endsWith('.docx')) {
      try {
        const mammoth = require('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        rawText = result.value || '';
      } catch (err: any) {
        console.error('mammoth failed, using fallback buffer-string scanner:', err);
        rawText = buffer.toString('utf8').replace(/[^\x20-\x7E\n]/g, '');
      }
    } else if (fileName.endsWith('.txt')) {
      rawText = buffer.toString('utf8');
    } else {
      return NextResponse.json({ error: 'Unsupported file format. Please upload PDF or DOCX.' }, { status: 400 });
    }

    if (!rawText.trim()) {
      return NextResponse.json({ error: 'Could not extract text from the file.' }, { status: 400 });
    }

    // 4. Regex Pattern Matching & Text Base Extraction
    const parsedData = parseResumeText(rawText);

    // 5. Store in MongoDB (using version tracking!)
    const db = await getDb();
    
    // Find existing resume for this user
    const existingResume = await db.collection('resumes').findOne({ userId });

    const newVersion = {
      parsedData,
      rawText,
      uploadedAt: new Date(),
      versionName: `Resume ${new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} (${file.name})`
    };

    if (existingResume) {
      // Append to existing versions list
      await db.collection('resumes').updateOne(
        { userId },
        { 
          $push: { versions: newVersion },
          $set: { updatedAt: new Date() }
        } as any
      );
    } else {
      // Create new resume document
      await db.collection('resumes').insertOne({
        userId,
        versions: [newVersion],
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    return NextResponse.json({
      message: 'Resume uploaded and parsed successfully!',
      parsedData,
      versionName: newVersion.versionName
    }, { status: 200 });

  } catch (error: any) {
    console.error('Resume upload error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

// Robust Regex and Text Parsing Engine
function parseResumeText(text: string) {
  const getKeywordRegex = (k: string): RegExp => {
    const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const startBoundary = /^\w/.test(k) ? '\\b' : '';
    const endBoundary = /\w$/.test(k) ? '\\b' : '(?![a-zA-Z0-9])';
    return new RegExp(startBoundary + escaped + endBoundary, 'i');
  };

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  
  // 1. Extract Target Role by scanning the entire length of the resume (supports 1 or 2 pages fully)
  let suggestedRole = '';
  const roleKeywords = [
    'software engineer', 'software developer', 'frontend developer', 'frontend engineer',
    'backend developer', 'backend engineer', 'full stack developer', 'full stack engineer',
    'data scientist', 'machine learning engineer', 'ai engineer', 'devops engineer',
    'cloud engineer', 'product manager', 'project manager', 'qa engineer', 'security engineer'
  ];
  
  for (let i = 0; i < lines.length; i++) {
    const lineLower = lines[i].toLowerCase();
    for (const role of roleKeywords) {
      const regex = new RegExp('\\b' + role.replace(' ', '\\s*') + '\\b', 'i');
      if (regex.test(lineLower) && lineLower.length < 50) {
        suggestedRole = role.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        break;
      }
    }
    if (suggestedRole) break;
  }
  
  const skills: string[] = [];
  const projects: Array<{ name: string; tech: string[] }> = [];
  const education: string[] = [];
  const certifications: string[] = [];
  const experience: string[] = [];
  const domains: string[] = [];

  // Standard Technology Keywords
  const techKeywords = [
    'react', 'node', 'express', 'mongodb', 'javascript', 'typescript', 'next.js', 'vue', 'angular',
    'tailwind', 'bootstrap', 'python', 'django', 'fastapi', 'flask', 'pytorch', 'tensorflow', 'keras',
    'scikit-learn', 'numpy', 'pandas', 'sql', 'mysql', 'postgres', 'postgresql', 'sqlite', 'mongodb',
    'redis', 'graphql', 'docker', 'kubernetes', 'aws', 'gcp', 'azure', 'devops', 'ci/cd', 'terraform',
    'jenkins', 'git', 'github', 'java', 'spring', 'c++', 'c#', 'rust', 'go', 'golang', 'html', 'css',
    'microservices', 'system design', 'rest api', 'graphql'
  ];

  // Domain categorization rules
  const domainRules = [
    { name: 'AI_ML', keywords: ['pytorch', 'tensorflow', 'keras', 'machine learning', 'deep learning', 'ai', 'scikit-learn', 'llm', 'nlp', 'vision', 'model'] },
    { name: 'MERN', keywords: ['mongodb', 'express', 'react', 'node', 'mern'] },
    { name: 'Frontend', keywords: ['html', 'css', 'javascript', 'typescript', 'react', 'next.js', 'vue', 'angular', 'tailwind', 'sass', 'ui/ux'] },
    { name: 'Backend', keywords: ['node', 'express', 'django', 'fastapi', 'spring boot', 'go', 'python', 'postgres', 'mysql', 'redis', 'graphql', 'rest api', 'sql'] },
    { name: 'DevOps', keywords: ['docker', 'kubernetes', 'aws', 'gcp', 'azure', 'ci/cd', 'terraform', 'jenkins', 'git', 'ansible'] },
    { name: 'SystemDesign', keywords: ['microservices', 'load balancer', 'scalability', 'architecture', 'system design', 'distributed systems', 'sharding'] }
  ];

  // Auto-tag domains
  const lowercaseText = text.toLowerCase();
  for (const rule of domainRules) {
    const matched = rule.keywords.filter(keyword => lowercaseText.includes(keyword));
    // If we have at least 2 match hits or a core term (like machine learning, mern)
    if (matched.length >= 2 || (matched.length >= 1 && rule.keywords.some(k => k.length > 5 && lowercaseText.includes(k)))) {
      domains.push(rule.name);
    }
  }
  if (domains.length === 0) {
    domains.push('General Software Engineering');
  }

  // Scan line by line for Skills
  let currentSection = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLower = line.toLowerCase();

    // Section markers detection
    if (/skills|technologies|technical capabilities/i.test(line) && line.length < 30) {
      currentSection = 'skills';
      continue;
    } else if (/projects|academic work|personal builds/i.test(line) && line.length < 30) {
      currentSection = 'projects';
      continue;
    } else if (/education|academic qualification/i.test(line) && line.length < 30) {
      currentSection = 'education';
      continue;
    } else if (/certifications|certificates|courses/i.test(line) && line.length < 30) {
      currentSection = 'certifications';
      continue;
    } else if (/experience|employment|work history/i.test(line) && line.length < 30) {
      currentSection = 'experience';
      continue;
    }

    // Extraction logic based on active section
    if (currentSection === 'skills') {
      // Look for keywords
      const matched = techKeywords.filter(k => {
        const regex = getKeywordRegex(k);
        return regex.test(line);
      });
      matched.forEach(m => {
        const formatted = m.charAt(0).toUpperCase() + m.slice(1);
        if (!skills.includes(formatted)) skills.push(formatted);
      });
      // Also grab comma-separated lists of words
      if (line.includes(',') && line.length < 150) {
        line.split(',').forEach(item => {
          const clean = item.trim().replace(/[•▪\-\*]/g, '');
          if (clean && clean.length < 20 && !skills.includes(clean)) {
            skills.push(clean);
          }
        });
      }
    } else if (currentSection === 'education') {
      if (line.length > 5 && line.length < 100) {
        education.push(line.replace(/[•▪]/g, '').trim());
      }
    } else if (currentSection === 'certifications') {
      if (line.length > 5 && line.length < 100) {
        certifications.push(line.replace(/[•▪]/g, '').trim());
      }
    } else if (currentSection === 'experience') {
      if (line.length > 10 && experience.length < 15) {
        experience.push(line.replace(/[•▪]/g, '').trim());
      }
    } else if (currentSection === 'projects') {
      // Find project names: e.g. bolded first items or short bullet items
      if (line.length > 4 && line.length < 40 && !line.includes(',') && !line.includes('.')) {
        // Collect technical words mentioned in surrounding lines
        const nextLinesText = (lines[i+1] || '') + ' ' + (lines[i+2] || '') + ' ' + (lines[i+3] || '');
        const projTech = techKeywords
          .filter(k => getKeywordRegex(k).test(nextLinesText))
          .map(k => k.charAt(0).toUpperCase() + k.slice(1));
        
        projects.push({
          name: line.replace(/[•▪\-\*]/g, '').trim(),
          tech: Array.from(new Set(projTech))
        });
      }
    }
  }

  // Scan entire text (page 1 and page 2) for techKeywords to guarantee all tools are captured
  techKeywords.forEach(k => {
    if (getKeywordRegex(k).test(text)) {
      skills.push(k.charAt(0).toUpperCase() + k.slice(1));
    }
  });

  // If no explicit role is found, infer it based on matched domains
  if (!suggestedRole) {
    if (domains.includes('AI_ML')) suggestedRole = 'AI/ML Engineer';
    else if (domains.includes('DevOps')) suggestedRole = 'DevOps Engineer';
    else if (domains.includes('Frontend')) suggestedRole = 'Frontend Developer';
    else if (domains.includes('Backend')) suggestedRole = 'Backend Engineer';
    else if (domains.includes('MERN')) suggestedRole = 'Full Stack Developer';
    else suggestedRole = 'Software Engineer';
  }

  // Deduplicate and slice lists to reasonable sizes
  return {
    skills: Array.from(new Set(skills)).slice(0, 25),
    projects: projects.filter(p => p.name.length > 3).slice(0, 5),
    education: Array.from(new Set(education)).slice(0, 4),
    certifications: Array.from(new Set(certifications)).slice(0, 6),
    experience: experience.slice(0, 10),
    domains: Array.from(new Set(domains)),
    suggestedRole
  };
}
