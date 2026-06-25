import type { Job } from "@/types/job";

const STORAGE_KEY = "workfinder-preferences";

export interface JobPreference {
  jobId: string;
  vote: "up" | "down";
  timestamp: number;
  technologies: string[];
  company: string;
  city: string;
  workMode: string;
}

export interface PreferenceState {
  votes: JobPreference[];
  preferredTechnologies: Record<string, number>;
  preferredCompanies: Record<string, number>;
  preferredCities: Record<string, number>;
  preferredWorkModes: Record<string, number>;
}

function buildDerivedState(votes: JobPreference[]): PreferenceState {
  const preferredTechnologies: Record<string, number> = {};
  const preferredCompanies: Record<string, number> = {};
  const preferredCities: Record<string, number> = {};
  const preferredWorkModes: Record<string, number> = {};

  for (const v of votes) {
    const multiplier = v.vote === "up" ? 1 : -2;

    for (const tech of v.technologies) {
      preferredTechnologies[tech] =
        (preferredTechnologies[tech] ?? 0) + multiplier;
    }
    if (v.company) {
      preferredCompanies[v.company] =
        (preferredCompanies[v.company] ?? 0) + multiplier;
    }
    if (v.city) {
      preferredCities[v.city] = (preferredCities[v.city] ?? 0) + multiplier;
    }
    if (v.workMode) {
      preferredWorkModes[v.workMode] =
        (preferredWorkModes[v.workMode] ?? 0) + multiplier;
    }
  }

  return {
    votes,
    preferredTechnologies,
    preferredCompanies,
    preferredCities,
    preferredWorkModes,
  };
}

export function getPreferences(): PreferenceState {
  if (typeof window === "undefined") {
    return buildDerivedState([]);
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return buildDerivedState([]);
    const votes: JobPreference[] = JSON.parse(raw);
    return buildDerivedState(votes);
  } catch {
    return buildDerivedState([]);
  }
}

function saveVotes(votes: JobPreference[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(votes));
}

export function recordVote(
  vote: JobPreference
): PreferenceState {
  const votes = getPreferences().votes;
  const existingIndex = votes.findIndex((v) => v.jobId === vote.jobId);

  if (existingIndex !== -1) {
    const existing = votes[existingIndex];
    if (existing.vote === vote.vote) {
      votes.splice(existingIndex, 1);
    } else {
      votes[existingIndex] = vote;
    }
  } else {
    votes.push(vote);
  }

  saveVotes(votes);
  return buildDerivedState(votes);
}

export function getJobScore(job: Job, state: PreferenceState): number {
  let score = 0;

  for (const tech of job.technologies) {
    if (tech in state.preferredTechnologies) {
      score += state.preferredTechnologies[tech];
    }
  }

  if (job.company && job.company in state.preferredCompanies) {
    score += state.preferredCompanies[job.company];
  }

  if (job.city && job.city in state.preferredCities) {
    score += state.preferredCities[job.city];
  }

  if (job.workMode && job.workMode in state.preferredWorkModes) {
    score += state.preferredWorkModes[job.workMode];
  }

  return score;
}

export function sortJobsByPreference<T extends Job>(
  jobs: T[],
  state: PreferenceState
): T[] {
  return [...jobs].sort(
    (a, b) => getJobScore(b, state) - getJobScore(a, state)
  );
}

export function getVoteForJob(
  jobId: string,
  state: PreferenceState
): "up" | "down" | null {
  const found = state.votes.find((v) => v.jobId === jobId);
  return found ? found.vote : null;
}
