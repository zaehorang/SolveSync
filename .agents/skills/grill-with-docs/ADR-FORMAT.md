# ADR 형식

ADR은 `docs/adr/`에 두며 순차 번호를 사용합니다. `0001-slug.md`, `0002-slug.md` 등이 그 예입니다.

`docs/adr/` 디렉터리는 lazyily하게 만드세요. 첫 ADR이 필요할 때만 만드세요.

## 템플릿

```md
# {결정 사항 (예: Next.js App Router 선택)}

결정: {뭘 선택했는지} 
이유: {왜 선택했는지} 
트레이드오프: {뭘 포기했는지}
```

그게 전부입니다. ADR은 한 단락이어도 됩니다. 가치는 섹션을 채우는 데 있지 않고, 결정이 내려졌다는 사실과 그 이유를 기록하는 데 있습니다.

## 선택 섹션

진짜 가치를 더할 때만 포함하세요. 대부분의 ADR에는 필요하지 않습니다.

- **Status** frontmatter (`proposed | accepted | deprecated | superseded by ADR-NNNN`) - 결정을 다시 살펴볼 때 유용함
- **Considered Options** - 거절한 대안을 기억할 가치가 있을 때만
- **Consequences** - 분명하지 않은 하위 영향을 짚어야 할 때만

## 번호 매기기

`docs/adr/`에서 기존 최고 번호를 훑고 1을 더하세요.

## ADR을 제안할 때

다음 세 가지가 모두 참이어야 합니다.

1. **되돌리기 어려움** - 나중에 마음을 바꾸는 비용이 의미 있을 정도로 큼
2. **맥락 없이는 놀라움** - 미래의 독자가 코드를 보고 "도대체 왜 이렇게 했지?"라고 궁금해할 것임
3. **실제 트레이드오프의 결과** - 진짜 대안들이 있었고, 특정 이유로 하나를 선택했음

결정을 되돌리기 쉽다면 건너뛰세요. 그냥 되돌리면 됩니다. 놀랍지 않다면 아무도 이유를 궁금해하지 않을 것입니다. 진짜 대안이 없었다면 "당연한 일을 했다"는 말 외에 기록할 것이 없습니다.

### 해당되는 것

- **아키텍처 형태.** "monorepo를 사용한다." "write model은 event-sourced이고, read model은 Postgres로 project한다."
- **컨텍스트 간 통합 패턴.** "Ordering과 Billing은 synchronous HTTP가 아니라 domain events로 communicate한다."
- **락인을 수반하는 기술 선택.** Database, message bus, auth provider, deployment target. 모든 library가 아니라, 교체하는 데 한 quarter가 걸릴 것들만 해당합니다.
- **경계와 범위 결정.** "Customer data는 Customer context가 소유하며, 다른 contexts는 ID로만 참조한다." 명시적인 no도 yes만큼 가치 있습니다.
- **명백한 경로에서 의도적으로 벗어난 선택.** "X 때문에 ORM 대신 manual SQL을 사용한다." 합리적인 독자가 반대를 가정할 만한 것은 무엇이든 해당됩니다. 이런 기록은 다음 엔지니어가 의도적인 것을 "고치려" 하는 일을 막습니다.
- **코드에 보이지 않는 제약.** "compliance requirements 때문에 AWS를 사용할 수 없다." "partner API contract 때문에 response time은 200ms 미만이어야 한다."
- **거절 이유가 분명하지 않은 대안.** GraphQL을 검토했고 미묘한 이유로 REST를 골랐다면 기록하세요. 그렇지 않으면 6개월 뒤 누군가 GraphQL을 다시 제안할 것입니다.
