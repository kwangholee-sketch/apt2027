/**
 * scrape_asil.js
 * asil.kr에서 2027년 아파트 입주물량 데이터를 가져와 asil_2027_raw.csv 갱신
 *
 * ⚠️  ENDPOINT 설정 필요
 * asil.kr 페이지에서 F12 → Network → XHR 탭에서
 * 입주물량 데이터를 로드할 때 발생하는 요청 URL과 파라미터를 확인 후 아래에 입력하세요.
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

// ─────────────────────────────────────────────────────────
// TODO: 아래 값을 asil.kr DevTools에서 확인한 실제 값으로 교체하세요
const ASIL_ENDPOINT = 'https://asil.kr/asil/TODO_ENDPOINT';  // ← 실제 URL
const ASIL_METHOD   = 'POST';                                  // 'GET' or 'POST'
const ASIL_PARAMS   = (year) => new URLSearchParams({          // ← 실제 파라미터
  // 예시: year: year, type: 'movein', page: 1, rows: 500
  year: year
}).toString();
// ─────────────────────────────────────────────────────────

const TARGET_YEAR = '2027';

function request(url, method, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const opts = {
      hostname: u.hostname,
      path: u.pathname + (method === 'GET' && body ? '?' + body : ''),
      method,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, */*',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://asil.kr/',
        ...(method === 'POST' ? { 'Content-Length': Buffer.byteLength(body) } : {})
      }
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    if (method === 'POST') req.write(body);
    req.end();
  });
}

// asil.kr 응답 JSON → CSV 행 변환
// ⚠️  응답 JSON 구조에 맞게 수정 필요
function parseResponse(json) {
  const rows = [];
  const list = json.list || json.data || json.result || json;
  for (const item of (Array.isArray(list) ? list : [])) {
    const region = (item.sido || item.region || '').trim();
    const addr   = (item.addr || item.address || item.juso || '').trim();
    const name   = (item.aptNm || item.name || item.aptName || '').trim();
    const movein = (item.moveInYm || item.movein || item.enterYm || '').trim();
    const hh     = String(item.hhldCnt || item.household || item.세대수 || 0);

    if (!name || !movein) continue;

    // movein을 "2027년 3월" 형식으로 정규화
    const moveinFmt = movein.replace(/^(\d{4})(\d{2})$/, (_, y, m) =>
      `${y}년 ${parseInt(m)}월`
    );
    const moveinYm = movein.replace(/[^0-9]/g, '').slice(0, 6);

    rows.push({ region, addr: addr || region, name, movein: moveinFmt, moveinYm, household: hh });
  }
  return rows;
}

async function main() {
  if (ASIL_ENDPOINT.includes('TODO')) {
    console.error('❌ ASIL_ENDPOINT가 설정되지 않았습니다.');
    console.error('   scrape_asil.js 상단의 TODO 항목을 채워주세요.');
    process.exit(1);
  }

  console.log(`asil.kr에서 ${TARGET_YEAR}년 입주물량 데이터 수집 중...`);
  const params = ASIL_PARAMS(TARGET_YEAR);
  const res = await request(ASIL_ENDPOINT, ASIL_METHOD, params);

  if (res.status !== 200) {
    console.error(`❌ HTTP ${res.status}: ${res.data.substring(0, 200)}`);
    process.exit(1);
  }

  let json;
  try { json = JSON.parse(res.data); }
  catch { console.error('❌ JSON 파싱 실패:', res.data.substring(0, 300)); process.exit(1); }

  const rows = parseResponse(json);
  if (rows.length === 0) {
    console.error('❌ 데이터가 없습니다. parseResponse() 함수를 응답 구조에 맞게 수정하세요.');
    console.log('응답 샘플:', res.data.substring(0, 500));
    process.exit(1);
  }

  // CSV 저장
  const csvLines = ['"region","addr","name","movein","movein_ym","household"'];
  for (const r of rows) {
    csvLines.push(`"${r.region}","${r.addr}","${r.name}","${r.movein}","${r.moveinYm}","${r.household}"`);
  }
  fs.writeFileSync(path.join(__dirname, 'asil_2027_raw.csv'), csvLines.join('\n'), 'utf8');

  // apt_list.txt 갱신
  const aptLines = rows.map(r => `${r.name}|${r.addr}|${r.movein}|${r.household}`);
  fs.writeFileSync(path.join(__dirname, 'apt_list.txt'), aptLines.join('\n') + '\n', 'utf8');

  console.log(`✅ ${rows.length}개 단지 수집 완료`);
}

main().catch(e => { console.error(e); process.exit(1); });
