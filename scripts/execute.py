#!/usr/bin/env python3
"""CLI entrypoint for the Codex harness runner."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.harness.errors import BlockedStep, FailedStep, GitOperationError, PhaseValidationError
from scripts.harness.runner import HarnessConfig, HarnessRunner


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Harness Step Executor")
    parser.add_argument("phase_dir", help="Phase directory name (e.g. 0-mvp)")
    parser.add_argument("--push", action="store_true", help="Push branch after completion")
    args = parser.parse_args(argv)

    try:
        HarnessRunner(HarnessConfig(ROOT, args.phase_dir, args.push)).run()
    except BlockedStep as exc:
        print(f"\n  BLOCKED: {exc}")
        return 2
    except (FailedStep, GitOperationError, PhaseValidationError) as exc:
        print(f"\n  ERROR: {exc}")
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
