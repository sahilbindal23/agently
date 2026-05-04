"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";

const categories = ["offer", "payment", "contract", "delivery", "message", "verification", "campaign", "workflow"];

export function NotificationPreferencesForm({
  initial
}: {
  initial: {
    delivery_mode: "in_app_only" | "important_only" | "daily_digest" | "paused";
    enabled_categories: string[];
    digest_hour: number;
    email_enabled: boolean;
  };
}) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(formData: FormData) {
    setStatus("saving");
    setMessage("");
    const response = await fetch("/api/notifications/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        delivery_mode: formData.get("delivery_mode"),
        enabled_categories: formData.getAll("enabled_categories"),
        digest_hour: Number(formData.get("digest_hour") ?? 9),
        email_enabled: Boolean(formData.get("email_enabled"))
      })
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setStatus("error");
      setMessage(body.error ?? "Could not update notification preferences.");
      return;
    }

    setStatus("saved");
    setMessage("Notification preferences saved.");
    router.refresh();
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-semibold" htmlFor="delivery_mode">Reminder mode</label>
        <select
          className="mt-2 h-10 w-full rounded-md border bg-white px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring"
          defaultValue={initial.delivery_mode}
          id="delivery_mode"
          name="delivery_mode"
        >
          <option value="in_app_only">In-app only</option>
          <option value="important_only">Important only</option>
          <option value="daily_digest">Daily digest</option>
          <option value="paused">Pause reminders</option>
        </select>
      </div>

      <div>
        <p className="text-sm font-semibold">Categories</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {categories.map((category) => (
            <label className="flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm" key={category}>
              <input
                defaultChecked={initial.enabled_categories.includes(category)}
                name="enabled_categories"
                type="checkbox"
                value={category}
              />
              {category.replace("_", " ")}
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold">
          Digest hour
          <input
            className="mt-2 h-10 w-full rounded-md border bg-white px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring"
            defaultValue={initial.digest_hour}
            max={23}
            min={0}
            name="digest_hour"
            type="number"
          />
        </label>
        <label className="flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm font-semibold">
          <input defaultChecked={initial.email_enabled} name="email_enabled" type="checkbox" />
          Email digest when sender is enabled
        </label>
      </div>

      <Button disabled={status === "saving"} type="submit">
        <BellRing className="h-4 w-4" />
        {status === "saving" ? "Saving..." : "Save preferences"}
      </Button>
      {message ? <p className={`text-sm ${status === "error" ? "text-red-600" : "text-emerald-700"}`}>{message}</p> : null}
    </form>
  );
}
