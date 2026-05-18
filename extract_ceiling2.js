const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

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

function extractCeiling(fullText) {
  const lines = fullText.split('\n');
  const results = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/천장|천정/.test(line)) {
      // 이 줄과 앞뒤 줄에서 숫자 찾기
      const ctx = [lines[i-1]||'', line, lines[i+1]||''].join(' ');
      const nums = ctx.match(/\d+\.\d+/g);
      if (nums) {
        nums.forEach(n => {
          const v = parseFloat(n);
          if (v >= 2.0 && v <= 4.0) {
            results.push(`${v}m`);
          }
        });
      }
    }
  }
  const unique = [...new Set(results)];
  return unique.length > 0 ? unique.join(', ') : '미확인';
}

const tmpDir = path.join(__dirname, 'pdfs');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

const apartments = [
  { name: '청계리버뷰자이', url: 'https://files-scs.pstatic.net/2023/12/01/XRWDM3VU8A/%EC%B2%AD%EA%B3%84%EB%A6%AC%EB%B2%84%EB%B7%B0%EC%9E%90%EC%9D%B4_%EC%9E%85%EC%A3%BC%EC%9E%90%EB%AA%A8%EC%A7%91%EA%B3%B5%EA%B3%A0_20231201_%EC%B2%AD%EA%B3%84%EB%A6%AC%EB%B2%84%EB%B7%B0%EC%9E%90%EC%9D%B4%20%EC%9E%85%EC%A3%BC%EC%9E%90%EB%AA%A8%EC%A7%91%EA%B3%B5%EA%B3%A0%EB%AC%B8.pdf' },
  { name: '광명자이힐스테이트SK뷰', url: 'https://byw.kr/wp-content/uploads/2023/12/%EA%B4%91%EB%AA%85%EC%9E%90%EC%9D%B4%ED%9E%90%EC%8A%A4%ED%85%8C%EC%9D%B4%ED%8A%B8SKVIEW-%EC%9E%85%EC%A3%BC%EC%9E%90%EB%AA%A8%EC%A7%91%EA%B3%B5%EA%B3%A0.pdf' },
  { name: '산성역헤리스톤', url: 'https://files-scs.pstatic.net/2024/06/23/SmynSyhcpj/%ED%97%A4%EB%A6%AC%EC%8A%A4%ED%86%A4%20%EC%9E%85%EC%A3%BC%EC%9E%90%EB%AA%A8%EC%A7%91%EA%B3%B5%EA%B3%A0.pdf' },
  { name: '힐스테이트더샵상생공원1단지', url: 'https://files-scs.pstatic.net/2025/03/27/u73XPz3oyV/%ED%9E%90%EC%8A%A4%ED%85%8C%EC%9D%B4%ED%8A%B8%20%EB%8D%94%EC%83%B5%20%EC%83%81%EC%83%9D%EA%B3%B5%EC%9B%90%20%EC%9E%85%EC%A3%BC%EC%9E%90%20%EB%AA%A8%EC%A7%91%EA%B3%B5%EA%B3%A0.pdf' },
  { name: '창경궁롯데캐슬시그니처', url: 'https://www.lottecastle.co.kr/cmm/fms/FileDown.do?fileId=FILE_000000000023264&saveFileNm=202411280448233040.pdf&fileSn=0' },
  { name: '대연디아이엘', url: 'https://image.r114.co.kr/imgdata/notice_file/2023/A03030004160082.pdf' },
  { name: '평촌자이퍼스니티', url: 'https://files-scs.pstatic.net/2024/11/20/4wbUTgw8gH/%ED%8F%89%EC%B4%8C%EC%9E%90%EC%9D%B4%ED%8D%BC%EC%8A%A4%EB%8B%88%ED%8B%B0%20%EC%9E%85%EC%A3%BC%EC%9E%90%EB%AA%A8%EC%A7%91%EA%B3%B5%EA%B3%A0.pdf' },
];

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

async function processPDF(apt) {
  const dest = path.join(tmpDir, apt.name.replace(/[/\\:*?"<>|]/g, '_') + '.pdf');
  try {
    if (!fs.existsSync(dest) || fs.statSync(dest).size < 1000) {
      process.stderr.write(`다운로드 중: ${apt.name}\n`);
      await downloadPDF(apt.url, dest);
    }
    const text = await extractTextFromPDF(dest);
    const ceiling = extractCeiling(text);
    console.log(`${apt.name}|${ceiling}`);
  } catch (e) {
    console.log(`${apt.name}|오류: ${e.message}`);
  }
}

(async () => {
  for (const apt of apartments) {
    await processPDF(apt);
  }
})();
