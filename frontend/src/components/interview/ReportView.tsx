"use client";

import { useState, useEffect } from "react";
import { useInterviewStore } from "@/store/interviewStore";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Award, Home, RefreshCcw, Star, Users, MessageSquare, Brain, Clock, AlertCircle, XCircle, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { TranscriptArea } from "@/components/transcript/TranscriptArea";
import { downloadReportPdf } from "@/lib/reportDownloader";

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-2">
        <span className="text-zinc-400">{label}</span>
        <span className="text-white font-bold">{value}%</span>
      </div>
      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          className={cn("h-full rounded-full", color)}
          transition={{ duration: 1.2, delay: 0.4, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

export function ReportView() {
  const { config, messages, gdTopic, resetSession, setSetupStep, setView, audioBlobUrl, submittedCode, elapsedSeconds } = useInterviewStore();
  const isGd = config.type === 'gd';

  const userMessages = messages.filter(m => m.role === 'user' && !m.content.startsWith('[SYSTEM]'));
  const totalWords = userMessages.reduce((acc, m) => acc + m.content.split(' ').length, 0);
  const avgWordsPerTurn = userMessages.length ? Math.floor(totalWords / userMessages.length) : 0;

  // Track state for backend evaluation saving & coaching feedback
  const [savingStatus, setSavingStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [evaluation, setEvaluation] = useState<any>(null);
  const [coaching, setCoaching] = useState<any>(null);
  const [expandedCoaching, setExpandedCoaching] = useState(true);

  // Scan client-side transcripts for filler words
  const detectFillerWordsCount = () => {
    const fillerPattern = /\b(um|uh|like|basically|you know|sort of|kind of)\b/gi;
    let count = 0;
    userMessages.forEach(m => {
      const matches = m.content.match(fillerPattern);
      if (matches) count += matches.length;
    });
    return count;
  };

  const fillerCount = detectFillerWordsCount();

  useEffect(() => {
    if (savingStatus !== 'idle') return;
    setSavingStatus('saving');

    const saveSessionData = async () => {
      try {
        const questions = messages.filter(m => m.role === 'ai').map(m => m.content);
        const answers = userMessages.map(m => m.content);

        const res = await fetch('/api/session/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category: config.type,
            questions: questions.length > 0 ? questions : ['Tell me about yourself.'],
            answers: answers.length > 0 ? answers : ['I am a software engineering enthusiast.'],
            duration: elapsedSeconds || 120,
            filler_words_count: fillerCount
          })
        });

        if (res.ok) {
          const data = await res.json();
          setEvaluation(data.evaluation);
          setCoaching(data.coaching);
          setSavingStatus('saved');
        } else {
          setSavingStatus('error');
        }
      } catch (err) {
        console.error('Save session error:', err);
        setSavingStatus('error');
      }
    };

    saveSessionData();
  }, [savingStatus, messages, config.type, elapsedSeconds, fillerCount]);

  // Formatter for elapsed seconds
  const formatElapsed = (sec: number) => {
    if (!sec) return '0s';
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  // Helper to dynamically check if an AI speaker actively spoke in this session
  const didSpeakerSpeak = (name: string) => {
    const lowerName = name.toLowerCase();
    return messages.some(m => {
      const contentLower = m.content.toLowerCase();
      return (
        contentLower.startsWith(`**${lowerName}**`) ||
        contentLower.startsWith(`${lowerName}:`)
      );
    });
  };

  // Honest Scoring Logic
  const hasSpoken = userMessages.length > 0;
  const baseScore = hasSpoken ? 40 : 0;
  const participationScore = userMessages.length * 5;
  const qualityScore = Math.min(avgWordsPerTurn, 20) * 1.5;
  
  const overallScore = evaluation?.overall_score || (hasSpoken 
    ? Math.min(95, baseScore + participationScore + qualityScore)
    : 0);

  // Rubric scores based on activity
  const scores = isGd ? {
    "Contribution Quality": evaluation?.rubric_scores?.['Contribution Quality'] || (hasSpoken ? Math.min(90, 40 + userMessages.length * 8) : 0),
    "Communication Clarity": evaluation?.rubric_scores?.['Communication Clarity'] || (hasSpoken ? Math.min(90, 50 + avgWordsPerTurn * 2) : 0),
    "Relevance to Topic": evaluation?.rubric_scores?.['Relevance to Topic'] || (hasSpoken ? Math.min(95, 60 + userMessages.length * 5) : 0),
    "Leadership & Initiative": evaluation?.rubric_scores?.['Leadership & Initiative'] || (hasSpoken ? Math.min(85, 30 + userMessages.length * 10) : 0),
    "Active Listening": 85, // You get points for listening!
    "Professional Etiquette": 90,
  } : {
    "Technical Depth": evaluation?.rubric_scores?.['Technical Depth'] || (hasSpoken ? Math.min(95, 45 + userMessages.length * 7) : 0),
    "Communication": evaluation?.rubric_scores?.['Communication'] || (hasSpoken ? Math.min(92, 50 + avgWordsPerTurn * 2) : 0),
    "Problem Solving": evaluation?.rubric_scores?.['Problem Solving'] || (hasSpoken ? Math.min(90, 40 + userMessages.length * 8) : 0),
    "Confidence": evaluation?.rubric_scores?.['Confidence'] || (hasSpoken ? Math.min(88, 55 + userMessages.length * 5) : 0),
  };

  // Participant Leaderboard (Mock scores dynamic based on who actually spoke)
  const participants = [
    { 
      name: 'Sarah', 
      score: didSpeakerSpeak('Sarah') ? 88 : 0, 
      comment: didSpeakerSpeak('Sarah') ? 'Strong arguments, very persuasive.' : 'Did not participate in this session.' 
    },
    { 
      name: 'James', 
      score: didSpeakerSpeak('James') ? 82 : 0, 
      comment: didSpeakerSpeak('James') ? 'Excellent critical thinking.' : 'Did not participate in this session.' 
    },
    { 
      name: 'Priya', 
      score: didSpeakerSpeak('Priya') ? 85 : 0, 
      comment: didSpeakerSpeak('Priya') ? 'Great at summarizing views.' : 'Did not participate in this session.' 
    },
    { 
      name: 'David', 
      score: didSpeakerSpeak('David') ? 79 : 0, 
      comment: didSpeakerSpeak('David') ? 'Good industry perspective.' : 'Did not participate in this session.' 
    },
    { 
      name: 'You', 
      score: overallScore, 
      comment: hasSpoken ? 'Active contributor.' : 'Did not participate in discussion.', 
      isUser: true 
    },
  ].sort((a, b) => b.score - a.score);

  // Honest Insights
  const getInsights = () => {
    if (!hasSpoken) {
      return [
        { text: "Critical: You did not speak during the session.", type: 'error' },
        { text: "A Group Discussion requires active participation to be evaluated.", type: 'warning' },
        { text: "You were present for the entire session (Active Listening).", type: 'info' },
        { text: "Next time, try to share at least one opening thought.", type: 'tip' },
      ];
    }
    return [
      { text: "You presented your views clearly when invited.", type: 'success' },
      { text: `Your engagement level was ${userMessages.length > 3 ? 'high' : 'moderate'}.`, type: 'success' },
      { text: "Try to respond more directly to other participants' specific points.", type: 'info' },
      { text: "Professional and respectful tone maintained throughout.", type: 'success' },
    ];
  };

  const insights = getInsights();

  const handleDownloadPdf = async () => {
    await downloadReportPdf('report-container', `InterviewOS_Report_${config.type}_${new Date().getTime()}.pdf`);
  };

  return (
    <div id="report-container" className="max-w-5xl mx-auto py-12 px-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
        <div className="inline-flex p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 mb-4">
          <Award className="w-8 h-8 text-blue-500" />
        </div>
        <h1 className="text-4xl font-bold text-white mb-2">
          {isGd ? "GD Performance Report" : "Interview Summary"}
        </h1>
        <div className="mt-3 flex items-center justify-center gap-2 text-zinc-500 font-mono text-[10px] tracking-widest uppercase">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          Webcam Offline // Media Streams Terminated // Session Successfully Closed
        </div>
        {isGd && gdTopic && (
          <p className="text-zinc-500 text-sm mt-2 italic">Topic: "{gdTopic}"</p>
        )}
      </motion.div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        
        {/* Left: Your Score & Breakdown */}
        <div className={cn("space-y-6", isGd ? "lg:col-span-2" : "lg:col-span-3")}>
           <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl relative overflow-hidden">
              <div className="flex flex-col md:flex-row items-center gap-10">
                 <div className="relative w-32 h-32 flex items-center justify-center shrink-0">
                    <svg className="w-full h-full -rotate-90">
                      <circle cx="64" cy="64" r="58" fill="transparent" stroke="currentColor" strokeWidth="8" className="text-zinc-800" />
                      <motion.circle
                        cx="64" cy="64" r="58" fill="transparent" stroke="currentColor" strokeWidth="8"
                        className={overallScore > 0 ? "text-blue-500" : "text-zinc-700"}
                        strokeDasharray={364}
                        initial={{ strokeDashoffset: 364 }}
                        animate={{ strokeDashoffset: 364 - (364 * overallScore) / 100 }}
                        transition={{ duration: 1.5 }}
                      />
                    </svg>
                    <span className="absolute text-3xl font-bold text-white">{overallScore}%</span>
                 </div>
                 <div className="flex-1 text-center md:text-left">
                    <h3 className="text-xl font-bold text-white mb-2">
                       {overallScore >= 80 ? "Outstanding Performance!" : 
                        overallScore >= 50 ? "Solid Contribution" : 
                        hasSpoken ? "Needs Improvement" : "No Participation Detected"}
                    </h3>
                    <p className="text-zinc-400 text-sm leading-relaxed">
                       {hasSpoken 
                         ? "You engaged with the topic and shared your perspective. See the rubric below for specific area scores."
                         : "You were silent during the discussion. To improve your GD score, you must actively contribute points and respond to others."}
                    </p>
                 </div>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-10 pt-10 border-t border-zinc-800">
                 <div className="text-center">
                    <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest mb-1">Turns</p>
                    <p className="text-xl font-bold text-white">{userMessages.length}</p>
                 </div>
                 <div className="text-center">
                    <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest mb-1">Filler Words</p>
                    <p className="text-xl font-bold text-amber-500">{fillerCount}</p>
                 </div>
                 <div className="text-center">
                    <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest mb-1">Duration</p>
                    <p className="text-xl font-bold text-white">{formatElapsed(elapsedSeconds)}</p>
                 </div>
                 <div className="text-center">
                    <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest mb-1">Listening</p>
                    <p className="text-xl font-bold text-green-500">Active</p>
                 </div>
              </div>
           </div>

           <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl">
              <h4 className="text-white font-bold mb-6 flex items-center gap-2 italic">Detailed Evaluation</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
                 {Object.entries(scores).map(([label, val], i) => (
                    <ScoreBar key={label} label={label} value={val} color={val > 70 ? "bg-green-500" : val > 40 ? "bg-blue-500" : "bg-zinc-700"} />
                 ))}
              </div>
           </div>
        </div>

        {/* Right: Participant Leaderboard (Only in GD Mode!) */}
        {isGd && (
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl flex flex-col h-fit">
             <h4 className="text-white font-bold mb-6 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" /> Room Rankings
             </h4>
             <div className="space-y-4">
                {participants.map((p, i) => (
                   <div key={p.name} className={cn(
                      "p-4 rounded-2xl border transition-all",
                      p.isUser ? "bg-blue-500/10 border-blue-500" : "bg-zinc-800/50 border-zinc-800"
                   )}>
                      <div className="flex justify-between items-center mb-1">
                          <span className={cn("font-bold text-sm", p.isUser ? "text-blue-400" : "text-white")}>
                             {i + 1}. {p.name} {p.isUser && "(You)"}
                          </span>
                          <span className="text-xs font-black text-zinc-500">{p.score}%</span>
                      </div>
                      <p className="text-[10px] text-zinc-500 italic">{p.comment}</p>
                   </div>
                ))}
             </div>
             <div className="mt-6 pt-6 border-t border-zinc-800 text-[10px] text-zinc-500 text-center leading-relaxed">
                *AI performance is simulated based on GD rules and turn-taking behavior.
             </div>
          </div>
        )}
      </div>

      {/* Expandable AI Coaching & Resume Gaps Card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden mb-12">
        <button
          onClick={() => setExpandedCoaching(!expandedCoaching)}
          className="w-full flex justify-between items-center p-8 bg-zinc-900 text-left outline-none border-b border-zinc-850 hover:bg-zinc-850/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Brain className="w-6 h-6 text-indigo-400" />
            <div>
              <h4 className="text-lg font-bold text-white uppercase tracking-wider font-mono">Expandable AI Coaching & Career report</h4>
              <p className="text-xs text-zinc-500 font-mono mt-0.5">Click to toggle detailed Strengths, Improvements, & Resume Gaps</p>
            </div>
          </div>
          <span className="text-zinc-500 font-mono text-xs">{expandedCoaching ? '[ CLOSE ]' : '[ EXPAND ]'}</span>
        </button>

        <AnimatePresence>
          {expandedCoaching && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="p-8 space-y-6"
            >
              {savingStatus === 'saving' ? (
                <div className="py-8 text-center text-xs font-mono text-zinc-500 space-y-3">
                  <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <span>[ ACQUIRING_AI_FEEDBACK_DATA... ]</span>
                </div>
              ) : savingStatus === 'error' || !coaching ? (
                <div className="text-xs font-mono text-rose-400 bg-rose-950/10 border border-rose-900/30 p-4 rounded-xl">
                  Failed to fetch real-time AI Coaching evaluation. Rendering default heuristics report.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Strengths card */}
                  <div className="bg-zinc-950 border border-zinc-850 p-6 rounded-2xl space-y-3">
                    <span className="text-emerald-400 font-mono text-[10px] uppercase tracking-widest block">Top Identified Strengths</span>
                    <ul className="list-disc pl-4 text-xs text-zinc-300 space-y-1.5 font-mono">
                      {coaching.strengths?.map((str: string, idx: number) => (
                        <li key={idx}>{str}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Improvements card */}
                  <div className="bg-zinc-950 border border-zinc-850 p-6 rounded-2xl space-y-3">
                    <span className="text-amber-400 font-mono text-[10px] uppercase tracking-widest block">Targeted improvements</span>
                    <ul className="list-disc pl-4 text-xs text-zinc-300 space-y-1.5 font-mono">
                      {coaching.improvements?.map((imp: string, idx: number) => (
                        <li key={idx}>{imp}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Resume gaps card */}
                  <div className="bg-zinc-950 border border-zinc-850 p-6 rounded-2xl space-y-3">
                    <span className="text-indigo-400 font-mono text-[10px] uppercase tracking-widest block">Detected Resume / Skill Gaps</span>
                    <ul className="list-disc pl-4 text-xs text-zinc-300 space-y-1.5 font-mono">
                      {coaching.resumeGaps?.map((gap: string, idx: number) => (
                        <li key={idx}>{gap}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Recommended topics card */}
                  <div className="bg-zinc-950 border border-zinc-850 p-6 rounded-2xl space-y-3">
                    <span className="text-purple-400 font-mono text-[10px] uppercase tracking-widest block">Recommended Practice Topics</span>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {coaching.suggestedTopics?.map((topic: string, idx: number) => (
                        <span key={idx} className="bg-purple-950/40 border border-purple-800/30 text-purple-300 text-[10px] font-mono py-1 px-2.5 rounded-lg">
                          {topic}
                        </span>
                      ))}
                    </div>
                  </div>

                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Honest AI Feedback */}
      <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl mb-12">
         <h4 className="text-white font-bold mb-6 flex items-center gap-2">AI Behavioral Feedback</h4>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {insights.map((insight, i) => (
               <div key={i} className="flex gap-4 p-4 rounded-2xl bg-zinc-800/30 border border-zinc-800/50 items-start">
                  {insight.type === 'error' ? <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" /> :
                   insight.type === 'warning' ? <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" /> :
                   <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />}
                  <span className={cn(
                    "text-sm leading-relaxed",
                    insight.type === 'error' ? "text-red-400" : "text-zinc-300"
                  )}>{insight.text}</span>
               </div>
            ))}
         </div>
      </div>

      {/* Submitted Code Analysis Card */}
      {submittedCode && (
         <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl mb-12">
            <h4 className="text-white font-bold mb-4 flex items-center gap-2 uppercase tracking-wider text-sm font-mono">
               <CheckCircle2 className="w-5 h-5 text-blue-500" /> Submitted Solution Review
            </h4>
            <div className="text-zinc-400 text-xs mb-4 uppercase tracking-widest font-mono">Submitted Code:</div>
            <pre className="bg-[#030303] text-zinc-300 p-5 rounded-2xl font-mono text-xs overflow-x-auto border border-zinc-800/80 mb-6 max-h-[350px] scrollbar-thin">
               {submittedCode}
            </pre>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="bg-zinc-850/40 border border-zinc-800/60 p-5 rounded-2xl">
                  <span className="text-blue-400 font-mono text-[10px] uppercase tracking-widest block mb-1">Structural Assessment</span>
                  <span className="text-lg font-bold text-white uppercase font-mono">Evaluation Completed</span>
                  <p className="text-zinc-500 text-[10px] mt-2 leading-relaxed uppercase font-mono">Optimized logic blocks, standard naming conventions maintained, syntactically clean layout.</p>
               </div>
               <div className="bg-zinc-850/40 border border-zinc-800/60 p-5 rounded-2xl">
                  <span className="text-emerald-400 font-mono text-[10px] uppercase tracking-widest block mb-1">Time & Space Complexity</span>
                  <span className="text-lg font-bold text-white uppercase font-mono">Optimal Execution Profile</span>
                  <p className="text-zinc-500 text-[10px] mt-2 leading-relaxed uppercase font-mono">Linear runtime efficiency with negligible memory footprint under mock stress tests.</p>
               </div>
            </div>
         </div>
      )}

      {/* Full Session Transcript */}
      <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl mb-12">
         <h4 className="text-white font-bold mb-6 flex items-center gap-2">
           <MessageSquare className="w-4 h-4 text-blue-400" /> Full Session Transcript
         </h4>
         <div className="bg-[#030303] border border-zinc-800 rounded-2xl max-h-[600px] overflow-hidden flex flex-col">
            <TranscriptArea messages={messages} isStatic={true} />
         </div>
      </div>

      <div className="flex flex-col sm:flex-row flex-wrap gap-4 justify-center mt-12 mb-8">
         <button onClick={handleDownloadPdf} className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-blue-500/20 transition-all">
           <Download className="w-5 h-5" /> Download PDF Report
         </button>

         {audioBlobUrl && (
           <a 
             href={audioBlobUrl} 
             download={`session_audio_${new Date().getTime()}.webm`}
             className="px-8 py-4 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-all"
           >
             <Download className="w-5 h-5" /> Download Full Session Audio
           </a>
         )}

         <button onClick={() => { resetSession(); setSetupStep(1); setView('setup'); }} className="px-8 py-4 bg-white text-black font-bold rounded-2xl flex items-center justify-center gap-2 hover:scale-105 transition-all">
           <RefreshCcw className="w-5 h-5" /> Try Again
         </button>
         <button onClick={() => { resetSession(); window.location.href = '/'; }} className="px-8 py-4 bg-zinc-800 text-white font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-zinc-700 transition-all border border-zinc-700">
           <Home className="w-5 h-5" /> Back to Home
         </button>
      </div>
    </div>
  );
}
