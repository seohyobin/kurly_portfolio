// 마켓컬리 포트폴리오 - 메인 페이지 자동화 시나리오 (Playwright + 순수 Node.js)
//
// 실행:  node automation/main-page-scenario.js
// 옵션:  HEADED=1  → 브라우저 창을 띄워서 천천히 진행 (눈으로 확인용)
//        SITE=https://내사이트주소/  → 배포된 사이트로 테스트 (지정 안 하면 build/ 를 로컬로 띄움)
const { chromium } = require('playwright');
const path = require('path');

const PORT = 4174;
const SITE = process.env.SITE || `http://localhost:${PORT}/`;
const HEADED = !!process.env.HEADED;
const SHOT_DIR = path.join(__dirname, 'screenshots');

let step = 0, passed = 0, failed = 0;
const results = [];

// 시나리오 한 단계를 실행하고 성공/실패를 기록
async function scenario(name, fn) {
  step++;
  const label = `${String(step).padStart(2, '0')}. ${name}`;
  try {
    await fn();
    passed++; results.push({ label, ok: true });
    console.log(`  ✅ ${label}`);
  } catch (e) {
    failed++; results.push({ label, ok: false, error: e.message.split('\n')[0] });
    console.log(`  ❌ ${label}\n      → ${e.message.split('\n')[0]}`);
  }
}

// 간단한 검증 함수
function expectEqual(actual, expected, what) {
  if (actual !== expected) throw new Error(`${what}: 기대값 "${expected}" / 실제값 "${actual}"`);
}

(async () => {
  let server = null;
  if (!process.env.SITE) {
    server = require('./serve-build');
    await new Promise((r) => server.listen(PORT, r));
  }

  const browser = await chromium.launch({ headless: !HEADED, slowMo: HEADED ? 400 : 0 });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();
  const shot = (name) => page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`) });

  console.log(`\n🛒 마켓컬리 메인 페이지 시나리오 시작 (${SITE})\n`);

  // ─────────────────────────── 1. 첫 진입 & 팝업 ───────────────────────────
  await scenario('메인 페이지 접속 → 상단 띠배너와 메인 팝업이 보인다', async () => {
    await page.goto(SITE);
    await page.locator('#topModal').waitFor({ timeout: 5000 });
    await page.locator('#mainModal').waitFor({ timeout: 5000 });
    await shot('01-first-visit');
  });

  await scenario('메인 팝업 [닫기] 클릭 → 팝업이 사라진다', async () => {
    await page.locator('#mainModal').getByRole('button', { name: '닫기' }).click();
    await page.locator('#mainModal').waitFor({ state: 'detached', timeout: 3000 });
  });

  await scenario('상단 띠배너 X 클릭 → 띠배너가 사라진다', async () => {
    await page.locator('#topModal svg').click();
    await page.locator('#topModal').waitFor({ state: 'detached', timeout: 3000 });
  });

  // ─────────────────────────── 2. 헤더 ───────────────────────────
  await scenario('헤더에 회원가입 / 로그인 / 고객센터 메뉴가 있다', async () => {
    for (const name of ['회원가입', '로그인', '고객센터']) {
      await page.getByRole('link', { name, exact: false }).first().waitFor({ timeout: 3000 });
    }
  });

  await scenario('검색창에 "사과" 입력', async () => {
    const search = page.getByPlaceholder('검색어를 입력해 주세요');
    await search.fill('사과');
    expectEqual(await search.inputValue(), '사과', '검색창 값');
  });

  // ─────────────────────────── 3. 메인 배너 슬라이드 ───────────────────────────
  const current = page.locator('#section1 .current-number, .current-number').first();

  await scenario('메인 배너 슬라이드: 처음엔 1번 슬라이드', async () => {
    await current.waitFor({ timeout: 5000 });
    expectEqual(await current.textContent(), '1', '현재 슬라이드 번호');
  });

  await scenario('메인 배너 [다음] 버튼 → 2번 슬라이드', async () => {
    await page.locator('.right-arrorw-btn').first().click();
    await page.waitForTimeout(700); // 슬라이드 애니메이션 대기
    expectEqual(await current.textContent(), '2', '현재 슬라이드 번호');
  });

  await scenario('메인 배너 [이전] 버튼 → 다시 1번 슬라이드', async () => {
    await page.locator('.left-arrorw-btn').first().click();
    await page.waitForTimeout(700);
    expectEqual(await current.textContent(), '1', '현재 슬라이드 번호');
  });

  // ─────────────────────────── 4. 상품 영역 ───────────────────────────
  // "이 상품 어때요?" 제목이 section3, section7 두 곳에 있어서 id로 정확히 지정
  for (const id of ['section3', 'section7']) {
    await scenario(`#${id} "이 상품 어때요?" 영역에 상품이 20개 표시된다`, async () => {
      const section = page.locator(`#${id}`);
      await section.scrollIntoViewIfNeeded();
      await section.getByRole('heading', { name: '이 상품 어때요?' }).waitFor({ timeout: 3000 });
      expectEqual(await section.locator('li.slide').count(), 20, '상품 개수');
    });
  }
  await shot('02-product-section');

  await scenario('상품 카드 가격이 천 단위 콤마 형식이다 (예: 42,900)', async () => {
    const priceText = (await page.locator('#section3 .panme-price').first().textContent()).trim();
    if (!/^\d{1,3}(,\d{3})+/.test(priceText)) throw new Error(`가격 형식 이상: "${priceText}"`);
  });

  // ─────────────────────────── 5. 메뉴 이동 ───────────────────────────
  await scenario('카테고리 메뉴 [신상품] 클릭 → /sub1 이동', async () => {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByRole('link', { name: '신상품', exact: true }).first().click();
    await page.waitForURL('**/sub1', { timeout: 5000 });
  });

  await scenario('장바구니 아이콘 클릭 → /cart 이동', async () => {
    await page.locator('a[href="/cart"]').first().click();
    await page.waitForURL('**/cart', { timeout: 5000 });
    await shot('03-cart');
  });

  await scenario('로고(마켓컬리) 클릭 → 메인으로 돌아온다', async () => {
    await page.getByRole('link', { name: '마켓컬리' }).first().click();
    await page.waitForURL('**/main', { timeout: 5000 });
  });

  // ─────────────────────────── 6. 팝업 "다시안보기" ───────────────────────────
  await scenario('새 방문자: 메인 팝업 [다시안보기] → 새로고침해도 팝업이 안 뜬다', async () => {
    const fresh = await browser.newContext({ viewport: { width: 1400, height: 900 } }); // 새 방문자(저장값 없음)
    const p = await fresh.newPage();
    await p.goto(SITE);
    await p.locator('#mainModal').getByRole('button', { name: '다시안보기' }).click();
    const saved = await p.evaluate(() => localStorage.getItem('MAINMODALONEYEARCLOSE'));
    if (!saved) throw new Error('localStorage에 MAINMODALONEYEARCLOSE 가 저장되지 않음');
    await p.reload();
    await p.waitForTimeout(1000);
    expectEqual(await p.locator('#mainModal').count(), 0, '새로고침 후 팝업 개수');
    await fresh.close();
  });

  // ─────────────────────────── 결과 ───────────────────────────
  await browser.close();
  server && server.close();

  console.log(`\n📸 스크린샷: ${SHOT_DIR}`);
  console.log(`📊 결과: 총 ${step}단계 / ✅ ${passed} 성공 / ❌ ${failed} 실패\n`);
  process.exit(failed ? 1 : 0);
})();
