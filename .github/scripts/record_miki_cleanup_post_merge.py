from __future__ import annotations

from pathlib import Path

ROOT = Path.cwd()
LOG = ROOT / "TASK_LOGS/2026-08-03-0210-miki-public-pool-cleanup.md"
TITLE = "## 13. Post-merge Update（2026-08-03）"

section = f"""

{TITLE}

- PR `mirrorlious/-#22` 已通过 squash 合并到 `main`。
- 合并提交：`5c99c5980413635367d08f1b51ad409801bdc413`。
- 合并后静态核验：`public-resources/manifest.json` 与 `scripts/build-politics-pack.py` 已不存在。
- 合并后保护核验：`public-resources/dyl-exam-public-backup/manifest.json` 与雅思词库 JSON 仍存在。
- Vercel 未进入应用构建，状态因账户 `build-rate-limit` 被平台拦截；这不是代码构建失败。仓库内 production build 已通过。
- 后续只剩：部署额度恢复后的阅读器页面冒烟测试，以及 CloudBase DYL 登录、chunk、媒体真实验收。
- `dyl-exam-public-backup/` 仍受门禁保护，必须通过独立任务删除。
"""

text = LOG.read_text(encoding="utf-8")
if TITLE not in text:
    LOG.write_text(text.rstrip() + section + "\n", encoding="utf-8")

for value in (
    ".github/scripts/record_miki_cleanup_post_merge.py",
    ".github/workflows/record-miki-cleanup-post-merge.yml",
    ".record-miki-cleanup-post-merge-trigger",
):
    path = ROOT / value
    if path.exists():
        path.unlink()
