export type HandoverJob = { id: string; number: number; date: string; summary: string | null; slot: string };
export type HandoverPreview = { jobs: HandoverJob[]; openShifts: number; tracks: string[]; swaps: number };
export function handoverChoices(jobs: HandoverJob[], selected: Record<string, string>) {
  if (jobs.some(job => selected[job.id] === undefined)) throw new Error("Choose a replacement or return each job to dispatch.");
  return jobs.map(job => ({ jobId: job.id, replacement: selected[job.id] === "dispatch" ? null : selected[job.id] }));
}