import { CAREER_ROLES, PRIORITIES } from "@/lib/onboarding/catalog";

export const roleLabel = (id: string | null) => (id ? (CAREER_ROLES.find((r) => r.id === id)?.label ?? id) : "your target role");
export const priorityLabel = (id: string) => PRIORITIES.find((p) => p.id === id)?.label ?? id;

/** ERIS weights are 0–1 importance for the role. */
export const importance = (weight: number) => (weight >= 0.9 ? "Core" : weight >= 0.6 ? "Important" : "Useful");
