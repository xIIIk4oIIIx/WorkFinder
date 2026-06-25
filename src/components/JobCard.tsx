'use client';

import { type Job, type GroupedJob } from '@/types/job';
import { type PreferenceState, getVoteForJob, recordVote } from '@/lib/preferences';

interface JobCardProps {
  job: Job | GroupedJob;
  preferences: PreferenceState;
  onPreferenceChange: (newState: PreferenceState) => void;
}

export function JobCard({ job, preferences, onPreferenceChange }: JobCardProps) {
  const currentVote = getVoteForJob(job.id, preferences);

  const handleVote = (vote: 'up' | 'down') => {
    const newState = recordVote({
      jobId: job.id,
      vote,
      technologies: job.technologies,
      company: job.company,
      city: job.city ?? '',
      workMode: job.workMode ?? '',
    });
    onPreferenceChange(newState);
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={() => handleVote('up')}
        className={`w-6 h-6 flex items-center justify-center rounded border transition-all duration-150 active:scale-90 ${
          currentVote === 'up'
            ? 'border-emerald-300 bg-emerald-50 text-emerald-500'
            : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
        }`}
        title="Lubię to"
      >
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill={currentVote === 'up' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 10v12" />
          <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z" />
        </svg>
      </button>
      <button
        onClick={() => handleVote('down')}
        className={`w-6 h-6 flex items-center justify-center rounded border transition-all duration-150 active:scale-90 ${
          currentVote === 'down'
            ? 'border-rose-300 bg-rose-50 text-rose-500'
            : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
        }`}
        title="Nie lubię tego"
      >
        <svg className="w-3 h-3 rotate-180" viewBox="0 0 24 24" fill={currentVote === 'down' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 10v12" />
          <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z" />
        </svg>
      </button>
    </div>
  );
}
