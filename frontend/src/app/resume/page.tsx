'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, CheckCircle2, ChevronDown, ListFilter, HelpCircle, ArrowRightLeft, Plus, Trash2 } from 'lucide-react';
import Navbar from '@/components/ui/Navbar';
import { useToast } from '@/components/ui/Toast';

export default function ResumePage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [parsedData, setParsedData] = useState<any>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [compareIndexA, setCompareIndexA] = useState<number>(-1);
  const [compareIndexB, setCompareIndexB] = useState<number>(-1);
  const [activeTab, setActiveTab] = useState<'upload' | 'history'>('upload');
  
  const { toast } = useToast();
  
  // Custom parsed resume profile editors
  const [isEditing, setIsEditing] = useState(false);
  const [newSkill, setNewSkill] = useState('');
  const [newDomain, setNewDomain] = useState('');
  const [newProjName, setNewProjName] = useState('');
  const [newProjTech, setNewProjTech] = useState('');

  const fetchVersions = async () => {
    try {
      const res = await fetch('/api/resume/versions');
      if (res.ok) {
        const data = await res.json();
        setVersions(data.versions || []);
        if (data.versions && data.versions.length > 0) {
          // Set active parsed view to latest version
          setParsedData(data.versions[data.versions.length - 1].parsedData);
          if (data.versions.length >= 2) {
            setCompareIndexA(data.versions.length - 2);
            setCompareIndexB(data.versions.length - 1);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching versions:', err);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const u = localStorage.getItem('user');
      if (!u) {
        window.location.href = '/login?redirect=' + window.location.pathname;
        return;
      }
    }
    fetchVersions();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast('Please select a file to upload', 'error');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/resume/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      toast('Resume uploaded and parsed successfully!', 'success');
      setParsedData(data.parsedData);
      setFile(null);
      
      // Refresh versions history
      await fetchVersions();
      setActiveTab('history');

    } catch (err: any) {
      toast(err.message || 'Error occurred during parsing', 'error');
    } finally {
      setUploading(false);
    }
  };

  // Perform beautiful analytical resume version comparisons
  const renderCompareDiff = () => {
    if (compareIndexA < 0 || compareIndexB < 0 || versions.length < 2) return null;
    
    const verA = versions[compareIndexA];
    const verB = versions[compareIndexB];

    const skillsA = verA.parsedData?.skills || [];
    const skillsB = verB.parsedData?.skills || [];
    const newSkills = skillsB.filter((s: string) => !skillsA.includes(s));
    const removedSkills = skillsA.filter((s: string) => !skillsB.includes(s));

    const projectsA = (verA.parsedData?.projects || []).map((p: any) => p.name);
    const projectsB = (verB.parsedData?.projects || []).map((p: any) => p.name);
    const newProjects = projectsB.filter((p: string) => !projectsA.includes(p));

    return (
      <div className="bg-zinc-900/30 border border-zinc-800 rounded-2xl p-6 space-y-6 mt-8">
        <div className="flex items-center gap-3 border-b border-zinc-800 pb-4">
          <ArrowRightLeft className="w-5 h-5 text-indigo-400" />
          <h3 className="text-sm font-mono tracking-wider uppercase text-white">Resume Evolution comparison</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Version Selector A */}
          <div className="space-y-2">
            <span className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">Baseline Version A</span>
            <select
              value={compareIndexA}
              onChange={(e) => setCompareIndexA(Number(e.target.value))}
              className="w-full bg-zinc-950 border border-zinc-800 focus:border-zinc-700 outline-none rounded-xl py-3 px-4 text-xs font-mono text-zinc-200"
            >
              {versions.map((v, idx) => (
                <option key={idx} value={idx}>{v.versionName}</option>
              ))}
            </select>
          </div>

          {/* Version Selector B */}
          <div className="space-y-2">
            <span className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">Comparison Version B</span>
            <select
              value={compareIndexB}
              onChange={(e) => setCompareIndexB(Number(e.target.value))}
              className="w-full bg-zinc-950 border border-zinc-800 focus:border-zinc-700 outline-none rounded-xl py-3 px-4 text-xs font-mono text-zinc-200"
            >
              {versions.map((v, idx) => (
                <option key={idx} value={idx}>{v.versionName}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Diff Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
          
          {/* Added Elements */}
          <div className="space-y-3 p-4 bg-emerald-950/10 border border-emerald-900/30 rounded-xl">
            <h4 className="text-xs font-mono tracking-wider uppercase text-emerald-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Acquired Growth Metrics
            </h4>
            
            {newSkills.length === 0 && newProjects.length === 0 ? (
              <p className="text-xs text-zinc-500 font-mono">No new skills or projects added in this cycle.</p>
            ) : (
              <div className="space-y-2">
                {newSkills.length > 0 && (
                  <div>
                    <span className="text-[9px] font-mono text-zinc-400 uppercase">New Skills:</span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {newSkills.map((s: string, idx: number) => (
                        <span key={idx} className="bg-emerald-950/50 border border-emerald-800/40 text-emerald-300 text-[10px] py-0.5 px-2 rounded font-mono">
                          +{s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {newProjects.length > 0 && (
                  <div className="pt-2">
                    <span className="text-[9px] font-mono text-zinc-400 uppercase">New Projects:</span>
                    <ul className="list-disc pl-4 text-xs text-emerald-300 font-mono mt-1 space-y-0.5">
                      {newProjects.map((p: string, idx: number) => (
                        <li key={idx}>+{p}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Deprecated Elements */}
          <div className="space-y-3 p-4 bg-rose-950/10 border border-rose-900/30 rounded-xl">
            <h4 className="text-xs font-mono tracking-wider uppercase text-rose-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
              Shifted Focus Categories
            </h4>

            {removedSkills.length === 0 ? (
              <p className="text-xs text-zinc-500 font-mono">No deprecated skillset nodes found.</p>
            ) : (
              <div>
                <span className="text-[9px] font-mono text-zinc-400 uppercase">Removed from Focus:</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {removedSkills.map((s: string, idx: number) => (
                    <span key={idx} className="bg-rose-950/50 border border-rose-800/40 text-rose-300 text-[10px] py-0.5 px-2 rounded font-mono line-through">
                      -{s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-[#030303] text-zinc-50 relative overflow-hidden font-sans pb-16">
      <div className="noise-bg" />
      
      {/* Background radial accent glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[900px] h-[300px] bg-blue-600/5 rounded-full blur-[140px] pointer-events-none z-0" />

      <Navbar />

      <div className="z-10 relative max-w-5xl mx-auto px-6 pt-12 space-y-10">
        
        {/* Header Info */}
        <div className="border-b border-zinc-900 pb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <span className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">[ COGNITIVE_RESUME_ANALYZER ]</span>
            <h1 className="text-4xl font-light text-white tracking-tight mt-1 uppercase">
              Resume Profile System
            </h1>
            <p className="text-zinc-400 text-sm mt-1">
              Upload your resume in PDF/DOCX to customize simulation topics and trace growth across iterations.
            </p>
          </div>

          {/* Mode Tabs */}
          <div className="flex bg-zinc-900/60 border border-zinc-800 p-1 rounded-xl font-mono text-[10px] uppercase">
            <button
              onClick={() => setActiveTab('upload')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'upload' ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Upload_Scanner
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'history' ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Versions_Diff ({versions.length})
            </button>
          </div>
        </div>

        {/* Dynamic tabs render */}
        <AnimatePresence mode="wait">
          {activeTab === 'upload' ? (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-8"
            >
              {/* Left Column: Drag & Drop Card */}
              <div className="lg:col-span-1 space-y-4">
                <div className="bg-zinc-900/30 border border-zinc-800 rounded-2xl p-6 text-center space-y-6 relative overflow-hidden group">
                  <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-blue-500/10 to-transparent" />
                  
                  <div className="mx-auto w-12 h-12 rounded-xl bg-zinc-850 flex items-center justify-center border border-zinc-800 group-hover:border-zinc-700 transition-colors">
                    <Upload className="w-5 h-5 text-zinc-400 group-hover:text-white transition-colors" />
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-white">Import Profile Asset</h3>
                    <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                      PDF, DOCX, or plain TXT format supported. Max size 5MB.
                    </p>
                  </div>

                  <form onSubmit={handleUpload} className="space-y-4 pt-2">
                    <div className="relative">
                      <input
                        type="file"
                        onChange={handleFileChange}
                        accept=".pdf,.docx,.txt"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        id="resume-file-input"
                      />
                      <button
                        type="button"
                        className="w-full bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 rounded-xl py-3 px-4 text-xs font-mono tracking-wide text-zinc-400 hover:text-white transition-colors"
                      >
                        {file ? file.name : 'SELECT_FILE_FROM_DISK'}
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={!file || uploading}
                      className="w-full relative overflow-hidden group/btn flex items-center justify-center gap-4 text-xs font-mono tracking-widest text-white uppercase py-3.5 rounded-xl border border-zinc-800 hover:border-white bg-transparent transition-colors duration-300 disabled:opacity-40 disabled:pointer-events-none"
                    >
                      <span className="absolute inset-0 w-full h-full bg-white translate-y-[100%] group-hover/btn:translate-y-0 transition-transform duration-300 origin-bottom ease-[0.16, 1, 0.3, 1] z-0" />
                      <span className="relative z-10 flex items-center gap-2 group-hover/btn:text-indigo-950 group-hover/btn:font-bold">
                        {uploading ? 'PARSING_SYSTEM...' : 'RUN_AUTO_SCANNER'}
                      </span>
                    </button>
                  </form>
                </div>
              </div>

              {/* Right Column: Parsed Preview display */}
              <div className="lg:col-span-2 space-y-6">
                {parsedData ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Auto-tagged domains */}
                    <div className="bg-zinc-900/30 border border-zinc-800 p-6 rounded-2xl space-y-4 md:col-span-2 relative">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">System Auto-tagged Domains</span>
                        <button
                          onClick={() => setIsEditing(!isEditing)}
                          className="text-[10px] font-mono border border-zinc-850 hover:border-zinc-700 text-zinc-400 hover:text-white px-2.5 py-1 rounded bg-zinc-950/50 cursor-pointer"
                        >
                          {isEditing ? 'FINISH_EDITS' : 'EDIT_PROFILE_ASSET'}
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2.5">
                        {parsedData.domains?.map((d: string, idx: number) => (
                          <span key={idx} className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-mono py-1.5 px-3.5 rounded-full flex items-center gap-1.5">
                            {d}
                            {isEditing && (
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = parsedData.domains.filter((_: any, i: any) => i !== idx);
                                  setParsedData({ ...parsedData, domains: updated });
                                  toast('Domain deleted', 'info');
                                }}
                                className="hover:text-rose-400 text-indigo-400/60 font-bold bg-transparent border-0 cursor-pointer text-xs"
                              >
                                ×
                              </button>
                            )}
                          </span>
                        ))}
                      </div>
                      
                      {isEditing && (
                        <div className="pt-2 flex gap-2">
                          <input
                            type="text"
                            placeholder="Add Domain..."
                            value={newDomain}
                            onChange={(e) => setNewDomain(e.target.value)}
                            className="bg-zinc-950 border border-zinc-850 focus:border-zinc-700 outline-none rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-200 w-44"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (newDomain.trim()) {
                                setParsedData({
                                  ...parsedData,
                                  domains: [...(parsedData.domains || []), newDomain.trim()]
                                });
                                setNewDomain('');
                                toast('Domain added', 'success');
                              }
                            }}
                            className="bg-indigo-650 hover:bg-indigo-600 px-3 py-1.5 rounded-lg text-xs font-mono text-white cursor-pointer"
                          >
                            Add
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Skill nodes */}
                    <div className="bg-zinc-900/30 border border-zinc-800 p-6 rounded-2xl space-y-4">
                      <span className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">Skill Matrix nodes</span>
                      <div className="flex flex-wrap gap-1.5">
                        {parsedData.skills?.map((s: string, idx: number) => (
                          <span key={idx} className="bg-zinc-950 border border-zinc-850 text-zinc-300 text-[10px] font-mono py-1 px-2.5 rounded-lg flex items-center gap-1.5">
                            {s}
                            {isEditing && (
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = parsedData.skills.filter((_: any, i: any) => i !== idx);
                                  setParsedData({ ...parsedData, skills: updated });
                                  toast('Skill chip removed', 'info');
                                }}
                                className="hover:text-rose-400 text-zinc-500 font-bold bg-transparent border-0 cursor-pointer text-xs"
                              >
                                ×
                              </button>
                            )}
                          </span>
                        ))}
                      </div>

                      {isEditing && (
                        <div className="pt-2 flex gap-2">
                          <input
                            type="text"
                            placeholder="Add Skill chip..."
                            value={newSkill}
                            onChange={(e) => setNewSkill(e.target.value)}
                            className="bg-zinc-950 border border-zinc-850 focus:border-zinc-700 outline-none rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-200 w-44"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (newSkill.trim()) {
                                setParsedData({
                                  ...parsedData,
                                  skills: [...(parsedData.skills || []), newSkill.trim()]
                                });
                                setNewSkill('');
                                toast('Skill chip added', 'success');
                              }
                            }}
                            className="bg-indigo-650 hover:bg-indigo-600 px-3 py-1.5 rounded-lg text-xs font-mono text-white cursor-pointer"
                          >
                            Add
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Project elements */}
                    <div className="bg-zinc-900/30 border border-zinc-800 p-6 rounded-2xl space-y-4">
                      <span className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">Identified Project nodes</span>
                      {parsedData.projects?.length > 0 ? (
                        <div className="space-y-4">
                          {parsedData.projects.map((p: any, idx: number) => (
                            <div key={idx} className="border-l border-zinc-800 pl-4 space-y-1 relative group">
                              {isEditing && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = parsedData.projects.filter((_: any, i: any) => i !== idx);
                                    setParsedData({ ...parsedData, projects: updated });
                                    toast('Project deleted', 'info');
                                  }}
                                  className="absolute right-0 top-0 text-zinc-600 hover:text-rose-400 bg-transparent border-none cursor-pointer"
                                  title="Delete Project"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <h4 className="text-sm font-medium text-white">{p.name}</h4>
                              <div className="flex flex-wrap gap-1">
                                {p.tech?.map((t: string, tIdx: number) => (
                                  <span key={tIdx} className="text-[9px] font-mono text-zinc-500 bg-zinc-950 px-1.5 py-0.5 rounded">
                                    {t}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-zinc-500 font-mono">No distinct project elements categorized.</p>
                      )}

                      {isEditing && (
                        <div className="pt-4 border-t border-zinc-900 space-y-2">
                          <input
                            type="text"
                            placeholder="Project Name..."
                            value={newProjName}
                            onChange={(e) => setNewProjName(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-850 focus:border-zinc-700 outline-none rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-200"
                          />
                          <input
                            type="text"
                            placeholder="Technologies (comma separated)..."
                            value={newProjTech}
                            onChange={(e) => setNewProjTech(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-850 focus:border-zinc-700 outline-none rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-200"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (newProjName.trim()) {
                                const techArr = newProjTech.split(',').map(s => s.trim()).filter(Boolean);
                                setParsedData({
                                  ...parsedData,
                                  projects: [...(parsedData.projects || []), { name: newProjName.trim(), tech: techArr }]
                                });
                                setNewProjName('');
                                setNewProjTech('');
                                toast('Project added successfully', 'success');
                              }
                            }}
                            className="w-full bg-indigo-650 hover:bg-indigo-600 py-2 rounded-lg text-xs font-mono text-white cursor-pointer"
                          >
                            Add Project
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="h-[250px] bg-zinc-900/10 border border-dashed border-zinc-850 rounded-2xl flex flex-col items-center justify-center text-zinc-500 font-mono text-xs space-y-2">
                    <FileText className="w-8 h-8 text-zinc-600" />
                    <span>[ NO_PROFILE_DATA_INJECTED ]</span>
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {versions.length < 2 ? (
                <div className="h-[250px] bg-zinc-900/10 border border-dashed border-zinc-850 rounded-2xl flex flex-col items-center justify-center text-zinc-500 font-mono text-xs space-y-2">
                  <HelpCircle className="w-8 h-8 text-zinc-600" />
                  <span>[ UPLOAD_AT_LEAST_TWO_VERSIONS_TO_DIFFER ]</span>
                </div>
              ) : (
                renderCompareDiff()
              )}

              {/* List of historical versions */}
              <div className="bg-zinc-900/30 border border-zinc-800 rounded-2xl p-6 space-y-4">
                <span className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">Archived version history</span>
                <div className="divide-y divide-zinc-900">
                  {versions.map((v, idx) => (
                    <div key={idx} className="flex justify-between items-center py-4 text-xs font-mono">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <span className="text-zinc-200 font-medium">{v.versionName}</span>
                      </div>
                      <span className="text-zinc-600">
                        {new Date(v.uploadedAt).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </main>
  );
}
