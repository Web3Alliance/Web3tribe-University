import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/rbac";

const ALLOWED_BUCKETS = ["course-videos", "course-documents", "course-images", "avatars", "assignments"] as const;
type AllowedBucket = (typeof ALLOWED_BUCKETS)[number];

const MAX_SIZE_BYTES: Record<AllowedBucket, number> = {
  "course-videos": 500 * 1024 * 1024, // 500MB
  "course-documents": 25 * 1024 * 1024, // 25MB
  "course-images": 10 * 1024 * 1024, // 10MB
  avatars: 5 * 1024 * 1024, // 5MB
  assignments: 25 * 1024 * 1024, // 25MB
};

const ALLOWED_MIME_PREFIXES: Record<AllowedBucket, string[]> = {
  "course-videos": ["video/", "audio/"],
  "course-documents": ["application/pdf", "application/vnd.", "text/", "application/zip", "application/x-zip-compressed"],
  "course-images": ["image/"],
  avatars: ["image/"],
  assignments: ["application/pdf", "application/vnd.", "text/", "image/"],
};

export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const bucket = formData.get("bucket") as string | null;

  if (!file) return NextResponse.json({ data: null, error: "No file provided." }, { status: 400 });
  if (!bucket || !ALLOWED_BUCKETS.includes(bucket as AllowedBucket)) {
    return NextResponse.json({ data: null, error: "Invalid or missing bucket." }, { status: 400 });
  }
  const bucketName = bucket as AllowedBucket;

  if (file.size > MAX_SIZE_BYTES[bucketName]) {
    return NextResponse.json(
      { data: null, error: `File exceeds the ${MAX_SIZE_BYTES[bucketName] / (1024 * 1024)}MB limit for this content type.` },
      { status: 400 }
    );
  }

  const allowedPrefixes = ALLOWED_MIME_PREFIXES[bucketName];
  if (!allowedPrefixes.some((p) => file.type.startsWith(p))) {
    return NextResponse.json({ data: null, error: `File type "${file.type}" is not allowed for this upload.` }, { status: 400 });
  }

  const supabase = await createClient();
  const ext = file.name.split(".").pop();
  const filePath = `${profile.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error } = await supabase.storage.from(bucketName).upload(filePath, Buffer.from(arrayBuffer), {
    contentType: file.type,
    upsert: false,
  });

  if (error) return NextResponse.json({ data: null, error: error.message }, { status: 500 });

  const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);

  return NextResponse.json({ data: { path: filePath, publicUrl: publicUrlData.publicUrl }, error: null });
}
