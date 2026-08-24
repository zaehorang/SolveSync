/** 억제 창 타이머 주입점. 테스트가 시간을 제어하기 위해 존재한다. */
export interface TimeoutScheduler {
  setTimeout(callback: () => void, delayMs: number): ReturnType<typeof setTimeout>;
  clearTimeout(timer: ReturnType<typeof setTimeout>): void;
}

export const defaultTimeoutScheduler: TimeoutScheduler = {
  setTimeout(callback, delayMs) {
    return setTimeout(callback, delayMs);
  },
  clearTimeout(timer) {
    clearTimeout(timer);
  }
};
