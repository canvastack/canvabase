#!/usr/bin/env python3
"""
Waypoint Checker — verifikasi konsistensi state waypoint (hard gate).

Memvalidasi 5 invariant setelah fase selesai:
  1. Setiap fase (1..N) punya >=1 WO di `.opencode/archive/sprints/`
  2. Setiap `phase-NN.json` punya `handoff_ref` yang menunjuk ke WO yang ADA
  3. `handoff.md` (.opencode/phase_state/<project>/) mencakup semua fase
  4. Setiap WO punya field kanonik lengkap
  5. `phase` di WO dalam rentang valid

Cara pakai (dari root project):
  python scripts/waypoint_check.py             # laporkan gap (exit 1 jika ada)
  python scripts/waypoint_check.py --check     # alias: exit 1 jika gap
  python scripts/waypoint_check.py --project slug   # override project slug

Skill asal: waypoint (section Waypoint Hard Gate). Copy ke `scripts/`
saat init project baru — jangan edit langsung versi di skill.
"""

import argparse
import glob
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SPRINTS_DIR = ROOT / ".opencode" / "archive" / "sprints"
PHASES_DIR = ROOT / ".opencode" / "archive" / "phases"

# Field kanonik wajib per WO (schema duration-based + status)
WO_REQUIRED_FIELDS = [
    "wo_id", "type", "task", "phase", "status",
    "started", "completed", "duration_minutes", "files_changed", "summary",
]

# Field yang dicek kehadiran key-nya (bukan nilai) — karena nilai valid bisa 0 / []
WO_KEY_PRESENCE_ONLY = {"duration_minutes", "files_changed", "findings_resolved", "findings_created"}

# Field kanonik wajib per phase JSON
PHASE_REQUIRED_FIELDS = ["phase", "name", "gate", "status", "tasks", "handoff_ref"]


def load_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def wo_phase_map() -> dict:
    """{phase: [wo_id, ...]} dari semua WO di sprints/."""
    result = {}
    for f in glob.glob(str(SPRINTS_DIR / "WO-*.json")):
        d = load_json(Path(f))
        if not d:
            continue
        ph = d.get("phase")
        if isinstance(ph, int):
            result.setdefault(ph, []).append(d.get("wo_id"))
    return result


def wo_duration(wo_id: str) -> int:
    """Duration minutes dari WO (0 jika tidak ada/legacy)."""
    d = load_json(SPRINTS_DIR / f"{wo_id}.json")
    if not d:
        return 0
    dur = d.get("duration_minutes")
    return dur if isinstance(dur, (int, float)) else 0


def phase_files() -> list:
    return sorted(glob.glob(str(PHASES_DIR / "phase-*.json")), key=_phase_sort_key)


def _phase_sort_key(path: str) -> int:
    m = re.search(r"phase-(\d+)\.json", path)
    return int(m.group(1)) if m else 0


def handoff_covered(project: str) -> set:
    hf = ROOT / ".opencode" / "phase_state" / project / "handoff.md"
    if not hf.exists():
        return set()
    text = hf.read_text(encoding="utf-8")
    return {int(m) for m in re.findall(r"Phase (\d+):", text)}


def check(project: str) -> tuple:
    issues = []

    # 1. Setiap fase punya >=1 WO
    wos = wo_phase_map()
    phases = phase_files()
    phase_nums = sorted({json.loads(Path(f).read_text(encoding="utf-8")).get("phase")
                         for f in phases if load_json(Path(f))})
    for ph in phase_nums:
        if not wos.get(ph):
            issues.append(f"FASE {ph}: tidak punya WO di archive/sprints/")

    # 2. handoff_ref valid
    for f in phases:
        d = load_json(Path(f))
        if not d:
            issues.append(f"{Path(f).name}: bukan JSON valid")
            continue
        h = d.get("handoff_ref")
        if not h:
            issues.append(f"{Path(f).name}: handoff_ref kosong")
        elif not (SPRINTS_DIR / f"{h}.json").exists():
            issues.append(f"{Path(f).name}: handoff_ref '{h}' tidak ada di sprints/")

    # 3. handoff.md mencakup fase dengan WO ber-duration nyata
    #    (fase backfill batch duration=0 dianggap legacy, tanpa narasi sesi nyata)
    covered = handoff_covered(project)
    active_phases = sorted(
        ph for ph, lst in wos.items()
        if any(wo_duration(w) > 0 for w in lst)
    )
    missing = [ph for ph in active_phases if ph not in covered]
    if missing:
        issues.append(f"handoff.md tidak mencakup fase: {missing}")

    # 4. Field kanonik lengkap
    for f in sorted(glob.glob(str(SPRINTS_DIR / "WO-*.json"))):
        d = load_json(Path(f))
        if not d:
            issues.append(f"{Path(f).name}: bukan JSON valid")
            continue
        missing_fields = [
            k for k in WO_REQUIRED_FIELDS
            if k not in d or (k not in WO_KEY_PRESENCE_ONLY and not d.get(k))
        ]
        if missing_fields:
            issues.append(f"{d.get('wo_id', Path(f).name)}: missing {missing_fields}")

    # 5. phase dalam rentang valid
    for ph, lst in wos.items():
        if not (1 <= ph <= max(phase_nums, default=0)):
            issues.append(f"WO {lst}: phase {ph} di luar rentang 1-{max(phase_nums, default=0)}")

    return issues, phase_nums


def main() -> int:
    parser = argparse.ArgumentParser(description="Waypoint hard gate checker")
    parser.add_argument("--check", action="store_true", help="Exit 1 jika ada gap")
    parser.add_argument("--project", default=None, help="Project slug (default: ROOT.name)")
    args = parser.parse_args()

    project = args.project or ROOT.name
    issues, phase_nums = check(project)

    if issues:
        print(f"WAYPOINT CHECK FAIL — {len(issues)} issue(s) di project '{project}'")
        for i in issues:
            print(f"  - {i}")
        print(f"\nCovered phases: {phase_nums}")
        return 1

    print(f"WAYPOINT CHECK OK — {len(phase_nums)} phase, konsisten (WO + handoff + phase JSON).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
