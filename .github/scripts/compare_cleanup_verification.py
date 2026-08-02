from __future__ import annotations

import sys
from pathlib import Path

workspace = Path(sys.argv[1]).resolve()
cleanup = Path(sys.argv[2]).resolve()
output = cleanup / "TASK_LOGS/2026-08-03-0210-miki-public-pool-cleanup-baseline-comparison.md"

cases = [
    ("lint", "a11y lint"),
    ("build", "production build"),
    ("e2e", "Playwright E2E"),
]


def code(name: str, side: str) -> int:
    return int((workspace / f"{side}-{name}.code").read_text(encoding="utf-8").strip())


def tail(name: str, side: str, limit: int = 100) -> str:
    path = workspace / f"{side}-{name}.log"
    if not path.exists():
        return "(log missing)"
    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    return "\n".join(lines[-limit:])

lines = [
    "# 普通 Miki 公共池清理：主线基线对照",
    "",
    "同一 GitHub runner、同一 Node/依赖安装环境下，分别检出 `main` 与 `chore/remove-miki-public-pool` 并执行相同命令。",
    "",
    "| 检查 | main | 清理分支 | 退出码一致 |",
    "|---|---:|---:|---|",
]

for name, label in cases:
    baseline_code = code(name, "baseline")
    cleanup_code = code(name, "cleanup")
    lines.append(f"| {label} | {baseline_code} | {cleanup_code} | {baseline_code == cleanup_code} |")

for name, label in cases:
    lines.extend([
        "",
        f"## {label}",
        "",
        "### main 输出尾部",
        "",
        "```text",
        tail(name, "baseline"),
        "```",
        "",
        "### 清理分支输出尾部",
        "",
        "```text",
        tail(name, "cleanup"),
        "```",
    ])

output.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")

for value in [
    ".github/scripts/compare_cleanup_verification.py",
    ".github/workflows/compare-miki-public-pool-cleanup.yml",
    ".compare-miki-public-pool-cleanup-trigger",
]:
    path = cleanup / value
    if path.exists():
        path.unlink()
