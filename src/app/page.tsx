"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import { UploadZone } from "@/components/upload-zone";
import { ScanResults } from "@/components/scan-results";
import { Logo } from "@/components/logo";
import { DonateButton } from "@/components/donate-button";
import { extractPluginZip, downloadPatchedZip, buildPatchedMap } from "@/lib/plugin-utils";
import { scanFiles, scanPluginHeader, type Issue, type ScannedFile, type ScanReport } from "@/lib/scanner";
import { patchAllIssues, type PatchResult } from "@/lib/patcher";

type Phase = "idle" | "extracting" | "scanning" | "done" | "patching" | "patched" | "downloading" | "error";

const STEPS = ["Extract", "Scan", "Analyze", "Patch", "Download"] as const;

function phaseStep(phase: Phase): number {
  const map: Record<Phase, number> = {
    idle: -1, extracting: 0, scanning: 1, done: 2, patching: 3, patched: 4, downloading: 3, error: -1,
  };
  return map[phase];
}

export default function Home() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [report, setReport] = useState<ScanReport | null>(null);
  const [pluginName, setPluginName] = useState("");
  const [pluginVersion, setPluginVersion] = useState("");
  const [patchResults, setPatchResults] = useState<PatchResult[]>([]);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [patchedFiles, setPatchedFiles] = useState<ScannedFile[]>([]);
  const [extractedFileCount, setExtractedFileCount] = useState(0);
  const [downloadStarted, setDownloadStarted] = useState(false);
  const [terminalLines, setTerminalLines] = useState<string[]>([]);

  const terminalRef = useRef<HTMLDivElement>(null);
  const currentStep = phaseStep(phase);
  const patchedCount = patchResults.filter((r) => r.applied).length;

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalLines]);

  const addTerminal = useCallback((line: string) => {
    setTerminalLines((prev) => [...prev, line]);
  }, []);

  // Type a line into the terminal with a delay — gives the user time to read
  // each line as it appears, like a real terminal running commands.
  const typeLine = useCallback(async (line: string, delayMs = 350) => {
    addTerminal(line);
    await new Promise((r) => setTimeout(r, delayMs));
  }, [addTerminal]);

  const handleFile = useCallback(async (file: File) => {
    setPhase("extracting");
    setError("");
    setReport(null);
    setPatchResults([]);
    setOriginalFile(file);
    setDownloadStarted(false);
    setTerminalLines([]);

    await typeLine(`$ hposkit scan ${file.name}`, 500);
    await typeLine(`  file size: ${Math.round(file.size / 1024)}KB`);
    await typeLine(`  extracting zip...`, 600);

    try {
      const extracted = await extractPluginZip(file);
      setPluginName(extracted.pluginName);
      setPluginVersion(extracted.pluginVersion);
      setExtractedFileCount(extracted.files.length);
      await typeLine(`  found ${extracted.files.length} PHP files`);
      await typeLine(`  plugin: ${extracted.pluginName} v${extracted.pluginVersion}`);

      setPhase("scanning");
      await typeLine(`  scanning for HPOS issues...`, 800);

      const codeReport = scanFiles(extracted.files);
      const headerIssues = extracted.mainFile
        ? scanPluginHeader(extracted.mainFile.content, extracted.files, extracted.mainFile.path)
        : [];

      const allIssues = [...codeReport.issues, ...headerIssues];
      const fullReport: ScanReport = {
        summary: {
          totalFiles: codeReport.summary.totalFiles,
          totalIssues: allIssues.length,
          criticalIssues: allIssues.filter((i) => i.severity === "critical").length,
          warningIssues: allIssues.filter((i) => i.severity === "warning").length,
          infoIssues: allIssues.filter((i) => i.severity === "info").length,
        },
        issues: allIssues,
      };

      await typeLine(`  scan complete: ${allIssues.length} issue(s) found`, 500);
      if (allIssues.length > 0) {
        for (const i of allIssues.slice(0, 5)) {
          const fname = i.file.split("/").pop();
          await typeLine(`    [${i.severity}] ${i.type} → ${fname}:${i.line}`, 200);
        }
        if (allIssues.length > 5) await typeLine(`    ... and ${allIssues.length - 5} more`, 200);
      }

      setReport(fullReport);
      setPhase("done");
    } catch (err) {
      await typeLine(`  ERROR: ${err instanceof Error ? err.message : "failed"}`);
      setError(err instanceof Error ? err.message : "Failed to process plugin zip.");
      setPhase("error");
    }
  }, [typeLine]);

  const handlePatch = useCallback(async () => {
    if (!originalFile || !report) return;
    setPhase("patching");
    setError("");
    await typeLine(`$ applying patches...`, 500);

    try {
      const extracted = await extractPluginZip(originalFile);
      const { patchedFiles: patched, results } = patchAllIssues(extracted.files, report.issues);
      setPatchResults(results);
      setPatchedFiles(patched);

      for (const r of results.filter((r) => r.applied)) {
        await typeLine(`  [patched] ${r.file.split("/").pop()}`, 300);
      }
      for (const r of results.filter((r) => !r.applied && r.error)) {
        await typeLine(`  [skipped] ${r.file.split("/").pop()} — ${r.error}`, 300);
      }

      const applied = results.filter((r) => r.applied).length;
      await typeLine(`  done: ${applied} file(s) patched`, 400);
      setPhase("patched");
    } catch (err) {
      await typeLine(`  ERROR: ${err instanceof Error ? err.message : "failed"}`);
      setError(err instanceof Error ? err.message : "Failed to apply patches.");
      setPhase("error");
    }
  }, [originalFile, report, typeLine]);

  const handleDownload = useCallback(async () => {
    if (!originalFile) return;
    setPhase("downloading");
    await typeLine(`$ packaging patched zip...`, 500);
    try {
      const patchedMap = buildPatchedMap(patchedFiles);
      const baseName = originalFile.name.replace(/\.zip$/i, "");
      const outName = `${baseName}-hpos-patched.zip`;
      await downloadPatchedZip(originalFile, patchedMap, outName);
      await typeLine(`  written: ${outName}`);
      await typeLine(`  download started ✓`, 400);
      setDownloadStarted(true);
      setPhase("patched");
    } catch (err) {
      await typeLine(`  ERROR: ${err instanceof Error ? err.message : "failed"}`);
      setError(err instanceof Error ? err.message : "Failed to download.");
      setPhase("error");
    }
  }, [originalFile, patchedFiles, typeLine]);

  const handleReset = useCallback(() => {
    setPhase("idle");
    setError("");
    setReport(null);
    setPatchResults([]);
    setPatchedFiles([]);
    setOriginalFile(null);
    setPluginName("");
    setPluginVersion("");
    setExtractedFileCount(0);
    setDownloadStarted(false);
    setTerminalLines([]);
  }, []);

  return (
    <div className="relative min-h-screen">
      {/* Background */}
      <div className="fixed inset-0 grid-bg pointer-events-none" />
      <div className="glow-orb top-[-10%] left-[15%] w-[350px] h-[350px] bg-wc-purple/15" />
      <div className="glow-orb top-[30%] right-[-10%] w-[400px] h-[400px] bg-purple-600/8" />

      {/* Nav */}
      <nav className="relative z-10 border-b border-white/5">
        <div className="max-w-4xl mx-auto px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo size={26} />
            <span className="font-semibold text-sm tracking-tight">HPOSKit <span className="text-gray-500 font-normal">for WooCommerce</span></span>
          </div>
          <DonateButton compact />
        </div>
      </nav>

      {/* Hero + upload */}
      {phase === "idle" && (
        <div className="relative z-10">
          <section className="max-w-2xl mx-auto px-5 pt-16 pb-8 text-center">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full glass mb-5 text-xs text-gray-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              WooCommerce 9.4+ HPOS Ready
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 leading-tight">
              Make your plugin <span className="gradient-text">HPOS-compatible</span>
            </h1>
            <p className="text-sm text-gray-400 max-w-lg mx-auto mb-8 leading-relaxed">
              Upload a WooCommerce plugin zip. Get an instant HPOS compatibility report.
              Auto-patch common issues. Download the fixed version. All in your browser.
            </p>
            <UploadZone onFile={handleFile} />
            <div className="flex items-center justify-center gap-6 mt-6 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                100% client-side
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                Instant
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                No upload
              </span>
            </div>
          </section>

          {/* Features */}
          <section className="max-w-3xl mx-auto px-5 py-10">
            <div className="grid md:grid-cols-3 gap-3">
              {[
                { icon: "🔍", title: "Deep Scan", desc: "Detects 10+ HPOS incompatibility patterns: get_post, post_meta, WP_Query, $wpdb, deprecated hooks, missing declarations." },
                { icon: "🔧", title: "Auto-Patch", desc: "One-click fixes. Replaces deprecated calls with WC CRUD methods. Adds HPOS compat declarations per WooCommerce docs." },
                { icon: "📦", title: "Download Fixed", desc: "Get a patched plugin zip ready to install. Diff preview before committing. Original assets preserved." },
              ].map((f) => (
                <div key={f.title} className="glass glass-hover rounded-xl p-4">
                  <div className="text-2xl mb-2">{f.icon}</div>
                  <h3 className="font-semibold text-sm mb-1">{f.title}</h3>
                  <p className="text-xs text-gray-400 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* What is HPOS */}
          <section className="max-w-2xl mx-auto px-5 py-8">
            <div className="glass rounded-xl p-5">
              <h2 className="text-base font-bold mb-2">What is HPOS?</h2>
              <p className="text-xs text-gray-400 leading-relaxed mb-2">
                High-Performance Order Storage stores orders in custom tables instead of <code className="text-wc-purpleLight font-mono">wp_posts</code>.
                Default since WooCommerce 9.4. Legacy storage deprecated, removal targeted late 2026.
              </p>
              <p className="text-xs text-gray-400 leading-relaxed">
                If your plugin uses <code className="text-wc-purpleLight font-mono">get_post_meta()</code> or direct SQL on order IDs, it will break.
              </p>
            </div>
          </section>

          {/* Donate */}
          <section className="max-w-2xl mx-auto px-5 py-8">
            <div className="glass rounded-xl p-5 text-center">
              <div className="text-2xl mb-2">☕</div>
              <h3 className="text-sm font-bold mb-1">Found this useful?</h3>
              <p className="text-xs text-gray-400 mb-4">HPOSKit is free and open source. If it saved you time, consider supporting rynald0s.</p>
              <div className="flex items-center justify-center gap-2">
                {[5, 10, 25].map((amt) => (
                  <a
                    key={amt}
                    href={`https://www.paypal.com/paypalme/rynald0s/${amt}`}
                    target="_blank"
                    rel="noopener"
                    className="px-4 py-2 rounded-lg bg-white/5 hover:bg-wc-purple/20 text-xs font-medium text-gray-300 hover:text-white transition-all border border-white/5 hover:border-wc-purple/30"
                  >
                    ${amt}
                  </a>
                ))}
                <a
                  href="https://www.paypal.com/paypalme/rynald0s"
                  target="_blank"
                  rel="noopener"
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-wc-purple to-purple-500 text-white text-xs font-medium hover:from-wc-purpleDark hover:to-purple-600 transition-all"
                >
                  Custom
                </a>
              </div>
              <p className="text-[10px] text-gray-600 mt-3">Opens PayPal.me — no account needed</p>
            </div>
          </section>

          <footer className="relative z-10 border-t border-white/5 mt-12">
            <div className="max-w-4xl mx-auto px-5 py-5 flex items-center justify-between text-xs text-gray-500">
              <div className="flex items-center gap-2">
                <Logo size={18} />
                <span>HPOSKit for WooCommerce — Free & open source</span>
              </div>
              <div className="flex items-center gap-4">
                <a href="https://www.paypal.com/paypalme/rynald0s" target="_blank" rel="noopener" className="hover:text-wc-purpleLight transition-colors">Donate</a>
                <span>Powered by your browser</span>
              </div>
            </div>
          </footer>
        </div>
      )}

      {/* Processing / results view */}
      {phase !== "idle" && (
        <div className="relative z-10 max-w-3xl mx-auto px-5 py-6">
          {/* Stepper */}
          {currentStep >= 0 && (
            <div className="mb-4 glass rounded-xl p-3">
              <div className="flex items-center justify-between">
                {STEPS.map((label, idx) => {
                  const isComplete = idx < currentStep;
                  const isActive = idx === currentStep;
                  return (
                    <div key={label} className="flex items-center flex-1 last:flex-none">
                      <div className="flex flex-col items-center gap-1">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                          isComplete ? "bg-green-500 text-white"
                          : isActive ? "bg-wc-purple text-white ring-2 ring-wc-purple/30 animate-pulse"
                          : "bg-white/5 text-gray-600"
                        }`}>
                          {isComplete ? "✓" : idx + 1}
                        </div>
                        <span className={`text-[10px] font-medium ${isActive ? "text-wc-purpleLight" : isComplete ? "text-green-400" : "text-gray-600"}`}>{label}</span>
                      </div>
                      {idx < STEPS.length - 1 && <div className={`flex-1 h-px mx-1.5 ${isComplete ? "bg-green-500/40" : "bg-white/5"}`} />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Terminal output */}
          {terminalLines.length > 0 && (
            <div className="mb-4 glass rounded-xl overflow-hidden">
              <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/5 bg-black/30">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
                <span className="text-[10px] text-gray-600 ml-2 font-mono">hposkit — bash — 80x24</span>
              </div>
              <div ref={terminalRef} className="p-3 bg-black/40 max-h-64 overflow-y-auto code-block leading-relaxed">
                {terminalLines.map((line, i) => (
                  <div key={i} className={`whitespace-pre-wrap animate-fade-in-up ${
                    line.startsWith("$") ? "text-wc-purpleLight font-semibold"
                    : line.includes("ERROR") ? "text-red-400"
                    : line.includes("✓") ? "text-green-400"
                    : line.includes("[patched]") ? "text-green-400"
                    : line.includes("[skipped]") ? "text-yellow-400"
                    : line.includes("[critical]") ? "text-red-400"
                    : line.includes("[warning]") ? "text-yellow-400"
                    : line.includes("[info]") ? "text-blue-400"
                    : "text-gray-400"
                  }`}>{line}</div>
                ))}
                {(phase === "extracting" || phase === "scanning" || phase === "patching" || phase === "downloading") && (
                  <div className="text-wc-purpleLight animate-pulse inline-block">▋</div>
                )}
              </div>
            </div>
          )}

          {/* Loading */}
          {(phase === "extracting" || phase === "scanning" || phase === "patching" || phase === "downloading") && (
            <div className="text-center py-8">
              <div className="inline-block w-10 h-10 rounded-full border-3 border-wc-purple/20 border-t-wc-purple animate-spin mb-3" style={{ borderWidth: "3px" }} />
              <p className="text-sm font-medium text-gray-200">
                {phase === "extracting" && "Extracting..."}
                {phase === "scanning" && "Scanning..."}
                {phase === "patching" && "Patching..."}
                {phase === "downloading" && "Packaging..."}
              </p>
            </div>
          )}

          {/* Error */}
          {phase === "error" && (
            <div className="glass rounded-xl p-5 text-center border-red-500/20">
              <p className="text-red-300 font-medium text-sm mb-1">Something went wrong</p>
              <p className="text-red-400/60 text-xs mb-4">{error}</p>
              <button onClick={handleReset} className="px-4 py-2 rounded-lg bg-red-500/15 text-red-300 hover:bg-red-500/25 transition-colors text-xs font-medium">Try Again</button>
            </div>
          )}

          {/* Scan results */}
          {phase === "done" && report && (
            <ScanResults report={report} pluginName={pluginName} pluginVersion={pluginVersion} onPatch={handlePatch} onReset={handleReset} />
          )}

          {/* Patched */}
          {phase === "patched" && report && (
            <div className="space-y-4">
              <div className="glass rounded-xl p-4 border-green-500/20 animate-fade-in-up">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-7 h-7 rounded-full bg-green-500/20 flex items-center justify-center">
                        <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                      </div>
                      <h2 className="text-base font-bold">{patchedCount > 0 ? "Patches Applied" : "No Auto-Patches"}</h2>
                    </div>
                    <p className="text-xs text-gray-400">
                      {patchedCount > 0 ? `${patchedCount} file(s) modified.` : "Issues require manual fixes."}
                      {downloadStarted && <span className="text-green-400 ml-2">✓ Downloaded!</span>}
                    </p>
                  </div>
                  {patchedCount > 0 && (
                    <button onClick={handleDownload} className="px-4 py-2 rounded-lg bg-gradient-to-r from-wc-purple to-purple-500 text-white text-xs font-medium hover:from-wc-purpleDark hover:to-purple-600 transition-all flex items-center gap-1.5 whitespace-nowrap">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      Download
                    </button>
                  )}
                </div>
              </div>

              {/* Before/After */}
              {patchResults.filter((r) => r.applied).map((result, idx) => (
                <div key={idx} className="glass rounded-xl overflow-hidden animate-fade-in-up" style={{ animationDelay: `${idx * 80}ms` }}>
                  <div className="px-3 py-2 border-b border-white/5 flex items-center justify-between">
                    <code className="text-xs font-mono text-gray-400">{result.file.split("/").pop()}</code>
                    <span className="text-[10px] text-green-400 px-1.5 py-0.5 rounded bg-green-500/10">PATCHED</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/5">
                    <div>
                      <div className="px-3 py-1.5 bg-red-500/5 text-[10px] font-semibold text-red-400 uppercase tracking-wide">Before</div>
                      <pre className="bg-black/30 text-gray-400 p-3 text-xs overflow-x-auto max-h-64 overflow-y-auto code-block">
                        {result.originalContent.split("\n").slice(0, 50).map((line, i) => <div key={i}>{line || " "}</div>)}
                      </pre>
                    </div>
                    <div>
                      <div className="px-3 py-1.5 bg-green-500/5 text-[10px] font-semibold text-green-400 uppercase tracking-wide">After</div>
                      <pre className="bg-black/30 text-gray-200 p-3 text-xs overflow-x-auto max-h-64 overflow-y-auto code-block">
                        {result.patchedContent.split("\n").slice(0, 50).map((line, i) => {
                          const orig = result.originalContent.split("\n")[i];
                          return <div key={i} className={orig !== line ? "bg-green-500/10 text-green-300 -mx-3 px-3" : ""}>{line || " "}</div>;
                        })}
                      </pre>
                    </div>
                  </div>
                </div>
              ))}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                {patchedCount > 0 && (
                  <button onClick={handleDownload} className="px-4 py-2 rounded-lg bg-gradient-to-r from-wc-purple to-purple-500 text-white text-xs font-medium hover:from-wc-purpleDark hover:to-purple-600 transition-all flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Download Patched Plugin
                  </button>
                )}
                <button onClick={handleReset} className="px-4 py-2 rounded-lg glass glass-hover text-gray-300 text-xs font-medium">Scan Another</button>
              </div>

              {/* Donate nudge */}
              <div className="flex items-center gap-3 py-1">
                <span className="text-xs opacity-40">☕</span>
                <p className="text-[11px] text-gray-600 font-light">Saved you some debugging time?</p>
                <DonateButton compact />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
