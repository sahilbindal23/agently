"use client";

import { useState } from "react";
import { CheckCircle2, KeyRound, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordInput } from "@/components/ui/password-input";

export function ChangePasswordPanel() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (next.length < 8) {
      setStatus("error");
      setError("New password must be at least 8 characters.");
      return;
    }
    if (next !== confirm) {
      setStatus("error");
      setError("New passwords do not match.");
      return;
    }
    if (next === current) {
      setStatus("error");
      setError("New password must differ from the current one.");
      return;
    }

    setStatus("submitting");
    const response = await fetch("/api/account/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current_password: current, new_password: next })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus("error");
      setError(body.error ?? "Could not update password.");
      return;
    }

    setStatus("done");
    setCurrent("");
    setNext("");
    setConfirm("");
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Change password
          </CardTitle>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Update the password used to sign in to your Agently account. You&apos;ll stay logged in on this device.
          </p>
        </div>
      </CardHeader>
      {status === "done" ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm dark:border-emerald-900/50 dark:bg-emerald-950/30">
          <p className="flex items-center gap-2 font-semibold text-emerald-900 dark:text-emerald-200">
            <CheckCircle2 className="h-4 w-4" /> Password updated
          </p>
          <p className="mt-1 leading-6 text-emerald-800 dark:text-emerald-300">
            Use the new password the next time you sign in.
          </p>
          <button
            className="mt-3 text-xs font-medium text-emerald-900 underline hover:no-underline dark:text-emerald-200"
            onClick={() => setStatus("idle")}
            type="button"
          >
            Change again
          </button>
        </div>
      ) : (
        <form className="grid gap-3" onSubmit={onSubmit}>
          <PasswordInput
            autoComplete="current-password"
            name="current_password"
            onChange={(event) => setCurrent(event.target.value)}
            placeholder="Current password"
            required
            value={current}
          />
          <PasswordInput
            autoComplete="new-password"
            minLength={8}
            name="new_password"
            onChange={(event) => setNext(event.target.value)}
            placeholder="New password (min 8 characters)"
            required
            value={next}
          />
          <PasswordInput
            autoComplete="new-password"
            minLength={8}
            name="confirm_password"
            onChange={(event) => setConfirm(event.target.value)}
            placeholder="Confirm new password"
            required
            value={confirm}
          />
          <Button
            className="md:w-auto md:justify-self-start"
            disabled={status === "submitting" || !current || !next || !confirm}
            type="submit"
          >
            <KeyRound className="h-4 w-4" />
            {status === "submitting" ? "Updating..." : "Update password"}
          </Button>
          {error ? <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p> : null}
        </form>
      )}
    </Card>
  );
}
