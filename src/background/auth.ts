import { normalizeError } from "../shared/errorNormalize";
import type { NormalizedError } from "../shared/errors";
import {
  STORAGE_SCHEMA_VERSION,
  type GitHubAccountSummary,
  type GitHubAuthSession
} from "../shared/storageSchema";
import type { IsoDateString } from "../shared/types";
import type { GitHubCredentialProvider } from "./client/github";
import type { ExtensionStorage, StorageAreaAdapter } from "./storage";

const GITHUB_WEB_BASE_URL = "https://github.com";
const GITHUB_API_BASE_URL = "https://api.github.com";
const ACCESS_TOKEN_REFRESH_WINDOW_MS = 5 * 60 * 1000;
const PENDING_AUTH_STORAGE_KEY = "githubPendingAuth";

export type GitHubAuthFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export interface PendingGitHubAuth {
  version: 1;
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresAt: IsoDateString;
  intervalSeconds: number;
  createdAt: IsoDateString;
}

export interface PublicPendingGitHubAuth {
  userCode: string;
  verificationUri: string;
  expiresAt: IsoDateString;
  intervalSeconds: number;
}

export type GitHubAuthPollResult =
  | {
      status: "pending";
      pending: PublicPendingGitHubAuth;
    }
  | {
      status: "connected";
      account: GitHubAccountSummary;
    };

export interface PendingGitHubAuthStorage {
  get(): Promise<PendingGitHubAuth | null>;
  save(pending: PendingGitHubAuth): Promise<void>;
  clear(): Promise<void>;
}

export interface GitHubAuthManager extends GitHubCredentialProvider {
  start(): Promise<PublicPendingGitHubAuth>;
  readPending(): Promise<PublicPendingGitHubAuth | null>;
  poll(): Promise<GitHubAuthPollResult>;
  disconnect(): Promise<void>;
}

export interface GitHubAuthManagerOptions {
  clientId: string;
  storage: ExtensionStorage;
  pendingStorage: PendingGitHubAuthStorage;
  fetchImpl?: GitHubAuthFetch;
  now?: () => Date;
  githubWebBaseUrl?: string;
  githubApiBaseUrl?: string;
}

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  refresh_token_expires_in: number;
  token_type: string;
}

interface DeviceFlowErrorResponse {
  error: string;
  error_description?: string;
  interval?: number;
}

interface GitHubUserResponse {
  id: number;
  login: string;
  avatar_url?: string | null;
}

export function createPendingGitHubAuthStorage(
  area: StorageAreaAdapter
): PendingGitHubAuthStorage {
  return {
    async get() {
      const values = await area.get(PENDING_AUTH_STORAGE_KEY);
      return parsePendingGitHubAuth(values[PENDING_AUTH_STORAGE_KEY]);
    },
    async save(pending) {
      await area.set({ [PENDING_AUTH_STORAGE_KEY]: pending });
    },
    async clear() {
      await area.remove(PENDING_AUTH_STORAGE_KEY);
    }
  };
}

