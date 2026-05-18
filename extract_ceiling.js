const { PDFParse } = require('pdf-parse');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

function downloadPDF(url, dest) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/pdf,*/*'
      }
    };
    proto.get(url, options, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        downloadPDF(res.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', (e) => { fs.unlink(dest, () => {}); reject(e); });
  });
}

function extractCeiling(text) {
  // 천장고 패턴 찾기: 2.XM, 2.Xm, 2.X미터 등
  const patterns = [
    /천장고[^.]*?(\d+\.\d+)\s*[Mm]/g,
    /천정고[^.]*?(\d+\.\d+)\s*[Mm]/g,
    /거실.*?천장.*?(\d+\.\d+)\s*[Mm]/g,
    /(\d+\.\d+)\s*[Mm].*?천장고/g,
    /천장.*?높이.*?(\d+\.\d+)/g,
    /ceiling.*?(\d+\.\d+)/gi
  ];

  const found = new Set();
  for (const pat of patterns) {
    let m;
    while ((m = pat.exec(text)) !== null) {
      const val = parseFloat(m[1]);
      if (val >= 2.0 && val <= 4.0) found.add(val + 'm');
    }
  }

  // 더 넓은 패턴: 천장 근처 숫자
  const lines = text.split('\n');
  for (const line of lines) {
    if (line.includes('천장') || line.includes('천정')) {
      const nums = line.match(/\d+\.\d+/g);
      if (nums) {
        nums.forEach(n => {
          const v = parseFloat(n);
          if (v >= 2.0 && v <= 4.0) found.add(v + 'm (ctx: ' + line.trim().substring(0, 60) + ')');
        });
      }
    }
  }

  return found.size > 0 ? [...found].join(' | ') : '미확인';
}

const apartments = [
  { name: '청계리버뷰자이', url: 'https://files-scs.pstatic.net/2023/12/01/XRWDM3VU8A/%EC%B2%AD%EA%B3%84%EB%A6%AC%EB%B2%84%EB%B7%B0%EC%9E%90%EC%9D%B4_%EC%9E%85%EC%A3%BC%EC%9E%90%EB%AA%A8%EC%A7%91%EA%B3%B5%EA%B3%A0_20231201_%EC%B2%AD%EA%B3%84%EB%A6%AC%EB%B2%84%EB%B7%B0%EC%9E%90%EC%9D%B4%20%EC%9E%85%EC%A3%BC%EC%9E%90%EB%AA%A8%EC%A7%91%EA%B3%B5%EA%B3%A0%EB%AC%B8.pdf' },
  { name: '광명자이힐스테이트SK뷰', url: 'https://byw.kr/wp-content/uploads/2023/12/%EA%B4%91%EB%AA%85%EC%9E%90%EC%9D%B4%ED%9E%90%EC%8A%A4%ED%85%8C%EC%9D%B4%ED%8A%B8SKVIEW-%EC%9E%85%EC%A3%BC%EC%9E%90%EB%AA%A8%EC%A7%91%EA%B3%B5%EA%B3%A0.pdf' },
  { name: '산성역헤리스톤', url: 'https://files-scs.pstatic.net/2024/06/23/SmynSyhcpj/%ED%97%A4%EB%A6%AC%EC%8A%A4%ED%86%A4%20%EC%9E%85%EC%A3%BC%EC%9E%90%EB%AA%A8%EC%A7%91%EA%B3%B5%EA%B3%A0.pdf' },
  { name: '힐스테이트더샵상생공원1단지', url: 'https://files-scs.pstatic.net/2025/03/27/u73XPz3oyV/%ED%9E%90%EC%8A%A4%ED%85%8C%EC%9D%B4%ED%8A%B8%20%EB%8D%94%EC%83%B5%20%EC%83%81%EC%83%9D%EA%B3%B5%EC%9B%90%20%EC%9E%85%EC%A3%BC%EC%9E%90%20%EB%AA%A8%EC%A7%91%EA%B3%B5%EA%B3%A0.pdf' },
  { name: '힐스테이트더샵상생공원2단지', url: 'http://hillstate-thesharp-sangsaengpark.co.kr/pdf/supply_contraction.pdf' },
  { name: '창경궁롯데캐슬시그니처', url: 'https://www.lottecastle.co.kr/cmm/fms/FileDown.do?fileId=FILE_000000000023264&saveFileNm=202411280448233040.pdf&fileSn=0' },
  { name: '대연디아이엘', url: 'https://image.r114.co.kr/imgdata/notice_file/2023/A03030004160082.pdf' },
];

const tmpDir = 'C:/Users/Rio/Desktop/iloom-workspace-claude/pdfs';
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

async function processPDF(apt) {
  const dest = path.join(tmpDir, apt.name.replace(/[/\\:*?"<>|]/g, '_') + '.pdf');
  try {
    await downloadPDF(apt.url, dest);
    const buf = fs.readFileSync(dest);
    const parser = new PDFParse();
    const data = await parser.parse(buf);
    const ceiling = extractCeiling(data.text);
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
