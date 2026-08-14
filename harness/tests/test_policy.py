"""하네스 공유 정책 테스트.

policy.py는 신뢰 경계다. model과 `git push` 사이, worktree 밖의 파일 사이,
테스트 없는 로직 코드 사이에 서 있는 유일한 것이다. 그에 걸맞게 테스트한다.
"""

import os
import tempfile
import unittest
from pathlib import Path

import cli
import policy

WORKTREE = "/tmp/wt"
HOME = "/Users/someone"


class ForbiddenPaths(unittest.TestCase):
    def test_build_artifacts_are_rejected(self):
        for path in ("dist/main.js", "node_modules/x/index.js", "coverage/lcov.info", ".harness/runs/x.json"):
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


class LogicSources(unittest.TestCase):
    def test_logic_directories_are_recognised(self):
        self.assertTrue(policy.is_logic_source("src/shared/catalog.ts"))
        self.assertTrue(policy.is_logic_source("src/background/sync.ts"))

    def test_ui_and_tests_are_not_logic_sources(self):
        self.assertFalse(policy.is_logic_source("src/options/main.ts"))
        self.assertFalse(policy.is_logic_source("src/content/observe.ts"))
        self.assertFalse(policy.is_logic_source("src/shared/catalog.test.ts"))
        self.assertFalse(policy.is_logic_source("docs/PRD.md"))

    def test_sibling_test_path(self):
        self.assertEqual(policy.sibling_test_path("src/shared/catalog.ts"), "src/shared/catalog.test.ts")


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
    def check(self, command):
        return policy.check_bash(command, WORKTREE, HOME)

    def test_push_and_publishing_are_denied(self):
        self.assertIsNotNone(self.check("git push origin HEAD"))
        self.assertIsNotNone(self.check("gh pr create --fill"))
        self.assertIsNotNone(self.check("gh issue comment 8 --body x"))
        self.assertIsNotNone(self.check("gh api /repos/x/y"))
        self.assertIsNotNone(self.check("npm publish"))

    def test_gate_bypass_is_denied(self):
        self.assertIsNotNone(self.check("git commit --no-verify -m 'feat: x'"))
        self.assertIsNotNone(self.check("git commit -n -m 'feat: x'"))

    def test_repository_surgery_is_denied(self):
        self.assertIsNotNone(self.check("git config core.hooksPath /tmp/evil"))
        self.assertIsNotNone(self.check("git worktree add ../other"))
        self.assertIsNotNone(self.check("git checkout main"))
        self.assertIsNotNone(self.check("git switch main"))
        self.assertIsNotNone(self.check("npm install -g something"))

    def test_denied_command_hidden_behind_an_operator_is_still_caught(self):
        self.assertIsNotNone(self.check("npm test && git push"))
        self.assertIsNotNone(self.check("echo hi; gh pr create"))
        self.assertIsNotNone(self.check("VAR=1 sudo git push"))

    def test_home_escape_is_denied(self):
        self.assertIsNotNone(self.check("cat ~/.ssh/id_rsa"))
        self.assertIsNotNone(self.check(f"cat {HOME}/.codex/config.toml"))

    def test_relative_escape_is_denied(self):
        # worktree는 ../<저장소이름> 옆에 만들어지므로 `..` 하나면 메인 체크아웃에
        # 닿는다. 이 구멍은 codex review가 찾았고 실제로 재현됐다.
        self.assertIsNotNone(self.check("cat ../SolveSync/AGENTS.md"))
        self.assertIsNotNone(self.check("echo evil > ../SolveSync/src/shared/x.ts"))
        self.assertIsNotNone(self.check("cat ../../etc/hosts"))

    def test_relative_paths_inside_the_worktree_are_allowed(self):
        self.assertIsNone(self.check("cat ./src/shared/catalog.ts"))
        self.assertIsNone(self.check("cat src/../src/shared/catalog.ts"))
        self.assertIsNone(self.check("git diff origin/main"))

    def test_ordinary_work_is_allowed(self):
        self.assertIsNone(self.check("npm test"))
        self.assertIsNone(self.check("git add -A && git commit -m 'feat: add revision column'"))
        self.assertIsNone(self.check("git status --short"))
        self.assertIsNone(self.check("npm run typecheck && npm run build"))
        self.assertIsNone(self.check("rg buildCatalog src/shared"))


