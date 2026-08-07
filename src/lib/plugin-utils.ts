/*
 * Plugin zip extraction and repackaging utilities.
 * Uses JSZip to handle WordPress plugin zip files entirely in-browser.
 */

import JSZip from "jszip";
import { saveAs } from "file-saver";
import type { ScannedFile } from "./scanner";

export interface ExtractedPlugin {
  files: ScannedFile[];
  mainFile: ScannedFile | null;
  pluginName: string;
  pluginVersion: string;
  rootFolder: string;
}

function normalizePath(p: string) {
  // Normalize ZIP entry paths: remove leading ./, convert backslashes to slashes
  return p.replace(/^\.\//, "").replace(/\\/g, "/");
}

/**
 * Determine common root folder among entries. Returns "" if no single root.
 */
function detectRootFolder(entries: string[]): string {
  const firstSegments = entries
    .map((e) => normalizePath(e))
    .map((e) => {
      const parts = e.split("/").filter(Boolean);
      return parts.length > 0 ? parts[0] : "";
    })
    .filter(Boolean);

  if (firstSegments.length === 0) return "";
  // Strict: all entries must share the same top-level folder.
  // This prevents picking a wrong root for mixed zips.
  const unique = new Set(firstSegments);
  if (unique.size === 1) return firstSegments[0];
  return "";
}

/**
 * Extract a plugin zip file and return all PHP files plus metadata.
 */
export async function extractPluginZip(zipFile: File): Promise<ExtractedPlugin> {
  const zip = await JSZip.loadAsync(zipFile);
  const files: ScannedFile[] = [];
  let mainFile: ScannedFile | null = null;
  let pluginName = "Unknown Plugin";
  let pluginVersion = "—";
  let rootFolder = "";

  const entries = Object.values(zip.files);
  const entryNames = entries.map((e) => normalizePath(e.name));

  // Determine root folder more robustly
  if (entryNames.length > 0) {
    rootFolder = detectRootFolder(entryNames);
  }

  for (const entry of entries) {
    if (entry.dir) continue;
    const name = normalizePath(entry.name);
    // Only process PHP files for scanning, but keep all for repackaging.
    if (!name.toLowerCase().endsWith(".php")) continue;

    const content = await entry.async("string");
    const scanned: ScannedFile = { path: name, content };
    files.push(scanned);

    // Detect main plugin file by looking for "Plugin Name:" header.
    if (/Plugin Name:/i.test(content) && !mainFile) {
      mainFile = scanned;
      const nameMatch = content.match(/Plugin Name:\s*(.+)/i);
      const versionMatch = content.match(/Version:\s*(.+)/i);
      if (nameMatch) pluginName = nameMatch[1].trim();
      if (versionMatch) pluginVersion = versionMatch[1].trim();
    }
  }

  // If no main file found with header, try the root-level PHP file.
  if (!mainFile && files.length > 0) {
    const rootPhp = files.find((f) => {
      const parts = f.path.split("/");
      return parts.length === 2 && parts[0] === rootFolder;
    });
    if (rootPhp) mainFile = rootPhp;
  }

  return { files, mainFile, pluginName, pluginVersion, rootFolder };
}

/**
 * Repackage files into a new zip and trigger download.
 * Preserves all original non-PHP files from the original zip.
 */
export async function downloadPatchedZip(
  originalZipFile: File,
  patchedFiles: Map<string, string>,
  outputName: string
): Promise<void> {
  const zip = await JSZip.loadAsync(originalZipFile);
  const entries = Object.values(zip.files);

  const newZip = new JSZip();

  for (const entry of entries) {
    if (entry.dir) {
      // Keep folder structure
      newZip.folder(normalizePath(entry.name).replace(/\/$/, ""));
      continue;
    }

    const normalized = normalizePath(entry.name);

    // If this file was patched, use the patched content. Compare normalized paths.
    if (patchedFiles.has(normalized)) {
      newZip.file(entry.name, patchedFiles.get(normalized)!);
    } else {
      // Keep original content for non-patched files.
      const content = await entry.async("blob");
      newZip.file(entry.name, content);
    }
  }

  const blob = await newZip.generateAsync({ type: "blob" });
  saveAs(blob, outputName);
}

/**
 * Get a map of file paths to patched content from patched files array.
 */
export function buildPatchedMap(patchedFiles: ScannedFile[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const file of patchedFiles) {
    map.set(file.path, file.content);
  }
  return map;
}
