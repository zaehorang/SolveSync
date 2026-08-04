# Investigation Notes

이 디렉터리는 실제 환경에서 아직 재현되지 않았거나 원인이 확정되지 않은 증상과 조사 가설을 기록한다. Investigation note는 제품 계약, 확정된 Known Issue, 구현 계획 또는 troubleshooting 절차가 아니다.

## 포함할 내용

- 사용자가 제보할 수 있는 증상 표현과 영향
- 의심하는 발생 조건과 원인 가설
- 정상 동작이나 다른 오류와 구분하는 기준
- 재현 시 수집할 최소 증거
- secret과 private source를 기록하지 않는 안전 범위
- 실제 재현 후 추가할 테스트와 검토할 구현 경계

각 note는 상태를 명시하고, 현재 구현이 바뀌었을 수 있으므로 조사 전에 관련 코드와 source of truth를 다시 확인한다.

## 문서 생명주기

1. 미재현 증상이나 원인 후보를 investigation note로 기록한다.
2. 실제 환경에서 재현되면 먼저 회귀 테스트로 증명하고 관련 구현을 수정한다.
3. 제품 계약이나 설계 결정이 바뀌면 `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/adr/`, `docs/platforms/` 같은 source of truth를 갱신한다.
4. 원인과 사용자 대응 절차가 확정되면 필요한 경우 별도 troubleshooting 문서로 전환한다.
5. 가설이 틀렸거나 관련 구현에서 구조적으로 해소되면 note에 결론을 남긴 뒤 제거한다.
