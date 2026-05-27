import { afterEach, describe, expect, it, vi } from "vitest";

import {
  LeetCodeClient,
  type LeetCodeFetch,
  fetchLatestAcceptedSubmission,
  fetchProblemMetadata
} from "./leetcode";

describe("LeetCode background client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses problem metadata without requesting problem content", async () => {
    const fetchImpl = mockFetch(
      graphQLResponse({
        question: {
          questionId: "1",
          questionFrontendId: "1",
          title: "Two Sum",
          titleSlug: "two-sum",
          difficulty: "Easy"
        }
      })
    );
    const metadata = await fetchProblemMetadata("two-sum", { fetchImpl });

    expect(metadata).toEqual({
      problemId: "1",
      frontendId: "1",
      title: "Two Sum",
      titleSlug: "two-sum",
      difficulty: "Easy",
      url: "https://leetcode.com/problems/two-sum/"
    });
    expect(requestBody(fetchImpl, 0).query).not.toContain("content");
    expect(fetchCalls(fetchImpl)[0]?.[1]?.credentials).toBe("include");
  });

  it("uses the default fetch wrapper with the global fetch receiver", async () => {
    const fetchImpl = vi.fn(function (
      this: typeof globalThis,
      input: RequestInfo | URL,
      init?: RequestInit
    ) {
      expect(this).toBe(globalThis);
      expect(String(input)).toBe("https://leetcode.com/graphql");
      expect(init?.method).toBe("POST");

      return Promise.resolve(
        graphQLResponse({
          question: {
            questionId: "1",
            questionFrontendId: "1",
            title: "Two Sum",
            titleSlug: "two-sum",
            difficulty: "Easy"
          }
        })
      );
    }) as unknown as LeetCodeFetch;
    vi.stubGlobal("fetch", fetchImpl);

    await expect(fetchProblemMetadata("two-sum")).resolves.toMatchObject({
      titleSlug: "two-sum"
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("parses the latest accepted submission detail and supported language", async () => {
    const fetchImpl = mockFetch(
      graphQLResponse({
        questionSubmissionList: {
          submissions: [
            {
              id: "123456789",
              titleSlug: "two-sum",
              statusDisplay: "Accepted",
              lang: "swift",
              langName: "Swift",
              timestamp: "1767225600",
              isPending: false
            }
          ]
        }
      }),
      graphQLResponse({
        submissionDetails: {
          code: "class Solution {}",
          timestamp: "1767225600",
          statusDisplay: "Accepted",
          lang: {
            name: "swift",
            verboseName: "Swift"
          },
          question: {
            titleSlug: "two-sum"
          }
        }
      })
    );
    const client = new LeetCodeClient({ fetchImpl });

    const result = await client.fetchLatestAcceptedSubmission("two-sum");

    expect(result).toMatchObject({
      supportedLanguage: "swift",
      submittedAt: "2026-01-01T00:00:00.000Z",
      syncable: true,
      identity: {
        submissionId: "123456789",
        titleSlug: "two-sum",
        language: "swift"
      },
      submission: {
        submissionId: "123456789",
        titleSlug: "two-sum",
        language: "Swift",
        code: "class Solution {}",
        acceptedAt: "2026-01-01T00:00:00.000Z"
      }
    });
    expect(requestBody(fetchImpl, 0).variables).toEqual({
      titleSlug: "two-sum",
      limit: 20,
      offset: 0,
      status: 10
    });
    expect(requestBody(fetchImpl, 1).variables).toEqual({
      submissionId: 123456789
    });
  });

  it("represents unsupported accepted languages as not syncable", async () => {
    const fetchImpl = mockFetch(
      graphQLResponse({
        questionSubmissionList: {
          submissions: [
            {
              id: "987654321",
              titleSlug: "two-sum",
              statusDisplay: "Accepted",
              lang: "java",
              langName: "Java",
              timestamp: 1767225600,
              isPending: false
            }
          ]
        }
      }),
      graphQLResponse({
        submissionDetails: {
          code: "class Solution {}",
          timestamp: 1767225600,
          lang: {
            name: "java",
            verboseName: "Java"
          },
          question: {
            titleSlug: "two-sum"
          }
        }
      })
    );

    const result = await fetchLatestAcceptedSubmission("two-sum", { fetchImpl });

    expect(result).toMatchObject({
      supportedLanguage: null,
      submittedAt: "2026-01-01T00:00:00.000Z",
      syncable: false,
      identity: null,
      submission: {
        language: "Java"
      }
    });
  });

  it("normalizes LeetCode auth required failures", async () => {
    const fetchImpl = mockFetch(
      jsonResponse(
        {
          errors: [{ message: "Please login to view submission details." }]
        },
        403
      )
    );

    await expect(fetchProblemMetadata("two-sum", { fetchImpl })).rejects.toMatchObject({
      code: "leetcode_auth_required",
      retryable: false
    });
  });

  it("normalizes malformed metadata responses", async () => {
    const fetchImpl = mockFetch(graphQLResponse({ question: null }));

    await expect(fetchProblemMetadata("two-sum", { fetchImpl })).rejects.toMatchObject({
      code: "leetcode_fetch_failed",
      retryable: true
    });
  });

  it("treats accepted submissions without code as not syncable", async () => {
    const fetchImpl = mockFetch(
      graphQLResponse({
        questionSubmissionList: {
          submissions: [
            {
              id: "123456789",
              titleSlug: "two-sum",
              statusDisplay: "Accepted",
              langName: "Python3",
              timestamp: "1767225600",
              isPending: false
            }
          ]
        }
      }),
      graphQLResponse({
        submissionDetails: {
          code: "",
          timestamp: "1767225600",
          lang: {
            name: "python3",
            verboseName: "Python3"
          },
          question: {
            titleSlug: "two-sum"
          }
        }
      })
    );

    await expect(
      fetchLatestAcceptedSubmission("two-sum", { fetchImpl })
    ).rejects.toMatchObject({
      code: "leetcode_fetch_failed",
      retryable: true
    });
  });
});

function mockFetch(...responses: Response[]): LeetCodeFetch {
  const fetchImpl = vi.fn(async () => {
    const response = responses.shift();

    if (response === undefined) {
      throw new Error("Unexpected fetch call.");
    }

    return response;
  });

  return fetchImpl as unknown as LeetCodeFetch;
}

function graphQLResponse(data: unknown, status = 200): Response {
  return jsonResponse({ data }, status);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

function requestBody(
  fetchImpl: LeetCodeFetch,
  callIndex: number
): { query: string; variables: Record<string, unknown> } {
  const init = fetchCalls(fetchImpl)[callIndex]?.[1];

  if (typeof init?.body !== "string") {
    throw new Error("Expected JSON request body.");
  }

  return JSON.parse(init.body) as {
    query: string;
    variables: Record<string, unknown>;
  };
}

function fetchCalls(
  fetchImpl: LeetCodeFetch
): Array<[RequestInfo | URL, RequestInit | undefined]> {
  return vi.mocked(fetchImpl).mock.calls as Array<
    [RequestInfo | URL, RequestInit | undefined]
  >;
}