export function createGitHubAuthManager(
  options: GitHubAuthManagerOptions
): GitHubAuthManager {
  const fetchImpl = options.fetchImpl ?? defaultFetch;
  const now = options.now ?? (() => new Date());
  const githubWebBaseUrl = options.githubWebBaseUrl ?? GITHUB_WEB_BASE_URL;
  const githubApiBaseUrl = options.githubApiBaseUrl ?? GITHUB_API_BASE_URL;
  let refreshInFlight: Promise<string> | null = null;

  async function start(): Promise<PublicPendingGitHubAuth> {
    assertConfigured(options.clientId);
    const response = await postForm<DeviceCodeResponse>(
      fetchImpl,
      new URL("/login/device/code", githubWebBaseUrl),
      {
        client_id: options.clientId
      }
    );
    if (!isDeviceCodeResponse(response)) {
      throw explicitError(
        "github_auth_failed",
        "GitHub returned a malformed device-flow response."
      );
    }
    const createdAt = now();
    const pending: PendingGitHubAuth = {
      version: 1,
      deviceCode: response.device_code,
      userCode: response.user_code,
      verificationUri: response.verification_uri,
      createdAt: createdAt.toISOString(),
      expiresAt: new Date(
        createdAt.getTime() + response.expires_in * 1000
      ).toISOString(),
      intervalSeconds: response.interval
    };

    await options.pendingStorage.save(pending);
    await options.storage.saveSettings({
      connectionStatus: {
        code: "authorizing",
        checkedAt: createdAt.toISOString(),
        error: null
      }
    });

    return toPublicPending(pending);
  }

  async function readPending(): Promise<PublicPendingGitHubAuth | null> {
    const pending = await options.pendingStorage.get();

    if (pending === null) {
      return null;
    }

    if (Date.parse(pending.expiresAt) <= now().getTime()) {
      await options.pendingStorage.clear();
      return null;
    }

    return toPublicPending(pending);
  }

  async function poll(): Promise<GitHubAuthPollResult> {
    assertConfigured(options.clientId);
    const pending = await options.pendingStorage.get();

    if (pending === null || Date.parse(pending.expiresAt) <= now().getTime()) {
      await options.pendingStorage.clear();
      const error = explicitError(
        "github_device_flow_expired",
        "GitHub device flow code is missing or expired."
      );
      await recordAuthFailure("device_flow_expired", error);
      throw error;
    }

    const response = await postForm<TokenResponse | DeviceFlowErrorResponse>(
      fetchImpl,
      new URL("/login/oauth/access_token", githubWebBaseUrl),
      {
        client_id: options.clientId,
        device_code: pending.deviceCode,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code"
      },
      false
    );

    if (isDeviceFlowErrorResponse(response)) {
      if (response.error === "authorization_pending") {
        return {
          status: "pending",
          pending: toPublicPending(pending)
        };
      }

      if (response.error === "slow_down") {
        const nextPending = {
          ...pending,
          intervalSeconds:
            typeof response.interval === "number"
              ? response.interval
              : pending.intervalSeconds + 5
        };
        await options.pendingStorage.save(nextPending);

        return {
          status: "pending",
          pending: toPublicPending(nextPending)
        };
      }

      await options.pendingStorage.clear();

      if (response.error === "expired_token") {
        const error = explicitError(
          "github_device_flow_expired",
          response.error_description ?? response.error
        );
        await recordAuthFailure("device_flow_expired", error);
        throw error;
      }

      if (response.error === "access_denied") {
        const error = explicitError(
          "github_device_flow_denied",
          response.error_description ?? response.error
        );
        await recordAuthFailure("device_flow_denied", error);
        throw error;
      }

      const error = explicitError(
        "github_auth_failed",
        response.error_description ?? response.error
      );
      await recordAuthFailure("auth_failed", error);
      throw error;
    }

    if (!isTokenResponse(response)) {
      const error = explicitError(
        "github_auth_failed",
        "GitHub returned a malformed token response."
      );
      await options.pendingStorage.clear();
      await recordAuthFailure("auth_failed", error);
      throw error;
    }

    const session = await buildSession(response);
    await options.storage.saveGitHubAuth(session);
    await options.pendingStorage.clear();
    await options.storage.saveSettings({
      connectionStatus: {
        code: "not_tested",
        checkedAt: now().toISOString(),
        error: null
      }
    });

    return {
      status: "connected",
      account: session.account
    };
  }

  async function disconnect(): Promise<void> {
    await Promise.all([
      options.storage.clearGitHubAuth(),
      options.pendingStorage.clear()
    ]);
    await options.storage.saveSettings({
      connectionStatus: {
        code: "login_required",
        checkedAt: now().toISOString(),
        error: null
      }
    });
  }

  async function getAccessToken(forceRefresh = false): Promise<string> {
    const session = await options.storage.getGitHubAuth();

    if (session === null) {
      throw explicitError("github_login_required", "GitHub login is required.");
    }

    const shouldRefresh =
      forceRefresh ||
      Date.parse(session.accessTokenExpiresAt) - now().getTime() <=
        ACCESS_TOKEN_REFRESH_WINDOW_MS;

    if (!shouldRefresh) {
      return session.accessToken;
    }

    if (refreshInFlight === null) {
      refreshInFlight = refreshSession(session).finally(() => {
        refreshInFlight = null;
      });
    }

    return refreshInFlight;
  }

  async function refreshSession(session: GitHubAuthSession): Promise<string> {
    if (Date.parse(session.refreshTokenExpiresAt) <= now().getTime()) {
      const error = explicitError(
        "github_token_refresh_failed",
        "GitHub refresh token expired."
      );
      await clearAuthWithFailure("token_refresh_failed", error);
      throw error;
    }

    let nextSession: GitHubAuthSession;

    try {
      const response = await postForm<TokenResponse>(
        fetchImpl,
        new URL("/login/oauth/access_token", githubWebBaseUrl),
        {
          client_id: options.clientId,
          grant_type: "refresh_token",
          refresh_token: session.refreshToken
        }
      );
      if (!isTokenResponse(response)) {
        throw explicitError(
          "github_auth_failed",
          "GitHub returned a malformed refresh response."
        );
      }
      const refreshedAt = now();
      nextSession = {
        ...session,
        accessToken: response.access_token,
        accessTokenExpiresAt: new Date(
          refreshedAt.getTime() + response.expires_in * 1000
        ).toISOString(),
        refreshToken: response.refresh_token,
        refreshTokenExpiresAt: new Date(
          refreshedAt.getTime() + response.refresh_token_expires_in * 1000
        ).toISOString(),
        updatedAt: refreshedAt.toISOString()
      };
    } catch (error) {
      const normalized = explicitError(
        "github_token_refresh_failed",
        normalizeError(error).debugMessage ?? "GitHub token refresh failed."
      );
      await clearAuthWithFailure("token_refresh_failed", normalized);
      throw normalized;
    }

    // 저장은 network 실패 처리 밖에 둔다. network 왕복 동안 사용자가 연결을
    // 해제했을 수 있고, 그건 refresh 실패가 아니라 사용자의 결정이다. 실패로
    // 기록하면 사용자가 만든 깨끗한 로그아웃 상태를 오류 상태로 덮는다.
    const saved = await options.storage.replaceGitHubAuthIfUnchanged(
      session.refreshToken,
      nextSession
    );

    if (saved === null) {
      throw explicitError(
        "github_login_required",
        "GitHub connection changed while the token was refreshing."
      );
    }

    return saved.accessToken;
  }

  async function clearAuthWithFailure(
    code: "token_refresh_failed",
    error: NormalizedError
  ): Promise<void> {
    await Promise.all([
      options.storage.clearGitHubAuth(),
      options.pendingStorage.clear()
    ]);
    await recordAuthFailure(code, error);
  }

  async function recordAuthFailure(
    code:
      | "auth_failed"
      | "device_flow_expired"
      | "device_flow_denied"
      | "token_refresh_failed",
    error: NormalizedError
  ): Promise<void> {
    await options.storage.saveSettings({
      connectionStatus: {
        code,
        checkedAt: now().toISOString(),
        error
      }
    });
  }

  async function buildSession(response: TokenResponse): Promise<GitHubAuthSession> {
    if (
      response.token_type.toLowerCase() !== "bearer" ||
      response.refresh_token.length === 0
    ) {
      throw explicitError(
        "github_auth_failed",
        "GitHub App must use expiring user access tokens."
      );
    }

    const account = await fetchAccount(response.access_token);
    const createdAt = now();

    return {
      version: STORAGE_SCHEMA_VERSION,
      accessToken: response.access_token,
      accessTokenExpiresAt: new Date(
        createdAt.getTime() + response.expires_in * 1000
      ).toISOString(),
      refreshToken: response.refresh_token,
      refreshTokenExpiresAt: new Date(
        createdAt.getTime() + response.refresh_token_expires_in * 1000
      ).toISOString(),
      tokenType: "bearer",
      account,
      updatedAt: createdAt.toISOString()
    };
  }

  async function fetchAccount(accessToken: string): Promise<GitHubAccountSummary> {
    const response = await fetchImpl(new URL("/user", githubApiBaseUrl), {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      throw explicitError(
        "github_auth_failed",
        `Could not read GitHub account (${response.status}).`
      );
    }

    const user = (await response.json()) as GitHubUserResponse;

    if (
      !Number.isInteger(user.id) ||
      typeof user.login !== "string" ||
      user.login.length === 0
    ) {
      throw explicitError(
        "github_auth_failed",
        "GitHub returned a malformed account response."
      );
    }

    return {
      id: user.id,
      login: user.login,
      avatarUrl: user.avatar_url ?? null
    };
  }

  return {
    start,
    readPending,
    poll,
    disconnect,
    getAccessToken
  };
}

function parsePendingGitHubAuth(value: unknown): PendingGitHubAuth | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;

  return candidate.version === 1 &&
    typeof candidate.deviceCode === "string" &&
    typeof candidate.userCode === "string" &&
    typeof candidate.verificationUri === "string" &&
    typeof candidate.expiresAt === "string" &&
    typeof candidate.intervalSeconds === "number" &&
    typeof candidate.createdAt === "string"
    ? (candidate as unknown as PendingGitHubAuth)
    : null;
}

