#!/usr/bin/env python3
"""
Repo Scanner — deteksi struktur repository di root workspace (versi generik).

Mekanisme yang men-scan folder pada root project dan mendefinisikan mana
yang merupakan git repo (project) vs non-repo (docs/config/scripts).

Output:
  1. REPO_MAP.json  — canonical mapping, disimpan ke `.opencode/repo_map.json`
  2. Console summary — untuk quick check oleh agent/user

Cara pakai (dari root project):
  python scripts/repo_scan.py            # scan & tulis REPO_MAP.json
  python scripts/repo_scan.py --check    # verifikasi vs REPO_MAP.json (CI gate)

Skill asal: waypoint (section Multi-Repo Detection). Copy ke `scripts/`
saat init project baru — jangan edit langsung versi di skill.
"""

import argparse
import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MAP_FILE = ROOT / ".opencode" / "repo_map.json"


def git(args: list, cwd: Path) -> str:
    try:
        r = subprocess.run(
            ["git"] + args,
            cwd=str(cwd),
            capture_output=True,
            text=True,
            timeout=15,
        )
        return r.stdout.strip() if r.returncode == 0 else ""
    except Exception:
        return ""


def is_git_repo(path: Path) -> bool:
    # Repo asli = folder yang memiliki .git sendiri (dir atau file worktree).
    # JANGAN pakai `git rev-parse --git-dir` saja: saat root adalah git repo,
    # subfolder apa pun akan "menemukan" .git di parent → false positive.
    return (path / ".git").exists()


def scan() -> dict:
    entries = []
    for item in sorted(ROOT.iterdir()):
        if not item.is_dir() or item.name.startswith("."):
            continue
        if not is_git_repo(item):
            entries.append({"folder": item.name, "is_repo": False})
            continue
        entries.append(
            {
                "folder": item.name,
                "is_repo": True,
                "branch": git(["branch", "--show-current"], item) or "-",
                "remote": git(["config", "--get", "remote.origin.url"], item) or None,
                "dirty": git(["status", "--porcelain"], item) != "",
            }
        )
    result = {
        "project": ROOT.name,
        "root": str(ROOT),
        "root_is_git": is_git_repo(ROOT),
        "scanned_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        "repos": entries,
        "repo_count": sum(1 for e in entries if e["is_repo"]),
        "non_repo_count": sum(1 for e in entries if not e["is_repo"]),
    }
    return result


def print_summary(data: dict) -> None:
    print(f"Project: {data['project']}  |  Root: {data['root']}")
    print(f"Root is git repo: {'YES' if data['root_is_git'] else 'NO'}")
    print(f"Total repos: {data['repo_count']}  |  Non-repo folders: {data['non_repo_count']}")
    print("-" * 70)
    for e in data["repos"]:
        if e["is_repo"]:
            dirty = " DIRTY" if e["dirty"] else ""
            print(
                f"  [REPO ] {e['folder']:<28} branch={e['branch']:<10} "
                f"remote={e['remote'] or '-'}{dirty}"
            )
        else:
            print(f"  [DIR  ] {e['folder']}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Repo scanner untuk workspace")
    parser.add_argument("--check", action="store_true", help="Verifikasi vs REPO_MAP.json (exit 1 jika beda)")
    args = parser.parse_args()

    data = scan()

    if args.check:
        if not MAP_FILE.exists():
            print(f"MISSING {MAP_FILE} — jalankan scan dulu", file=sys.stderr)
            return 1
        prev = json.loads(MAP_FILE.read_text(encoding="utf-8"))
        prev_map = {e["folder"]: e["is_repo"] for e in prev["repos"]}
        cur_map = {e["folder"]: e["is_repo"] for e in data["repos"]}
        if prev_map != cur_map:
            print("REPO_MAP DESYNC", file=sys.stderr)
            print("  prev:", prev_map, file=sys.stderr)
            print("  curr:", cur_map, file=sys.stderr)
            return 1
        print("REPO_MAP OK — struktur repo konsisten.")
        return 0

    MAP_FILE.parent.mkdir(parents=True, exist_ok=True)
    MAP_FILE.write_text(
        json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print_summary(data)
    print(f"\nSaved -> {MAP_FILE.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
