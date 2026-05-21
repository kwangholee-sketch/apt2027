/**
 * gen_ceiling_data.js
 * 363개 아파트 천장고 데이터 생성 (2026+2027)
 */
const fs = require('fs');
const path = require('path');

// PDF로 직접 확인한 데이터
const pdfConfirmed = {
  '청계리버뷰자이':                 { ceiling: '2.4m', source: 'PDF확인' },
  '광명자이힐스테이트SK뷰':         { ceiling: '2.3m', source: 'PDF확인' },
  '대연디아이엘':                   { ceiling: '2.3m', source: 'PDF확인' },
  '창경궁롯데캐슬시그니처':         { ceiling: '2.3m', source: 'PDF확인' },
  '힐스테이트더샵상생공원1단지':    { ceiling: '2.3m', source: 'PDF확인' },
  '힐스테이트더샵상생공원2단지':    { ceiling: '2.3m', source: 'PDF확인' },
};

// 웹조사·뉴스기사 확인 데이터
const newsConfirmed = {
  // 서울경제 기사 직접 확인
  '영통자이센트럴파크': { ceiling: '2.4m', source: '웹조사(서울경제기사확인)' },
};

// 브랜드·단지 분석 조사 데이터
const researchData = {
  // ─── 서울 프리미엄 재개발/재건축 ───
  '마포푸르지오어반피스(주상복합)': { ceiling: '2.4m', source: '조사(서울마포재개발)' },
  '푸르지오라디우스파크':           { ceiling: '2.4m', source: '조사(서울장위뉴타운)' },
  '한신더휴하이엔에듀포레':         { ceiling: '2.4m', source: '조사(서울+프리미엄브랜드)' },
  '디에이치클래스트':               { ceiling: '2.4m', source: '조사(현대건설DH최고급)' },
  '청량리롯데캐슬하이루체':         { ceiling: '2.4m', source: '조사(서울청량리재개발)' },
  '두산위브더제니스오션시티':       { ceiling: '2.4m', source: '조사(위브더제니스프리미엄)' },

  // ─── 디에트르 브랜드 (대방건설 프리미엄, 전 단지 2.4m 정책) ───
  '인천검단신도시디에트르더에듀(AA20BL)': { ceiling: '2.4m', source: '조사(디에트르브랜드)' },
  '부산에코델타시티디에트르더퍼스트':     { ceiling: '2.4m', source: '조사(디에트르브랜드)' },
  '부산장안지구디에트르디오션':           { ceiling: '2.4m', source: '조사(디에트르브랜드)' },
  '과천디에트르퍼스티지(S2BL)':           { ceiling: '2.4m', source: '조사(과천+디에트르)' },
  '부산에코델타시티디에트르그랑루체':     { ceiling: '2.4m', source: '조사(디에트르브랜드)' },
  '대구금호워터폴리스대방디에트르':       { ceiling: '2.4m', source: '조사(디에트르브랜드)' },
  '북수원이목지구대방디에트르더리체I':    { ceiling: '2.4m', source: '조사(디에트르브랜드)' },
  '의왕월암지구대방디에트르레이크파크':   { ceiling: '2.4m', source: '조사(디에트르브랜드)' },

  // ─── 대방엘리움 브랜드 (전 단지 2.4m 정책) ───
  '동탄역대방엘리움더시그니처(C18BL)': { ceiling: '2.4m', source: '조사(대방엘리움브랜드)' },
  '부산에코델타시티대방엘리움리버뷰':  { ceiling: '2.4m', source: '조사(대방엘리움브랜드)' },

  // ─── 드파인 브랜드 (SK에코플랜트 프리미엄, 특화설계 확인) ───
  '드파인광안': { ceiling: '2.4m', source: '조사(SK드파인프리미엄브랜드)' },
};

function readAptFile(filename) {
  const filepath = path.join(__dirname, filename);
  if (!fs.existsSync(filepath)) return [];
  return fs.readFileSync(filepath, 'utf8')
    .split('\n')
    .filter(l => l.trim())
    .map(l => {
      const parts = l.split('|');
      return {
        name: parts[0].trim(),
        addr: parts[1]?.trim() || '',
        movein: parts[2]?.trim() || '',
        households: parseInt(parts[3]?.trim() || '0')
      };
    });
}

// apt_list_2026.txt + apt_list.txt(2027) 합산
const aptList = [
  ...readAptFile('apt_list_2026.txt'),
  ...readAptFile('apt_list.txt'),
];

// 각 아파트 천장고 결정
const results = [];
for (const apt of aptList) {
  let info;

  if (pdfConfirmed[apt.name]) {
    info = pdfConfirmed[apt.name];
  } else if (newsConfirmed[apt.name]) {
    info = newsConfirmed[apt.name];
  } else if (researchData[apt.name]) {
    info = researchData[apt.name];
  } else {
    info = { ceiling: '2.3m', source: '추정(브랜드기준)' };
  }

  results.push({
    name: apt.name,
    addr: apt.addr,
    movein: apt.movein,
    households: apt.households,
    ceiling: info.ceiling,
    source: info.source
  });
}

// JSON 저장
fs.writeFileSync(
  path.join(__dirname, 'ceiling_data.json'),
  JSON.stringify(results, null, 2),
  'utf8'
);

console.log(`생성 완료: ${results.length}개 아파트`);
console.log(`2.4m: ${results.filter(r=>r.ceiling==='2.4m').length}개`);
console.log(`2.3m: ${results.filter(r=>r.ceiling==='2.3m').length}개`);
console.log('\n2.4m 아파트 목록:');
results.filter(r=>r.ceiling==='2.4m').forEach(r=>{
  console.log(`  ${r.name} (${r.addr}) - ${r.source}`);
});
