import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/rbac";
import { checkUpload } from "@/lib/file-signature";
import { enforceRateLimit } from "@/lib/rate-limit";

const ALLOWED_BUCKETS = ["course-videos", "course-documents", "course-images", "avatars", "assignments"] as const;
type AllowedBucket = (typeof ALLOWED_BUCKETS)[number];

const MAX_SIZE_BYTES: Record<AllowedBucket, number> = {
  "course-videos": 500 * 1024 * 1024, // 500MB
  "course-documents": 25 * 1024 * 1024, // 25MB
  "course-images": 10 * 1024 * 1024, // 10MB
  avatars: 5 * 1024 * 1024, // 5MB
  assignments: 25 * 1024 * 1024, // 25MB
};

export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const limited = await enforceRateLimit("upload", profile.id, 30, 600);
  if (limited) return limited;

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

  // SECURITY: never trust the browser-declared type. Check the file's real content and store
  // and serve the detected type, so a script cannot be uploaded dressed up as a PDF or image.
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const check = checkUpload(bucketName, bytes.slice(0, 4096), file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg") ? new TextDecoder().decode(bytes) : undefined);
  if (!check.ok) return NextResponse.json({ data: null, error: check.reason }, { status: 400 });

  const supabase = await createClient();
  const filePath = `${profile.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${check.ext}`;

  const { error } = await supabase.storage.from(bucketName).upload(filePath, Buffer.from(arrayBuffer), {
    contentType: check.mime,
    upsert: false,
  });

  if (error) return NextResponse.json({ data: null, error: error.message }, { status: 500 });

  const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);

  return NextResponse.json({ data: { path: filePath, publicUrl: publicUrlData.publicUrl }, error: null });
}
