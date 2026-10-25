import type { Persona } from "@/db/schema";

// Shape of profile_views.view as written by worker/intelligence/compute.py
// (VIEW_VERSION 1). Client-safe.

// "preview": the widget's layout is shown before its data source exists
// (faculty and alumni widgets that depend on modules still being built).
export type WidgetState = "ready" | "empty" | "partial" | "stale" | "preview";

export type ScoredWidget = {
  id: string;
  module: string;
  label: string;
  score: number;
  components: { I: number; G: number; R: number; F: number };
  state: WidgetState;
  data: unknown;
};

export type SkillGap = { skill: string; readiness: number; weight: number };

export type SkillGraphNode = {
  id: string;
  name: string;
  strength: number;
  confidence: number;
  isDirect: boolean;
  category?: string;
  source?: string;
  reason?: string;
  inferredFrom?: string[];
};

export type SkillGraphEdge = {
  source: string;
  target: string;
  relationship: string;
  weight?: number;
};

export type SkillGraphData = {
  nodes: SkillGraphNode[];
  edges: SkillGraphEdge[];
};

export type ProfileViewDoc = {
  version: number;
  computedAt: string;
  trigger: string | null;
  identity: { name: string | null; university: string | null; degree: string | null; careerRole: string | null };
  // Missing in views computed before personas existed: treat as student.
  persona?: Persona;
  goals: { primaryRole: string | null; roles: string[]; roleOther: string | null; priorities: string[] };
  skills: { name: string; category: string; evidenceStrength: number; sources: string[]; verificationStatus: string }[];
  projects: { canonicalTitle: string; technologies: string[]; status: string; matchConfidence: number }[];
  erisScore: { overall: number | null; byRole: Record<string, number>; gaps: SkillGap[] };
  readinessIndicators: { resumeLinked: boolean; connectorsCount: number; confirmedFacts: number; profileComplete?: number };
  inferredSkills?: { name: string; strength: number; isDirect: boolean; inferredFrom: string[] }[];
  skill_graph?: SkillGraphData;
  skillGraph?: SkillGraphData;
  skillGapsAndPaths?: {
    gaps: { skill: string; description: string; priority: string; action: string }[];
    learning_paths: { title: string; description: string; modules_count: number; duration_weeks: number; focus_areas: string[] }[];
  };
  careerRoadmap?: {
    current_stage: string;
    short_term: { title?: string; timeline?: string; milestones: string[]; focus?: string };
    mid_term: { title?: string; timeline?: string; milestones: string[]; focus?: string };
    long_term: { title?: string; timeline?: string; milestones: string[]; focus?: string };
  };
  nextActions?: { num: number; title: string; desc: string; btnText: string; btnHref: string; category?: string }[];
  widgets: ScoredWidget[];
};

// Per-widget `data` payloads.
export type ErisData = { role: string | null; score: number; gaps: SkillGap[] };
export type SkillGapsData = { role: string | null; gaps: SkillGap[] };
export type CompletenessData = { percent: number; checks: { id: string; label: string; done: boolean }[] };
