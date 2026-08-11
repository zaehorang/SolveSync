"""Tests for the deterministic plan checks.

A plan that fails these costs one cheap re-run. A plan that passes them and is
still wrong costs an exec round, so these checks exist to catch everything that
can be decided without a model.
"""

import copy
import tempfile
import unittest
from pathlib import Path

import cli


def make_repo(tmp: Path) -> Path:
    (tmp / "src" / "shared").mkdir(parents=True)
    (tmp / "docs").mkdir()
    (tmp / "src" / "shared" / "catalog.ts").write_text("")
    (tmp / "docs" / "PRD.md").write_text("")
    return tmp


VALID_PLAN = {
    "issueNumber": 8,
    "status": "ready",
    "statusReason": None,
    "branchType": "feat",
    "slug": "catalog-revision",
    "summary": "Solution Catalog에 revision 열을 추가한다.",
    "groundedIn": ["docs/PRD.md", "src/shared/catalog.ts"],
    "acceptanceCriteria": ["같은 문제·언어를 재제출하면 revision이 1 증가한다"],
    "touchedPaths": ["src/shared/catalog.ts", "src/shared/catalog.test.ts", "docs/PRD.md"],
    "docsToUpdate": ["docs/PRD.md"],
    "phases": [
        {
            "title": "revision 열 추가",
            "commitMessage": "feat: add revision column to solution catalog",
            "verifies": ["재제출 시 revision이 증가한다"],
            "tasks": [
                {"kind": "test", "file": "src/shared/catalog.test.ts", "detail": "증가 케이스 추가"},
                {"kind": "impl", "file": "src/shared/catalog.ts", "detail": "revision 계산"},
                {"kind": "docs", "file": "docs/PRD.md", "detail": "문서 반영"},
            ],
        }
    ],
    "outOfScope": ["기존 저장소 마이그레이션"],
}


