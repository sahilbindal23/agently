"use client";

import { useEffect, useState } from "react";
import { ArrowRight, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "agently-welcomed-v1";

export function FirstVisitPopup() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setVisible(true);
      }
    } catch {
      // localStorage unavailable
    }
  }, []);

  function dismiss() {
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* ignore */ }
    setVisible(false);
  }

  function startWalkthrough() {
    dismiss();
    window.dispatchEvent(new Event("agently:start-walkthrough"));
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border bg-white p-8 shadow-2xl dark:border-white/10 dark:bg-card">
        <button
          className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          onClick={dismiss}
          type="button"
          aria-label="Dismiss"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <Zap className="h-6 w-6 text-primary" />
        </div>

        <h2 className="text-2xl font-bold tracking-tight">Welcome to Agently</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          We&apos;re a creator talent agency OS built for India-first campaigns. Take a quick 2-minute walkthrough to see how campaigns, offers, deliverables, and payments all connect.
        </p>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button className="flex-1" onClick={startWalkthrough} type="button">
            Start walkthrough
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button className="flex-1" onClick={dismiss} type="button" variant="secondary">
            Explore on my own
          </Button>
        </div>
      </div>
    </div>
  );
}
