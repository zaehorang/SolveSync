# SWEA 1206. View — 조망권이 확보된 세대의 수.
#
# 입력은 테스트케이스 10개가 이어 붙은 형태다. 선행 개수 줄이 없고 케이스
# 번호도 입력에 없다 — 번호는 읽은 순서로 만든다. 케이스마다 건물 개수 N이
# 한 줄, 그 다음 줄에 N개의 높이가 온다.
#
# 높이 줄을 통째로 `int()`에 넘기면 안 된다. 정수가 여러 개 들어 있어
# ValueError가 나고 SWEA는 그것을 Runtime Error로 보고한다(실측).
#
# `import`를 쓰지 않는다. SWEA 채점 sandbox는 import를 컴파일 오류로 막고
# `open`도 "허용하지 않는 라이브러리"로 거부한다(2026-08-25 실측). 표준입력을
# 읽는 수단은 `input()`뿐이다.
#
# 케이스 수를 10으로 박지 않고 EOF까지 읽는다. dry-run은 예제 3개만 넣기
# 때문에 10회로 고정하면 거기서 EOF를 만나 죽는다.


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

    # 양끝 두 칸은 항상 높이 0이므로 가운데만 본다. 좌우 2칸 안에서 가장
    # 높은 건물보다 높은 층수만큼 조망권이 확보된다.
    total = 0
    for i in range(2, count - 2):
        tallest = max(heights[i - 2], heights[i - 1], heights[i + 1], heights[i + 2])
        if heights[i] > tallest:
            total += heights[i] - tallest

    print(f'#{case} {total}')
