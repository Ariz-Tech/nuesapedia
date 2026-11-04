import type { Metadata } from "next";
import { getResourceById } from "@/lib/db";
import { resolveCourseMetadata } from "@/lib/courses";
import type { CourseMaterialItem } from "@/lib/saved-client";
import ResourceReaderClient from "./ResourceReaderClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  let resource = null;
  try {
    resource = await getResourceById(id);
  } catch (err) {
    console.warn(`[generateMetadata] Could not fetch resource ${id} from database:`, err);
  }

  if (!resource || resource.status !== "APPROVED") {
    return {
      title: "Course Material — NUESApedia",
      description: "Digital academic repository for Nigerian Universities Engineering Students' Association.",
    };
  }

  const courseMeta = resolveCourseMetadata(resource.courseCode, {
    department: resource.department,
    level: resource.level,
    semester: resource.semester,
  });

  const title = `${resource.courseCode}: ${resource.title} — NUESApedia`;
  const description =
    resource.description ||
    `${resource.type} for ${resource.courseCode} (${courseMeta.title}), ${resource.department}, ${resource.level}.`;

  const ogImage =
    resource.medium === "YOUTUBE" && resource.thumbnailUrl
      ? resource.thumbnailUrl
      : "/icons/icon.svg";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: resource.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function ResourceReaderPage({ params }: PageProps) {
  const { id } = await params;
  let dbItem = null;
  try {
    dbItem = await getResourceById(id);
  } catch (err) {
    console.warn(`[ResourceReaderPage] Could not fetch resource ${id} from database:`, err);
  }

  let initialResource: CourseMaterialItem | null = null;
  if (dbItem && dbItem.status === "APPROVED") {
    initialResource = {
      id: dbItem.id,
      resourceId: dbItem.id,
      title: dbItem.title,
      courseCode: dbItem.courseCode,
      department: dbItem.department,
      level: dbItem.level,
      semester: dbItem.semester,
      sessionYear: dbItem.sessionYear,
      type: dbItem.type,
      medium: dbItem.medium,
      fileUrl: dbItem.fileUrl,
      fileName: dbItem.fileName,
      fileSize: dbItem.fileSize,
      downloads: dbItem.downloads,
      youtubeUrl: dbItem.youtubeUrl,
      youtubeVideoId: dbItem.youtubeVideoId,
      thumbnailUrl: dbItem.thumbnailUrl,
      description: dbItem.description,
      createdAt: dbItem.createdAt,
    };
  }

  return (
    <ResourceReaderClient
      resourceId={id}
      initialResource={initialResource}
    />
  );
}
