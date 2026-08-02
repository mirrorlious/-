from __future__ import annotations

import json
import subprocess
from collections import defaultdict
from pathlib import Path

ROOT = Path.cwd()
OUTPUT = ROOT / "TASK_LOGS/2026-08-03-0210-miki-public-pool-cleanup-audit.json"

CANDIDATE_PATHS = [
    "public-resources/manifest.json",
    "public-resources/politics-2027",
    "public-resources/pharmacology",
    "public-resources/jlpt-eggrolls",
    "public-resources/kaoyan-english-one-papers",
    "public-resources/kaoyan-english-two-papers",
]

PROTECTED_PATHS = [
    "public-resources/dyl-exam-public-backup",
    "public-resources/ielts-vocabulary",
    "public-resources/kaoyan-english-2027-vocabulary",
    "scripts/build-cloudbase-v2.cjs",
]

SEARCH_PATTERNS = [
    "public-resources/manifest.json",
    "politics-2027",
    "pharmacology",
    "jlpt-eggrolls",
    "kaoyan-english-one-papers",
    "kaoyan-english-two-papers",
    "kaoyan-english-2027-vocabulary",
    "ielts-vocabulary",
    "dyl-exam-public-backup",
    "build-politics-pack",
    "generate_kaoyan_english_vocabulary",
    "build_jlpt_eggrolls_pack",
    "build_pharmacology_pack",
]

SKIP_SUFFIXES = {
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".woff", ".woff2",
    ".ttf", ".mp3", ".mp4", ".pdf", ".gz", ".zip", ".b64",
}


def git(*args: str) -> str:
    return subprocess.check_output(["git", *args], cwd=ROOT, text=True).strip()


def tracked_files() -> list[Path]:
    return [ROOT / line for line in git("ls-files").splitlines() if line]


def relative(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def files_under(path_value: str, files: list[Path]) -> list[str]:
    path = ROOT / path_value
    if path.is_file():
        return [path_value]
    prefix = path_value.rstrip("/") + "/"
    return [relative(item) for item in files if relative(item).startswith(prefix)]


def read_text(path: Path) -> str | None:
    if path.suffix.lower() in SKIP_SUFFIXES:
        return None
    try:
        return path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        return None


def is_inside_candidate(path_value: str) -> bool:
    return any(
        path_value == candidate or path_value.startswith(candidate.rstrip("/") + "/")
        for candidate in CANDIDATE_PATHS
    )


def main() -> None:
    files = tracked_files()
    tracked = [relative(path) for path in files]

    top_level_public = defaultdict(list)
    for path_value in tracked:
        if not path_value.startswith("public-resources/"):
            continue
        rest = path_value[len("public-resources/"):]
        top = rest.split("/", 1)[0]
        top_level_public[top].append(path_value)

    references: dict[str, list[dict[str, object]]] = {pattern: [] for pattern in SEARCH_PATTERNS}
    for path in files:
        path_value = relative(path)
        if path_value.endswith("-audit.json"):
            continue
        text = read_text(path)
        if text is None:
            continue
        lower = text.lower()
        lines = text.splitlines()
        for pattern in SEARCH_PATTERNS:
            needle = pattern.lower()
            if needle not in lower:
                continue
            hits = []
            for index, line in enumerate(lines, start=1):
                if needle in line.lower():
                    hits.append({"line": index, "text": line.strip()[:300]})
                    if len(hits) >= 12:
                        break
            references[pattern].append({
                "path": path_value,
                "insideCandidate": is_inside_candidate(path_value),
                "hits": hits,
            })

    scripts_and_tools = [
        path for path in tracked
        if path.startswith("scripts/") or path.startswith("tools/")
    ]
    workflows = [path for path in tracked if path.startswith(".github/workflows/")]
    task_logs = [path for path in tracked if path.startswith("TASK_LOGS/")]

    candidate_details = {}
    for candidate in CANDIDATE_PATHS:
        members = files_under(candidate, files)
        candidate_details[candidate] = {
            "exists": bool(members),
            "fileCount": len(members),
            "files": members,
        }

    protected_details = {}
    for protected in PROTECTED_PATHS:
        members = files_under(protected, files)
        protected_details[protected] = {
            "exists": bool(members),
            "fileCount": len(members),
            "files": members,
        }

    manifest = None
    manifest_path = ROOT / "public-resources/manifest.json"
    if manifest_path.is_file():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    report = {
        "schemaVersion": 1,
        "repository": "mirrorlious/-",
        "branch": git("branch", "--show-current"),
        "head": git("rev-parse", "HEAD"),
        "trackedFileCount": len(tracked),
        "publicResourcesTopLevel": {
            key: {"fileCount": len(value), "files": value}
            for key, value in sorted(top_level_public.items())
        },
        "catalogPackIds": [
            str(pack.get("id") or pack.get("packId") or "")
            for pack in ((manifest or {}).get("packs") or [])
        ],
        "candidatePaths": candidate_details,
        "protectedPaths": protected_details,
        "references": references,
        "scriptsAndTools": scripts_and_tools,
        "workflows": workflows,
        "taskLogs": task_logs,
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
