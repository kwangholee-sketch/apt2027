const https = require('https');

function checkUrl(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      resolve({ url, status: res.statusCode, contentType: res.headers['content-type'] });
      res.resume();
    }).on('error', e => resolve({ url, status: 'ERR', error: e.message }));
  });
}

async function main() {
  const urls = [
    'https://kwangholee-sketch.github.io/apt2027/',
    'https://cdn.jsdelivr.net/gh/kwangholee-sketch/apt2027@main/index.html',
    'https://raw.githubusercontent.com/kwangholee-sketch/apt2027/main/index.html',
    'https://gist.githubusercontent.com/kwangholee-sketch/40ff4e741c5d696fe226d7020772e5dc/raw/전국_아파트_입주물량_2027.html'
  ];
  for (const url of urls) {
    const r = await checkUrl(url);
    console.log(`${r.status} [${r.contentType || r.error}]\n  ${r.url}\n`);
  }
}
main();
