"use client";

import { Breadcrumb } from "../../leads/_components";

export default function JacobClosersScoringShellPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Breadcrumb items={["Jacob (H1B)", "Closers scoring"]} />
        <h1 className="text-2xl font-bold text-gray-900">Closers call scoring</h1>
        <p className="text-sm text-gray-500 mt-1">
          Shell page — closers template & AI prompt ship in the same module commit.
        </p>
      </div>
    </div>
  );
}
