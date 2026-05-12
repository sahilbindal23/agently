import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type EntityType = "creator" | "freelancer" | "brand";

// Production hardening for the upload endpoint. Without these limits the
// route is a DoS surface (huge files filling Supabase storage) and an
// XSS surface (SVG mistaken for an image, then served and rendered inline).
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB - generous for profile photos
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const ALLOWED_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif"
};

export async function POST(request: Request) {
  const auth = await createClient();
  const { data: authData } = await auth.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const formData = await request.formData();
  const entityType = String(formData.get("entity_type") ?? "") as EntityType;
  const entityId = String(formData.get("entity_id") ?? "");
  const file = formData.get("image");

  if (!isEntityType(entityType) || !entityId || !(file instanceof File)) {
    return NextResponse.json({ error: "Entity type, entity id, and image are required." }, { status: 400 });
  }

  // 1. MIME allowlist. Rejects image/svg+xml (XSS), application/pdf-as-image,
  //    and anything else that isn't a real raster image format.
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json({
      error: "Image must be JPEG, PNG, WebP, or GIF. SVG and other formats are not supported."
    }, { status: 400 });
  }

  // 2. Size cap. 5 MB is plenty for a profile photo; anything bigger is
  //    either a mistake or an attempt to fill our storage.
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({
      error: `Image is too large (${Math.round(file.size / 1024 / 1024)} MB). Maximum is 5 MB.`
    }, { status: 413 });
  }

  // 3. Magic-byte sniff. file.type is client-supplied and trivially spoofed;
  //    confirm the actual bytes match a known image signature.
  const headerBytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const realType = sniffImageType(headerBytes);
  if (!realType || !ALLOWED_MIME_TYPES.has(realType)) {
    return NextResponse.json({
      error: "Uploaded file is not a valid image. The file contents do not match a JPEG/PNG/WebP/GIF signature."
    }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase service role key is not configured." }, { status: 500 });

  const allowed = await canUpdateEntity(admin, entityType, entityId, authData.user.id);
  if (!allowed) return NextResponse.json({ error: "Not allowed to update this profile image." }, { status: 403 });

  // Use the sniffed type's canonical extension, not the user-supplied
  // filename (which could be `profile.svg.jpg` or worse).
  const extension = ALLOWED_EXTENSIONS[realType] ?? "jpg";
  const path = `${entityType}/${entityId}-${Date.now()}.${extension}`;
  const { error: uploadError } = await admin.storage
    .from("profile-images")
    .upload(path, file, { contentType: realType, upsert: true });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: publicUrl } = admin.storage.from("profile-images").getPublicUrl(path);
  const table = tableForEntity(entityType);
  const { error: updateError } = await admin
    .from(table)
    .update({ image_url: publicUrl.publicUrl })
    .eq("id", entityId);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ image_url: publicUrl.publicUrl });
}

function isEntityType(value: string): value is EntityType {
  return value === "creator" || value === "freelancer" || value === "brand";
}

function tableForEntity(entityType: EntityType) {
  if (entityType === "creator") return "creators";
  if (entityType === "freelancer") return "freelancers";
  return "brands";
}

/**
 * Inspect the first ~12 bytes of an upload and return the real MIME type
 * based on magic bytes. Returns null if the signature doesn't match a
 * known raster image format. Critical because the file.type field is
 * pulled from the client-supplied Content-Type header and can be spoofed.
 */
function sniffImageType(bytes: Uint8Array): string | null {
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
      bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return "image/png";
  // GIF: "GIF87a" or "GIF89a"
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38 &&
      (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61) return "image/gif";
  // WebP: "RIFF" .... "WEBP"
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp";
  return null;
}

async function canUpdateEntity(admin: NonNullable<ReturnType<typeof createAdminClient>>, entityType: EntityType, entityId: string, userId: string) {
  const { data: profile } = await admin.from("profiles").select("role").eq("id", userId).single();
  if (profile?.role === "admin") return true;

  if (entityType === "creator") {
    const { data } = await admin.from("creators").select("profile_id").eq("id", entityId).single();
    return data?.profile_id === userId;
  }

  if (entityType === "freelancer") {
    const { data } = await admin.from("freelancers").select("profile_id").eq("id", entityId).single();
    return data?.profile_id === userId;
  }

  const { data } = await admin.from("brands").select("contact_email").eq("id", entityId).single();
  const { data: userProfile } = await admin.from("profiles").select("email").eq("id", userId).single();
  return Boolean(data?.contact_email && userProfile?.email && data.contact_email === userProfile.email);
}
