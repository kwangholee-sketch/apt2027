const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs');
const fs = require('fs');
const path = require('path');

async function findCeiling(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjsLib.getDocument({ data, useSystemFonts: true }).promise;
  const allItems = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    for (const item of content.items) {
      if (item.str.trim()) allItems.push(item.str);
    }
  }
  const lines = allItems.join('\n').split('\n');
  console.log(`총 ${lines.length}개 라인`);

  // 패턴 1: 천장고 관련
  const patterns = [
    /세대.*천장고|단위세대.*천장|천장고.*[Hh]:\s*\d|천장.*높이.*\d{4}|천장고.*\d{3}0/,
    /[Hh]:\s*2[,.]?[3-5]00|2[,.]?[3-5]00\s*mm|천장.*2\.[3-5]/,
    /거실.*천장|침실.*천장|천장.*거실/
  ];

  const found = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pat of patterns) {
      if (pat.test(line)) {
        const ctx = lines.slice(Math.max(0, i-2), Math.min(lines.length, i+3)).join(' | ');
        found.push(`[L${i}] ${ctx.substring(0, 250)}`);
        break;
      }
    }
  }

  if (found.length === 0) {
    // 모든 "천장" 관련 라인
    console.log('--- 모든 천장 관련 라인 ---');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('천장고') || lines[i].includes('천정고') || /[Hh]:\s*2[,.]?[3-5]/.test(lines[i])) {
        const ctx = lines.slice(Math.max(0, i-1), Math.min(lines.length, i+2)).join(' | ');
        console.log(`[L${i}] ${ctx.substring(0, 200)}`);
      }
    }
  } else {
    found.forEach(f => console.log(f));
  }
}

const pdfDir = path.join(__dirname, 'pdfs');
const fname = process.argv[2];
if (fname) {
  findCeiling(path.join(pdfDir, fname)).catch(e => console.error(e.message));
} else {
  // 모든 PDF 검사
  const files = fs.readdirSync(pdfDir).filter(f => f.endsWith('.pdf') && !f.startsWith('_proxy'));
  (async () => {
    for (const f of files) {
      console.log(`\n===== ${f} =====`);
      await findCeiling(path.join(pdfDir, f));
    }
  })();
}
