# SWEA 1206. View — 오답 캡처용.
#
# 입력 파싱은 정답과 똑같이 맞춘다. 틀리는 곳은 출력 한 군데뿐이다.
# 채점 결과가 Runtime Error가 아니라 **오답**이어야 오답 UI 캡처로서 의미가
# 있다 — 실행 중 죽으면 플랫폼은 오답 화면 대신 에러 화면을 그린다.
#
# 제약은 정답본과 같다. `import`와 `open`은 SWEA sandbox가 막는다.


def read_row(count):
    values = []
    while len(values) < count:
        values += list(map(int, input().split()))
    return values


case = 0

while True:
    try:
        header = input().strip()
    except EOFError:
        break

    if header == '':
        continue

    count = int(header)
    heights = read_row(count)
    case += 1

    total = 0
    for i in range(2, count - 2):
        tallest = max(heights[i - 2], heights[i - 1], heights[i + 1], heights[i + 2])
        if heights[i] > tallest:
            total += heights[i] - tallest

    # 일부러 1을 더한다. 조망권 세대 수는 음수가 될 수 없으므로 어떤
    # 테스트케이스에서도 정답과 겹치지 않는다.
    print(f'#{case} {total + 1}')
