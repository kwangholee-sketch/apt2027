/**
 * ceiling_batch.js
 * 164개 아파트 천장고 수집 스크립트
 * - PDF URL이 있는 아파트: 다운로드 후 파싱
 * - 나머지: 브랜드/지역 기반 기본값 사용
 */
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const tmpDir = path.join(__dirname, 'pdfs');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

async function downloadPDF(url, dest, redirectCount = 0) {
  if (redirectCount > 5) throw new Error('Too many redirects');
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/pdf,*/*'
      }
    };
    proto.get(url, options, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        const loc = res.headers.location;
        res.resume();
        if (!loc) { reject(new Error('Redirect without location')); return; }
        const nextUrl = loc.startsWith('http') ? loc : new URL(loc, url).href;
        downloadPDF(nextUrl, dest, redirectCount + 1).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) { reject(new Error('HTTP ' + res.statusCode)); return; }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
      file.on('error', reject);
    }).on('error', reject);
  });
}

async function extractTextFromPDF(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const loadingTask = pdfjsLib.getDocument({ data, useSystemFonts: true });
  const doc = await loadingTask.promise;
  let fullText = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map(item => item.str).join('\n');
    fullText += pageText + '\n';
  }
  return fullText;
}

function extractCeiling(fullText) {
  const lines = fullText.split('\n');
  const results = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/천장|천정/.test(line)) {
      const ctx = [lines[i-1]||'', line, lines[i+1]||''].join(' ');
      // mm 단위 패턴 (2300, 2400 등)
      const mmNums = ctx.match(/[Hh]:\s*(\d{4})|(\d{4})\s*mm|(\d{4})mm/g);
      if (mmNums) {
        for (const m of mmNums) {
          const n = m.replace(/[Hh]:\s*|mm/gi, '').replace(/,/g,'').trim();
          const v = parseInt(n);
          if (v >= 2000 && v <= 4000) results.push((v/1000).toFixed(1) + 'm');
        }
      }
      // m 단위 패턴
      const mNums = ctx.match(/(\d+\.\d+)\s*[Mm]/g);
      if (mNums) {
        for (const m of mNums) {
          const v = parseFloat(m);
          if (v >= 2.0 && v <= 4.0) results.push(v.toFixed(1) + 'm');
        }
      }
    }
  }
  // 중복 제거, 정렬
  const unique = [...new Set(results)].sort();
  if (unique.length > 0) return unique.join(', ');

  // 더 넓은 패턴: 천장 근처 숫자
  for (let i = 0; i < lines.length; i++) {
    if (/천장|천정/.test(lines[i])) {
      const ctx = [lines[i-1]||'', lines[i], lines[i+1]||''].join(' ');
      const nums = ctx.match(/\d+[,.]?\d*/g);
      if (nums) {
        for (const n of nums) {
          const v = parseFloat(n.replace(',',''));
          if (v >= 2.0 && v <= 4.0) results.push(v.toFixed(1) + 'm');
          else if (v >= 2000 && v <= 4000) results.push((v/1000).toFixed(1) + 'm');
        }
      }
    }
  }
  const unique2 = [...new Set(results)].sort();
  return unique2.length > 0 ? unique2.join(', ') : '미확인';
}

// 브랜드/지역 기반 기본 천장고 추정
function estimateCeiling(aptName, addr) {
  // 서울 프리미엄 재건축 자이
  if (/자이/.test(aptName) && /서울/.test(addr) && !/성북|강북|노원/.test(addr)) return '2.4m';
  // 디에이치 (현대건설 최고급)
  if (/디에이치/.test(aptName)) return '2.4m';
  // 디에트르 (대방건설 프리미엄)
  if (/디에트르|대방엘리움/.test(aptName)) return '2.4m';
  // 한신더휴하이엔 (프리미엄)
  if (/한신더휴하이엔/.test(aptName)) return '2.4m';
  // 서울대방신혼희망타운은 공공
  if (/신혼희망타운/.test(aptName)) return '2.3m';
  // 공공분양
  if (/공공분양/.test(aptName)) return '2.3m';
  // 일반 - 대부분 2.3m
  return '2.3m';
}

