from __future__ import annotations

import json
import os
import shutil
import subprocess
from pathlib import Path

ROOT = Path.cwd()
LOG_PATH = ROOT / "TASK_LOGS/2026-08-03-0210-miki-public-pool-cleanup.md"
FILES_PATH = ROOT / "TASK_LOGS/2026-08-03-0210-miki-public-pool-cleanup-files.json"
VERIFICATION_PATH = ROOT / "TASK_LOGS/2026-08-03-0210-miki-public-pool-cleanup-verification.json"

TEMPORARY_PATHS = [
    ".github/scripts/audit_miki_public_pool_cleanup.py",
    ".github/scripts/summarize_miki_public_pool_audit.py",
    ".github/scripts/apply_miki_public_pool_cleanup.py",
    ".github/scripts/finalize_miki_public_pool_cleanup.py",
    ".github/workflows/audit-miki-public-pool-cleanup.yml",
    ".github/workflows/summarize-miki-public-pool-audit.yml",
    ".github/workflows/apply-miki-public-pool-cleanup.yml",
    ".apply-miki-public-pool-cleanup-trigger",
    "TASK_LOGS/2026-08-03-0210-miki-public-pool-cleanup-audit.json",
    "TASK_LOGS/2026-08-03-0210-miki-public-pool-cleanup-files.json",
]

RESULT_NAMES = ["install", "unit", "lint", "build", "edgeInstall", "e2e", "diffCheck"]
REQUIRED_RESULTS = ["install", "unit", "lint", "build", "e2e", "diffCheck"]


def replace_once(text: str, old: str, new: str) -> str:
    if old not in text:
        raise SystemExit(f"expected log block is missing: {old[:80]!r}")
    return text.replace(old, new, 1)


def remove_temporary_paths() -> None:
    for value in TEMPORARY_PATHS:
        path = ROOT / value
        if path.is_dir():
            shutil.rmtree(path)
        elif path.exists():
            path.unlink()


def main() -> None:
    results = {name: os.environ.get(name.upper() + "_RESULT", "skipped") for name in RESULT_NAMES}
    verified_head = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    cleanup = json.loads(FILES_PATH.read_text(encoding="utf-8"))
    overall_success = all(results[name] == "success" for name in REQUIRED_RESULTS)
    status = "已完成" if overall_success else "部分完成"

    verification = {
        "schemaVersion": 1,
        "verifiedHead": verified_head,
        "status": status,
        "removedPathCount": cleanup["removedPathCount"],
        "removedFileCount": cleanup["removedFileCount"],
        "results": results,
        "protectedPaths": cleanup["protected"],
    }
    VERIFICATION_PATH.write_text(json.dumps(verification, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    log = LOG_PATH.read_text(encoding="utf-8")
    log = replace_once(log, "- 状态：计划中", f"- 状态：{status}")
    log = replace_once(
        log,
        "## 8. 实际修改\n\n尚未开始删除。",
        "## 8. 实际修改\n\n"
        "- 删除 6 个普通 Miki 资源路径，共 55 个资源文件：总 manifest、政治、药理学、JLPT、英语一真题、英语二真题。\n"
        "- 删除 4 个 Miki 专用生成/工作流文件：政治 workflow、政治生成脚本、JLPT 生成工具、药理学生成工具。\n"
        "- 总计删除 10 个明确路径、59 个已跟踪文件。\n"
        "- 保留 DYL 备用包、雅思词库、红宝书词库、红宝书生成链路和阅读器构建脚本。\n"
        "- 删除任务结束后不再需要的临时审计与清理 workflow/script；保留主任务日志、审计摘要和验证结果。",
    )
    log = replace_once(
        log,
        "### 自动测试\n\n待执行。\n\n### 手工验收\n\n待执行。",
        "### 自动测试\n\n"
        f"- npm ci: `{results['install']}`。\n"
        f"- unit（Vitest）: `{results['unit']}`。\n"
        f"- a11y lint（ESLint）: `{results['lint']}`。\n"
        f"- production build: `{results['build']}`。\n"
        f"- Playwright Edge 安装: `{results['edgeInstall']}`。\n"
        f"- E2E（Playwright）: `{results['e2e']}`。\n"
        f"- git diff --check: `{results['diffCheck']}`。\n\n"
        "### 手工验收\n\n"
        "- 本任务未启动开发服务器、未登录账号，也未访问线上 Firebase/CloudBase。\n"
        "- 通过构建产物与自动测试验证阅读器代码和受保护词库仍可被打包。\n"
        "- DYL CloudBase 主链路仍需按既有门禁在真实站点单独验收。",
    )
    log = replace_once(
        log,
        "## 12. 未完成项\n\n"
        "- 删除实施。\n"
        "- 自动测试与构建。\n"
        "- PR 创建与合并。\n"
        "- CloudBase DYL 真实验收及 DYL 备用目录的最终删除。",
        "## 12. 未完成项\n\n"
        "- PR 创建、审阅与合并。\n"
        "- 部署后阅读器页面的真实浏览器冒烟测试。\n"
        "- CloudBase DYL 真实验收及 DYL 备用目录的最终删除。",
    )
    log = replace_once(
        log,
        "## 14. 最终结论\n\n当前状态：计划中。删除边界已通过仓库级静态引用审计确认，尚未执行破坏性删除。",
        "## 14. 最终结论\n\n"
        f"当前状态：{status}。普通 Miki 公共池已从清理分支移除；阅读器实际依赖和 DYL 备用目录均保留。"
        + ("全部必需自动验证通过，已具备创建 PR 的条件。" if overall_success else "存在未通过验证，PR 不应合并，需先处理验证失败。"),
    )
    LOG_PATH.write_text(log, encoding="utf-8")

    remove_temporary_paths()


if __name__ == "__main__":
    main()
