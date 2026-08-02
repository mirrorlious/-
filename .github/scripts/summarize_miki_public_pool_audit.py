from __future__ import annotations

import json
from pathlib import Path

ROOT = Path.cwd()
SOURCE = ROOT / "TASK_LOGS/2026-08-03-0210-miki-public-pool-cleanup-audit.json"
OUTPUT = ROOT / "TASK_LOGS/2026-08-03-0210-miki-public-pool-cleanup-audit-summary.md"

IGNORED_REFERENCE_PREFIXES = (
    "TASK_LOGS/2026-08-03-0210-miki-public-pool-cleanup",
    ".github/scripts/audit_miki_public_pool_cleanup.py",
    ".github/scripts/summarize_miki_public_pool_audit.py",
    ".github/workflows/audit-miki-public-pool-cleanup.yml",
    ".github/workflows/summarize-miki-public-pool-audit.yml",
)


def is_ignored(path: str) -> bool:
    return path.startswith(IGNORED_REFERENCE_PREFIXES)


def main() -> None:
    report = json.loads(SOURCE.read_text(encoding="utf-8"))
    lines = [
        "# Miki 公共池清理审计摘要",
        "",
        f"- branch: `{report['branch']}`",
        f"- audited head: `{report['head']}`",
        f"- tracked files: **{report['trackedFileCount']}**",
        "",
        "## public-resources 顶层内容",
        "",
        "| 名称 | 文件数 |",
        "|---|---:|",
    ]
    for name, detail in report["publicResourcesTopLevel"].items():
        lines.append(f"| `{name}` | {detail['fileCount']} |")

    lines.extend(["", "## 总 manifest 条目", ""])
    for pack_id in report.get("catalogPackIds", []):
        lines.append(f"- `{pack_id}`")

    lines.extend([
        "",
        "## 删除候选",
        "",
        "| 路径 | 存在 | 文件数 |",
        "|---|---|---:|",
    ])
    for path, detail in report["candidatePaths"].items():
        lines.append(f"| `{path}` | {detail['exists']} | {detail['fileCount']} |")

    lines.extend([
        "",
        "## 保护路径",
        "",
        "| 路径 | 存在 | 文件数 |",
        "|---|---|---:|",
    ])
    for path, detail in report["protectedPaths"].items():
        lines.append(f"| `{path}` | {detail['exists']} | {detail['fileCount']} |")

    lines.extend(["", "## 候选标记的候选目录外引用", ""])
    meaningful_reference_count = 0
    for pattern, items in report["references"].items():
        external = [item for item in items if not item["insideCandidate"] and not is_ignored(item["path"])]
        if not external:
            continue
        meaningful_reference_count += len(external)
        lines.append(f"### `{pattern}`")
        lines.append("")
        for item in external:
            lines.append(f"- `{item['path']}`")
            for hit in item.get("hits", [])[:6]:
                lines.append(f"  - L{hit['line']}: `{hit['text']}`")
        lines.append("")
    if meaningful_reference_count == 0:
        lines.append("无候选目录外引用。")

    lines.extend(["", "## scripts / tools", ""])
    for path in report.get("scriptsAndTools", []):
        lines.append(f"- `{path}`")

    lines.extend(["", "## workflows", ""])
    for path in report.get("workflows", []):
        lines.append(f"- `{path}`")

    OUTPUT.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
