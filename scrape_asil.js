/**
 * scrape_asil.js
 * asil.kr에서 2027년 전국 아파트 입주물량 데이터를 가져와
 * asil_2027_raw.csv + apt_list.txt 갱신
 */
const https = require('https');
const fs    = require('fs');
const path  = require('path');

// 전국 시/도 코드 (area=0 이 전체가 아닐 경우 개별 코드로 수집)
const SIDO_CODES = [
  { code: '11', name: '서울'  },
  { code: '41', name: '경기'  },
  { code: '28', name: '인천'  },
  { code: '42', name: '강원'  },
  { code: '43', name: '충북'  },
  { code: '44', name: '충남'  },
  { code: '30', name: '대전'  },
  { code: '47', name: '경북'  },
  { code: '48', name: '경남'  },
  { code: '27', name: '대구'  },
  { code: '26', name: '부산'  },
  { code: '31', name: '울산'  },
  { code: '45', name: '전북'  },
  { code: '46', name: '전남'  },
  { code: '29', name: '광주'  },
  { code: '50', name: '제주'  },
  { code: '36', name: '세종'  },
];

function get(url) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'asil.kr',
      path: url,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://asil.kr/app/household.jsp',
        'Accept': 'application/json, text/plain, */*',
      }
    };
    const req = https.request(opts, res => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function fetchSido(code, name) {
  const qs = new URLSearchParams({
    area: code,
    order: 'movein_yyyymm',
    orderby: 'asc',
    sY: '2027', sM: '1',
    eY: '2027', eM: '12',
  });
  const res = await get(`/app/data/data_movein.jsp?${qs}`);
  if (res.status !== 200) throw new Error(`${name} HTTP ${res.status}`);

  let json;
  try { json = JSON.parse(res.data); } catch { return []; }
  const list = Array.isArray(json) ? json : (json.list || json.data || []);

  return list.map(item => ({
    region: name,
    addr:      (item.addr  || '').trim(),
    name:      (item.name  || '').trim(),
    movein:    (item.movein || '').trim(),           // "2027년 3월"
    household: String(item.household || '0').replace(/[^0-9]/g, ''),
  })).filter(r => r.name && r.movein);
}

async function main() {
  console.log('asil.kr 2027년 전국 입주물량 수집 중...');
  const all = [];

  for (const sido of SIDO_CODES) {
    try {
      const rows = await fetchSido(sido.code, sido.name);
      console.log(`  ${sido.name}: ${rows.length}개`);
      all.push(...rows);
    } catch (e) {
      console.warn(`  ${sido.name} 실패: ${e.message}`);
    }
    // 요청 간 간격
    await new Promise(r => setTimeout(r, 300));
  }

  // 중복 제거 (같은 단지명+입주월)
  const seen = new Set();
  const deduped = all.filter(r => {
    const key = `${r.name}|${r.movein}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // 입주월 오름차순 정렬
  deduped.sort((a, b) => a.movein.localeCompare(b.movein, 'ko'));

  // CSV 저장
  const csvLines = ['"region","addr","name","movein","movein_ym","household"'];
  for (const r of deduped) {
    const ym = r.movein.replace(/[^0-9]/g, '').padEnd(6, '0');
    csvLines.push(`"${r.region}","${r.addr}","${r.name}","${r.movein}","${ym}","${r.household}"`);
  }
  fs.writeFileSync(path.join(__dirname, 'asil_2027_raw.csv'), csvLines.join('\n'), 'utf8');

  // apt_list.txt 저장
  const aptLines = deduped.map(r => `${r.name}|${r.addr}|${r.movein}|${r.household}`);
  fs.writeFileSync(path.join(__dirname, 'apt_list.txt'), aptLines.join('\n') + '\n', 'utf8');

  console.log(`\n✅ 총 ${deduped.length}개 단지 저장 완료`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
