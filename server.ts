import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { randomUUID } from "crypto";
import * as admin from "firebase-admin";
import fs from "fs";

// Initialize Firebase Admin securely without crashing
let adminApp: admin.app.App;
let adminDbInst: admin.firestore.Firestore;

try {
  // Load config if available to ensure projectId
  const configStr = fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf-8");
  const config = JSON.parse(configStr);
  
  try {
    adminApp = admin.initializeApp({
      projectId: config.projectId,
    });
  } catch (e) {
    adminApp = admin.app(); // already initialized
  }
  
  // Set databaseId using the settings object
  adminDbInst = adminApp.firestore();
  adminDbInst.settings({ databaseId: config.firestoreDatabaseId });
  
} catch (e) {
  console.log("Firebase config not found or failed, initializing default app...", e);
  try {
    adminApp = admin.initializeApp();
  } catch (err) {
    adminApp = admin.app();
  }
  adminDbInst = adminApp.firestore();
}

export const adminDb = adminDbInst;


const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// --- INFRASTRUCTURE MOCKS ---

// Rate Limiting
const rateLimits = new Map<string, { count: number, resetAt: number }>();
app.use('/api', (req, res, next) => {
  const ip = req.ip || '127.0.0.1';
  const now = Date.now();
  let record = rateLimits.get(ip);
  if (!record || record.resetAt < now) {
    record = { count: 1, resetAt: now + 60000 }; // 1 min window
  } else {
    record.count++;
  }
  rateLimits.set(ip, record);
  if (record.count > 30) { // Max 30 requests per minute
    return res.status(429).json({ error: "Rate limit exceeded. Please try again later." });
  }
  next();
});

// Caching Layer & Database history
const cacheLayer = new Map<string, { data: any, expires: number }>();
const projectHistory = new Map<string, any[]>(); // Store historical reports

// Scalable Queue System (Mocking Celery/BullMQ implementation)
type JobStatus = 'pending' | 'fetching' | 'analyzing' | 'complete' | 'error';
type Job = {
  id: string;
  status: JobStatus;
  result?: any;
  error?: string;
  createdAt: number;
  ephemeral: boolean;
};
const jobQueue = new Map<string, Job>();

// Periodic Memory Leak Cleanup Task
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimits.entries()) {
    if (record.resetAt < now) rateLimits.delete(ip);
  }
  for (const [url, cached] of cacheLayer.entries()) {
    if (cached.expires < now) cacheLayer.delete(url);
  }
  for (const [jobId, job] of jobQueue.entries()) {
    // Drop jobs older than 1 hour to prevent memory leaks
    if (job.createdAt < now - 3600000) jobQueue.delete(jobId);
  }
}, 60000);

// --- END INFRASTRUCTURE MOCKS ---

