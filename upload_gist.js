const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Windows Credential Manager에서 GitHub 토큰 가져오기
function getGitHubToken() {
  try {
    const ps = `
$cred = Get-StoredCredential -Target 'git:https://github.com' 2>$null
if ($cred) { $cred.GetNetworkCredential().Password }
`;
    // CredentialManager 모듈 없을 경우 대비해서 cmdkey로도 시도
    const ps2 = `
Add-Type -AssemblyName System.Security
$creds = [System.Net.CredentialCache]::DefaultNetworkCredentials
# Windows Credential Manager 직접 접근
$sig = @'
[DllImport("advapi32.dll", EntryPoint = "CredReadW", CharSet = CharSet.Unicode, SetLastError = true)]
public static extern bool CredRead(string target, int type, int flags, out IntPtr credPtr);
[DllImport("advapi32.dll", EntryPoint = "CredFree", SetLastError = true)]
public static extern void CredFree(IntPtr cred);
'@
$type = Add-Type -MemberDefinition $sig -Name WinCred -Namespace Win32 -PassThru
$credPtr = [IntPtr]::Zero
if ($type::CredRead("git:https://github.com", 1, 0, [ref]$credPtr)) {
  $cred = [System.Runtime.InteropServices.Marshal]::PtrToStructure($credPtr, [Type][Microsoft.Win32.NativeMethods+CREDENTIAL])
}
`;
    // 가장 간단한 방법: PowerShell의 Windows Credential Manager
    const result = execSync(
      `powershell -NoProfile -Command "` +
      `$c = [System.Net.CredentialCache]::DefaultCredentials; ` +
      `$wc = New-Object System.Net.WebClient; ` +
      `$wc.Credentials = [System.Net.CredentialCache]::DefaultCredentials; ` +
      `# Try cmdkey approach` +
      `$o = cmdkey /list:git:https://github.com; Write-Host $o` +
      `"`,
      { encoding: 'utf8' }
    );
    return null;
  } catch (e) {
    return null;
  }
}

// 토큰을 환경변수나 인자로 받음
const token = process.argv[2] || process.env.GITHUB_TOKEN;

if (!token) {
  console.log('사용법: node upload_gist.js <GITHUB_TOKEN>');
  console.log('');
  console.log('토큰을 가져오려면:');
  console.log('  PowerShell에서 실행:');
  console.log('  $cred = Get-StoredCredential -Target "git:https://github.com"');
  console.log('  $cred.GetNetworkCredential().Password');
  console.log('  또는:');
  console.log('  git credential fill (입력: protocol=https, host=github.com)');
  process.exit(1);
}

const htmlPath = path.join(__dirname, '전국_아파트_입주물량_2027.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

console.log(`HTML 파일 크기: ${(htmlContent.length / 1024).toFixed(1)} KB`);

const gistData = JSON.stringify({
  description: '전국 아파트 입주물량 2027 (천장고 포함)',
  public: true,
  files: {
    '전국_아파트_입주물량_2027.html': {
      content: htmlContent
    }
  }
});

const options = {
  hostname: 'api.github.com',
  path: '/gists',
  method: 'POST',
  headers: {
    'Authorization': `token ${token}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(gistData),
    'User-Agent': 'iloom-apt-share/1.0',
    'Accept': 'application/vnd.github.v3+json'
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    if (res.statusCode === 201) {
      const result = JSON.parse(data);
      const gistId = result.id;
      const rawUrl = result.files['전국_아파트_입주물량_2027.html'].raw_url;
      const htmlPreviewUrl = `https://htmlpreview.github.io/?${rawUrl}`;
      const gistUrl = result.html_url;

      console.log('\n✅ Gist 생성 성공!');
      console.log(`\nGist URL: ${gistUrl}`);
      console.log(`\n📋 공유 링크 (HTML 렌더링):`);
      console.log(htmlPreviewUrl);
      console.log('\n위 링크를 다른 사람과 공유하세요!');
    } else {
      console.error(`❌ 실패 (${res.statusCode}):`, data.substring(0, 500));
    }
  });
});

req.on('error', e => console.error('Error:', e.message));
req.write(gistData);
req.end();
