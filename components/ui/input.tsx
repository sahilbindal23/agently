import * as React from "react";
import { cn } from "@/lib/utils/cn";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "h-10 w-full rounded-md border bg-white px-3 text-sm outline-none transition placeholder:text-muted-foreground focus:ring-2 focus:ring-ring dark:bg-card dark:text-foreground dark:border-white/10",
        props.className
      )}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "min-h-28 w-full rounded-md border bg-white px-3 py-2 text-sm outline-none transition placeholder:text-muted-foreground focus:ring-2 focus:ring-ring dark:bg-card dark:text-foreground dark:border-white/10",
        props.className
      )}
    />
  );
}
