"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImageUp } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ProfileImageUpload({
  entityId,
  entityType
}: {
  entityId: string;
  entityType: "creator" | "freelancer" | "brand";
}) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle");
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setStatus("uploading");
    setError("");

    const formData = new FormData(form);
    formData.set("entity_id", entityId);
    formData.set("entity_type", entityType);

    const response = await fetch("/api/profile-image", {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setStatus("error");
      setError(body.error ?? "Could not upload image.");
      return;
    }

    setStatus("idle");
    setFileName("");
    form.reset();
    router.refresh();
  }

  return (
    <form className="flex flex-col items-start gap-2 sm:flex-row sm:items-center" onSubmit={onSubmit}>
      <label aria-label="Choose profile image file" className="flex h-10 w-full max-w-sm cursor-pointer items-center overflow-hidden rounded-md border bg-white text-sm transition hover:border-primary/50 dark:border-white/10 dark:bg-card sm:flex-1">
        <span className="flex h-full shrink-0 items-center border-r bg-muted px-3 font-medium text-foreground dark:border-white/10">
          Choose file
        </span>
        <span className="min-w-0 truncate px-3 text-muted-foreground">
          {fileName || "No file chosen"}
        </span>
        <input
          accept="image/*"
          className="sr-only"
          name="image"
          onChange={(event) => setFileName(event.currentTarget.files?.[0]?.name ?? "")}
          required
          type="file"
        />
      </label>
      <Button disabled={status === "uploading"} type="submit" variant="secondary">
        <ImageUp className="h-4 w-4" />
        {status === "uploading" ? "Uploading..." : "Upload image"}
      </Button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
