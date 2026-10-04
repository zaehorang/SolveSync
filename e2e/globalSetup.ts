import {
  buildPreflightItems,
  collectPreflightObservations,
  detectPreflightMode,
  formatPreflight,
  type PreflightItem,
  type PreflightMode
} from "./support/preflight";

export function preflightFailure(
  mode: PreflightMode,
  items: readonly PreflightItem[]
): string | null {
  if (mode !== "live-submit") {
    return null;
  }

  const github = items.find((item) => item.id === "github");

  return github?.status === "ready"
    ? null
    : `[preflight] 풀사이클을 시작하지 않는다: ${github?.action ?? "GitHub write 설정을 확인할 수 없다."}`;
}

export default async function globalSetup(): Promise<void> {
  const mode = detectPreflightMode(process.env);
  const observations = await collectPreflightObservations();
  const items = buildPreflightItems(mode, observations);

  console.info(formatPreflight(mode, items));

  const failure = preflightFailure(mode, items);

  if (failure !== null) {
    throw new Error(failure);
  }
}