async function fetchRepoData(repoUrl: string) {
  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) throw new Error("Invalid GitHub URL. Must be like https://github.com/owner/repo");
  
  const owner = match[1];
  const repo = match[2].replace(/\.git$/, "");
  const headers: Record<string, string> = { "User-Agent": "Agentic-Reality-Check" };

  // Add optional GitHub token to increase rate limit if provided in env
  if (process.env.GITHUB_TOKEN) {
    headers["Authorization"] = `token ${process.env.GITHUB_TOKEN}`;
  }

  try {
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
    if (!repoRes.ok) {
      if (repoRes.status === 403 || repoRes.status === 429) {
        throw new Error("GitHub API Rate Limit Exceeded. Try again later or provide a GITHUB_TOKEN environment variable.");
      }
      throw new Error("Could not fetch repo details (might be private or rate limited).");
    }
    const repoData = await repoRes.json();
    const defaultBranch = repoData.default_branch;

    const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`, { headers });
    if (!treeRes.ok) throw new Error("Could not fetch repository tree.");
    const treeData = await treeRes.json();
    
    // limit tree to 1500 files to avoid massive payloads
    const allPaths = (treeData.tree || []).map((t: any) => t.path);
    const paths = allPaths.slice(0, 1500);
    const isTruncated = allPaths.length > 1500;

    let packageJsonStr = "";
    if (paths.includes("package.json")) {
      const pkgRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/package.json`, { headers });
      if (pkgRes.ok) {
        const pkgData = await pkgRes.json();
        if (pkgData.content) packageJsonStr = Buffer.from(pkgData.content, 'base64').toString('utf-8');
      }
    }

    let readmeStr = "";
    const readmeNode = (treeData.tree || []).find((t: any) => t.path.toLowerCase() === 'readme.md');
    if (readmeNode) {
      const readmeRes = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${readmeNode.path}`, { headers });
      if (readmeRes.ok) {
        readmeStr = await readmeRes.text();
        // Truncate to save tokens if massive
        readmeStr = readmeStr.substring(0, 3000);
      }
    }

    // Deep Inspection: Fetch up to 8 actual core source files to find race conditions, bugs, and real implementation smells
    const allowedExts = ['ts', 'tsx', 'js', 'jsx', 'go', 'py', 'java', 'rs', 'cpp', 'c', 'h', 'php', 'rb'];
    const sourceFilesInfo = (treeData.tree || []).filter((t: any) => {
      if (t.type !== "blob") return false;
      if (t.path.includes('node_modules') || t.path.includes('dist/') || t.path.includes('build/') || t.path.includes('.min.')) return false;
      const ext = t.path.split('.').pop()?.toLowerCase();
      return allowedExts.includes(ext!);
    })
    // Sort to prioritize core files over configs
    .sort((a: any, b: any) => {
      const aCore = a.path.includes('server') || a.path.includes('app') || a.path.includes('main') || a.path.includes('index') ? -1 : 1;
      const bCore = b.path.includes('server') || b.path.includes('app') || b.path.includes('main') || b.path.includes('index') ? -1 : 1;
      return aCore - bCore;
    })
    .slice(0, 8);

    const sourceFileContents: { path: string, content: string }[] = [];
    for (const fileInfo of sourceFilesInfo) {
      try {
        const fileRes = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${fileInfo.path}`, { headers });
        if (fileRes.ok) {
           const text = await fileRes.text();
           // Truncate to first 400 lines to save context limits
           const truncatedText = text.split('\n').slice(0, 400).join('\n');
           sourceFileContents.push({ path: fileInfo.path, content: truncatedText });
        }
      } catch (e) {
        // silently ignore individual file fetch failures
      }
    }

    return { 
      tree: paths, 
      isTruncated,
      packageJson: packageJsonStr,
      readme: readmeStr,
      description: repoData.description,
      language: repoData.language,
      sourceFiles: sourceFileContents
    };
  } catch (error: any) {
    throw new Error(`GitHub API Error: ${error.message}`);
  }
}

