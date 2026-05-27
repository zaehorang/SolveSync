import { afterEach, describe, expect, it, vi } from "vitest";

import type { StorageAreaAdapter } from "./storage";

describe("background entry", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it("registers service worker lifecycle and runtime listeners at module top level", async () => {
    const onInstalledAddListener = vi.fn();
    const onMessageAddListener = vi.fn();
    vi.stubGlobal("chrome", {
      runtime: {
        onInstalled: {
          addListener: onInstalledAddListener
        },
        onMessage: {
          addListener: onMessageAddListener
        },
        sendMessage: vi.fn(),
        openOptionsPage: vi.fn(),
        lastError: undefined
      },
      storage: {
        local: createMemoryStorageArea()
      },
      tabs: {
        sendMessage: vi.fn(),
        create: vi.fn()
      }
    });

    await import("./index");

    expect(onInstalledAddListener).toHaveBeenCalledTimes(1);
    expect(onMessageAddListener).toHaveBeenCalledTimes(1);
  });
});

function createMemoryStorageArea(seed: Record<string, unknown> = {}): StorageAreaAdapter {
  let data = cloneRecord(seed);

  return {
    async get(keys?: string | string[] | Record<string, unknown> | null) {
      if (keys === null || keys === undefined) {
        return cloneRecord(data);
      }

      if (typeof keys === "string") {
        return { [keys]: cloneValue(data[keys]) };
      }

      if (Array.isArray(keys)) {
        return Object.fromEntries(keys.map((key) => [key, cloneValue(data[key])]));
      }

      return {
        ...cloneRecord(keys),
        ...Object.fromEntries(
          Object.keys(keys)
            .filter((key) => key in data)
            .map((key) => [key, cloneValue(data[key])])
        )
      };
    },
    async set(items: Record<string, unknown>) {
      data = {
        ...data,
        ...cloneRecord(items)
      };
    },
    async remove(keys: string | string[]) {
      const keysToRemove = Array.isArray(keys) ? keys : [keys];

      for (const key of keysToRemove) {
        delete data[key];
      }
    }
  };
}

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function cloneValue<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}
