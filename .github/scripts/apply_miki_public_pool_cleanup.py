from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

ROOT = Path.cwd()
RESULT = ROOT / "TASK_LOGS/2026-08-03-0210-miki-public-pool-cleanup-files.json"

DELETE_PATHS = [
    "public-resources/manifest.json",
    "public-resources/politics-2027",
    "public-resources/pharmacology",
    "public-resources/jlpt-eggrolls",
    "public-resources/kaoyan-english-one-papers",
    "public-resources/kaoyan-english-two-papers",
    ".github/workflows/build-politics-pack.yml",
    "scripts/build-politics-pack.py",
    "tools/build_jlpt_eggrolls_pack.py",
    "tools/build_pharmacology_pack.py",
]

PROTECTED_PATHS = [
    "public-resources/dyl-exam-public-backup/manifest.json",
    "public-resources/dyl-exam-public-backup/data.json",
    "public-resources/ielts-vocabulary/ielts-vocabulary-4-level.json",
    "public-resources/kaoyan-english-2027-vocabulary",
    "scripts/build-cloudbase-v2.cjs",
    "scripts/generate_kaoyan_english_vocabulary.py",
    ".github/workflows/generate-kaoyan-english-vocabulary.yml",
    "src/core/vocabulary.js",
]


def git_ls_files(path_value: str) -> list[str]:
    completed = subprocess.run(
        ["git", "ls-files", path_value],
        cwd=ROOT,
        check=True,
        text=True,
        capture_output=True,
    )
    return [line for line in completed.stdout.splitlines() if line]


def assert_protected() -> None:
    missing = [path for path in PROTECTED_PATHS if not (ROOT / path).exists()]
    if missing:
        raise SystemExit("protected reader paths are missing: " + ", ".join(missing))


def remove_path(path_value: str) -> list[str]:
    path = ROOT / path_value
    tracked = git_ls_files(path_value)
    if not tracked:
        raise SystemExit(f"cleanup candidate is missing or untracked: {path_value}")
    if path.is_dir():
        shutil.rmtree(path)
    elif path.is_file():
        path.unlink()
    else:
        raise SystemExit(f"cleanup candidate does not exist: {path_value}")
    return tracked


def main() -> None:
    assert_protected()
    removed: dict[str, list[str]] = {}
    for path_value in DELETE_PATHS:
        removed[path_value] = remove_path(path_value)
    assert_protected()

    survivors = [path for path in DELETE_PATHS if (ROOT / path).exists()]
    if survivors:
        raise SystemExit("cleanup candidates still exist: " + ", ".join(survivors))

    removed_files = sorted({item for values in removed.values() for item in values})
    if len(removed_files) != 59:
        raise SystemExit(f"unexpected deletion count: expected 59, got {len(removed_files)}")

    RESULT.write_text(
        json.dumps(
            {
                "schemaVersion": 1,
                "removedPathCount": len(DELETE_PATHS),
                "removedFileCount": len(removed_files),
                "removed": removed,
                "protected": PROTECTED_PATHS,
            },
            ensure_ascii=False,
            indent=2,
        ) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
