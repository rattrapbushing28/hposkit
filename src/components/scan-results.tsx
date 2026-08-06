"use client";

import { IssueCard } from "./issue-card";
import type { ScanReport } from "@/lib/scanner";

interface ScanResultsProps {
  report: ScanReport;
  pluginName: string;
  pluginVersion: string;
  onPatch: () => void;
  onReset: () => void;
}

export function ScanResults({ report, pluginName, pluginVersion, onPatch, onReset }: ScanResultsProps) {
  const { summary, issues } = report;
  const hasPatchable = issues.some((i) => i.patchable);
  const isCompatible = issues.length === 0;

  const verdict = summary.criticalIssues > 0
    ? { label: "Not Compatible", color: "red", icon: "✕" }
    : summary.warningIssues > 0
    ? { label: "Needs Fixes", color: "yellow", icon: "!" }
    : { label: "Compatible", color: "green", icon: "✓" };

  const verdictStyles: Record<string, string> = {
    red: "from-red-500/15 to-red-600/5 border-red-500/20 text-red-300",
    yellow: "from-yellow-500/15 to-yellow-600/5 border-yellow-500/20 text-yellow-300",
    green: "from-green-500/15 to-green-600/5 border-green-500/20 text-green-300",
  };

  return (
    <div className="space-y-4">
      {/* Plugin + verdict */}
      <div className={`glass rounded-xl p-4 bg-gradient-to-r ${verdictStyles[verdict.color]} border animate-fade-in-up`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold">{pluginName}</h2>
            <p className="text-xs text-gray-400 mt-0.5">v{pluginVersion}</p>
          </div>
          <div className="flex items-center gap-2">
            {hasPatchable && verdict.color !== "green" && (
              <button onClick={onPatch} className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-wc-purple to-purple-500 text-white text-xs font-medium hover:from-wc-purpleDark hover:to-purple-600 transition-all flex items-center gap-1.5 whitespace-nowrap">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                Auto-Patch
              </button>
            )}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5">
              <span className="text-sm font-bold">{verdict.icon}</span>
              <span className="text-sm font-semibold">{verdict.label}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        <Stat label="Files" value={summary.totalFiles} color="text-gray-200" />
        <Stat label="Critical" value={summary.criticalIssues} color="text-red-400" />
        <Stat label="Warnings" value={summary.warningIssues} color="text-yellow-400" />
        <Stat label="Info" value={summary.infoIssues} color="text-blue-400" />
      </div>

      {/* Compatible */}
      {isCompatible && (
        <div className="glass rounded-xl p-5 text-center border-green-500/20 animate-fade-in-up">
          <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
          </div>
          <h3 className="text-base font-bold text-green-300 mb-1">No HPOS Issues</h3>
          <p className="text-xs text-gray-400">This plugin is fully HPOS-compatible.</p>
        </div>
      )}

      {/* Issues */}
      {issues.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-200">Issues ({issues.length})</h3>
            {hasPatchable && (
              <span className="text-[10px] text-green-400 px-2 py-0.5 rounded-full bg-green-500/10">
                {issues.filter((i) => i.patchable).length} auto-patchable
              </span>
            )}
          </div>
          {issues.map((issue, idx) => (
            <div key={idx} className="animate-fade-in-up" style={{ animationDelay: `${idx * 40}ms` }}>
              <IssueCard issue={issue} />
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        {hasPatchable && (
          <button onClick={onPatch} className="px-4 py-2 rounded-lg bg-gradient-to-r from-wc-purple to-purple-500 text-white text-xs font-medium hover:from-wc-purpleDark hover:to-purple-600 transition-all flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            Auto-Patch All
          </button>
        )}
        <button onClick={onReset} className="px-4 py-2 rounded-lg glass glass-hover text-gray-300 text-xs font-medium">Scan Another</button>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="glass rounded-lg p-3 text-center">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-[10px] text-gray-500 mt-0.5 uppercase tracking-wider">{label}</div>
    </div>
  );
}
