import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const tableByType = {
  creator: "creators",
  freelancer: "freelancers",
  brand: "brands"
} as const;

export async function POST(request: Request) {
  const auth = await createClient();
  const { data: authData } = await auth.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase service role key is not configured." }, { status: 500 });

  const body = await request.json();
  const message = String(body.body ?? "").trim();
  const threadId = String(body.thread_id ?? "").trim();
  const toType = String(body.to_type ?? "") as keyof typeof tableByType;
  const toId = String(body.to_id ?? "").trim();

  if (!message) return NextResponse.json({ error: "Message is required." }, { status: 400 });

  const finalThreadId = threadId || await createThread(admin, authData.user.id, toType, toId);
  if (!finalThreadId) return NextResponse.json({ error: "Recipient could not be resolved." }, { status: 400 });

  const allowed = await isParticipant(admin, finalThreadId, authData.user.id);
  if (!allowed) return NextResponse.json({ error: "Not allowed to message this thread." }, { status: 403 });

  const { data, error } = await admin.from("messages").insert({
    thread_id: finalThreadId,
    sender_profile_id: authData.user.id,
    body: message
  }).select("*").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await admin.from("message_threads").update({ updated_at: new Date().toISOString() }).eq("id", finalThreadId);

  return NextResponse.json({ data, thread_id: finalThreadId }, { status: 201 });
}

async function createThread(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  senderId: string,
  toType: keyof typeof tableByType,
  toId: string
) {
  const recipientId = await resolveRecipientProfileId(admin, toType, toId);
  if (!recipientId || recipientId === senderId) return "";

  const existing = await findExistingThread(admin, senderId, recipientId);
  if (existing) return existing;

  const { data: thread, error } = await admin.from("message_threads").insert({
    created_by: senderId,
    subject: "Agently conversation"
  }).select("id").single();

  if (error || !thread) return "";

  await admin.from("message_thread_participants").insert([
    { thread_id: thread.id, profile_id: senderId },
    { thread_id: thread.id, profile_id: recipientId }
  ]);

  return String(thread.id);
}

async function resolveRecipientProfileId(admin: NonNullable<ReturnType<typeof createAdminClient>>, toType: keyof typeof tableByType, toId: string) {
  if (!tableByType[toType] || !toId) return "";
  if (toType === "brand") {
    const { data: brand } = await admin.from("brands").select("contact_email").eq("id", toId).maybeSingle();
    if (!brand?.contact_email) return "";
    const { data: profile } = await admin.from("profiles").select("id").eq("email", brand.contact_email).maybeSingle();
    return profile?.id ? String(profile.id) : "";
  }

  const { data } = await admin.from(tableByType[toType]).select("profile_id").eq("id", toId).maybeSingle();
  return data?.profile_id ? String(data.profile_id) : "";
}

async function findExistingThread(admin: NonNullable<ReturnType<typeof createAdminClient>>, a: string, b: string) {
  const { data } = await admin
    .from("message_thread_participants")
    .select("thread_id")
    .in("profile_id", [a, b]);

  const counts = new Map<string, number>();
  (data ?? []).forEach((row) => counts.set(String(row.thread_id), (counts.get(String(row.thread_id)) ?? 0) + 1));
  return Array.from(counts.entries()).find(([, count]) => count >= 2)?.[0] ?? "";
}

async function isParticipant(admin: NonNullable<ReturnType<typeof createAdminClient>>, threadId: string, profileId: string) {
  const { data } = await admin
    .from("message_thread_participants")
    .select("id")
    .eq("thread_id", threadId)
    .eq("profile_id", profileId)
    .maybeSingle();
  return Boolean(data);
}
