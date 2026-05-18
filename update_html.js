/**
 * update_html.js - HTML에 천장고 컬럼 추가
 */
const fs = require('fs');
const path = require('path');

const ceilingData = JSON.parse(fs.readFileSync(path.join(__dirname, 'ceiling_data.json'), 'utf8'));
const ceilingMap = {};
for (const apt of ceilingData) {
  // 이름 정규화 (공백 제거)
  const key = apt.name.replace(/\s+/g, '');
  ceilingMap[key] = apt;
}

function lookupCeiling(rawName) {
  const key = rawName.replace(/\s+/g, '');
  return ceilingMap[key] || { ceiling: '미확인', source: '' };
}

// 천장고 배지 HTML
function ceilingBadge(ceiling, source) {
  const is24 = ceiling === '2.4m';
  const isPDF = source.includes('PDF확인');
  const color = is24 ? '#1a6b9e' : '#4a7c3f';
  const bg = is24 ? '#dbeeff' : '#e8f5e2';
  const star = isPDF ? ' ★' : '';
  const title = isPDF ? 'PDF 직접 확인' : source;
  return `<span class="ceiling-badge" style="background:${bg};color:${color};padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;cursor:default;" title="${title}">${ceiling}${star}</span>`;
}

const html = fs.readFileSync(path.join(__dirname, '전국_아파트_입주물량_2027.html'), 'utf8');

// 1. CSS 추가 (tbody tr td 천장고 열 스타일)
const cssAdd = `
    td:nth-child(5) { text-align: center; white-space: nowrap; }
    .ceiling-badge { display: inline-block; }
    .ceiling-filter-btns { display: flex; gap: 6px; margin-bottom: 10px; flex-wrap: wrap; }
    .ceiling-filter-btns button { padding: 5px 12px; border: 1px solid #ddd; border-radius: 14px; background: #fff; font-size: 12px; cursor: pointer; font-family: inherit; transition: all 0.15s; }
    .ceiling-filter-btns button.active, .ceiling-filter-btns button:hover { background: #2c3e6b; color: #fff; border-color: #2c3e6b; }`;

let result = html.replace(
  '    tfoot tr { background: #dce6f1; font-weight: 700; }',
  `    tfoot tr { background: #dce6f1; font-weight: 700; }${cssAdd}`
);

// 2. 검색바 아래 천장고 필터 버튼 추가
result = result.replace(
  '<p class="count" id="countTxt">총 164개 단지</p>',
  `<div class="ceiling-filter-btns">
    <button onclick="filterCeiling('')" class="active" id="ceilBtn-all">전체</button>
    <button onclick="filterCeiling('2.4m')" id="ceilBtn-24">천장고 2.4m</button>
    <button onclick="filterCeiling('2.3m')" id="ceilBtn-23">천장고 2.3m</button>
  </div>
  <p class="count" id="countTxt">총 164개 단지</p>`
);

// 3. 테이블 헤더에 천장고 컬럼 추가
result = result.replace(
  '<th onclick="sortTable(3)">총세대수</th>',
  '<th onclick="sortTable(3)">총세대수</th>\n        <th onclick="sortTable(4)">천장고</th>'
);

// tfoot도 colspan 조정
result = result.replace(
  '<td colspan="2"></td><td>총 세대수</td>',
  '<td colspan="2"></td><td>총 세대수</td>'
);
// tfoot td 끝에 빈 td 추가
result = result.replace(
  '<td colspan="2"></td><td>총 세대수</td><td>153,158세대</td></tr>',
  '<td colspan="2"></td><td>총 세대수</td><td>153,158세대</td><td></td></tr>'
);

// 4. 각 tbody row에 천장고 td 추가
result = result.replace(/<tr><td>([^<]+)<\/td><td>([^<]+)<\/td><td>([^<]+)<\/td><td>([^<]+)<\/td><\/tr>/g,
  (match, loc, name, movein, hh) => {
    const apt = lookupCeiling(name.trim());
    const badge = ceilingBadge(apt.ceiling, apt.source);
    return `<tr><td>${loc}</td><td>${name}</td><td>${movein}</td><td>${hh}</td><td>${badge}</td></tr>`;
  }
);

