# src/shared

제품 전역이 공유하는 타입과 결정적 순수 로직의 소유 module이다.

## Owns
- 공통 타입, Coding Platform policy, runtime message union과 versioned storage schema
- language/path mapping과 GitHub tree payload 생성
- Solution Catalog merge와 Solution README managed projection
- 외부 API error normalization과 공통 UI model

## Common changes
- 타입·message·storage 계약 변경 → [`types.ts`](types.ts), [`messages.ts`](messages.ts), [`storageSchema.ts`](storageSchema.ts)를 함께 확인하고 co-located test로 backward compatibility를 검증한다.
- language·path·platform policy 변경 → [`languageRegistry.ts`](languageRegistry.ts), [`platformPolicy.ts`](platformPolicy.ts), [`paths.ts`](paths.ts)를 수정하고 지원 플랫폼별 경로 test를 갱신한다.
- Solution README/Catalog 변경 → [`readme.ts`](readme.ts), [`solutionCatalog.ts`](solutionCatalog.ts), [`githubTree.ts`](githubTree.ts)를 수정하고 managed marker 밖 내용 보존을 검증한다.

```bash
npx vitest run src/shared
```

## Non-obvious
- 주의: 이 module에는 browser UI나 외부 API 호출을 넣지 않고 결정적인 pure logic만 둔다.
- 주의: README/index/path 규칙은 이 module만 소유한다. UI나 API client에 같은 규칙을 복제하지 않는다.
- Why: 같은 입력이 content, background와 UI에서 같은 결과를 내야 storage migration과 retry가 재현 가능하다.

## Dependencies
- imports: 내부 product module 없음
- imported by: `src/background`, `src/content`, `src/options`, `src/popup`
- 계약 문서: [ARCHITECTURE](../../docs/ARCHITECTURE.md), [Coding Platform 공통 계약](../../docs/platforms/README.md), [Domain Naming Contract](../../CONTEXT.md)
