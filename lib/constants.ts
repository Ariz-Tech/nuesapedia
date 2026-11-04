export const ACADEMIC_LEVELS = ["100L", "200L", "300L", "400L", "500L"] as const;
export type AcademicLevel = (typeof ACADEMIC_LEVELS)[number];

export const SEMESTERS = ["First Semester", "Second Semester"] as const;
export type SemesterName = (typeof SEMESTERS)[number];

export const SUBMISSION_MEDIUMS = ["PDF", "YOUTUBE"] as const;
export type SubmissionMedium = (typeof SUBMISSION_MEDIUMS)[number];

export const SUBMISSION_STATUSES = [
  "UPLOADING",
  "PENDING_REVIEW",
  "APPROVED",
  "REJECTED",
] as const;
export type SubmissionStatusType = (typeof SUBMISSION_STATUSES)[number];

export const MATERIAL_CATEGORIES = [
  "Lecture Note",
  "Past Question",
  "Video Tutorial",
] as const;
export type MaterialCategory = (typeof MATERIAL_CATEGORIES)[number];

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 24,
  MAX_PAGE_SIZE: 100,
  MODERATION_PAGE_SIZE: 150,
} as const;

export const LIMITS = {
  TITLE_MIN_LENGTH: 3,
  TITLE_MAX_LENGTH: 200,
  COURSE_CODE_MIN_LENGTH: 3,
  COURSE_CODE_MAX_LENGTH: 20,
  DESCRIPTION_MAX_LENGTH: 1000,
  REJECTION_REASON_MIN_LENGTH: 5,
  REJECTION_REASON_MAX_LENGTH: 500,
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_MAX_LENGTH: 128,
} as const;