// 5. JavaScript 업데이트
// filterTable: cells[4] (천장고) 도 필터
const oldFilter = `  function filterTable() {
    const kw = document.getElementById('searchInput').value.toLowerCase();
    const mon = document.getElementById('filterMonth').value;
    const rows = document.querySelectorAll('#aptTable tbody tr');
    let visible = 0;
    rows.forEach(r => {
      const loc = r.cells[0].textContent;
      const nm  = r.cells[1].textContent;
      const mv  = r.cells[2].textContent;
      const matchKw = !kw || loc.toLowerCase().includes(kw) || nm.toLowerCase().includes(kw);
      const matchMon = !mon || mv.replace(/\\s/g,'').includes(mon.replace(/\\s/g,''));
      r.style.display = matchKw && matchMon ? '' : 'none';
      if (matchKw && matchMon) visible++;
    });
    document.getElementById('countTxt').textContent = '총 ' + visible + '개 단지';
  }`;

const newFilter = `  let ceilFilter = '';
  function filterCeiling(val) {
    ceilFilter = val;
    document.querySelectorAll('.ceiling-filter-btns button').forEach(b => b.classList.remove('active'));
    const id = val === '2.4m' ? 'ceilBtn-24' : val === '2.3m' ? 'ceilBtn-23' : 'ceilBtn-all';
    document.getElementById(id).classList.add('active');
    filterTable();
  }

  function filterTable() {
    const kw = document.getElementById('searchInput').value.toLowerCase();
    const mon = document.getElementById('filterMonth').value;
    const rows = document.querySelectorAll('#aptTable tbody tr');
    let visible = 0;
    rows.forEach(r => {
      const loc = r.cells[0].textContent;
      const nm  = r.cells[1].textContent;
      const mv  = r.cells[2].textContent;
      const ceil = r.cells[4] ? r.cells[4].textContent.trim() : '';
      const matchKw = !kw || loc.toLowerCase().includes(kw) || nm.toLowerCase().includes(kw);
      const matchMon = !mon || mv.replace(/\\s/g,'').includes(mon.replace(/\\s/g,''));
      const matchCeil = !ceilFilter || ceil.includes(ceilFilter);
      r.style.display = matchKw && matchMon && matchCeil ? '' : 'none';
      if (matchKw && matchMon && matchCeil) visible++;
    });
    document.getElementById('countTxt').textContent = '총 ' + visible + '개 단지';
  }`;

result = result.replace(oldFilter, newFilter);

// sortTable col=4 처리
const oldSort = `    rows.sort((a, b) => {
      let av = a.cells[col].textContent.trim();
      let bv = b.cells[col].textContent.trim();
      if (col === 3) {
        av = parseInt(av.replace(/[^0-9]/g,'')) || 0;
        bv = parseInt(bv.replace(/[^0-9]/g,'')) || 0;
        return (av - bv) * sortDir;
      }
      return av.localeCompare(bv, 'ko') * sortDir;
    });`;
const newSort = `    rows.sort((a, b) => {
      let av = a.cells[col] ? a.cells[col].textContent.trim() : '';
      let bv = b.cells[col] ? b.cells[col].textContent.trim() : '';
      if (col === 3) {
        av = parseInt(av.replace(/[^0-9]/g,'')) || 0;
        bv = parseInt(bv.replace(/[^0-9]/g,'')) || 0;
        return (av - bv) * sortDir;
      }
      return av.localeCompare(bv, 'ko') * sortDir;
    });`;
result = result.replace(oldSort, newSort);

fs.writeFileSync(
  path.join(__dirname, '전국_아파트_입주물량_2027.html'),
  result,
  'utf8'
);

// 통계
const matched = result.match(/title="PDF 직접 확인"/g);
const count24 = result.match(/1a6b9e/g);
console.log(`✅ HTML 업데이트 완료`);
console.log(`   2.4m: ${count24 ? count24.length : 0}개`);
console.log(`   PDF확인: ${matched ? matched.length : 0}개`);
