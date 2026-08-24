#!/usr/bin/env python3
"""Dependency drift scanner for the timesheet-app npm workspaces.

Collects, for backend/ and frontend/:
  - installed vs. latest versions (npm outdated)
  - known advisories (npm audit)

Emits one normalized JSON document on stdout (or to --out) that matches
docs/automations/remediation-queue.schema.json, so the weekly drift report and
its remediation queue are reproducible instead of hand-assembled.

Read-only: never installs, never writes to package.json or a lockfile.
"""

import argparse
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone

REPO = "Cognition-Partner-Workshops/timesheet-app"
WORKSPACES = ("backend", "frontend")

SEVERITY_POINTS = {"CRITICAL": 50, "HIGH": 30, "MODERATE": 12, "MEDIUM": 12, "LOW": 4, "INFO": 1}
EXPOSURE_POINTS = {"runtime": 10, "dev": 3}
# Components whose major bumps ripple through the whole app.
HIGH_BLAST_RADIUS = {
    "react", "react-dom", "react-router-dom", "@mui/material", "vite", "typescript",
    "express", "sqlite3", "jsonwebtoken", "jest", "eslint",
}


def run(cmd, cwd):
    proc = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    return proc.returncode, proc.stdout, proc.stderr


def run_json(cmd, cwd, errors):
    """npm outdated/audit exit non-zero when they have findings; only parse failures matter."""
    code, out, err = run(cmd, cwd)
    if not out.strip():
        errors.append(f"{' '.join(cmd)} in {cwd}: no output (exit {code}): {err.strip()[:200]}")
        return None
    try:
        return json.loads(out)
    except json.JSONDecodeError as exc:
        errors.append(f"{' '.join(cmd)} in {cwd}: unparseable output: {exc}")
        return None


def parse_version(value):
    parts = [int(p) for p in re.findall(r"\d+", value or "")[:3]]
    return parts + [0] * (3 - len(parts))


def version_gap(current, latest):
    cur, new = parse_version(current), parse_version(latest)
    return {
        "major": max(0, new[0] - cur[0]),
        "minor": max(0, new[1] - cur[1]) if new[0] == cur[0] else 0,
        "patch": max(0, new[2] - cur[2]) if new[:2] == cur[:2] else 0,
    }


def rank_score(item):
    severities = [SEVERITY_POINTS.get(a["severity"].upper(), 4) for a in item["advisories"]]
    severity = max(severities) if severities else 0
    volume = min(15, 5 * max(0, len(item["advisories"]) - 1))
    gap = item["gap"]
    staleness = min(24, 8 * gap["major"]) + min(6, gap["minor"]) + (2 if gap["patch"] else 0)
    return severity + volume + staleness + EXPOSURE_POINTS.get(item["exposure"], 5)


def size_estimate(item):
    gap = item["gap"]
    if gap["major"] >= 1:
        return "L" if item["component"] in HIGH_BLAST_RADIUS else "M"
    if gap["minor"] >= 1:
        return "S"
    # No version gap but an advisory still needs a lockfile bump or an override.
    return "S" if item["advisories"] else "XS"


def collect_advisories(cwd, errors):
    """Map package name -> advisories, from `npm audit --json`."""
    report = run_json(["npm", "audit", "--json"], cwd, errors)
    advisories = {}
    if not report:
        return advisories
    for name, vuln in (report.get("vulnerabilities") or {}).items():
        entries = []
        for via in vuln.get("via") or []:
            if isinstance(via, dict):
                entries.append({
                    "id": str(via.get("source") or via.get("url") or "unknown"),
                    "severity": (via.get("severity") or vuln.get("severity") or "low").upper(),
                    "summary": via.get("title") or "",
                    "url": via.get("url") or "",
                })
        if not entries:
            entries.append({
                "id": f"npm-audit:{name}",
                "severity": (vuln.get("severity") or "low").upper(),
                "summary": f"transitive advisory via {', '.join(str(v) for v in vuln.get('via') or [])}",
                "url": "",
            })
        advisories[name] = entries
    return advisories


def declared_exposure(manifest, name):
    if name in (manifest.get("dependencies") or {}):
        return "runtime"
    if name in (manifest.get("devDependencies") or {}):
        return "dev"
    return "transitive"


def scan_workspace(workspace, root, errors):
    cwd = os.path.join(root, workspace)
    manifest_path = os.path.join(cwd, "package.json")
    if not os.path.isfile(manifest_path):
        errors.append(f"{workspace}: no package.json")
        return []
    with open(manifest_path) as handle:
        manifest = json.load(handle)

    outdated = run_json(["npm", "outdated", "--json", "--long"], cwd, errors) or {}
    advisories = collect_advisories(cwd, errors)

    items = []
    for name, info in outdated.items():
        current = info.get("current") or info.get("wanted") or ""
        latest = info.get("latest") or ""
        items.append({
            "component": name,
            "ecosystem": "npm",
            "kind": "dependency",
            "location": f"{workspace}/package.json",
            "current": current,
            "latest": latest,
            "exposure": declared_exposure(manifest, name),
            "gap": version_gap(current, latest),
            "advisories": advisories.pop(name, []),
        })

    # Advisories on packages npm outdated did not report (already latest, or transitive).
    for name, entries in advisories.items():
        items.append({
            "component": name,
            "ecosystem": "npm",
            "kind": "dependency",
            "location": f"{workspace}/package-lock.json",
            "current": "installed",
            "latest": "see advisory",
            "exposure": declared_exposure(manifest, name),
            "gap": {"major": 0, "minor": 0, "patch": 0},
            "advisories": entries,
        })
    return items


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", help="write JSON here instead of stdout")
    parser.add_argument("--root", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
    parser.add_argument("--max-advisories", type=int, default=5,
                        help="advisories kept per component (highest severity first); the rest are counted only")
    args = parser.parse_args()

    root = os.path.abspath(args.root)
    errors = []
    items = []
    for workspace in WORKSPACES:
        items.extend(scan_workspace(workspace, root, errors))

    for item in items:
        item["rank_score"] = rank_score(item)
        item["size"] = size_estimate(item)
        item["advisory_count"] = len(item["advisories"])
        item["advisories"].sort(key=lambda a: -SEVERITY_POINTS.get(a["severity"].upper(), 4))
        del item["advisories"][args.max_advisories:]
    items.sort(key=lambda i: (-i["rank_score"], i["size"], i["component"]))

    document = {
        "repo": REPO,
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "scanner": "scripts/drift_scan.py",
        "items": items,
        "errors": errors,
    }
    payload = json.dumps(document, indent=2)
    if args.out:
        with open(args.out, "w") as handle:
            handle.write(payload + "\n")
    else:
        print(payload)
    return 0


if __name__ == "__main__":
    sys.exit(main())
