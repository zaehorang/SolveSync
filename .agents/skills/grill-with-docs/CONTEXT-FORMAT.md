# CONTEXT.md 형식

## 구조

```md
# {컨텍스트 이름}

{이 컨텍스트가 무엇이며 왜 존재하는지에 대한 한두 문장 설명}

## 언어

**Order**:
{이 용어에 대한 한두 문장 설명}
_Avoid_: Purchase, transaction

**Invoice**:
배송 후 고객에게 보내는 결제 요청.
_Avoid_: Bill, payment request

**Customer**:
주문을 하는 개인 또는 조직.
_Avoid_: Client, buyer, account
```

## 규칙

- **의견을 분명히 가지세요.** 같은 개념을 가리키는 단어가 여러 개 있다면 가장 좋은 하나를 고르고, 나머지는 `_Avoid_` 아래에 나열하세요.
- **정의를 간결하게 유지하세요.** 최대 한두 문장으로 작성하세요. 그것이 무엇을 하는지가 아니라 무엇인지 정의하세요.
- **이 프로젝트 context에 특화된 용어만 포함하세요.** 일반 프로그래밍 개념(timeouts, error types, utility patterns)은 프로젝트에서 널리 사용하더라도 여기에 속하지 않습니다. 용어를 추가하기 전에 물어보세요. 이것이 이 context에 고유한 개념인가, 아니면 일반 프로그래밍 개념인가? 전자만 여기에 속합니다.
- **자연스러운 묶음이 생기면 용어를 하위 제목 아래에 그룹화하세요.** 모든 용어가 하나의 응집된 영역에 속한다면 flat list도 괜찮습니다.

## 단일 컨텍스트 저장소와 다중 컨텍스트 저장소

**단일 컨텍스트(대부분의 저장소):** 저장소 루트에 `CONTEXT.md` 하나를 둡니다.

**여러 컨텍스트:** 저장소 루트의 `CONTEXT-MAP.md`가 컨텍스트 목록, 위치, 그리고 서로의 관계를 나열합니다.

```md
# Context Map

## Contexts

- [Ordering](./src/ordering/CONTEXT.md) — 고객 주문을 받고 추적함
- [Billing](./src/billing/CONTEXT.md) — invoice를 생성하고 payment를 처리함
- [Fulfillment](./src/fulfillment/CONTEXT.md) — warehouse picking과 shipping을 관리함

## Relationships

- **Ordering → Fulfillment**: Ordering은 `OrderPlaced` 이벤트를 발행하고, Fulfillment는 이를 소비해 picking을 시작함
- **Fulfillment → Billing**: Fulfillment는 `ShipmentDispatched` 이벤트를 발행하고, Billing은 이를 소비해 invoice를 생성함
- **Ordering ↔ Billing**: `CustomerId`와 `Money`를 위한 shared types
```

스킬은 어떤 구조가 적용되는지 추론합니다.

- `CONTEXT-MAP.md`가 있으면, 컨텍스트를 찾기 위해 읽으세요
- 루트 `CONTEXT.md`만 있으면, 단일 컨텍스트입니다
- 둘 다 없으면, 첫 용어가 확정될 때 루트 `CONTEXT.md`를 게으르게 만드세요

여러 컨텍스트가 있을 때는 현재 주제가 어느 컨텍스트와 관련되는지 추론하세요. 불명확하면 물어보세요.
