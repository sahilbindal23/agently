import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type EntityType = "creator" | "freelancer" | "brand";

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

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Upload an image file." }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase service role key is not configured." }, { status: 500 });

  const allowed = await canUpdateEntity(admin, entityType, entityId, authData.user.id);
  if (!allowed) return NextResponse.json({ error: "Not allowed to update this profile image." }, { status: 403 });

  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${entityType}/${entityId}-${Date.now()}.${extension}`;
  const { error: uploadError } = await admin.storage
    .from("profile-images")
    .upload(path, file, { contentType: file.type, upsert: true });

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
