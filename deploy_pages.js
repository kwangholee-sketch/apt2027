const https = require('https');
const fs = require('fs');
const path = require('path');

const token = process.argv[2];
if (!token) { console.error('사용법: node deploy_pages.js <TOKEN>'); process.exit(1); }

const owner = 'kwangholee-sketch';
const repo = 'apt2027';

function apiCall(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.github.com',
      path: endpoint,
      method,
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'iloom-apt/1.0',
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    };
    const req = https.request(options, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  // 1. repo 생성 (이미 있으면 무시)
  console.log('1. 저장소 생성 중...');
  const createRes = await apiCall('POST', '/user/repos', {
    name: repo,
    description: '전국 아파트 입주물량 2027',
    private: false,
    auto_init: false
  });
  if (createRes.status === 201) {
    console.log(`   ✅ 저장소 생성됨`);
  } else if (createRes.status === 422) {
    console.log(`   ℹ️  저장소 이미 존재`);
  } else {
    console.log(`   ❌ 생성 실패: ${createRes.status} ${createRes.body}`);
  }

  // 잠시 대기
  await new Promise(r => setTimeout(r, 1000));

  // 2. 기존 index.html SHA 가져오기 (업데이트시 필요)
  const existRes = await apiCall('GET', `/repos/${owner}/${repo}/contents/index.html`);
  let sha = null;
  if (existRes.status === 200) {
    sha = JSON.parse(existRes.body).sha;
    console.log(`2. 기존 파일 SHA: ${sha.substring(0, 8)}...`);
  } else {
    console.log('2. 신규 파일 업로드');
  }

  // 3. HTML 파일을 index.html로 업로드
  const htmlContent = fs.readFileSync(
    path.join(__dirname, '전국_아파트_입주물량_2027.html'), 'utf8'
  );
  const encoded = Buffer.from(htmlContent).toString('base64');

  const uploadBody = {
    message: 'Update apt2027 data',
    content: encoded,
    ...(sha ? { sha } : {})
  };

  console.log('3. 파일 업로드 중...');
  const uploadRes = await apiCall('PUT', `/repos/${owner}/${repo}/contents/index.html`, uploadBody);
  if (uploadRes.status === 200 || uploadRes.status === 201) {
    console.log('   ✅ 업로드 완료');
  } else {
    console.log(`   ❌ 업로드 실패: ${uploadRes.status}`);
    console.log(uploadRes.body.substring(0, 300));
    return;
  }

  // 4. GitHub Pages 활성화
  console.log('4. GitHub Pages 활성화 중...');
  const pagesRes = await apiCall('POST', `/repos/${owner}/${repo}/pages`, {
    source: { branch: 'main', path: '/' }
  });
  if (pagesRes.status === 201) {
    console.log('   ✅ Pages 활성화됨');
  } else if (pagesRes.status === 409 || pagesRes.status === 422) {
    console.log('   ℹ️  Pages 이미 활성화되어 있음');
  } else {
    // 이미 활성화된 경우 업데이트 시도
    const pagesUpdate = await apiCall('PUT', `/repos/${owner}/${repo}/pages`, {
      source: { branch: 'main', path: '/' }
    });
    console.log(`   Pages 상태: ${pagesUpdate.status}`);
  }

  const url = `https://${owner}.github.io/${repo}/`;
  console.log('\n🎉 배포 완료!');
  console.log(`\n📋 공유 링크:`);
  console.log(url);
  console.log('\n※ GitHub Pages 빌드까지 1~2분 소요될 수 있습니다.');
}

main().catch(e => console.error(e));