class PlanValidation(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = make_repo(Path(self.tmp.name))
        self.addCleanup(self.tmp.cleanup)

    def check(self, mutate=None):
        plan = copy.deepcopy(VALID_PLAN)
        if mutate:
            mutate(plan)
        return cli.validate_plan(plan, self.root)

    def test_valid_plan_passes(self):
        result = self.check()
        self.assertEqual(result["problems"], [])
        self.assertIsNone(result["demote"])

    def test_blocked_plan_only_needs_a_reason(self):
        result = self.check(lambda p: p.update(status="blocked", statusReason="요구가 모호하다"))
        self.assertEqual(result["problems"], [])

    def test_blocked_plan_without_a_reason_fails(self):
        result = self.check(lambda p: p.update(status="blocked", statusReason=None))
        self.assertTrue(result["problems"])

    def test_grounded_paths_must_exist(self):
        result = self.check(lambda p: p.update(groundedIn=["src/shared/imaginary.ts"]))
        self.assertTrue(any("does not exist" in problem for problem in result["problems"]))

    def test_logic_phase_must_start_with_a_test_task(self):
        def mutate(plan):
            tasks = plan["phases"][0]["tasks"]
            tasks[0], tasks[1] = tasks[1], tasks[0]

        result = self.check(mutate)
        self.assertTrue(any("first task must be kind=test" in problem for problem in result["problems"]))

    def test_logic_task_without_a_matching_test_fails(self):
        def mutate(plan):
            plan["phases"][0]["tasks"] = [
                {"kind": "test", "file": "src/shared/other.test.ts", "detail": "x"},
                {"kind": "impl", "file": "src/shared/catalog.ts", "detail": "y"},
            ]
            plan["touchedPaths"].append("src/shared/other.test.ts")

        result = self.check(mutate)
        self.assertTrue(any("has no test" in problem for problem in result["problems"]))

    def test_task_files_must_be_declared_in_touched_paths(self):
        result = self.check(lambda p: p["touchedPaths"].remove("docs/PRD.md"))
        self.assertTrue(any("missing from touchedPaths" in problem for problem in result["problems"]))

    def test_commit_message_must_be_conventional(self):
        result = self.check(lambda p: p["phases"][0].update(commitMessage="add revision column"))
        self.assertTrue(any("not conventional" in problem for problem in result["problems"]))

    def test_kind_test_task_must_point_at_a_test_file(self):
        def mutate(plan):
            plan["phases"][0]["tasks"][0]["file"] = "src/shared/catalog.ts"

        result = self.check(mutate)
        self.assertTrue(any("must point at a *.test.ts" in problem for problem in result["problems"]))

    def test_missing_acceptance_criteria_fails(self):
        result = self.check(lambda p: p.update(acceptanceCriteria=[]))
        self.assertTrue(result["problems"])

    def test_oversized_plan_is_demoted_not_rejected(self):
        def mutate(plan):
            phase = plan["phases"][0]
            plan["phases"] = [copy.deepcopy(phase) for _ in range(cli.MAX_PHASES + 1)]

        result = self.check(mutate)
        self.assertEqual(result["problems"], [])
        self.assertIn("phases exceeds", result["demote"])

    def test_too_many_touched_paths_is_demoted(self):
        def mutate(plan):
            plan["touchedPaths"] += [f"docs/extra-{i}.md" for i in range(cli.MAX_TOUCHED_PATHS)]

        result = self.check(mutate)
        self.assertIn("touched paths exceeds", result["demote"])


class PlanSummary(unittest.TestCase):
    def test_summary_lists_every_planned_commit(self):
        text = cli.render_plan_summary(VALID_PLAN)
        self.assertIn("feat/issue-8-catalog-revision", text)
        self.assertIn("feat: add revision column to solution catalog", text)
        self.assertIn("기존 저장소 마이그레이션", text)


class PullRequestBody(unittest.TestCase):
    def test_body_uses_measured_numbers_not_prose(self):
        check = {
            "verify": {
                "passed": True,
                "steps": [
                    {"step": "typecheck", "passed": True},
                    {"step": "test", "passed": True, "testsPassed": 236},
                    {"step": "build", "passed": True},
                ],
            },
            "commits": {
                "commits": [{"sha": "abc123", "subject": "feat: add revision column to solution catalog"}],
                "notes": [],
            },
        }
        evaluation = {"verdict": "pass", "findings": []}
        body = cli.render_pr_body(VALID_PLAN, check, evaluation, rounds=1)
        self.assertIn("(236 passed)", body)
        self.assertIn("Fixes #8", body)
        self.assertIn("🤖 SolveSync harness", body)


class Batching(unittest.TestCase):
    def plan(self, number, *paths):
        return {"issueNumber": number, "touchedPaths": list(paths)}

    def test_disjoint_issues_run_together(self):
        plans = [self.plan(1, "src/a.ts"), self.plan(2, "src/b.ts")]
        self.assertEqual(cli.plan_batches(plans, max_parallel=2), [[1, 2]])

    def test_overlapping_issues_are_separated(self):
        plans = [self.plan(1, "src/a.ts"), self.plan(2, "src/a.ts")]
        self.assertEqual(cli.plan_batches(plans, max_parallel=2), [[1], [2]])

    def test_parallel_limit_is_respected(self):
        plans = [self.plan(n, f"src/{n}.ts") for n in (1, 2, 3)]
        self.assertEqual(cli.plan_batches(plans, max_parallel=2), [[1, 2], [3]])

    def test_partial_overlap_still_separates(self):
        plans = [
            self.plan(1, "src/a.ts", "src/shared.ts"),
            self.plan(2, "src/b.ts", "src/shared.ts"),
            self.plan(3, "src/c.ts"),
        ]
        self.assertEqual(cli.plan_batches(plans, max_parallel=2), [[1, 3], [2]])

    def test_paths_are_normalized_before_comparing(self):
        plans = [self.plan(1, "./src/a.ts"), self.plan(2, "src/a.ts")]
        self.assertEqual(cli.plan_batches(plans, max_parallel=2), [[1], [2]])


class Gates(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.worktree = Path(self.tmp.name)
        self.addCleanup(self.tmp.cleanup)

    def test_a_worktree_without_the_harness_is_reported(self):
        # git skips hooks silently when core.hooksPath is missing, so a worktree
        # branched off a base that lacks the harness has no gate at all.
        self.assertEqual(sorted(cli.missing_gates(self.worktree)), sorted(cli.GATE_FILES))

    def test_a_complete_worktree_reports_nothing(self):
        for name in cli.GATE_FILES:
            path = self.worktree / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("")
        self.assertEqual(cli.missing_gates(self.worktree), [])

    def test_a_partially_present_harness_still_fails(self):
        path = self.worktree / cli.GATE_FILES[0]
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("")
        self.assertTrue(cli.missing_gates(self.worktree))


class Titles(unittest.TestCase):
    def test_title_is_the_first_sentence(self):
        plan = {"summary": "첫 문장이다. 두 번째 문장은 빠진다.", "slug": "x"}
        self.assertEqual(cli.pr_title(plan), "첫 문장이다")

    def test_title_is_bounded(self):
        self.assertLessEqual(len(cli.pr_title({"summary": "가" * 200, "slug": "x"})), 70)


class Findings(unittest.TestCase):
    def test_findings_render_as_actionable_instructions(self):
        text = cli.render_findings(
            {
                "findings": [
                    {
                        "severity": "blocker",
                        "file": "src/shared/catalog.ts",
                        "line": 12,
                        "problem": "revision이 실패한 커밋에도 증가한다",
                        "requiredChange": "commit 성공 후에만 증가시킨다",
                    }
                ]
            }
        )
        self.assertIn("src/shared/catalog.ts:12", text)
        self.assertIn("Required: commit 성공 후에만 증가시킨다", text)

    def test_no_findings_renders_nothing(self):
        self.assertEqual(cli.render_findings({"findings": []}), "")


if __name__ == "__main__":
    unittest.main()
