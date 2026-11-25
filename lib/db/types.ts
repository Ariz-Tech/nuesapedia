import type { CourseMetadata } from "../courses";

export type UserRole = "STUDENT" | "MODERATOR" | "ADMIN";
export type SubmissionStatus = "UPLOADING" | "PENDING_REVIEW" | "APPROVED" | "REJECTED";

export interface DbUser {
  id: string;
  name: string;
  email: string;
  password: string;
  department: string;
  level: string;
  avatar: string;
  role: string;
  sessionVersion: number;
  createdAt: string;
}

export interface DbSavedResource {
  id: string;
  userId: string;
  resourceId: string;
  title: string;
  courseCode: string;
  department: string;
  type: string;
  fileSize: string;
  createdAt: string;
  level?: string;
  semester?: string;
  sessionYear?: string;
  medium?: "PDF" | "YOUTUBE";
  description?: string;
  fileUrl?: string;
  fileName?: string;
  youtubeUrl?: string;
  youtubeVideoId?: string;
  thumbnailUrl?: string;
  downloads?: number;
}

export interface SubmissionContributor {
  id: string;
  name: string;
  email: string;
  department: string;
  level: string;
  avatar?: string;
}

export interface DbSubmission {
  id: string;
  userId: string;
  submittedBy?: SubmissionContributor;
  title: string;
  courseCode: string;
  department: string;
  level: string;
  semester: string;
  sessionYear?: string;
  type: string;
  medium: "PDF" | "YOUTUBE";
  description?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: string;
  fileSizeBytes?: number | null;
  fileHash?: string;
  r2Key?: string;
  cloudinaryPublicId?: string;
  youtubeUrl?: string;
  youtubeVideoId?: string;
  thumbnailUrl?: string;
  status: SubmissionStatus;
  rejectionReason?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewedById?: string | null;
  downloads?: number;
  createdAt: string;
}

export interface DbReadingProgress {
  userId: string;
  resourceId: string;
  percentage: number;
  page: number;
  updatedAt: string;
}

export interface DbMaterialRequest {
  id: string;
  userId?: string;
  requesterName: string;
  courseCode: string;
  department: string;
  level: string;
  type: string;
  details: string;
  status: "OPEN" | "FULFILLED";
  createdAt: string;
}

export interface DbResourceReport {
  id: string;
  resourceId: string;
  resourceTitle: string;
  courseCode: string;
  reason: string;
  details?: string;
  status: "OPEN" | "RESOLVED";
  createdAt: string;
}

export interface DbCourse extends CourseMetadata {
  resourceCount: number;
}

export interface GetResourcesOptions {
  department?: string;
  level?: string;
  semester?: string;
  courseCode?: string;
  type?: string;
  medium?: string;
  query?: string;
  sortBy?: "newest" | "popular" | "title" | "course";
  page?: number;
  limit?: number;
}

export interface PaginatedResourcesResult {
  resources: DbSubmission[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Client-safe projection of a submission for public catalog endpoints.
 * Explicitly allowlisted so internal fields (r2Key, uploader userId, reviewer
 * identity, rejection reason, storage public id) are never serialized to clients.
 */
export interface PublicResource {
  id: string;
  title: string;
  courseCode: string;
  department: string;
  level: string;
  semester: string;
  sessionYear?: string;
  type: string;
  medium: "PDF" | "YOUTUBE";
  description?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: string;
  fileSizeBytes?: number | null;
  youtubeUrl?: string;
  youtubeVideoId?: string;
  thumbnailUrl?: string;
  status: SubmissionStatus;
  downloads?: number;
  createdAt: string;
}

export function toPublicResource(submission: DbSubmission): PublicResource {
  return {
    id: submission.id,
    title: submission.title,
    courseCode: submission.courseCode,
    department: submission.department,
    level: submission.level,
    semester: submission.semester,
    sessionYear: submission.sessionYear,
    type: submission.type,
    medium: submission.medium,
    description: submission.description,
    fileUrl: submission.fileUrl,
    fileName: submission.fileName,
    fileSize: submission.fileSize,
    fileSizeBytes: submission.fileSizeBytes,
    youtubeUrl: submission.youtubeUrl,
    youtubeVideoId: submission.youtubeVideoId,
    thumbnailUrl: submission.thumbnailUrl,
    status: submission.status,
    downloads: submission.downloads,
    createdAt: submission.createdAt,
  };
}