class InteractiveBashRules(unittest.TestCase):
    """대화형 세션에 붙는 규칙.

    exec 규칙을 그대로 붙이면 이슈 우선 워크플로우와 worktree 규칙이 그 자리에서
    막힌다. 정확히 하네스가 강제하려는 두 가지다.
    """

    def check(self, command, in_main_worktree=False):
        return policy.check_bash(
            command,
            WORKTREE,
            HOME,
            context=policy.CONTEXT_INTERACTIVE,
            in_main_worktree=in_main_worktree,
        )

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
        self.assertIsNone(self.check(f"cat {HOME}/.claude/projects/x/memory/MEMORY.md"))
        self.assertIsNone(self.check("cat ../SolveSync/AGENTS.md"))

    def test_gate_bypass_is_still_denied(self):
        self.assertIsNotNone(self.check("git commit --no-verify -m 'feat: x'"))
        self.assertIsNotNone(self.check("git commit -n -m 'feat: x'"))

    def test_global_install_and_publish_are_still_denied(self):
        self.assertIsNotNone(self.check("npm install -g something"))
        self.assertIsNotNone(self.check("npm publish"))

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


class ExecContextIsUnchanged(unittest.TestCase):
    """컨텍스트를 도입해도 codex 경로의 판정은 그대로여야 한다."""

    def check(self, command):
        return policy.check_bash(command, WORKTREE, HOME, context=policy.CONTEXT_EXEC)

    def test_default_context_is_exec(self):
        self.assertEqual(
            policy.check_bash("git push", WORKTREE, HOME),
            self.check("git push"),
        )

    def test_publishing_and_repository_surgery_stay_denied(self):
        for command in (
            "git push origin HEAD",
            "gh pr create --fill",
            "gh issue comment 8 --body x",
            "gh api /repos/x/y",
            "git config core.hooksPath /tmp/evil",
            "git worktree add ../other",
            "git checkout main",
            "cat ../SolveSync/AGENTS.md",
        ):
            self.assertIsNotNone(self.check(command), command)


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
    """Claude Code의 Write/Edit이 보는 규칙. codex의 apply_patch와 같은 코어다."""

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

    def test_logic_without_a_test_is_denied(self):
        reason = policy.check_file_write(
            [str(self.worktree / "src/shared/catalog.ts")], self.worktree
        )
        self.assertIsNotNone(reason)
        self.assertIn("src/shared/catalog.test.ts", reason)

    def test_existing_sibling_test_allows_the_edit(self):
        (self.worktree / "src" / "shared" / "catalog.test.ts").write_text("")
        self.assertIsNone(
            policy.check_file_write([str(self.worktree / "src/shared/catalog.ts")], self.worktree)
        )

    def test_forbidden_paths_are_denied(self):
        self.assertIsNotNone(
            policy.check_file_write([str(self.worktree / "dist/main.js")], self.worktree)
        )
        self.assertIsNotNone(policy.check_file_write([".env"], self.worktree))

    def test_outside_paths_are_denied_in_exec_and_allowed_when_interactive(self):
        self.assertIsNotNone(policy.check_file_write(["/etc/passwd"], self.worktree))
        self.assertIsNone(
            policy.check_file_write(
                ["/tmp/scratch/notes.md"], self.worktree, policy.CONTEXT_INTERACTIVE
            )
        )

    def test_the_forbidden_path_rule_still_applies_inside_the_repository_when_interactive(self):
        self.assertIsNotNone(
            policy.check_file_write(
                [str(self.worktree / "dist/main.js")], self.worktree, policy.CONTEXT_INTERACTIVE
            )
        )


