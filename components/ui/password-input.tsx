"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils/cn";

// Drop-in replacement for <Input type="password"> with a reveal toggle on
// the right edge. Avoids browser-native password reveal (Edge/Chrome show
// it inconsistently) and works the same on all platforms.
export const PasswordInput = React.forwardRef<HTMLInputElement, Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">>(function PasswordInput(props, ref) {
  const [visible, setVisible] = React.useState(false);
  const { className, ...rest } = props;
  return (
    <div className="relative">
      <input
        {...rest}
        ref={ref}
        type={visible ? "text" : "password"}
        className={cn(
          "h-10 w-full rounded-md border bg-white px-3 pr-10 text-sm outline-none transition placeholder:text-muted-foreground focus:ring-2 focus:ring-ring dark:bg-card dark:text-foreground dark:border-white/10",
          className
        )}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        aria-label={visible ? "Hide password" : "Show password"}
        title={visible ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground transition hover:text-foreground"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
});
