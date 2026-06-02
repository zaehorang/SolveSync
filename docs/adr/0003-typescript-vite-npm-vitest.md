# TypeScript, Vite, npm, Vitest

결정: TypeScript, Vite, npm, Vitest를 사용한다.
이유: TypeScript는 API payload와 상태 모델 안정성을 높인다. Vite는 여러 extension entry point를 적은 설정으로 번들링할 수 있다. npm은 사용 환경 의존성이 낮다. Vitest는 Vite와 잘 맞고 순수 로직 테스트에 충분하다.
트레이드오프: raw JavaScript 확장보다 Node build step과 lockfile 관리가 추가된다.
