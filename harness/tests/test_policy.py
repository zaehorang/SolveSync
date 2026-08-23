"""하네스 공유 정책 테스트.

policy.py는 신뢰 경계다. 되돌릴 수 없는 변경과 저장소 사이에 서 있는 유일한
것이다. 그에 걸맞게 테스트한다.
"""

import os
import tempfile
import unittest
from pathlib import Path

import policy

WORKTREE = "/tmp/wt"


class ForbiddenPaths(unittest.TestCase):
    def test_build_artifacts_are_rejected(self):
        for path in ("dist/main.js", "node_modules/x/index.js", "coverage/lcov.info", "artifacts/x.zip"):
            self.assertIsNotNone(policy.forbidden_path_reason(path), path)

    def test_env_files_are_rejected_except_the_example(self):
        self.assertIsNotNone(policy.forbidden_path_reason(".env"))
        self.assertIsNotNone(policy.forbidden_path_reason(".env.local"))
        self.assertIsNone(policy.forbidden_path_reason(".env.example"))

    def test_source_files_are_allowed(self):
        self.assertIsNone(policy.forbidden_path_reason("src/shared/catalog.ts"))

    def test_leading_dot_slash_is_normalized(self):
        self.assertIsNotNone(policy.forbidden_path_reason("./dist/main.js"))

    def test_prefix_match_does_not_catch_similar_names(self):
        self.assertIsNone(policy.forbidden_path_reason("src/distance.ts"))


class Secrets(unittest.TestCase):
    def test_github_tokens_are_detected(self):
        text = "+const token = 'ghp_" + "a" * 36 + "'"
        self.assertTrue(policy.scan_secrets(text))

    def test_bearer_header_is_detected(self):
        self.assertTrue(policy.scan_secrets("Authorization: Bearer " + "a" * 32))

    def test_prose_about_bearer_headers_is_not_a_secret(self):
        # 이 오탐이 실제로 하네스 자신의 설계 문서를 막았다.
        self.assertEqual(policy.scan_secrets("secret scan: `Authorization: Bearer` 패턴을 본다"), [])
        self.assertEqual(policy.scan_secrets("send an Authorization: Bearer header"), [])

    def test_token_prefixes_mentioned_in_prose_are_not_secrets(self):
        self.assertEqual(policy.scan_secrets("prefixes: ghp_, github_pat_, gho_, ghu_, ghs_"), [])

    def test_ordinary_code_is_clean(self):
        self.assertEqual(policy.scan_secrets("const label = 'github token';"), [])

    def test_policy_source_does_not_trip_its_own_patterns(self):
        source = Path(policy.__file__).read_text()
        self.assertEqual(policy.scan_secrets(source), [])



