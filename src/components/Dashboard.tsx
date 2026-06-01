import { motion } from "motion/react";
import { AnalysisResult } from "../types";
import { Radar, AlertTriangle, Bug, LayoutTemplate, Activity, ChevronRight, CheckCircle2, Copy, Download } from "lucide-react";
import { useState } from "react";

const generateMarkdown = (result: AnalysisResult) => {
  return `# RealityCheck.ai Analysis Report

## Vibe Check
> ${result.vibeCheck}

## Core Metrics
- **True Reality Score:** ${result.realityScore}/100
- **Est. True Progress:** ${result.completionPercentage}% MVP Complete

## Architecture Evaluation
${result.architectureEvaluation}

## Section Breakdown (0-100)
- **Frontend:** ${result.sectionBreakdown?.frontend || 0}%
- **Backend:** ${result.sectionBreakdown?.backend || 0}%
- **Database:** ${result.sectionBreakdown?.database || 0}%
- **Integration/Glue:** ${result.sectionBreakdown?.glue || 0}%
- **Security Health:** ${result.sectionBreakdown?.security || 0}%
- **Bug Health:** ${result.sectionBreakdown?.bugHealth || 0}%

## Gap Analysis (Missing for Production)
${result.gapAnalysis?.map(g => `- ${g}`).join('\n') || 'None'}

## Suggested Roadmap
${result.suggestedRoadmap?.map((r, i) => `${i + 1}. **[${r.priority.toUpperCase()}]** ${r.task} *(Effort: ${r.effort})*`).join('\n') || 'None'}

## Actionable Overhauls
${result.actionableOverhauls?.map(o => `- ${o}`).join('\n') || 'None'}

## Hallucinated Shells
${result.hallucinatedFeatures?.map(f => `- ${f}`).join('\n') || 'None'}

## Structural Smells
${result.structuralSmells?.map(s => `- ${s}`).join('\n') || 'None'}

## Deep Static Analysis
- **Languages Detected:** ${result.deepMetrics?.detectedLanguages?.join(', ')}
- **Cyclomatic Complexity:** ${result.deepMetrics?.cyclomaticComplexity}
- **Test Coverage:** ${result.deepMetrics?.testCoverage}
- **Dependency Health:** ${result.deepMetrics?.dependencyHealth}
- **Security Audit:** ${result.deepMetrics?.securityAudit}
- **Documentation Quality:** ${result.deepMetrics?.documentationQuality}

## Critical Bugs & Leaks
${result.bugsAndLeaks?.map(b => `- ${b}`).join('\n') || 'None'}

${result.implementationPlan && result.implementationPlan.length > 0 ? `## Agentic Implementation Plan\n${result.implementationPlan.map((step, idx) => `
### Step ${idx + 1}: ${step.title}
**Description:** ${step.description}
**Target Files:** ${step.targetFiles?.join(', ')}

\`\`\`
${step.promptInstruction}
\`\`\`
`).join('\n')}` : ''}
`;
};

