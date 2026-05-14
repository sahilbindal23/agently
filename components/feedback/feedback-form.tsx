"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";

export function FeedbackForm() {
  const pathname = usePathname();
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    setMessage("");

    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page_path: pathname, ...Object.fromEntries(formData.entries()) })
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus("error");
      setMessage(body.error ?? "Could not submit feedback.");
      return;
    }

    event.currentTarget.reset();
    setStatus("saved");
    setMessage("Feedback saved. Thanks — we read every one.");
    router.refresh();
  }

  return (
    <form className="grid gap-3 md:grid-cols-2" onSubmit={submit}>
      <Input name="workflow" placeholder="Workflow tested, e.g. brand campaign, creator offer, freelancer project" required />
      <select className="h-10 w-full rounded-md border bg-white px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring" name="rating" required defaultValue="">
        <option value="" disabled>Overall rating</option>
        <option value="5">5 - Very strong</option>
        <option value="4">4 - Good, small issues</option>
        <option value="3">3 - Useful but confusing</option>
        <option value="2">2 - Needs major work</option>
        <option value="1">1 - Did not work for me</option>
      </select>
      <Textarea className="md:col-span-2" name="what_worked" placeholder="What felt useful, impressive, or believable?" />
      <Textarea className="md:col-span-2" name="what_was_confusing" placeholder="Where did you get stuck or feel unsure what to click?" />
      <Textarea className="md:col-span-2" name="missing_feature" placeholder="What feature, data, or workflow did you expect but not see?" />
      <Textarea className="md:col-span-2" name="would_use" placeholder="Would you use this as a brand, creator, or freelancer? Why or why not?" />
      <Button className="md:col-span-2" disabled={status === "saving"} type="submit">
        <Send className="h-4 w-4" />
        {status === "saving" ? "Saving feedback..." : "Submit feedback"}
      </Button>
      {message ? <p className={`md:col-span-2 text-sm ${status === "error" ? "text-red-600" : "text-emerald-700"}`}>{message}</p> : null}
    </form>
  );
}