class BashRules(unittest.TestCase):
    """shell 명령에 붙는 규칙.

    게시와 저장소 밖 경로를 막지 않는 것이 핵심이다. 막으면 worktree 규칙이 그
    자리에서 막힌다. 정확히 하네스가 강제하려는 것이다.
    """

    def check(self, command, in_main_worktree=False):
        return policy.check_bash(command, WORKTREE, in_main_worktree=in_main_worktree)

    def test_denied_command_hidden_behind_an_operator_is_still_caught(self):
        self.assertIsNotNone(self.check("npm test && git commit -n -m x"))
        self.assertIsNotNone(self.check("echo hi; git commit --no-verify -m x"))
        self.assertIsNotNone(self.check("VAR=1 sudo npm install -g x"))

    def test_workflow_commands_are_allowed(self):
        self.assertIsNone(self.check("gh issue create --title x --body y"))
        self.assertIsNone(self.check("gh pr create --fill"))
        self.assertIsNone(self.check("gh api /repos/x/y"))
        self.assertIsNone(self.check("git push --force-with-lease"))
        self.assertIsNone(self.check("git worktree add -b feat/issue-20-x ../SolveSync-wt/x main"))
        self.assertIsNone(self.check("git config core.hooksPath harness/hooks"))

    def test_paths_outside_the_repository_are_allowed(self):
        # scratchpad와 memory는 저장소 밖이고 대화형 세션의 정상 작업이다.
        self.assertIsNone(self.check("cat /tmp/scratch/notes.md"))
        self.assertIsNone(self.check("cat /Users/someone/.claude/projects/x/memory/MEMORY.md"))
        self.assertIsNone(self.check("cat ../SolveSync/AGENTS.md"))

    def test_gate_bypass_is_still_denied(self):
        self.assertIsNotNone(self.check("git commit --no-verify -m 'feat: x'"))
        self.assertIsNotNone(self.check("git commit -n -m 'feat: x'"))

    def test_global_install_is_denied(self):
        self.assertIsNotNone(self.check("npm install -g something"))

    def test_publishing_the_package_is_not_the_harness_business(self):
        """하네스는 되돌릴 수 없는 피해만 막는다. private 저장소의 npm publish는 그게 아니다."""
        self.assertIsNone(self.check("npm publish"))

    def test_branch_switching_in_the_main_worktree_is_denied(self):
        for command in (
            "git checkout main",
            "git checkout feat/issue-20-x",
            "git checkout -b feat/issue-20-x",
            "git switch main",
            "git switch -c feat/issue-20-x",
            "npm test && git checkout main",
        ):
            self.assertIsNotNone(self.check(command, in_main_worktree=True), command)

    def test_branch_switching_inside_a_worktree_is_allowed(self):
        self.assertIsNone(self.check("git checkout feat/issue-20-x"))
        self.assertIsNone(self.check("git switch -c feat/issue-20-x"))

    def test_restoring_a_file_is_not_branch_switching(self):
        self.assertIsNone(self.check("git checkout -- src/shared/catalog.ts", in_main_worktree=True))
        self.assertIsNone(self.check("git restore src/shared/catalog.ts", in_main_worktree=True))

    def test_reading_and_inspecting_the_main_worktree_is_allowed(self):
        for command in ("git status --short", "git fetch --prune origin", "git log --oneline -5"):
            self.assertIsNone(self.check(command, in_main_worktree=True), command)



class WorktreeIsolation(unittest.TestCase):
    """실측값 기준. 주 worktree는 두 경로가 같고 linked worktree는 다르다."""

    def test_main_worktree_is_denied(self):
        self.assertIsNotNone(policy.check_worktree_isolation(".git", ".git"))

    def test_linked_worktree_is_allowed(self):
        self.assertIsNone(
            policy.check_worktree_isolation(
                "/repo/.git/worktrees/worktree-isolation-gate", "/repo/.git"
            )
        )

    def test_absolute_and_relative_forms_of_the_same_directory_match(self):
        self.assertIsNotNone(
            policy.check_worktree_isolation(os.path.abspath(".git"), ".git")
        )

    def test_reason_tells_the_reader_what_to_do_instead(self):
        reason = policy.check_worktree_isolation(".git", ".git")
        self.assertIn("worktree add", reason)


