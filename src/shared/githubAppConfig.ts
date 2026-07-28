export const GITHUB_APP_CLIENT_ID =
  import.meta.env.VITE_GITHUB_APP_CLIENT_ID?.trim() ?? "";

const GITHUB_APP_SLUG =
  import.meta.env.VITE_GITHUB_APP_SLUG?.trim() ?? "";

export function getGitHubAppInstallationUrl(): string | null {
  return GITHUB_APP_SLUG.length === 0
    ? null
    : `https://github.com/apps/${encodeURIComponent(
        GITHUB_APP_SLUG
      )}/installations/new`;
}
