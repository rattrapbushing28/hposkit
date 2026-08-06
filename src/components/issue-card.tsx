"use client";

import { useState } from "react";
import type { Issue } from "@/lib/scanner";

const severityConfig = {
  critical: { badge: "bg-red-500/15 text-red-400 border-red-500/20", border: "border-l-red-500/60", label: "Critical" },
  warning: { badge: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20", border: "border-l-yellow-500/60", label: "Warning" },
  info: { badge: "bg-blue-500/15 text-blue-400 border-blue-500/20", border: "border-l-blue-500/60", label: "Info" },
};

export function IssueCard({ issue }: { issue: Issue }) {
  const [showCode, setShowCode] = useState(false);
  const config = severityConfig[issue.severity as keyof typeof severityConfig] || severityConfig.info;

  return (
    <div className={`glass rounded-lg border-l-2 ${config.border} overflow-hidden`}>
      <div className="p-3">
        <div className="flex items-start gap-2.5">
          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${config.badge} whitespace-nowrap mt-0.5`}>{config.label}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <strong className="text-xs text-gray-100">{issue.title}</strong>
              <code className="text-[10px] text-gray-500 bg-white/5 px-1.5 py-0.5 rounded font-mono">{issue.file.split("/").pop()}:{issue.line}</code>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">{issue.description}</p>
            <div className="mt-2 flex items-start gap-1.5">
              <span className="text-[10px] font-semibold text-wc-purpleLight mt-0.5 whitespace-nowrap">Fix:</span>
              <code className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded text-gray-300 font-mono break-all">{issue.fix}</code>
            </div>
            {issue.code && (
              <div className="mt-2">
                <button onClick={() => setShowCode(!showCode)} className="text-[10px] text-wc-purpleLight hover:text-wc-purple transition-colors flex items-center gap-1">
                  <svg className={`w-3 h-3 transition-transform ${showCode ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  {showCode ? "Hide" : "Show code"}
                </button>
                {showCode && <pre className="mt-1.5 bg-black/40 text-gray-300 p-2 rounded text-[10px] overflow-x-auto code-block border border-white/5">{issue.code}</pre>}
              </div>
            )}
            <div className="mt-2 pt-2 border-t border-white/5">
              {issue.patchable ? (
                <span className="inline-flex items-center gap-1 text-[10px] text-green-400"><span className="w-1 h-1 rounded-full bg-green-400" />Auto-patchable</span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] text-gray-500"><span className="w-1 h-1 rounded-full bg-gray-500" />Manual fix</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
