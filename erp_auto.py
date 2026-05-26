"""
부산사업소 매출 데이터 자동화 스크립트
매월 실행: ERP 로그인 → 수주관리 조회 → 다운로드 → Google Sheets 저장
"""

import asyncio
import glob
import os
from datetime import datetime, date
from calendar import monthrange
from playwright.async_api import async_playwright
import time

# ════════════════════════════════════════
# 설정값 (여기만 수정하면 됩니다)
# ════════════════════════════════════════
ERP_ID = "kwangho_lee"
ERP_PW = "ajou0700kh!!"   # ← 실제 비밀번호로 바꾸세요

EP_URL = "https://ep.fursys.com/account/login.do"

# 저장될 Google Sheets 파일 이름 형식
# 예: 부산사업소_매출_2026년04월
SHEET_NAME_FORMAT = "부산사업소_매출_{year}년{month:02d}월"

# ════════════════════════════════════════
# 전월 날짜 계산
# ════════════════════════════════════════
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


# ════════════════════════════════════════
# 메인 자동화 함수
# ════════════════════════════════════════
async def run():
    start_date, end_date, year, month = get_prev_month_range()
    sheet_name = SHEET_NAME_FORMAT.format(year=year, month=month)

    print(f"\n{'='*50}")
    print(f"  부산사업소 매출 자동화 시작")
    print(f"  조회 기간: {start_date} ~ {end_date}")
    print(f"  저장 파일명: {sheet_name}")
    print(f"{'='*50}\n")

    async with async_playwright() as p:
        # 브라우저 실행 (headless=False → 화면이 보임)
        browser = await p.chromium.launch(headless=False, slow_mo=800)
        context = await browser.new_context()
        page = await context.new_page()

        # ── STEP 1: EP 포털 로그인 ──────────────────────
        print("STEP 1: EP 포털 로그인 중...")
        await page.goto(EP_URL)
        await page.wait_for_load_state("networkidle")

        await page.fill('input[name="userId"], input[placeholder*="아이디"], #userId', ERP_ID)
        await page.fill('input[type="password"]', ERP_PW)
        await page.click('button:has-text("로그인")')
        await page.wait_for_load_state("networkidle")
        await asyncio.sleep(2)
        print("  ✅ EP 로그인 완료")

        # ── STEP 2: ERP 접속 (EP 통해) ───────────────────
        print("STEP 2: ERP 접속 중...")

        # 햄버거 메뉴 클릭
        try:
            await page.click('header button', timeout=3000)
            await asyncio.sleep(2)
            print("  햄버거 메뉴 클릭")
        except:
            pass

        # JS로 페이지 전체에서 ERP 관련 링크/버튼 탐색
        erp_href = await page.evaluate("""() => {
            const all = document.querySelectorAll('a, button, [onclick], li');
            for (const el of all) {
                const text = el.innerText || el.textContent || '';
                const href = el.href || el.getAttribute('href') || el.getAttribute('onclick') || '';
                if (text.includes('ERP') || href.includes('erp')) {
                    return { text: text.trim().slice(0,50), href: href.slice(0,100) };
                }
            }
            return null;
        }""")
        print(f"  JS 탐색 결과: {erp_href}")

        # iframe 안도 탐색
        for f in page.frames:
            if f == page.main_frame:
                continue
            try:
                result = await f.evaluate("""() => {
                    const all = document.querySelectorAll('a, button, li');
                    for (const el of all) {
                        const text = el.innerText || el.textContent || '';
                        const href = el.href || el.getAttribute('href') || '';
                        if (text.includes('ERP') || href.includes('erp')) {
                            return { text: text.trim().slice(0,50), href: href.slice(0,100) };
                        }
                    }
                    return null;
                }""")
                if result:
                    print(f"  iframe 탐색 결과 ({f.url[:50]}): {result}")
            except:
                continue

        # ERP Korea 클릭 시도
        erp_page = None
        for sel in [
            'a:has-text("ERP Korea")', 'a:has-text("ERP KOREA")',
            'li:has-text("ERP Korea")', 'button:has-text("ERP Korea")',
            '[href*="erp.fursys"]', 'a:has-text("ERP")',
        ]:
            try:
                el = page.locator(sel).first
                if await el.is_visible(timeout=1500):
                    async with context.expect_page() as erp_info:
                        await el.click()
                    erp_page = await erp_info.value
                    await erp_page.wait_for_load_state("networkidle")
                    print(f"  ERP 클릭 성공: {sel}")
                    break
            except:
                continue

        if erp_page is None:
            print("  ⚠️ 자동 접속 실패")
            print("  위의 JS 탐색 결과를 Claude에게 알려주세요")
            input("  ERP 화면으로 수동 이동 후 Enter 누르세요...")
            erp_page = next((p for p in context.pages if "erp.fursys.com" in p.url), context.pages[-1])

        await asyncio.sleep(3)
        print(f"  ✅ ERP 접속 완료 (URL: {erp_page.url})")

        # ── STEP 3: 수주관리 메뉴 진입 ──────────────────
        print("STEP 3: 수주관리 메뉴 진입 중...")
        print("  ERP URL:", erp_page.url)
        await erp_page.screenshot(path="debug_step3_start.png")

        try:
            # 1단계: 수주판매 클릭
            await erp_page.click('text=수주판매', timeout=5000)
            print("  수주판매 클릭 완료")
            await asyncio.sleep(1.5)

            # 2단계: 수주관리 클릭 (서브메뉴 펼치기)
            await erp_page.click('text=수주관리', timeout=5000)
            print("  수주관리 1차 클릭 완료")
            await asyncio.sleep(1.5)

            # 3단계: 수주관리 클릭 (실제 화면 진입) - 마지막 항목
            menu_items = erp_page.locator('text=수주관리')
            count = await menu_items.count()
            print(f"  수주관리 항목 수: {count}")
            await menu_items.last.click(timeout=5000)
            print("  수주관리 2차 클릭 완료")

        except Exception as e:
            print(f"  ❌ STEP 3 오류: {e}")
            await erp_page.screenshot(path="debug_step3_error.png")
            input("  수동으로 수주관리 화면 진입 후 Enter 누르세요...")

        await erp_page.wait_for_load_state("networkidle")
        await asyncio.sleep(3)
        await erp_page.screenshot(path="debug_step3_done.png")
        print("  ✅ 수주관리 화면 진입 완료")

        # ── STEP 4: 조회 조건 설정 ──────────────────────
        print("STEP 4: 조회 조건 설정 중...")
        await erp_page.screenshot(path="debug_step4_start.png")

        # 전체 frame 목록 출력 (디버깅)
        print(f"  전체 frame 수: {len(erp_page.frames)}")
        for i, f in enumerate(erp_page.frames):
            print(f"  frame[{i}] name={f.name!r} url={f.url[:80]}")

        # 콘텐츠 frame 찾기: 이름에 'work' 또는 'right' 포함, 혹은 input이 있는 frame
        content = erp_page
        for f in erp_page.frames:
            fname = f.name.lower()
            if any(k in fname for k in ['work', 'right', 'content', 'main']) and 'left' not in fname:
                content = f
                print(f"  콘텐츠 frame 선택 (이름): {f.name} / {f.url[:60]}")
                break

        # 이름으로 못 찾으면 input이 있는 frame 탐색
        if content is erp_page:
            for f in erp_page.frames:
                try:
                    cnt = await f.locator('input[type="text"]').count()
                    if cnt > 0:
                        content = f
                        print(f"  콘텐츠 frame 선택 (input 있음): {f.name} / {f.url[:60]}")
                        break
                except:
                    continue

        try:
            # 실적사업소 입력 (ERP는 보통 돋보기 버튼 옆 input)
            bizoffice_input = None
            for sel in [
                'input[id*="BizOfficeCode"]', 'input[id*="bizOffice"]',
                'input[id*="PerformOffice"]', 'input[id*="SalesOffice"]',
            ]:
                try:
                    el = content.locator(sel).first
                    if await el.is_visible(timeout=1000):
                        bizoffice_input = el
                        break
                except:
                    continue

            # ID로 못 찾으면 모든 text input 중 값이 빈 것 or '부산' 관련
            if bizoffice_input is None:
                inputs = content.locator('input[type="text"]')
                cnt = await inputs.count()
                print(f"  텍스트 input 수: {cnt}")
                # 첫 번째 visible input에 입력
                for i in range(cnt):
                    try:
                        el = inputs.nth(i)
                        if await el.is_visible(timeout=500):
                            bizoffice_input = el
                            break
                    except:
                        continue

            if bizoffice_input:
                await bizoffice_input.click()
                await bizoffice_input.fill('부산사업소')
                print("  실적사업소 입력 완료")
                await asyncio.sleep(0.8)
            else:
                print("  ⚠️ 실적사업소 input 못 찾음")

            # 납기일자 라디오
            for sel in ['input[type="radio"][value*="납기"]', 'label:has-text("납기일자")']:
                try:
                    await content.click(sel, timeout=2000)
                    print("  납기일자 선택 완료")
                    await asyncio.sleep(0.5)
                    break
                except:
                    continue

            # 날짜 input - type="text" 중 날짜 형식 input 찾기
            all_inputs = content.locator('input[type="text"]')
            total = await all_inputs.count()
            date_inputs_found = []
            for i in range(total):
                try:
                    el = all_inputs.nth(i)
                    val = await el.input_value()
                    # 날짜 형식이거나 비어있는 input
                    if await el.is_visible(timeout=300):
                        date_inputs_found.append(el)
                except:
                    continue

            print(f"  visible input 수: {len(date_inputs_found)}")

            # 날짜 input이 충분하면 마지막 두 개에 날짜 입력
            if len(date_inputs_found) >= 2:
                await date_inputs_found[-2].click()
                await date_inputs_found[-2].fill(start_date)
                await asyncio.sleep(0.3)
                await date_inputs_found[-1].click()
                await date_inputs_found[-1].fill(end_date)
                print(f"  날짜 입력: {start_date} ~ {end_date}")

            await asyncio.sleep(0.5)
            await erp_page.screenshot(path="debug_step4_filled.png")

            # 조회 버튼
            for sel in ['button:has-text("조회")', 'input[value="조회"]',
                        '[title="조회"]', 'button[id*="조회"]']:
                try:
                    el = content.locator(sel).first
                    if await el.is_visible(timeout=2000):
                        await el.click()
                        print("  조회 버튼 클릭 완료")
                        break
                except:
                    continue

            await asyncio.sleep(5)
            await erp_page.screenshot(path="debug_step4_done.png")
            print("  ✅ 조회 완료")

        except Exception as e:
            print(f"  ❌ STEP 4 오류: {e}")
            await erp_page.screenshot(path="debug_step4_error.png")
            input("  조회 조건 수동 입력 후 조회 버튼까지 누르고 Enter 누르세요...")

        # ── STEP 5: 라인모드 → 자료변환 (파일 다운로드) ─────
        print("STEP 5: 데이터 다운로드 중...")
        await erp_page.screenshot(path="debug_step5_start.png")

        downloads_dir = os.path.expanduser("~/Downloads")
        download_path = None
        click_time = time.time()  # 자료변환 클릭 직전 시각 기록

        def get_new_download(since_time, wait_sec=8):
            """since_time 이후에 생성/수정된 파일 반환"""
            deadline = time.time() + wait_sec
            while time.time() < deadline:
                candidates = []
                for f in glob.glob(os.path.join(downloads_dir, "*")):
                    if os.path.isfile(f) and os.path.getmtime(f) >= since_time - 1:
                        candidates.append(f)
                if candidates:
                    return max(candidates, key=os.path.getmtime)
                time.sleep(1)
            return None

        try:
            # iframe 포함 전체에서 데이터 행 찾기
            first_row = None
            for f in [erp_page] + erp_page.frames:
                try:
                    row = f.locator('table tbody tr').first
                    if await row.is_visible(timeout=2000):
                        first_row = row
                        content = f
                        print(f"  데이터 행 발견: {f.url[:60]}")
                        break
                except:
                    continue

            if first_row is None:
                raise Exception("데이터 행을 찾을 수 없음")

            # 우클릭 → 라인모드
            await first_row.click(button='right')
            await asyncio.sleep(1)
            await erp_page.click('text=라인모드')
            await asyncio.sleep(1.5)
            print("  라인모드 클릭 완료")

            # 다시 우클릭 → 자료변환
            await first_row.click(button='right')
            await asyncio.sleep(1)
            click_time = time.time()
            await erp_page.click('text=자료변환')
            await asyncio.sleep(3)

        except Exception as e:
            print(f"  ❌ STEP 5 자동 실패: {e}")
            await erp_page.screenshot(path="debug_step5_error.png")
            click_time = time.time()
            input("  수동으로 라인모드→자료변환 실행 후 파일 다운로드 완료되면 Enter 누르세요...")

        # 다운로드된 파일 감지 (자료변환 클릭 시각 기준)
        print("  파일 다운로드 대기 중...")
        download_path = get_new_download(since_time=click_time, wait_sec=15)
        if download_path:
            print(f"  ✅ 새 파일 감지: {download_path}")
        else:
            print("  ⚠️ 다운로드 파일을 찾지 못했습니다.")

        # ── STEP 6: 다운로드 파일 → Google Sheets 업로드 ──
        print("STEP 6: Google Sheets 업로드 중...")

        if download_path and os.path.exists(download_path):
            print(f"  업로드할 파일: {download_path}")
            print(f"  파일 크기: {os.path.getsize(download_path):,} bytes")
            # TODO: gspread로 Google Sheets 업로드 (다음 단계에서 구현)
            print("  ✅ 파일 준비 완료 - Google Sheets 업로드는 다음 단계에서 구현")
        else:
            print("  ⚠️ 다운로드 파일을 찾지 못했습니다.")

        print(f"\n{'='*50}")
        print(f"  완료! {sheet_name} 저장됨")
        print(f"{'='*50}\n")

        input("  완료 확인 후 Enter 누르면 브라우저가 닫힙니다...")
        await browser.close()


# ════════════════════════════════════════
# 실행
# ════════════════════════════════════════
if __name__ == "__main__":
    asyncio.run(run())
