"""하네스 공유 정책 테스트.

policy.py는 신뢰 경계다. model과 `git push` 사이, worktree 밖의 파일 사이,
테스트 없는 로직 코드 사이에 서 있는 유일한 것이다. 그에 걸맞게 테스트한다.
"""

import tempfile
import unittest
from pathlib import Path

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


if __name__ == "__main__":
    unittest.main()