class ApplyPatchRules(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.worktree = Path(self.tmp.name)
        (self.worktree / "src" / "shared").mkdir(parents=True)
        self.addCleanup(self.tmp.cleanup)

    def patch(self, *entries):
        body = ["*** Begin Patch"]
        for operation, path in entries:
            body.append(f"*** {operation} File: {path}")
            body.append("+content")
        body.append("*** End Patch")
        return "\n".join(body)

    def test_logic_without_a_test_is_denied(self):
        reason = policy.check_apply_patch(self.patch(("Add", "src/shared/catalog.ts")), self.worktree)
        self.assertIsNotNone(reason)
        self.assertIn("src/shared/catalog.test.ts", reason)

    def test_existing_sibling_test_allows_the_edit(self):
        (self.worktree / "src" / "shared" / "catalog.test.ts").write_text("")
        self.assertIsNone(
            policy.check_apply_patch(self.patch(("Update", "src/shared/catalog.ts")), self.worktree)
        )

    def test_test_written_in_the_same_patch_allows_the_edit(self):
        patch = self.patch(("Add", "src/shared/catalog.test.ts"), ("Add", "src/shared/catalog.ts"))
        self.assertIsNone(policy.check_apply_patch(patch, self.worktree))

    def test_writing_only_a_test_is_always_allowed(self):
        self.assertIsNone(
            policy.check_apply_patch(self.patch(("Add", "src/shared/catalog.test.ts")), self.worktree)
        )

    def test_non_logic_files_need_no_test(self):
        self.assertIsNone(policy.check_apply_patch(self.patch(("Update", "docs/PRD.md")), self.worktree))
        self.assertIsNone(
            policy.check_apply_patch(self.patch(("Update", "src/options/main.ts")), self.worktree)
        )

    def test_deleting_logic_needs_no_test(self):
        self.assertIsNone(
            policy.check_apply_patch(self.patch(("Delete", "src/shared/catalog.ts")), self.worktree)
        )

    def test_paths_outside_the_worktree_are_denied(self):
        self.assertIsNotNone(policy.check_apply_patch(self.patch(("Add", "/etc/passwd")), self.worktree))
        self.assertIsNotNone(
            policy.check_apply_patch(self.patch(("Add", "../elsewhere/x.ts")), self.worktree)
        )

    def test_forbidden_paths_are_denied(self):
        self.assertIsNotNone(policy.check_apply_patch(self.patch(("Add", "dist/main.js")), self.worktree))

    def test_payload_without_file_headers_is_allowed(self):
        self.assertIsNone(policy.check_apply_patch("no file headers here", self.worktree))


class BranchName(unittest.TestCase):
    def test_harness_generated_names_pass(self):
        """gate와 harness가 어긋나면 하네스가 자기 branch에서 커밋하지 못한다."""
        for branch_type in policy.BRANCH_TYPES:
            plan = {"branchType": branch_type, "issueNumber": 19, "slug": "issue-first-workflow-gate"}
            self.assertIsNone(policy.check_branch_name(cli.branch_name(plan)), branch_type)

    def test_names_without_an_issue_number_are_rejected(self):
        for branch in ("fix/pr-body-accuracy", "docs/swea-platform-contract", "feat/agent-harness-phase1"):
            self.assertIsNotNone(policy.check_branch_name(branch), branch)

    def test_unknown_branch_types_are_rejected(self):
        for branch in ("ci/issue-19-github-actions", "agent/issue-19-preview", "chore/issue-19-cleanup"):
            self.assertIsNotNone(policy.check_branch_name(branch), branch)

    def test_missing_slug_is_rejected(self):
        for branch in ("feat/issue-19-", "feat/issue-19", "feat/issue--slug"):
            self.assertIsNotNone(policy.check_branch_name(branch), branch)

    def test_main_is_rejected(self):
        self.assertIsNotNone(policy.check_branch_name("main"))

    def test_nested_slug_is_rejected(self):
        self.assertIsNotNone(policy.check_branch_name("feat/issue-19-slug/extra"))

    def test_reason_names_the_branch_and_the_expected_form(self):
        reason = policy.check_branch_name("fix/pr-body-accuracy")
        self.assertIn("fix/pr-body-accuracy", reason)
        self.assertIn("issue-", reason)


if __name__ == "__main__":
    unittest.main()
