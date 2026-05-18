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
    const pageText = content.items.map(item => item.str).join(' ');
    fullText += pageText + '\n';
  }
  return fullText;
}

const tmpDir = path.join(__dirname, 'pdfs');
const files = fs.readdirSync(tmpDir).filter(f => f.endsWith('.pdf'));

(async () => {
  for (const file of files) {
    const pdfPath = path.join(tmpDir, file);
    try {
      const text = await extractTextFromPDF(pdfPath);
      console.log(`\n===== ${file} =====`);
      // 천장 관련 구간 출력
      const lines = text.split('\n');
      let found = false;
      for (let i = 0; i < lines.length; i++) {
        if (/천장|천정|層高|층고/.test(lines[i])) {
          const start = Math.max(0, i-1);
          const end = Math.min(lines.length-1, i+2);
          for (let j = start; j <= end; j++) {
            console.log(`  [${j}] ${lines[j].substring(0, 120)}`);
          }
          found = true;
        }
      }
      if (!found) {
        console.log('  (천장 관련 텍스트 없음 - 이미지 PDF일 가능성)');
        // 전체 텍스트 처음 200자 출력
        console.log('  텍스트 샘플:', text.substring(0, 200));
      }
    } catch(e) {
      console.log(`  오류: ${e.message}`);
    }
  }
})();
