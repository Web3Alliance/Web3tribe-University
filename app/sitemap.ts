import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.web3tribe.university";

/**
 * Previously no sitemap existed at all. Course pages are generated
 * dynamically here rather than hardcoded, so a newly-published course
 * becomes discoverable without anyone needing to remember to update this
 * file by hand.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();
  const { data: courses } = await supabase
    .from("courses")
    .select("slug, updated_at")
    .eq("status", "published");

  const courseEntries: MetadataRoute.Sitemap = (courses ?? []).map((c) => ({
    url: `${SITE_URL}/student/courses/${c.slug}`,
    lastModified: c.updated_at ?? undefined,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/student/courses`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/impact`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    ...courseEntries,
  ];
}
