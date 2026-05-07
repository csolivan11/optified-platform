"use client";

import { useState } from "react";
import { type LucideIcon, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface CalculatorCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  children: React.ReactNode;
}

/**
 * Collapsible card wrapper used by every Tools calculator. Closed by
 * default — opens to reveal inputs and results inline. Keeps the catalog
 * scannable while preserving instant-use without modal overhead.
 */
export function CalculatorCard({
  title,
  description,
  icon: Icon,
  children,
}: CalculatorCardProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden transition-shadow hover:shadow-elevation-1">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-4 p-5 text-left focus-visible:outline-none focus-visible:bg-card/40"
        aria-expanded={open}
      >
        <div className="w-10 h-10 rounded-md bg-success/10 border border-success/20 flex items-center justify-center shrink-0">
          <Icon size={18} className="text-success" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-body font-semibold">{title}</div>
          <div className="text-caption text-muted-foreground mt-0.5">
            {description}
          </div>
        </div>
        <ChevronDown
          size={16}
          className={cn(
            "text-muted-foreground transition-transform shrink-0",
            open && "rotate-180"
          )}
        />
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-border bg-card/40 animate-fade-in">
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Standard input row used inside calculators.
 */
export function CalcInput({
  label,
  value,
  onChange,
  unit,
  type = "number",
  step = "any",
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  unit?: string;
  type?: string;
  step?: string;
  min?: number;
  max?: number;
}) {
  return (
    <label className="block">
      <span className="block text-caption font-medium text-muted-foreground mb-1.5">
        {label}
      </span>
      <div className="relative">
        <input
          type={type}
          inputMode={type === "number" ? "decimal" : undefined}
          step={step}
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-10 rounded-md border border-input bg-card/60 px-3 pr-12 text-body focus-visible:outline-none focus-visible:border-success focus-visible:ring-1 focus-visible:ring-success/40 tabular-nums"
        />
        {unit && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-caption text-muted-foreground pointer-events-none">
            {unit}
          </span>
        )}
      </div>
    </label>
  );
}

/**
 * Standard select used inside calculators.
 */
export function CalcSelect<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <label className="block">
      <span className="block text-caption font-medium text-muted-foreground mb-1.5">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="w-full h-10 rounded-md border border-input bg-card/60 px-3 text-body focus-visible:outline-none focus-visible:border-success focus-visible:ring-1 focus-visible:ring-success/40"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Result display row.
 */
export function CalcResult({
  label,
  value,
  unit,
  highlight,
}: {
  label: string;
  value: string | number;
  unit?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between py-2.5 border-b border-border last:border-0",
        highlight && "px-3 -mx-3 rounded-md bg-success/10 border-b-0"
      )}
    >
      <span className="text-caption text-muted-foreground">{label}</span>
      <span className="text-body font-bold tabular-nums">
        {value}
        {unit && (
          <span className="text-caption text-muted-foreground font-normal ml-1">
            {unit}
          </span>
        )}
      </span>
    </div>
  );
}
