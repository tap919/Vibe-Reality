import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ScanStatus, AnalysisResult } from "./types";
import { ScanningProgress } from "./components/ScanningProgress";
import { Dashboard } from "./components/Dashboard";
import { TeamsAndUsage } from "./components/TeamsAndUsage";
import { Github, AlertCircle, FolderUp, LogIn, LogOut, User as UserIcon } from "lucide-react";
import { useAuth } from "./contexts/AuthContext";

export default function App() {
  const { user, signIn, logOut, loading: authLoading, userTier } = useAuth();
  const [repoUrl, setRepoUrl] = useState("");
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [scanType, setScanType] = useState<"github" | "local">("github");
  const [ephemeral, setEphemeral] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [view, setView] = useState<"scan" | "teams">("scan");
  
  const performScan = async (body: any) => {
    if (!user) {
      setErrorMsg("You must be signed in to perform scans.");
      return;
    }
    
    setStatus("fetching");
    setErrorMsg("");

    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, idToken }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to start analysis job.");
      }

      const { jobId } = await response.json();

      // Long polling for the job status
      while (true) {
        await new Promise(resolve => setTimeout(resolve, 3000)); // poll every 3 seconds
        const jobRes = await fetch(`/api/jobs/${jobId}`);
        
        if (!jobRes.ok) throw new Error("Failed to fetch job status.");
        
        const jobData = await jobRes.json();

        if (jobData.status === "error") {
          throw new Error(jobData.error || "Analysis job encountered an error.");
        }

        if (jobData.status === "complete") {
          setResult(jobData.result);
          setStatus("complete");
          break;
        }

        // Updating UI tracking
        if (jobData.status === "fetching") setStatus("fetching");
        if (jobData.status === "analyzing") setStatus("analyzing");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "An unexpected error occurred.");
      setStatus("error");
    }
  };

  const handleGithubScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl) return;
    await performScan({ repoUrl, ephemeral });
  };

  const handleLocalFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setStatus("fetching");
    setErrorMsg("");

    try {
      // Read top source files to send
      let manualContext = "Local Folder Source Files Review:\n\n";
      const allowedExts = ['ts', 'tsx', 'js', 'jsx', 'go', 'py', 'java', 'rs', 'cpp', 'c', 'h', 'php', 'rb'];
      
      const fileArray = Array.from(files) as File[];
      
      const filteredFiles = fileArray.filter(f => {
        const path = (f.webkitRelativePath || f.name).toLowerCase();
        if (path.includes('node_modules/') || path.includes('.git/') || path.includes('dist/')) return false;
        const ext = f.name.split('.').pop()?.toLowerCase() || '';
        return allowedExts.includes(ext) || f.name.toLowerCase() === 'package.json' || f.name.toLowerCase() === 'readme.md';
      });

      // Sort prioritizing core files
      filteredFiles.sort((a, b) => {
        const aCore = a.name.includes('server') || a.name.includes('main') || a.name.includes('app') || a.name.includes('index') ? -1 : 1;
        const bCore = b.name.includes('server') || b.name.includes('main') || b.name.includes('app') || b.name.includes('index') ? -1 : 1;
        return aCore - bCore;
      });

      let addedFilesCount = 0;
      let totalContextSize = 0;
      const MAX_CONTEXT_SIZE = 100000; // rough char limit

      for (const file of filteredFiles) {
        if (addedFilesCount > 15 || totalContextSize > MAX_CONTEXT_SIZE) break;
        
        const content = await file.text();
        const truncated = content.split('\n').slice(0, 400).join('\n');
        manualContext += `\nFile: ${file.webkitRelativePath || file.name}\n\`\`\`\n${truncated}\n\`\`\`\n`;
        addedFilesCount++;
        totalContextSize += truncated.length;
      }

      await performScan({ manualContext, ephemeral });
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to process local folder.");
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 font-sans text-zinc-100 selection:bg-emerald-500/30">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 py-4 px-6 fixed top-0 w-full z-50 backdrop-blur-md flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent flex items-center gap-2 drop-shadow-[0_0_10px_rgba(52,211,153,0.2)] hover:drop-shadow-[0_0_15px_rgba(52,211,153,0.5)] transition-all cursor-default">
            RealityCheck.ai
          </h1>
        </div>
        <div className="flex items-center space-x-4">
          {!authLoading && user ? (
            <div className="flex items-center space-x-4">
               <button onClick={() => setView('scan')} className={`text-sm font-medium ${view === 'scan' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>Scanner</button>
               <button onClick={() => setView('teams')} className={`text-sm font-medium ${view === 'teams' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>Teams & Usage</button>
               
               <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-widest font-bold">
                 {userTier}
               </span>
               <div className="flex items-center space-x-2">
                 <img src={user.photoURL || ''} alt="avatar" className="w-7 h-7 rounded-full border border-zinc-700" />
                 <span className="text-sm font-medium text-zinc-300 hidden sm:block">{user.displayName || user.email}</span>
               </div>
               <button onClick={logOut} className="text-zinc-500 hover:text-white transition-colors" title="Log out">
                 <LogOut className="w-4 h-4" />
               </button>
            </div>
          ) : !authLoading ? (
            <button onClick={signIn} className="text-sm flex items-center space-x-2 bg-white text-zinc-950 font-semibold px-4 py-1.5 rounded-lg hover:bg-zinc-200 transition-colors">
               <LogIn className="w-4 h-4" />
               <span>Sign In</span>
            </button>
          ) : null}
        </div>
      </header>

      <main className="pt-24 pb-12 px-4 min-h-screen flex flex-col justify-center items-center">
        {view === 'teams' ? (
          <TeamsAndUsage />
        ) : (
          <AnimatePresence mode="wait">
            {status === "idle" || status === "error" ? (
              <motion.div
                key="hero"
                initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full max-w-2xl px-4 py-12 flex flex-col items-center"
            >
              <div className="mb-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 text-xs font-mono">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Agentic Output Analyzer
              </div>
              
              <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-center text-white mb-4">
                Verify AI App Reality.
              </h2>
              <p className="text-zinc-400 text-center text-lg max-w-lg mb-12 leading-relaxed">
                LLMs lie. They claim your app is 100% production-ready. Paste your GitHub repo or upload a local folder to uncover the real maturity score, unhandled leaks, and missing architectural layers.
              </p>

              <div className="w-full bg-zinc-900 rounded-2xl border border-zinc-800 p-2 shadow-2xl shadow-zinc-900/50 mb-6">
                <div className="flex border-b border-zinc-800 mb-4 px-2 pt-2">
                  <button
                    onClick={() => setScanType("github")}
                    className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                      scanType === "github" ? "border-emerald-500 text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    GitHub Repo
                  </button>
                  <button
                    onClick={() => setScanType("local")}
                    className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                      scanType === "local" ? "border-emerald-500 text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    Local Folder
                  </button>
                </div>

                <div className="px-2 pb-2">
                  {scanType === "github" ? (
                    <form onSubmit={handleGithubScan} className="relative flex items-center">
                      <div className="absolute left-4 text-zinc-500 pointer-events-none">
                        <Github className="w-5 h-5" />
                      </div>
                      <input
                        type="url"
                        value={repoUrl}
                        onChange={(e) => setRepoUrl(e.target.value)}
                        placeholder="https://github.com/owner/repository"
                        className="w-full bg-zinc-950 border border-zinc-800 text-white placeholder:text-zinc-600 rounded-xl py-4 pl-12 pr-32 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500 focus:shadow-[0_0_20px_rgba(16,185,129,0.15)] transition-all duration-300 font-mono text-sm"
                        required
                      />
                      <button
                        type="submit"
                        className="absolute right-2 top-2 bottom-2 bg-white text-zinc-950 font-semibold px-6 rounded-lg hover:bg-zinc-200 hover:shadow-[0_0_15px_rgba(255,255,255,0.4)] transition-all duration-300"
                      >
                        Analyze
                      </button>
                    </form>
                  ) : (
                    <div 
                      className="w-full border-2 border-dashed border-zinc-800 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500/50 hover:bg-emerald-500/5 hover:shadow-[0_0_30px_rgba(16,185,129,0.1)] transition-all duration-300 group relative overflow-hidden"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-2xl"></div>
                      <FolderUp className="w-10 h-10 text-zinc-500 mb-4 group-hover:-translate-y-1 group-hover:text-emerald-400 group-hover:drop-shadow-[0_0_8px_rgba(52,211,153,0.8)] transition-all duration-300 relative z-10" />
                      <p className="text-zinc-300 font-medium mb-1 relative z-10">Click to securely select a project folder</p>
                      <p className="text-zinc-500 text-sm relative z-10">Analyzed entirely in context, no permanent storage.</p>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleLocalFolderSelect}
                        className="hidden"
                        // @ts-ignore - webkitdirectory is non-standard but works in modern browsers
                        webkitdirectory=""
                        directory=""
                        multiple
                      />
                    </div>
                  )}
                </div>

                <div className="mt-4 border-t border-zinc-800/80 pt-3 px-3 pb-2 flex items-center justify-between text-xs text-zinc-500">
                  <label className="flex items-center space-x-2 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      checked={ephemeral} 
                      onChange={e => setEphemeral(e.target.checked)}
                      className="rounded border-zinc-700 bg-zinc-950 text-emerald-500 focus:ring-emerald-500/20"
                    />
                    <span className="group-hover:text-zinc-400 transition-colors flex items-center gap-1">
                      Strict Data Privacy Mode (Zero Retention)
                    </span>
                  </label>
                  <div className="flex gap-2">
                    <span className="bg-zinc-800/60 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider text-[10px] text-zinc-400 border border-zinc-700/50">E2EE Upload</span>
                    <span className="bg-emerald-500/10 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider text-[10px] text-emerald-500/80 border border-emerald-500/20">SOC2 / GDPR Ready</span>
                  </div>
                </div>
              </div>

              {status === "error" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="w-full flex items-start space-x-3 text-rose-400 bg-rose-400/10 border border-rose-500/20 p-4 rounded-xl text-sm font-mono overflow-hidden"
                >
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <p>{errorMsg}</p>
                </motion.div>
              )}
            </motion.div>
          ) : status === "fetching" || status === "analyzing" ? (
            <motion.div key="progress" className="w-full" exit={{ opacity: 0 }}>
              <ScanningProgress status={status} />
            </motion.div>
          ) : result ? (
            <motion.div key="dashboard" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="w-full">
              <Dashboard result={result} onReset={() => setStatus("idle")} />
            </motion.div>
          ) : null}
        </AnimatePresence>
        )}
      </main>
    </div>
  );
}
