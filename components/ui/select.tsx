"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Option } from "@/lib/taxonomies";

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  options: Option[];
  placeholderOption?: string;
};

export function Select({ label, options, placeholderOption = "Select…", className = "", ...rest }: SelectProps) {
  return (
    <label className={`block ${label ? "" : ""}`}>
      {label ? <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span> : null}
      <span className="relative block">
        <select
          {...rest}
          className={`h-10 w-full appearance-none rounded-md border bg-white px-3 pr-9 text-sm outline-none transition focus:ring-2 focus:ring-ring dark:border-white/10 dark:bg-card dark:text-foreground ${className}`}
        >
          <option value="">{placeholderOption}</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </span>
    </label>
  );
}

type MultiCheckboxProps = {
  name: string;
  label?: string;
  options: Option[];
  defaultSelected?: string[];
  className?: string;
  /** Render at most this many before showing a "+N more" expansion */
  maxVisible?: number;
};

/**
 * Multi-checkbox grid with hidden inputs that submit as a JSON array under
 * `name` so it Just Works with a standard FormData submit. Renders all
 * options visibly so users see all choices without having to open a popover —
 * critical for India-mobile users who hate hidden UI.
 */
export function MultiCheckbox({ name, label, options, defaultSelected = [], className = "", maxVisible = 999 }: MultiCheckboxProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(defaultSelected));
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? options : options.slice(0, maxVisible);
  const hiddenCount = options.length - visible.length;

  function toggle(value: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  return (
    <div className={`block ${className}`}>
      {label ? <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span> : null}
      <div className="grid gap-1.5 sm:grid-cols-2 md:grid-cols-3">
        {visible.map((opt) => {
          const isOn = selected.has(opt.value);
          return (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition ${isOn ? "border-primary bg-primary/5 text-foreground dark:bg-primary/10" : "border-border bg-white text-muted-foreground hover:bg-muted dark:border-white/10 dark:bg-card dark:hover:bg-white/4"}`}
            >
              <input
                type="checkbox"
                className="h-3.5 w-3.5"
                checked={isOn}
                onChange={() => toggle(opt.value)}
              />
              <span className="leading-tight">{opt.label}</span>
            </label>
          );
        })}
      </div>
      {hiddenCount > 0 && !expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-2 text-xs font-semibold text-primary hover:underline"
        >
          Show {hiddenCount} more
        </button>
      ) : null}
      {/* Hidden input carries the selection as JSON for FormData. The API
          already accepts comma-separated for backwards compat, so we serialize
          to comma-separated here. */}
      <input type="hidden" name={name} value={Array.from(selected).join(",")} />
    </div>
  );
}
