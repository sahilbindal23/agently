"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImageUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("uploading");
    setError("");

    const formData = new FormData(event.currentTarget);
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
    router.refresh();
  }

  return (
    <form className="flex flex-col gap-2 sm:flex-row" onSubmit={onSubmit}>
      <Input accept="image/*" className="max-w-sm" name="image" required type="file" />
      <Button disabled={status === "uploading"} type="submit" variant="secondary">
        <ImageUp className="h-4 w-4" />
        {status === "uploading" ? "Uploading..." : "Upload image"}
      </Button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
