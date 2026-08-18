import { describe, expect, it, vi } from "vitest";

import {
  STORAGE_SCHEMA_VERSION,
  type GitHubAuthSession
} from "../shared/storageSchema";
import {
  createGitHubAuthManager,
  type GitHubAuthFetch,
  type PendingGitHubAuth,
  type PendingGitHubAuthStorage
} from "./auth";
import {
  createExtensionStorage,
  type StorageAreaAdapter
} from "./storage";

const NOW = new Date("2026-01-01T00:00:00.000Z");

describe("GitHub App device-flow authentication", () => {
  it("starts device flow without exposing the device code or using a client secret", async () => {
    const fetchImpl = queueFetch(
      jsonResponse({
        device_code: "private-device-code",
        user_code: "ABCD-1234",
        verification_uri: "https://github.com/login/device",
        expires_in: 900,
        interval: 5
      })
    );
    const harness = makeHarness(fetchImpl);

    const pending = await harness.manager.start();

    expect(pending).toEqual({
      userCode: "ABCD-1234",
      verificationUri: "https://github.com/login/device",
      expiresAt: "2026-01-01T00:15:00.000Z",
      intervalSeconds: 5
    });
    expect(JSON.stringify(pending)).not.toContain("private-device-code");
    expect(harness.pending.current?.deviceCode).toBe("private-device-code");
    expect(fetchRequestBody(fetchImpl, 0)).toBe("client_id=client-id");
    expect(fetchRequestBody(fetchImpl, 0)).not.toContain("secret");
    await expect(harness.storage.getSettings()).resolves.toMatchObject({
      connectionStatus: {
        code: "authorizing"
      }
    });
  });

  it("keeps authorization pending and applies GitHub slow-down intervals", async () => {
    const fetchImpl = queueFetch(
      jsonResponse(deviceCodeResponse()),
      jsonResponse({ error: "authorization_pending" }),
      jsonResponse({ error: "slow_down", interval: 12 })
    );
    const harness = makeHarness(fetchImpl);
    await harness.manager.start();

    await expect(harness.manager.poll()).resolves.toMatchObject({
      status: "pending",
      pending: {
        intervalSeconds: 5
      }
    });
    await expect(harness.manager.poll()).resolves.toMatchObject({
      status: "pending",
      pending: {
        intervalSeconds: 12
      }
    });
    expect(harness.pending.current?.intervalSeconds).toBe(12);
  });

  it("stores rotating tokens locally and returns only the connected account", async () => {
    const fetchImpl = queueFetch(
      jsonResponse(deviceCodeResponse()),
      jsonResponse(tokenResponse("access-1", "refresh-1")),
      jsonResponse({
        id: 7,
        login: "octo",
        avatar_url: "https://avatars.example/octo"
      })
    );
    const harness = makeHarness(fetchImpl);
    await harness.manager.start();

    const result = await harness.manager.poll();

    expect(result).toEqual({
      status: "connected",
      account: {
        id: 7,
        login: "octo",
        avatarUrl: "https://avatars.example/octo"
      }
    });
    expect(JSON.stringify(result)).not.toContain("access-1");
    expect(JSON.stringify(result)).not.toContain("refresh-1");
    await expect(harness.storage.getGitHubAuth()).resolves.toMatchObject({
      accessToken: "access-1",
      refreshToken: "refresh-1",
      account: {
        login: "octo"
      }
    });
    expect(harness.pending.current).toBeNull();
  });

  it("coalesces concurrent refreshes and persists rotated tokens", async () => {
    const fetchImpl = queueFetch(
      jsonResponse(tokenResponse("access-2", "refresh-2"))
    );
    const harness = makeHarness(fetchImpl);
    await harness.storage.saveGitHubAuth({
      version: STORAGE_SCHEMA_VERSION,
      accessToken: "access-1",
      accessTokenExpiresAt: "2026-01-01T00:04:00.000Z",
      refreshToken: "refresh-1",
      refreshTokenExpiresAt: "2026-07-01T00:00:00.000Z",
      tokenType: "bearer",
      account: {
        id: 7,
        login: "octo",
        avatarUrl: null
      },
      updatedAt: NOW.toISOString()
    });

    await expect(
      Promise.all([
        harness.manager.getAccessToken(),
        harness.manager.getAccessToken()
      ])
    ).resolves.toEqual(["access-2", "access-2"]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchRequestBody(fetchImpl, 0)).toContain("grant_type=refresh_token");
    expect(fetchRequestBody(fetchImpl, 0)).toContain("refresh_token=refresh-1");
    expect(fetchRequestBody(fetchImpl, 0)).not.toContain("client_secret");
    await expect(harness.storage.getGitHubAuth()).resolves.toMatchObject({
      accessToken: "access-2",
      refreshToken: "refresh-2"
    });
  });

  it("discards a token refresh that lands after the user disconnected", async () => {
    let markRefreshStarted = (): void => {};
    let releaseRefresh = (): void => {};
    const refreshStarted = new Promise<void>((resolve) => {
      markRefreshStarted = resolve;
    });
    const refreshGate = new Promise<void>((resolve) => {
      releaseRefresh = resolve;
    });
    const fetchImpl = vi.fn(async () => {
      markRefreshStarted();
      await refreshGate;
      return jsonResponse(tokenResponse("access-2", "refresh-2"));
    });
    const harness = makeHarness(fetchImpl);
    await harness.storage.saveGitHubAuth(makeExpiringSession());

    const refresh = harness.manager.getAccessToken();
    // refresh가 실제로 network를 기다리는 중인지 확인한 뒤 연결을 해제한다.
    // 그래야 "해제 뒤에 도착한 refresh"를 검증한다.
    await refreshStarted;
    await harness.manager.disconnect();
    releaseRefresh();

    await expect(refresh).rejects.toMatchObject({
      code: "github_login_required"
    });
    await expect(harness.storage.getGitHubAuth()).resolves.toBeNull();
    await expect(harness.storage.getSettings()).resolves.toMatchObject({
      connectionStatus: {
        code: "login_required"
      }
    });
  });

  it("clears an expired refresh session and requires a new login", async () => {
    const harness = makeHarness(queueFetch());
    await harness.storage.saveGitHubAuth({
      version: STORAGE_SCHEMA_VERSION,
      accessToken: "expired-access",
      accessTokenExpiresAt: "2025-12-31T23:00:00.000Z",
      refreshToken: "expired-refresh",
      refreshTokenExpiresAt: "2025-12-31T23:59:59.000Z",
      tokenType: "bearer",
      account: {
        id: 7,
        login: "octo",
        avatarUrl: null
      },
      updatedAt: "2025-12-31T23:00:00.000Z"
    });

    await expect(harness.manager.getAccessToken()).rejects.toMatchObject({
      code: "github_token_refresh_failed"
    });
    await expect(harness.storage.getGitHubAuth()).resolves.toBeNull();
    await expect(harness.storage.getSettings()).resolves.toMatchObject({
      connectionStatus: {
        code: "token_refresh_failed"
      }
    });
  });
});

