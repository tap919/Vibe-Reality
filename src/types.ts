export interface ImplementationStep {
  title: string;
  description: string;
  targetFiles: string[];
  promptInstruction: string;
}

export interface RoadmapStep {
  priority: "high" | "medium" | "low";
  task: string;
  effort: string;
}

export interface DeepMetrics {
  cyclomaticComplexity: string;
  testCoverage: string;
  dependencyHealth: string;
  securityAudit: string;
  documentationQuality: string;
  detectedLanguages: string[];
}

export interface SectionBreakdown {
  frontend: number;
  backend: number;
  database: number;
  glue: number;
  security: number;
  bugHealth: number;
}

export interface AnalysisResult {
  realityScore: number;
  completionPercentage: number;
  sectionBreakdown: SectionBreakdown;
  deepMetrics: DeepMetrics;
  vibeCheck: string;
  architectureEvaluation: string;
  gapAnalysis: string[];
  suggestedRoadmap: RoadmapStep[];
  hallucinatedFeatures: string[];
  bugsAndLeaks: string[];
  structuralSmells: string[];
  actionableOverhauls: string[];
  implementationPlan: ImplementationStep[];
  summary: string;
}

export type ScanStatus = "idle" | "fetching" | "analyzing" | "complete" | "error";
