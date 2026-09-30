import type { ReactNode } from "react";
import type { LeadStatus } from "@/lib/statuses";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-zinc-200 bg-white shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4">
      <div>
        <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
        {subtitle ? (
          <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function Badge({
  children,
  tone = "zinc",
}: {
  children: ReactNode;
  tone?: "zinc" | "green" | "blue" | "amber" | "red" | "violet";
}) {
  const tones: Record<string, string> = {
    zinc: "bg-zinc-100 text-zinc-700 ring-zinc-200",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    blue: "bg-sky-50 text-sky-700 ring-sky-200",
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    red: "bg-rose-50 text-rose-700 ring-rose-200",
    violet: "bg-violet-50 text-violet-700 ring-violet-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

const STATUS_TONES: Record<
  LeadStatus,
  "zinc" | "green" | "blue" | "amber" | "red" | "violet"
> = {
  new: "blue",
  qualified: "violet",
  message_ready: "amber",
  approved: "green",
  contacted: "zinc",
  replied: "blue",
  interested: "green",
  not_interested: "red",
  converted: "green",
  do_not_contact: "red",
};

export function StatusBadge({ status }: { status: LeadStatus }) {
  return (
    <Badge tone={STATUS_TONES[status] ?? "zinc"}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

export function ScorePill({ score }: { score: number | undefined }) {
  if (typeof score !== "number") {
    return <span className="text-xs text-zinc-400">—</span>;
  }
  const tone =
    score >= 75 ? "bg-emerald-50 text-emerald-700" : score >= 50 ? "bg-amber-50 text-amber-700" : "bg-zinc-100 text-zinc-600";
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${tone}`}
    >
      {score}
    </span>
  );
}

export function Button({
  children,
  onClick,
  type = "button",
  variant = "secondary",
  disabled,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  className?: string;
}) {
  const styles: Record<string, string> = {
    primary:
      "bg-zinc-900 text-white hover:bg-zinc-800 disabled:bg-zinc-300",
    secondary:
      "bg-white text-zinc-700 ring-1 ring-inset ring-zinc-300 hover:bg-zinc-50 disabled:text-zinc-300 disabled:ring-zinc-200",
    ghost: "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
    danger: "bg-white text-rose-700 ring-1 ring-inset ring-rose-200 hover:bg-rose-50",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function EmptyState({
  title,
  note,
}: {
  title: string;
  note?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 px-6 py-12 text-center">
      <div className="text-sm font-medium text-zinc-600">{title}</div>
      {note ? <p className="text-xs text-zinc-400">{note}</p> : null}
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-zinc-600">
        {label}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-zinc-400">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none";

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700 ${className}`}
    />
  );
}