export function Dashboard({ result, onReset }: { result: AnalysisResult; onReset: () => void }) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-400";
    if (score >= 50) return "text-yellow-400";
    return "text-rose-400";
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return "bg-emerald-400/10 border-emerald-500/20";
    if (score >= 50) return "bg-yellow-400/10 border-yellow-500/20";
    return "bg-rose-400/10 border-rose-500/20";
  };

  const copyPrompt = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const exportMD = () => {
    const md = generateMarkdown(result);
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "reality-check-report.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-6xl mx-auto p-4 md:p-8 space-y-6"
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white mb-2">Reality Check</h2>
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 inline-block">
             <h3 className="text-emerald-400 font-semibold mb-1 text-sm tracking-widest uppercase">Vibe Check</h3>
             <p className="text-emerald-100 font-mono text-sm max-w-3xl leading-relaxed">"{result.vibeCheck}"</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={exportMD}
            className="flex items-center space-x-2 text-sm font-medium text-emerald-400 hover:text-emerald-300 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 hover:drop-shadow-[0_0_10px_rgba(52,211,153,0.5)] transition-all duration-300 border border-emerald-500/20 rounded-md"
          >
            <Download className="w-4 h-4" />
            <span>Export MD</span>
          </button>
          <button
            onClick={onReset}
            className="text-sm font-medium text-zinc-400 hover:text-white px-4 py-2 bg-zinc-800 hover:bg-zinc-700 hover:drop-shadow-[0_0_10px_rgba(255,255,255,0.2)] transition-all duration-300 border border-zinc-700 rounded-md"
          >
            Scan Another
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Core Stats */}
        <div className={`col-span-1 border rounded-2xl p-6 flex flex-col justify-between hover:shadow-[0_0_30px_rgba(52,211,153,0.15)] transition-shadow duration-500 ${getScoreBg(result.realityScore)}`}>
          <div>
            <div className="flex space-x-2 items-center mb-6">
              <Activity className={`w-5 h-5 ${getScoreColor(result.realityScore)}`} />
              <h3 className="text-sm font-semibold tracking-wide uppercase text-zinc-300">True Reality Score</h3>
            </div>
            <div className={`text-7xl font-bold tracking-tighter ${getScoreColor(result.realityScore)} mb-2`}>
              {result.realityScore}<span className="text-2xl text-zinc-500">/100</span>
            </div>
            <p className="text-zinc-400 text-sm">
              LLMs claim 100%. Reality begs to differ.
            </p>
          </div>
          <div className="mt-8">
            <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Est. True Progress</h4>
            <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${result.completionPercentage}%` }}
                transition={{ duration: 1, delay: 0.5 }}
                className="bg-white h-full"
              ></motion.div>
            </div>
            <div className="text-right text-xs mt-2 text-zinc-400">{result.completionPercentage}% MVP Complete</div>
          </div>
        </div>

        <div className="col-span-1 md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Actionable Overhauls */}
          <div className="border border-zinc-800 bg-zinc-900/50 rounded-2xl p-6">
            <div className="flex items-center space-x-2 mb-4">
              <Radar className="w-5 h-5 text-emerald-400" />
              <h3 className="font-medium text-white tracking-tight">Maturity Overhauls</h3>
            </div>
            <ul className="space-y-3">
              {result.actionableOverhauls.map((item, idx) => (
                <li key={idx} className="flex items-start text-sm text-zinc-400">
                  <ChevronRight className="w-4 h-4 text-emerald-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
              {result.actionableOverhauls.length === 0 && (
                <span className="text-zinc-500 text-sm">No overhauls suggested. Shocking.</span>
              )}
            </ul>
          </div>

          {/* Hallucinated Features */}
          <div className="border border-zinc-800 bg-zinc-900/50 rounded-2xl p-6">
            <div className="flex items-center space-x-2 mb-4">
              <LayoutTemplate className="w-5 h-5 text-fuchsia-400" />
              <h3 className="font-medium text-white tracking-tight">Hallucinated Shells</h3>
            </div>
            <ul className="space-y-3">
              {result.hallucinatedFeatures.map((item, idx) => (
                <li key={idx} className="flex items-start text-sm text-zinc-400">
                  <span className="w-1.5 h-1.5 bg-fuchsia-400 rounded-full mr-3 flex-shrink-0 mt-1.5" />
                  <span>{item}</span>
                </li>
              ))}
              {result.hallucinatedFeatures.length === 0 && (
                <span className="text-zinc-500 text-sm">No fake features found. Incredible.</span>
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* Section Breakdown Grid */}
      {result.sectionBreakdown && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 mt-8">
          {[
            { label: "Frontend", value: result.sectionBreakdown.frontend, fillClass: "bg-blue-400" },
            { label: "Backend", value: result.sectionBreakdown.backend, fillClass: "bg-purple-400" },
            { label: "Database", value: result.sectionBreakdown.database, fillClass: "bg-orange-400" },
            { label: "Integration", value: result.sectionBreakdown.glue, fillClass: "bg-emerald-400" },
            { label: "Security", value: result.sectionBreakdown.security, fillClass: "bg-rose-400" },
            { label: "Bug Health", value: result.sectionBreakdown.bugHealth, fillClass: "bg-cyan-400" },
          ].map((metric, idx) => (
            <div key={idx} className="border border-zinc-800 bg-zinc-900/50 rounded-xl p-4 flex flex-col justify-between">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">{metric.label}</span>
              <div className="mt-4">
                <div className="text-2xl font-bold tracking-tighter text-white mb-2">{metric.value}%</div>
                <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${metric.value}%` }}
                    transition={{ duration: 1, delay: 0.5 + (idx * 0.1) }}
                    className={`h-full ${metric.fillClass}`}
                  ></motion.div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Production & Architecture Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <div className="border border-zinc-800 bg-zinc-900/80 rounded-2xl p-6">
           <h3 className="text-lg font-medium text-white tracking-tight mb-4 flex items-center gap-2">
             <LayoutTemplate className="w-5 h-5 text-indigo-400" />
             Architecture Evaluation
           </h3>
           <p className="text-sm text-zinc-400 leading-relaxed mb-6">{result.architectureEvaluation}</p>
           
           <h4 className="text-sm font-semibold text-zinc-300 uppercase tracking-widest mb-3">Gap Analysis (Missing for Prod)</h4>
           <ul className="space-y-3">
             {result.gapAnalysis?.map((gap, idx) => (
                <li key={idx} className="flex items-start text-sm text-zinc-400">
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full mr-3 flex-shrink-0 mt-1.5" />
                  <span>{gap}</span>
                </li>
             ))}
           </ul>
        </div>
        
        <div className="border border-zinc-800 bg-zinc-900/80 rounded-2xl p-6">
           <h3 className="text-lg font-medium text-white tracking-tight mb-4 flex items-center gap-2">
             <Activity className="w-5 h-5 text-amber-400" />
             Suggested Roadmap
           </h3>
           <div className="space-y-4">
             {result.suggestedRoadmap?.map((step, idx) => (
                <div key={idx} className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 flex gap-4 items-start">
                   <div className={`mt-0.5 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                      step.priority === 'high' ? 'bg-rose-500/20 text-rose-400' :
                      step.priority === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-emerald-500/20 text-emerald-400'
                   }`}>
                     {step.priority}
                   </div>
                   <div>
                     <p className="text-sm text-zinc-300 font-medium mb-1">{step.task}</p>
                     <p className="text-xs text-zinc-500 font-mono">Effort: {step.effort}</p>
                   </div>
                </div>
             ))}
           </div>
        </div>
      </div>

      {/* Deep Metrics */}
      {result.deepMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
          <div className="border border-zinc-800 bg-zinc-900/50 rounded-2xl p-6 transition hover:bg-zinc-900/80">
            <h3 className="font-medium text-white tracking-tight mb-2">Complexity & Structure</h3>
            <p className="text-sm text-zinc-400">{result.deepMetrics.cyclomaticComplexity}</p>
          </div>
          <div className="border border-zinc-800 bg-zinc-900/50 rounded-2xl p-6 transition hover:bg-zinc-900/80">
            <h3 className="font-medium text-white tracking-tight mb-2">Tests & Coverage</h3>
            <p className="text-sm text-zinc-400">{result.deepMetrics.testCoverage}</p>
          </div>
          <div className="border border-zinc-800 bg-zinc-900/50 rounded-2xl p-6 transition hover:bg-zinc-900/80">
            <h3 className="font-medium text-white tracking-tight mb-2">Dependency Security</h3>
            <p className="text-sm text-zinc-400">{result.deepMetrics.dependencyHealth}</p>
          </div>
          <div className="border border-zinc-800 bg-zinc-900/50 rounded-2xl p-6 transition hover:bg-zinc-900/80">
            <h3 className="font-medium text-white tracking-tight mb-2">Security & OWASP Audit</h3>
            <p className="text-sm text-zinc-400">{result.deepMetrics.securityAudit}</p>
          </div>
          <div className="border border-zinc-800 bg-zinc-900/50 rounded-2xl p-6 transition hover:bg-zinc-900/80">
            <h3 className="font-medium text-white tracking-tight mb-2">Documentation</h3>
            <p className="text-sm text-zinc-400">{result.deepMetrics.documentationQuality}</p>
          </div>
          <div className="border border-zinc-800 bg-zinc-900/50 rounded-2xl p-6 transition hover:bg-zinc-900/80">
             <h3 className="font-medium text-white tracking-tight mb-2">Ecosystem</h3>
             <div className="flex flex-wrap gap-2 mt-2">
                {result.deepMetrics.detectedLanguages?.map((lang, idx) => (
                  <span key={idx} className="text-xs px-2 py-1 bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-md font-mono">{lang}</span>
                ))}
             </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        {/* Structural Smells */}
        <div className="border border-zinc-800 bg-zinc-900/50 rounded-2xl p-6">
          <div className="flex items-center space-x-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
            <h3 className="font-medium text-white tracking-tight">Structural Smells</h3>
          </div>
          <ul className="space-y-3">
            {result.structuralSmells.map((item, idx) => (
              <li key={idx} className="flex items-start text-sm text-zinc-400">
                <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full mr-3 flex-shrink-0 mt-1.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Bugs & Leaks */}
        <div className="border border-rose-900/30 bg-rose-950/10 rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 blur-3xl rounded-full" />
          <div className="flex items-center space-x-2 mb-4 relative z-10">
            <Bug className="w-5 h-5 text-rose-400" />
            <h3 className="font-medium text-rose-100 tracking-tight">Critical Bugs & Leaks</h3>
          </div>
          <ul className="space-y-3 relative z-10">
            {result.bugsAndLeaks.map((item, idx) => (
              <li key={idx} className="flex items-start text-sm text-rose-200/70">
                <span className="w-1.5 h-1.5 bg-rose-400/50 rounded-full mr-3 flex-shrink-0 mt-1.5" />
                <span>{item}</span>
              </li>
            ))}
            {result.bugsAndLeaks.length === 0 && (
              <span className="text-emerald-400 text-sm font-mono">No critical bugs found. (Yet).</span>
            )}
          </ul>
        </div>
      </div>

      {result.implementationPlan && result.implementationPlan.length > 0 && (
        <div className="mt-8 border border-zinc-800 bg-zinc-900/30 rounded-2xl p-6">
          <div className="flex items-center space-x-2 mb-6">
            <CheckCircle2 className="w-5 h-5 text-cyan-400" />
            <h3 className="font-medium text-white tracking-tight text-lg">Agentic Implementation Plan</h3>
          </div>
          <p className="text-sm text-zinc-400 mb-6 max-w-3xl">
            Copy and paste these precise instructions into your LLM (or execute them yourself) to systematically fix the architecture and complete the project.
          </p>
          <div className="space-y-4">
            {result.implementationPlan.map((step, idx) => (
              <div key={idx} className="bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden">
                <div className="p-4 border-b border-zinc-800/80 bg-zinc-900/50 flex justify-between items-start">
                  <div>
                    <h4 className="text-white font-medium mb-1">Step {idx + 1}: {step.title}</h4>
                    <p className="text-sm text-zinc-400">{step.description}</p>
                    {step.targetFiles && step.targetFiles.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {step.targetFiles.map((file, fIdx) => (
                          <span key={fIdx} className="xs text-xs px-2 py-0.5 bg-zinc-800 text-zinc-300 rounded font-mono">
                            {file}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="p-4 relative group">
                  <pre className="text-sm text-zinc-300 font-mono whitespace-pre-wrap">{step.promptInstruction}</pre>
                  <button
                    onClick={() => copyPrompt(step.promptInstruction, idx)}
                    className="absolute top-4 right-4 p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-md transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 flex items-center space-x-2"
                  >
                    {copiedIndex === idx ? (
                      <span className="text-xs text-emerald-400 flex items-center"><CheckCircle2 className="w-3 h-3 justify-center" /> Copied!</span>
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
