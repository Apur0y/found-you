"use client";

import { CommandRunner } from "@/components/CommandRunner";

export default function CommandCenterPage() {
  return (
    <div className="container-shell space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Command Center</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Type a natural-language command. Gemini plans it, and the app runs it through a
          controlled action layer — AI never executes raw queries.
        </p>
      </div>
      <CommandRunner />
    </div>
  );
}