class FileWriteRules(unittest.TestCase):
    """Claude Code의 Write/Edit이 보는 규칙."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.worktree = Path(self.tmp.name)
        (self.worktree / "src" / "shared").mkdir(parents=True)
        self.addCleanup(self.tmp.cleanup)

    def test_absolute_paths_inside_the_worktree_are_relativised(self):
        self.assertEqual(
            policy.relative_to_worktree(str(self.worktree / "src/shared/catalog.ts"), self.worktree),
            "src/shared/catalog.ts",
        )

    def test_paths_outside_the_worktree_have_no_relative_form(self):
        self.assertIsNone(policy.relative_to_worktree("/etc/passwd", self.worktree))

    def test_logic_sources_are_not_gated_on_a_sibling_test(self):
        """테스트 관례는 CLAUDE.md의 Do로 남기고 gate에서는 뺐다.

        파일 존재만 보는 gate는 빈 테스트 파일 하나로 통과하므로 막을 사고가 없었다.
        """
        self.assertIsNone(
            policy.check_file_write([str(self.worktree / "src/shared/catalog.ts")], self.worktree)
        )

    def test_forbidden_paths_are_denied(self):
        self.assertIsNotNone(
            policy.check_file_write([str(self.worktree / "dist/main.js")], self.worktree)
        )
        self.assertIsNotNone(policy.check_file_write([".env"], self.worktree))

    def test_paths_outside_the_repository_are_allowed(self):
        # scratchpad와 memory는 저장소 밖이고 대화형 세션의 정상 작업이다.
        self.assertIsNone(policy.check_file_write(["/tmp/scratch/notes.md"], self.worktree))



class BranchName(unittest.TestCase):
    def test_every_documented_branch_type_passes(self):
        """CLAUDE.md가 안내하는 형식이 gate를 통과하지 못하면 아무도 커밋하지 못한다."""
        for branch_type in policy.BRANCH_TYPES:
            branch = f"{branch_type}/shrink-harness"
            self.assertIsNone(policy.check_branch_name(branch), branch)

    def test_names_without_an_issue_number_are_allowed(self):
        """이슈는 선택이다. 번호를 요구하던 gate는 커밋 시점이라 예방 효과가 없었다."""
        for branch in ("fix/pr-body-accuracy", "docs/swea-platform-contract", "feat/agent-harness-phase1"):
            self.assertIsNone(policy.check_branch_name(branch), branch)

    def test_names_that_still_carry_an_issue_number_keep_working(self):
        """살아있는 branch를 깨뜨리지 않는다. 번호는 slug의 일부로 통과한다."""
        self.assertIsNone(policy.check_branch_name("feat/issue-19-issue-first-workflow-gate"))

    def test_unknown_branch_types_are_rejected(self):
        for branch in ("agent/preview", "build/bundle", "perf/faster"):
            self.assertIsNotNone(policy.check_branch_name(branch), branch)

    def test_chore_and_ci_are_allowed(self):
        """맞는 type이 없으면 맞지 않는 type을 억지로 고르게 되고 history 신호가 흐려진다."""
        self.assertIsNone(policy.check_branch_name("chore/cleanup"))
        self.assertIsNone(policy.check_branch_name("ci/github-actions"))

    def test_missing_slug_is_rejected(self):
        for branch in ("feat/", "feat"):
            self.assertIsNotNone(policy.check_branch_name(branch), branch)

    def test_main_is_rejected(self):
        self.assertIsNotNone(policy.check_branch_name("main"))

    def test_nested_slug_is_rejected(self):
        self.assertIsNotNone(policy.check_branch_name("feat/slug/extra"))


class BranchNameDiagnosis(unittest.TestCase):
    """차단 사유가 실제 원인을 가리키는가.

    사유를 하나로 뭉뚱그리면 틀린 지시를 하게 된다. gate가 사람을 잘못된 방향으로
    보내면 없느니만 못하다.
    """

    def test_bad_type_reason_names_the_type(self):
        reason = policy.check_branch_name("chore2/ci-tests")
        self.assertIn("chore2", reason)

    def test_missing_type_is_reported_as_a_missing_type(self):
        reason = policy.check_branch_name("no-type-here")
        self.assertIn("type이 없습니다", reason)

    def test_bad_slug_is_reported_as_a_slug_problem(self):
        reason = policy.check_branch_name("feat/slug/extra")
        self.assertIn("slug", reason)

    def test_every_reason_names_the_expected_form_and_the_workflow_doc(self):
        for branch in ("main", "no-type-here", "chore2/x", "feat/a/b"):
            reason = policy.check_branch_name(branch)
            self.assertIn("{type}/{slug}", reason, branch)
            self.assertIn("CLAUDE.md", reason, branch)


if __name__ == "__main__":
    unittest.main()
