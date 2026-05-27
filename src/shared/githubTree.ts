import type { LeetCodeSyncIndex } from "./indexFile";

export interface GitTreeFile {
  path: string;
  content: string;
}

export interface BuildGitTreeFilesInput {
  solutionPath: string;
  solutionContent: string;
  readmeContent: string;
  index: LeetCodeSyncIndex;
}

export function buildGitTreeFiles(input: BuildGitTreeFilesInput): GitTreeFile[] {
  return [
    {
      path: input.solutionPath,
      content: input.solutionContent
    },
    {
      path: "README.md",
      content: input.readmeContent
    },
    {
      path: ".leetcode-sync/index.json",
      content: `${JSON.stringify(input.index, null, 2)}\n`
    }
  ];
}
