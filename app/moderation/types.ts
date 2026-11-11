export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  level: string;
  avatar: string;
}

export interface SubmissionItem {
  id: string;
  userId: string;
  title: string;
  courseCode: string;
  department: string;
  level: string;
  semester: string;
  type: string;
  medium: "PDF" | "YOUTUBE";
  description?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: string;
  cloudinaryPublicId?: string;
  youtubeUrl?: string;
  youtubeVideoId?: string;
  thumbnailUrl?: string;
  status: "PENDING_REVIEW" | "APPROVED" | "REJECTED";
  rejectionReason?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  createdAt: string;
}

export interface UserDirectoryItem {
  id: string;
  name: string;
  email: string;
  department: string;
  level: string;
  avatar: string;
  role: string;
  createdAt: string;
}

export interface MaterialRequestItem {
  id: string;
  requesterName?: string;
  courseCode: string;
  department: string;
  level: string;
  type: string;
  details?: string;
  status: "OPEN" | "FULFILLED";
  createdAt: string;
}

export interface ResourceReportItem {
  id: string;
  resourceId: string;
  resourceTitle: string;
  courseCode: string;
  reason: string;
  details?: string;
  status: "OPEN" | "RESOLVED";
  createdAt: string;
}

