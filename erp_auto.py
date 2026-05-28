"""
부산사업소 매출 - 전월 조회 기간 안내
"""

from datetime import date
from calendar import monthrange


def get_prev_month_range():
    today = date.today()
    if today.month == 1:
        year, month = today.year - 1, 12
    else:
        year, month = today.year, today.month - 1
    last_day = monthrange(year, month)[1]
    start = f"{year}-{month:02d}-01"
    end   = f"{year}-{month:02d}-{last_day:02d}"
    return start, end, year, month


def main():
    start_date, end_date, year, month = get_prev_month_range()

    print(f"\n{'='*50}")
    print(f"  부산사업소 매출 - {year}년 {month:02d}월")
    print(f"{'='*50}")
    print()
    print("  [ERP 조회 조건]")
    print(f"  실적사업소 : (전체 - 비워두기)")
    print(f"  납기일자   : {start_date} ~ {end_date}")
    print()
    print("  [작업 순서]")
    print("  1. ERP → 수주판매 → 수주관리 → 수주관리")
    print("  2. 실적사업소 비우고, 납기일자 + 날짜 입력 후 조회")
    print("  3. 데이터 행 우클릭 → 라인모드")
    print("  4. 다시 우클릭 → 자료변환 → 다운로드")
    print("  5. 파일 → Google Sheets로 저장")
    print()
    print(f"{'='*50}\n")


if __name__ == "__main__":
    main()