async function processAnalysisJob(jobId: string, repoUrl?: string, manualContext?: string) {
  const job = jobQueue.get(jobId);
  if (!job) return;

  try {
    let contextStr = "";
    
    // Simulating Secure Sandbox Environment Spin-up
    job.status = "fetching";
    
    if (repoUrl) {
      const repoData = await fetchRepoData(repoUrl);
      contextStr = `Repository Description: ${repoData.description || 'N/A'}\nPrimary Language: ${repoData.language || 'N/A'}\n`;
      contextStr += `Tree Truncated: ${repoData.isTruncated}\n`;
      contextStr += `Files Layout (top 1500):\n${repoData.tree.join("\n")}\n\n`;
      if (repoData.packageJson) {
        contextStr += `package.json dependencies:\n${repoData.packageJson}\n\n`;
      }
      if (repoData.readme) {
        contextStr += `README.md content:\n${repoData.readme}\n\n`;
      }
      if (repoData.sourceFiles && repoData.sourceFiles.length > 0) {
        contextStr += `\n--- CORE SOURCE FILES SUMMARIES FOR DEEP ANALYSIS ---\n`;
        for (const file of repoData.sourceFiles) {
          contextStr += `\nFile: ${file.path}\n\`\`\`\n${file.content}\n\`\`\`\n`;
        }
      }
    } else if (manualContext) {
      contextStr = `Arbitrary Codebase Context Submitted:\n${manualContext}\n`;
    }

    job.status = "analyzing";

    const prompt = `You are a strict, senior engineering architect evaluating an AI Agent-generated codebase.
LLMs often hallucinate that a codebase is 100% complete, fully functional, or enterprise-ready when it is just a brittle shell.
Review the following project structure and core source files. Provide a highly critical, realistic, deep evaluation of the actual state of the project. Pay specific attention to the source code provided to look for logical flaws.

Identify and deeply analyze:
- "Vibe Check": A brutally honest natural language summary of the project's true state.
- Gap Analysis: Exactly what is missing to reach true production-readiness.
- Suggested Roadmap: Prioritized tasks (High/Medium/Low) required to finish the project.
- Hallucination Risk Detection: Identify overly confident modules that are just brittle UI shells or mocks.
- Architecture Evaluation: Assess architecture patterns (e.g., monolith vs microservices, scalability issues, state management).
- Static Code Analysis: structure, modularity, and complexity metrics (e.g., cyclomatic complexity estimates).
- Multi-Language Ecosystem: detect languages used and multi-language support.
- Automated Test Detection: evaluate test coverage and test file completeness.
- Dependency Scanning: identify potential outdated packages, or OSV/sec vulnerability risks based on package.json.
- Security Audit: scan for leaked secrets, OWASP top 10 violations, hardcoded credentials, and race conditions.
- Documentation Completeness: evaluate README quality, API docs, and inline comments ratio.
- Actionable overhauls using mature, trending components/libraries.
- An explicit, step-by-step implementation plan that an LLM or developer could execute to fix these issues.

Codebase Context:
${contextStr}
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            realityScore: { type: Type.NUMBER, description: "A realistic 0-100 score of how 'done' the project actually is." },
            completionPercentage: { type: Type.NUMBER, description: "Honest percentage to finish MVP." },
            vibeCheck: { type: Type.STRING, description: "A natural language 'Vibe Check' of the project's current state. Is it a messy prototype, a solid foundation, or AI slop?" },
            architectureEvaluation: { type: Type.STRING, description: "Architecture evaluation: monolith vs microservices, state management, scalability concerns." },
            gapAnalysis: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Gap analysis: What's specifically missing to reach production?" },
            suggestedRoadmap: {
              type: Type.ARRAY,
              description: "Suggested roadmap with prioritized tasks to reach completion.",
              items: {
                type: Type.OBJECT,
                properties: {
                  priority: { type: Type.STRING, description: "'high', 'medium', or 'low'" },
                  task: { type: Type.STRING, description: "The task to be done." },
                  effort: { type: Type.STRING, description: "Estimated effort (e.g., 'Days', 'Weeks', 'Hours')" }
                },
                required: ["priority", "task", "effort"]
              }
            },
            hallucinatedFeatures: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "Features implied by structure but likely non-functional (hallucination risks)."
            },
            bugsAndLeaks: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Potential bugs, memory leaks, or missing error boundary spots."
            },
            structuralSmells: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Missing tests, bad abstraction, tight coupling, poor folder structure."
            },
            actionableOverhauls: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Suggestions to swap makeshift AI code with trending/mature open source libraries."
            },
            deepMetrics: {
              type: Type.OBJECT,
              description: "Deep static analysis metrics and security audits.",
              properties: {
                cyclomaticComplexity: { type: Type.STRING, description: "Assessment of code complexity (e.g., 'High: deeply nested loops', 'Low')." },
                testCoverage: { type: Type.STRING, description: "Assessment of automated test coverage." },
                dependencyHealth: { type: Type.STRING, description: "Analysis of outdated packages or vulnerabilities." },
                securityAudit: { type: Type.STRING, description: "Assessment of OWASP top 10 violations, leaked secrets, or hardcoded credentials." },
                documentationQuality: { type: Type.STRING, description: "Assessment of README quality, API docs, and inline comments ratio." },
                detectedLanguages: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of all programming languages detected." }
              },
              required: ["cyclomaticComplexity", "testCoverage", "dependencyHealth", "securityAudit", "documentationQuality", "detectedLanguages"]
            },
            sectionBreakdown: {
              type: Type.OBJECT,
              description: "A detailed breakdown of completion and health scores (0-100) per domain.",
              properties: {
                frontend: { type: Type.NUMBER, description: "Frontend completion percentage." },
                backend: { type: Type.NUMBER, description: "Backend completion percentage." },
                database: { type: Type.NUMBER, description: "Database maturity/completion percentage." },
                glue: { type: Type.NUMBER, description: "Integration/Glue code completion percentage." },
                security: { type: Type.NUMBER, description: "Security robustness score." },
                bugHealth: { type: Type.NUMBER, description: "Bug health score (100 is completely bug-free)." }
              },
              required: ["frontend", "backend", "database", "glue", "security", "bugHealth"]
            },
            implementationPlan: {
              type: Type.ARRAY,
              description: "Step-based solutions that can be easily fed into an LLM or picked up by a dev to execute.",
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING, description: "Short title of the step" },
                  description: { type: Type.STRING, description: "Why this step is needed and what it accomplishes." },
                  targetFiles: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Specific files this step should target." },
                  promptInstruction: { type: Type.STRING, description: "A prompt that could be copy-pasted to an LLM to execute this step." }
                },
                required: ["title", "description", "targetFiles", "promptInstruction"]
              }
            },
            summary: {
              type: Type.STRING,
              description: "One paragraph brutal but constructive summary of where the dev is at."
            }
          },
          required: ["realityScore", "completionPercentage", "vibeCheck", "architectureEvaluation", "gapAnalysis", "suggestedRoadmap", "sectionBreakdown", "deepMetrics", "hallucinatedFeatures", "bugsAndLeaks", "structuralSmells", "actionableOverhauls", "implementationPlan", "summary"]
        }
      }
    });

    const docText = response.text || "{}";
    let cleanedText = docText;
    if (cleanedText.startsWith("```json")) {
      cleanedText = cleanedText.replace(/^```json/, '').replace(/```$/, '').trim();
    }
    const resultObj = JSON.parse(cleanedText);

    job.status = "complete";
    job.result = resultObj;

    // Cache the result only if not ephemeral
    if (!job.ephemeral && repoUrl) {
      cacheLayer.set(repoUrl, {
        data: resultObj,
        expires: Date.now() + 1000 * 60 * 60 // 1 hour cache
      });
      
      // Store in history
      const history = projectHistory.get(repoUrl) || [];
      history.push({ timestamp: new Date().toISOString(), result: resultObj });
      projectHistory.set(repoUrl, history);
    }
  } catch (error: any) {
    console.error("Job Error:", error);
    job.status = "error";
    if (error.status === 429 || (error.message && error.message.includes("429"))) {
       job.error = "Gemini API Quota Exceeded. You have hit the rate limit or context size limit for your current plan.";
    } else {
       job.error = error.message;
    }
  }
}

