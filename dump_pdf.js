const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs');
const fs = require('fs');
const path = require('path');

async function extractTextFromPDF(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const loadingTask = pdfjsLib.getDocument({ data, useSystemFonts: true });
  const doc = await loadingTask.promise;
  let fullText = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // 각 아이템을 개별적으로 처리 (좌표 포함)
    const items = content.items;
    for (const item of items) {
      if (item.str && item.str.trim()) {
        fullText += item.str + '\n';
      }
    }
  }
  return fullText;
}

const tmpDir = path.join(__dirname, 'pdfs');
const targetFile = process.argv[2] || '대연디아이엘.pdf';
const pdfPath = path.join(tmpDir, targetFile);

(async () => {
  try {
    const text = await extractTextFromPDF(pdfPath);
    // 유사한 패턴 검색
    const keywords = ['천장', '층고', '높이', '2.3', '2.4', '2.5', 'M이', '거실및침실', '거실 및 침실'];
    const lines = text.split('\n');
    console.log(`총 ${lines.length}개 라인`);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const kw of keywords) {
        if (line.includes(kw)) {
          const ctx = lines.slice(Math.max(0,i-2), Math.min(lines.length, i+3)).join(' | ');
          console.log(`[${i}] ${ctx.substring(0, 200)}`);
          break;
        }
      }
    }
  } catch(e) {
    console.error(e.message);
  }
})();
