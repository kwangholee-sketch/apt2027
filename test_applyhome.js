const https = require('https');

function post(url, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const options = {
      hostname: u.hostname,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://www.applyhome.co.kr/ai/aia/selectAPTLttotPblancListView.do',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

(async () => {
  // 청계리버뷰자이로 테스트
  const body = new URLSearchParams({
    orderBy: 'RCRIT_PBLANC_DE',
    houseNm: '청계리버뷰자이',
    startYm: '202301',
    endYm: '202512',
    page: '1',
    rows: '10'
  }).toString();

  try {
    const r = await post('https://www.applyhome.co.kr/ai/aia/selectAPTLttotPblancList.do', body);
    console.log('Status:', r.status);
    console.log('Response (first 2000):', r.data.substring(0, 2000));
  } catch (e) {
    console.error('Error:', e.message);
  }
})();
