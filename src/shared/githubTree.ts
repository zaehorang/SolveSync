import type { SolutionCatalog } from "./solutionCatalog";

export interface GitTreeFile {
  path: string;
  content: string;
}

export interface BuildGitTreeFilesInput {
  solutionPath: string;
  solutionContent: string;
  solutionReadmePath: string;
  readmeContent: string;
  solutionCatalogPath: string;
  solutionCatalog: SolutionCatalog;
}

export function buildGitTreeFiles(input: BuildGitTreeFilesInput): GitTreeFile[] {
  return [
    {
      path: input.solutionPath,
      content: input.solutionContent
    },
    {
      path: input.solutionReadmePath,
      content: input.readmeContent
    },
    {
      path: input.solutionCatalogPath,
      content: `${JSON.stringify(input.solutionCatalog, null, 2)}\n`
    }
  ];
}
