const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '전국_아파트_입주물량_2027.html');
let html = fs.readFileSync(htmlPath, 'utf8');

// 1. search-bar에 지역 select 추가
html = html.replace(
  `<select id="filterMonth" onchange="filterTable()">`,
  `<select id="filterRegion" onchange="filterTable()">
      <option value="">전체 지역</option>
      <option value="서울">서울</option>
      <option value="경기">경기</option>
      <option value="인천">인천</option>
      <option value="강원">강원</option>
      <option value="충북">충북</option>
      <option value="충남">충남</option>
      <option value="대전">대전</option>
      <option value="경북">경북</option>
      <option value="경남">경남</option>
      <option value="대구">대구</option>
      <option value="부산">부산</option>
      <option value="울산">울산</option>
      <option value="전북">전북</option>
      <option value="전남">전남</option>
      <option value="광주">광주</option>
      <option value="제주">제주</option>
    </select>
    <select id="filterMonth" onchange="filterTable()">`
);

// 2. filterTable()에 지역 필터 조건 추가
html = html.replace(
  `  function filterTable() {
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
  }`,
  `  function filterTable() {
    const kw = document.getElementById('searchInput').value.toLowerCase();
    const mon = document.getElementById('filterMonth').value;
    const region = document.getElementById('filterRegion').value;
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
      const matchRegion = !region || loc.startsWith(region);
      r.style.display = matchKw && matchMon && matchCeil && matchRegion ? '' : 'none';
      if (matchKw && matchMon && matchCeil && matchRegion) visible++;
    });
    document.getElementById('countTxt').textContent = '총 ' + visible + '개 단지';
  }`
);

fs.writeFileSync(htmlPath, html, 'utf8');
console.log('✅ 지역 필터 추가 완료');
