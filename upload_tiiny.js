const https = require('https');
const fs = require('fs');
const path = require('path');

const zipPath = path.join(__dirname, 'apt_share.zip');
const zipData = fs.readFileSync(zipPath);

const boundary = '----FormBoundary' + Date.now().toString(36);

const filename = 'apt_share.zip';
const subdomain = 'apt2027-' + Date.now().toString(36).slice(-6);

const body = Buffer.concat([
  Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/zip\r\n\r\n`),
  zipData,
  Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="subdomain"\r\n\r\n${subdomain}\r\n`),
  Buffer.from(`--${boundary}--\r\n`)
]);

const options = {
  hostname: 'tiiny.host',
  path: '/create',
  method: 'POST',
  headers: {
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'Content-Length': body.length
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', data.substring(0, 500));
  });
});

req.on('error', e => console.error('Error:', e.message));
req.write(body);
req.end();
