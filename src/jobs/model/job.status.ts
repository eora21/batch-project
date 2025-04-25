export const JobStatus = {
  PENDING: "pending",
  COMPLETED: "completed",
} as const;

export type JobStatus = typeof JobStatus[keyof typeof JobStatus];