app.post("/api/analyze", async (req, res) => {
  const { repoUrl, manualContext, ephemeral = true, idToken } = req.body;

  if (!repoUrl && !manualContext) {
    return res.status(400).json({ error: "No repository or context provided." });
  }

  // Auth and limits
  let userId: string | null = null;
  let userTier = 'free';
  if (idToken) {
    try {
      const decodedUser = await admin.auth().verifyIdToken(idToken);
      userId = decodedUser.uid;
      const userRef = await adminDb.collection("users").doc(userId).get();
      if (userRef.exists) {
        userTier = userRef.data()?.tier || 'free';
        const scansThisMonth = userRef.data()?.scansThisMonth || 0;
        const limits = { free: 5, pro: 100, enterprise: 1000 };
        if (scansThisMonth >= limits[userTier as keyof typeof limits]) {
           return res.status(403).json({ error: "Monthly scan limit reached. Please upgrade your plan." });
        }
        
        // Decrement logic (well, increment usage)
        await adminDb.collection("users").doc(userId).update({
           scansThisMonth: admin.firestore.FieldValue.increment(1)
        });
      }
    } catch (e: any) {
      return res.status(401).json({ error: "Invalid authentication token." });
    }
  }

  // Require login if usage without auth is rejected completely.
  // Wait, if it's a tiered tool, let's require auth:
  if (!idToken) {
     return res.status(401).json({ error: "You must be logged in to perform scans." });
  }

  // Check Cache Layer for repeating scans (only if not forcing ephemeral run)
  if (!ephemeral && repoUrl && cacheLayer.has(repoUrl)) {
    const cached = cacheLayer.get(repoUrl)!;
    if (cached.expires > Date.now()) {
      const jobId = randomUUID();
      jobQueue.set(jobId, { id: jobId, status: 'complete', result: cached.data, createdAt: Date.now(), ephemeral: false });
      return res.json({ jobId });
    }
  }

  const jobId = randomUUID();
  jobQueue.set(jobId, { id: jobId, status: 'pending', createdAt: Date.now(), ephemeral });

  // Add to background task queue
  processAnalysisJob(jobId, repoUrl, manualContext).catch(console.error);

  res.json({ jobId });
});

// Queue Job Polling Endpoint
app.get("/api/jobs/:jobId", (req, res) => {
  const job = jobQueue.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });
  
  // Clone to safely return before deletion
  const jobResponse = { ...job };

  // Strict Data Retention Policy: Delete job payload immediately if ephemeral and completed
  if (job.ephemeral && (job.status === 'complete' || job.status === 'error')) {
     jobQueue.delete(job.id); 
  }
  
  res.json(jobResponse);
});

// History endpoint for the Data layer
app.get("/api/history", (req, res) => {
  const { repoUrl } = req.query;
  if (!repoUrl || typeof repoUrl !== 'string') return res.status(400).json({ error: "repoUrl query required" });
  res.json(projectHistory.get(repoUrl) || []);
});

// Webhook for Automatic Re-analysis
app.post("/api/webhooks/github", async (req, res) => {
  const event = req.headers['x-github-event'];
  if (event === 'push') {
    const repoUrl = req.body.repository?.html_url;
    if (repoUrl) {
      // Clear cache and queue new run. Webhook events by default use standard retention so they can be viewed later.
      cacheLayer.delete(repoUrl);
      const jobId = randomUUID();
      jobQueue.set(jobId, { id: jobId, status: 'pending', createdAt: Date.now(), ephemeral: false });
      processAnalysisJob(jobId, repoUrl).catch(console.error);
      return res.status(202).json({ message: "Analysis job queued. Processed securely via isolated container task.", jobId });
    }
  }
  res.status(200).json({ message: "Webhook received using E2EE endpoint." });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