function toPublicPending(
  pending: PendingGitHubAuth
): PublicPendingGitHubAuth {
  return {
    userCode: pending.userCode,
    verificationUri: pending.verificationUri,
    expiresAt: pending.expiresAt,
    intervalSeconds: pending.intervalSeconds
  };
}

async function postForm<T>(
  fetchImpl: GitHubAuthFetch,
  url: URL,
  values: Record<string, string>,
  requireSuccessPayload = true
): Promise<T> {
  let response: Response;

  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams(values).toString()
    });
  } catch (error) {
    throw normalizeError(error);
  }

  const data = (await response.json()) as T;

  if (!response.ok || (requireSuccessPayload && isDeviceFlowErrorResponse(data))) {
    const detail = isDeviceFlowErrorResponse(data)
      ? data.error_description ?? data.error
      : `GitHub auth request failed (${response.status}).`;
    throw explicitError("github_auth_failed", detail);
  }

  return data;
}

function isDeviceFlowErrorResponse(
  value: unknown
): value is DeviceFlowErrorResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as Record<string, unknown>).error === "string"
  );
}

function isDeviceCodeResponse(value: unknown): value is DeviceCodeResponse {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.device_code === "string" &&
    candidate.device_code.length > 0 &&
    typeof candidate.user_code === "string" &&
    candidate.user_code.length > 0 &&
    typeof candidate.verification_uri === "string" &&
    candidate.verification_uri.length > 0 &&
    typeof candidate.expires_in === "number" &&
    candidate.expires_in > 0 &&
    typeof candidate.interval === "number" &&
    candidate.interval > 0
  );
}

function isTokenResponse(value: unknown): value is TokenResponse {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.access_token === "string" &&
    candidate.access_token.length > 0 &&
    typeof candidate.expires_in === "number" &&
    candidate.expires_in > 0 &&
    typeof candidate.refresh_token === "string" &&
    candidate.refresh_token.length > 0 &&
    typeof candidate.refresh_token_expires_in === "number" &&
    candidate.refresh_token_expires_in > 0 &&
    typeof candidate.token_type === "string"
  );
}

function assertConfigured(clientId: string): void {
  if (clientId.length === 0) {
    throw explicitError(
      "github_auth_failed",
      "GitHub App client ID is not configured."
    );
  }
}

function explicitError(code: NormalizedError["code"], message: string): NormalizedError {
  return normalizeError({ code, message });
}

function defaultFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  return globalThis.fetch(input, init);
}
