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
#
# **이 풀이는 일부러 길다.** SWEA editor는 CodeMirror이고 화면에 보이는 줄만
# DOM에 그린다. bridge가 DOM이 아니라 editor instance의 `getValue()`를 부르는
# 덕에 화면 밖 줄도 와야 하는데, 짧은 풀이로는 그 전제가 검증되지 않는다.
# 그래서 좌우 도달 거리를 상수로 빼고 각 단계를 함수로 갈라 두었다.


REACH = 2


def read_line():
    """공백 줄을 건너뛰고 다음 내용 줄을 준다. EOF면 None이다."""
    while True:
        try:
            line = input()
        except EOFError:
            return None

        stripped = line.strip()

        if stripped != '':
            return stripped


def read_values(count):
    """정수 count개를 모을 때까지 줄을 이어 읽는다.

    한 줄에 다 오는 것이 보통이지만 그것을 전제하지 않는다.
    """
    values = []

    while len(values) < count:
        line = read_line()

        if line is None:
            break

        for token in line.split():
            values.append(int(token))

    return values


def read_case():
    """다음 케이스의 높이 목록을 준다. 더 없으면 None이다."""
    header = read_line()

    if header is None:
        return None

    return read_values(int(header))


def tallest_around(heights, index):
    """index 좌우 REACH칸 중 가장 높은 건물의 높이."""
    tallest = 0
    offset = -REACH

    while offset <= REACH:
        if offset != 0:
            neighbor = heights[index + offset]

            if neighbor > tallest:
                tallest = neighbor

        offset += 1

    return tallest


def count_view(heights):
    """조망권이 확보된 세대 수.

    양끝 REACH칸은 항상 높이 0이므로 가운데만 본다. 좌우 REACH칸 안에서 가장
    높은 건물보다 높은 층수만큼 조망권이 확보된다.
    """
    total = 0
    index = REACH
    limit = len(heights) - REACH

    while index < limit:
        tallest = tallest_around(heights, index)

        if heights[index] > tallest:
            total += heights[index] - tallest

        index += 1

    return total


def solve():
    case = 0

    while True:
        heights = read_case()

        if heights is None:
            break

        case += 1
        print(f'#{case} {count_view(heights)}')


solve()