function makeHarness(fetchImpl: GitHubAuthFetch) {
  const storage = createExtensionStorage(createMemoryStorageArea());
  const pending = createMemoryPendingStorage();
  const manager = createGitHubAuthManager({
    clientId: "client-id",
    storage,
    pendingStorage: pending,
    fetchImpl,
    now: () => NOW
  });

  return {
    storage,
    pending,
    manager
  };
}

function createMemoryPendingStorage(): PendingGitHubAuthStorage & {
  current: PendingGitHubAuth | null;
} {
  return {
    current: null,
    async get() {
      return this.current;
    },
    async save(pending) {
      this.current = structuredClone(pending);
    },
    async clear() {
      this.current = null;
    }
  };
}

function createMemoryStorageArea(): StorageAreaAdapter {
  const values: Record<string, unknown> = {};

  return {
    async get(keys) {
      if (typeof keys === "string") {
        return keys in values ? { [keys]: structuredClone(values[keys]) } : {};
      }

      return structuredClone(values);
    },
    async set(items) {
      Object.assign(values, structuredClone(items));
    },
    async remove(keys) {
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        delete values[key];
      }
    }
  };
}

function queueFetch(...responses: Response[]): GitHubAuthFetch {
  return vi.fn(async () => {
    const response = responses.shift();

    if (response === undefined) {
      throw new Error("Unexpected fetch.");
    }

    return response;
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

function makeExpiringSession(): GitHubAuthSession {
  return {
    version: STORAGE_SCHEMA_VERSION,
    accessToken: "access-1",
    accessTokenExpiresAt: "2026-01-01T00:04:00.000Z",
    refreshToken: "refresh-1",
    refreshTokenExpiresAt: "2026-07-01T00:00:00.000Z",
    tokenType: "bearer",
    account: {
      id: 7,
      login: "octo",
      avatarUrl: null
    },
    updatedAt: NOW.toISOString()
  };
}

function deviceCodeResponse() {
  return {
    device_code: "private-device-code",
    user_code: "ABCD-1234",
    verification_uri: "https://github.com/login/device",
    expires_in: 900,
    interval: 5
  };
}

function tokenResponse(accessToken: string, refreshToken: string) {
  return {
    access_token: accessToken,
    expires_in: 28_800,
    refresh_token: refreshToken,
    refresh_token_expires_in: 15_552_000,
    token_type: "bearer"
  };
}

function fetchRequestBody(fetchImpl: GitHubAuthFetch, index: number): string {
  const mock = fetchImpl as ReturnType<typeof vi.fn>;
  return String(mock.mock.calls[index]?.[1]?.body ?? "");
}