// PDF를 가진 아파트 목록 (다운로드 및 파싱)
const pdfApts = [
  {
    name: '마포푸르지오어반피스',
    url: 'https://www.prugio.com/hb/2023/mapo/main/sub/announcement.pdf?v1='
  },
  {
    name: '푸르지오라디우스파크',
    url: 'https://files-scs.pstatic.net/2024/07/14/4ss3pKK0J0/2024000284%20%ED%91%B8%EB%A5%B4%EC%A7%80%EC%98%A4%20%EB%9D%BC%EB%94%94%EC%9A%B0%EC%8A%A4%20%ED%8C%8C%ED%81%AC%20%EC%9E%85%EC%A3%BC%EC%9E%90%EB%AA%A8%EC%A7%91%EA%B3%B5%EA%B3%A0%EB%AC%B8.pdf'
  },
  {
    name: '광명자이힐스테이트SK뷰',
    url: 'https://blog.kakaocdn.net/dn/DM8fX/btsG1eIYLJh/NmIyjyZbYsxNYc0oP15By1/%EA%B4%91%EB%AA%85%EC%9E%90%EC%9D%B4%ED%9E%90%EC%8A%A4%ED%85%8C%EC%9D%B4%ED%8A%B8SKVIEW%20%EB%AA%A8%EC%A7%91%EA%B3%B5%EA%B3%A0.pdf?attach=1&knm=tfile.dat'
  },
  {
    name: '과천디에트르퍼스티지(S2BL)',
    url: 'https://files-scs.pstatic.net/2024/06/30/OzXxmQUlTj/(24.6.28.%20%EC%A0%95%EC%A0%95)%202024000249%20%EA%B3%BC%EC%B2%9C%20%EB%94%94%EC%97%90%ED%8A%B8%EB%A5%B4%20%ED%8D%BC%EC%8A%A4%ED%8B%B0%EC%A7%80(S2BL)%20%EC%9E%85%EC%A3%BC%EC%9E%90%EB%AA%A8%EC%A7%91%EA%B3%B5%EA%B3%A0%EB%AC%B8.pdf'
  },
  // 브랜드 기준용 (에피트 브랜드 확인용)
  {
    name: '_proxy_에피트',
    url: 'https://files-scs.pstatic.net/2025/11/14/1HniTVvURS/%EB%B3%B5%EC%A0%95%EC%97%AD%20%EC%97%90%ED%94%BC%ED%8A%B8%20%EC%9E%85%EC%A3%BC%EC%9E%90%20%EB%AA%A8%EC%A7%91%EA%B3%B5%EA%B3%A0.pdf'
  },
  // 디에이치 브랜드 확인용
  {
    name: '_proxy_디에이치',
    url: 'https://files-scs.pstatic.net/2024/09/26/JPrZ1gTamQ/%EB%94%94%EC%97%90%EC%9D%B4%EC%B9%98%20%EB%8C%80%EC%B9%98%20%EC%97%90%EB%8D%B8%EB%A3%A8%EC%9D%B4%20%EC%9E%85%EC%A3%BC%EC%9E%90%EB%AA%A8%EC%A7%91%EA%B3%B5%EA%B3%A0%EB%AC%B8.pdf'
  }
];

// 이미 다운로드된 PDF 결과 (기존 파싱 완료)
const confirmedData = {
  '청계리버뷰자이': { ceiling: '2.4m', source: 'PDF확인' },
  '대연디아이엘': { ceiling: '2.3m', source: 'PDF확인' },
  '힐스테이트더샵상생공원1단지': { ceiling: '2.3m', source: 'PDF확인' },
  '창경궁롯데캐슬시그니처': { ceiling: '2.3m', source: 'PDF확인' },
  '산성역헤리스톤': { ceiling: '2.3m', source: 'PDF확인' },
};

async function processPDFApt(apt) {
  const safeName = apt.name.replace(/[/\\:*?"<>|()]/g, '_');
  const dest = path.join(tmpDir, safeName + '.pdf');
  try {
    if (!fs.existsSync(dest) || fs.statSync(dest).size < 5000) {
      process.stderr.write(`다운로드: ${apt.name}\n`);
      await downloadPDF(apt.url, dest);
    }
    const stat = fs.statSync(dest);
    if (stat.size < 5000) throw new Error('파일 너무 작음: ' + stat.size);
    const text = await extractTextFromPDF(dest);
    const ceiling = extractCeiling(text);
    return { name: apt.name, ceiling, source: 'PDF확인' };
  } catch (e) {
    process.stderr.write(`오류 [${apt.name}]: ${e.message}\n`);
    return { name: apt.name, ceiling: null, source: '오류' };
  }
}

// apt_list.txt 읽기
const aptList = fs.readFileSync(path.join(__dirname, 'apt_list.txt'), 'utf8')
  .split('\n')
  .filter(l => l.trim())
  .map(l => {
    const parts = l.split('|');
    return { name: parts[0].trim(), addr: parts[1]?.trim() || '', movein: parts[2]?.trim() || '', households: parts[3]?.trim() || '' };
  });

(async () => {
  // PDF 다운로드/파싱
  const pdfResults = {};
  for (const apt of pdfApts) {
    const r = await processPDFApt(apt);
    if (r.ceiling && r.ceiling !== '미확인') {
      pdfResults[r.name] = { ceiling: r.ceiling, source: r.source };
    }
    process.stderr.write(`  → ${r.name}: ${r.ceiling}\n`);
  }

  // 에피트/디에이치 브랜드 기본값 결정
  const efeteDefault = pdfResults['_proxy_에피트']?.ceiling || '2.3m';
  const dihDefault = pdfResults['_proxy_디에이치']?.ceiling || '2.4m';
  process.stderr.write(`에피트 브랜드 기본값: ${efeteDefault}\n`);
  process.stderr.write(`디에이치 브랜드 기본값: ${dihDefault}\n`);

  // 전체 아파트 결과 생성
  const allResults = [];
  for (const apt of aptList) {
    let result;

    // 1순위: 기확인 데이터
    if (confirmedData[apt.name]) {
      result = confirmedData[apt.name];
    }
    // 2순위: PDF 파싱 데이터
    else if (pdfResults[apt.name]) {
      result = pdfResults[apt.name];
    }
    // 3순위: 에피트 브랜드 프록시
    else if (/에피트/.test(apt.name)) {
      result = { ceiling: efeteDefault, source: '브랜드추정(에피트)' };
    }
    // 4순위: 디에이치 브랜드
    else if (/디에이치/.test(apt.name)) {
      result = { ceiling: dihDefault, source: '브랜드추정(디에이치)' };
    }
    // 5순위: 기본 추정
    else {
      result = { ceiling: estimateCeiling(apt.name, apt.addr), source: '브랜드추정' };
    }

    allResults.push({
      name: apt.name,
      addr: apt.addr,
      movein: apt.movein,
      households: apt.households,
      ceiling: result.ceiling,
      source: result.source
    });
  }

  // JSON 출력
  console.log(JSON.stringify(allResults, null, 2));
})();
