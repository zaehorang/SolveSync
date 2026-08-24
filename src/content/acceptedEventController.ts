/** Accepted event lifecycle.
 *
 * 플랫폼별 판정은 Coding Platform Adapter가 소유하고 여기에는 어떤 플랫폼
 * 이름도 나오지 않는다. 이 파일이 소유하는 것은 억제 창, route generation과
 * 전달이며 셋 다 플랫폼과 무관하다.
 */
import type { AcceptedDetectedMessage } from "../shared";
import {
  createPlatformAdapters,
  resolveRoute,
  type ObserveTarget,
  type PlatformAdapter,
  type PlatformObservation,
  type PlatformObservationDocument,
  type ResolvedRoute,
  type RouteTransition
} from "./platforms";
import { defaultTimeoutScheduler, type TimeoutScheduler } from "./scheduler";

const ACCEPTED_COALESCING_WINDOW_MS = 700;
const UNSUPPORTED_ROUTE_KEY = "unsupported";

interface AcceptedMutationObserver {
  observe(target: Node, options?: MutationObserverInit): void;
  disconnect(): void;
}

export interface AcceptedEventControllerOptions {
  documentRef: PlatformObservationDocument;
  getCurrentUrl(): string;
  sendAcceptedMessage(message: AcceptedDetectedMessage): void;
  createObserver(callback: MutationCallback): AcceptedMutationObserver;
  now?(): string;
  scheduler?: TimeoutScheduler;
  coalescingWindowMs?: number;
  /** 주입하지 않으면 기본 Adapter 집합을 쓴다. SWEA bridge가 필요하면
   * `createPlatformAdapters`로 만들어 넘긴다. */
  adapters?: readonly PlatformAdapter[];
}

export function startAcceptedEventController(
  options: AcceptedEventControllerOptions
): () => void {
  const scheduler = options.scheduler ?? defaultTimeoutScheduler;
  const coalescingWindowMs =
    options.coalescingWindowMs ?? ACCEPTED_COALESCING_WINDOW_MS;
  const adapters = options.adapters ?? createPlatformAdapters();
  const documentRef = options.documentRef;
  const now = (): string => options.now?.() ?? new Date().toISOString();

  const resolveCurrentRoute = (pageUrl: string): ResolvedRoute | null => {
    try {
      return resolveRoute(new URL(pageUrl), documentRef, adapters);
    } catch {
      return null;
    }
  };

  const keyOf = (route: ResolvedRoute | null): string =>
    route?.key ?? UNSUPPORTED_ROUTE_KEY;

  let currentRoute = resolveCurrentRoute(options.getCurrentUrl());
  let currentRouteKey = keyOf(currentRoute);
  let observation: PlatformObservation | null =
    currentRoute?.observe(documentRef, "startup") ?? null;
  let currentTargets: readonly ObserveTarget[] = observation?.targets() ?? [];

  // 같은 render burst를 한 번만 전달하기 위한 억제 창이다 (ADR 0034).
  //
  // 전달을 창이 닫힐 때까지 미루지 않는다. 미루면 그 사이 page가 사라졌을 때
  // event가 통째로 사라진다. SWEA Accepted layer의 `확인`을 빠르게 누르면
  // page가 그 창 안에서 언로드되어 sync가 시작조차 하지 못했다.
  let suppressed = false;
  let suppressionTimer: ReturnType<typeof setTimeout> | null = null;
  // route가 바뀔 때마다 올린다. 전달 직전의 route key 비교만으로는 A→B→A로
  // 돌아온 경우를 걸러내지 못한다. 그때 key는 다시 A라서 같아 보인다.
  let routeGeneration = 0;

  const clearSuppression = (): void => {
    if (suppressionTimer !== null) {
      scheduler.clearTimeout(suppressionTimer);
    }

    suppressed = false;
    suppressionTimer = null;
  };

  const openSuppressionWindow = (): void => {
    suppressed = true;
    suppressionTimer = scheduler.setTimeout(() => {
      suppressed = false;
      suppressionTimer = null;
    }, coalescingWindowMs);
  };

  const reobserve = (targets: readonly ObserveTarget[]): void => {
    currentTargets = targets;
    observer.disconnect();

    for (const target of targets) {
      observer.observe(target.node, target.init);
    }
  };

  const deliver = (message: AcceptedDetectedMessage, routeKey: string): void => {
    // route는 전달 직전에 다시 확인한다 (ADR 0034).
    if (keyOf(resolveCurrentRoute(options.getCurrentUrl())) !== routeKey) {
      return;
    }

    options.sendAcceptedMessage(message);
  };

  const observer = options.createObserver((mutations) => {
    const pageUrl = options.getCurrentUrl();
    const nextRoute = resolveCurrentRoute(pageUrl);
    const nextRouteKey = keyOf(nextRoute);

    if (nextRouteKey !== currentRouteKey) {
      const transition: RouteTransition =
        currentRoute !== null && nextRoute !== null && currentRoute.platform === nextRoute.platform
          ? "samePlatform"
          : "otherPlatform";

      routeGeneration += 1;
      clearSuppression();
      currentRoute = nextRoute;
      currentRouteKey = nextRouteKey;
      observation = nextRoute?.observe(documentRef, transition) ?? null;
      reobserve(observation?.targets() ?? []);
    }

    if (observation === null) {
      return;
    }

    const signal = observation.detect(mutations, { pageUrl, now });
    const nextTargets = observation.targets();

    if (nextTargets !== currentTargets) {
      reobserve(nextTargets);
    }

    if (signal === null || suppressed) {
      return;
    }

    openSuppressionWindow();

    const generation = routeGeneration;
    const routeKey = currentRouteKey;

    resolveMaybePromise(signal.toMessage(), (message) => {
      // 관찰된 route 이동이 있었으면 버린다. `deliver`의 현재 URL 비교는
      // mutation 없이 바뀐 route를 잡고, 이 비교는 되돌아온 route를 잡는다.
      if (generation !== routeGeneration) {
        return;
      }

      deliver(message, routeKey);
    });
  });

  reobserve(currentTargets);

  return () => {
    // 종료 뒤 도착하는 bridge 응답도 무효로 만든다.
    routeGeneration += 1;
    clearSuppression();
    observer.disconnect();
  };
}

/** 값이 Promise가 아니면 동기로 부른다.
 *
 * 일률적으로 await하면 전달이 microtask로 밀린다. 밀리는 사이 page가
 * 사라지면 event가 통째로 없어져 실패 기록조차 남지 않는다 (ADR 0037).
 * 기다리는 것은 SWEA bridge 응답뿐이다. */
function resolveMaybePromise<T>(value: T | Promise<T>, onValue: (value: T) => void): void {
  if (value instanceof Promise) {
    void value.then(onValue);
    return;
  }

  onValue(value);
}
