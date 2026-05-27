import type { LeetCodeSyncIndex } from "./indexFile";

export interface GitTreeFile {
  path: string;
  content: string;
}

export interface BuildGitTreeFilesInput {
  solutionPath: string;
  solutionContent: string;
  readmePath: string;
  readmeContent: string;
  indexPath: string;
  index: LeetCodeSyncIndex;
}

export function buildGitTreeFiles(input: BuildGitTreeFilesInput): GitTreeFile[] {
  return [
    {
      path: input.solutionPath,
      content: input.solutionContent
    },
    {
      path: input.readmePath,
      content: input.readmeContent
    },
    {
      path: input.indexPath,
      content: `${JSON.stringify(input.index, null, 2)}\n`
    }
  ];
}
