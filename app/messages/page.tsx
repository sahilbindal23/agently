import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { MessageComposer } from "@/components/messages/message-composer";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function MessagesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  if (!admin) redirect("/");

  const threads = await getThreads(admin, user.id);
  const selectedThreadId = first(params.thread) || threads[0]?.id || "";
  const selectedThread = threads.find((thread) => thread.id === selectedThreadId);
  const messages = selectedThreadId ? await getMessages(admin, selectedThreadId, user.id) : [];
  const recipient = first(params.to_type) && first(params.to_id)
    ? await getRecipient(admin, first(params.to_type) ?? "", first(params.to_id) ?? "")
    : null;

  return (
    <AppShell>
      <PageHeader
        eyebrow="Messages"
        title="Campaign conversations"
        description="Message creators, freelancers, and brands from discovery, campaign recommendations, and profile pages."
      />

      <section className="grid gap-5 xl:grid-cols-[0.75fr_1.25fr]">
        <Card>
          <CardHeader><CardTitle>Inbox</CardTitle><Badge tone="blue">{threads.length}</Badge></CardHeader>
          <div className="space-y-2">
            {threads.map((thread) => (
              <a
                className={`block rounded-md border p-3 text-sm transition hover:bg-muted ${thread.id === selectedThreadId ? "border-primary bg-primary/5" : "bg-white"}`}
                href={`/messages?thread=${thread.id}`}
                key={thread.id}
              >
                <p className="font-semibold">{thread.other_names || thread.subject || "Conversation"}</p>
                <p className="mt-1 text-xs text-muted-foreground">{thread.last_message || "No messages yet"}</p>
              </a>
            ))}
            {threads.length === 0 ? <p className="text-sm leading-6 text-muted-foreground">No conversations yet. Start one from a profile or discovery card.</p> : null}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>{recipient ? `Message ${recipient.name}` : selectedThread?.other_names || "New conversation"}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">{recipient ? `${recipient.type} profile` : "Keep campaign fit, pricing, deliverables, and next steps in one place."}</p>
            </div>
            <Badge tone="green">prototype inbox</Badge>
          </CardHeader>

          {messages.length ? (
            <div className="mb-4 max-h-[440px] space-y-3 overflow-y-auto rounded-md border bg-muted p-3">
              {messages.map((message) => {
                const mine = message.sender_profile_id === user.id;
                return (
                  <div className={`flex ${mine ? "justify-end" : "justify-start"}`} key={message.id}>
                    <div className={`max-w-[78%] rounded-md border px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-white"}`}>
                      <p className="whitespace-pre-wrap leading-6">{message.body}</p>
                      <p className={`mt-1 text-[11px] ${mine ? "text-primary-foreground/75" : "text-muted-foreground"}`}>{new Date(message.created_at).toLocaleString("en-IN")}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          <MessageComposer
            recipientId={recipient ? first(params.to_id) : undefined}
            recipientType={recipient ? first(params.to_type) : undefined}
            threadId={selectedThreadId || undefined}
          />
        </Card>
      </section>
    </AppShell>
  );
}

async function getThreads(admin: NonNullable<ReturnType<typeof createAdminClient>>, profileId: string) {
  const { data: participantRows } = await admin
    .from("message_thread_participants")
    .select("thread_id")
    .eq("profile_id", profileId);
  const threadIds = (participantRows ?? []).map((row) => String(row.thread_id));
  if (!threadIds.length) return [];

  const [{ data: threads }, { data: allParticipants }, { data: profiles }, { data: messages }] = await Promise.all([
    admin.from("message_threads").select("*").in("id", threadIds).order("updated_at", { ascending: false }),
    admin.from("message_thread_participants").select("*").in("thread_id", threadIds),
    admin.from("profiles").select("id, full_name, email, role"),
    admin.from("messages").select("*").in("thread_id", threadIds).order("created_at", { ascending: false })
  ]);

  return (threads ?? []).map((thread) => {
    const others = (allParticipants ?? [])
      .filter((participant) => participant.thread_id === thread.id && participant.profile_id !== profileId)
      .map((participant) => profiles?.find((profile) => profile.id === participant.profile_id))
      .filter(Boolean);
    const last = messages?.find((message) => message.thread_id === thread.id);
    return {
      id: String(thread.id),
      subject: String(thread.subject ?? ""),
      other_names: others.map((profile) => profile?.full_name || profile?.email || profile?.role).join(", "),
      last_message: last?.body ? String(last.body).slice(0, 90) : ""
    };
  });
}

async function getMessages(admin: NonNullable<ReturnType<typeof createAdminClient>>, threadId: string, profileId: string) {
  const { data: participant } = await admin
    .from("message_thread_participants")
    .select("id")
    .eq("thread_id", threadId)
    .eq("profile_id", profileId)
    .maybeSingle();
  if (!participant) return [];

  const { data } = await admin.from("messages").select("*").eq("thread_id", threadId).order("created_at", { ascending: true });
  return (data ?? []) as Array<{ id: string; sender_profile_id: string; body: string; created_at: string }>;
}

async function getRecipient(admin: NonNullable<ReturnType<typeof createAdminClient>>, type: string, id: string) {
  if (!id) return null;
  if (type === "creator") {
    const { data } = await admin.from("creators").select("display_name").eq("id", id).maybeSingle();
    return data ? { type, name: String(data.display_name ?? "creator") } : null;
  }
  if (type === "freelancer") {
    const { data } = await admin.from("freelancers").select("display_name").eq("id", id).maybeSingle();
    return data ? { type, name: String(data.display_name ?? "freelancer") } : null;
  }
  if (type === "brand") {
    const { data } = await admin.from("brands").select("name").eq("id", id).maybeSingle();
    return data ? { type, name: String(data.name ?? "brand") } : null;
  }
  return null;
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
