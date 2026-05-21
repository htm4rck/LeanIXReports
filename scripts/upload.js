const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
const lxr = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'lxr.json'), 'utf8'));

const reportId = pkg.leanixReport.id;
const reportTitle = pkg.leanixReport.title;
const reportDesc = pkg.description || '';
const version = pkg.version;
const host = lxr.host;
const apiToken = lxr.apitoken;

function getToken() {
  return new Promise((resolve, reject) => {
    const data = 'grant_type=client_credentials';
    const svcHost = host.replace('br.', 'br-svc.');
    const req = https.request({
      hostname: svcHost,
      path: '/services/mtm/v1/oauth2/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from('apitoken:' + apiToken).toString('base64')
      }
    }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        const json = JSON.parse(body);
        if (json.access_token) resolve(json.access_token);
        else reject(new Error('Auth failed: ' + body));
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function createZip() {
  const distPath = path.join(process.cwd(), 'dist');
  const zipPath = path.join(process.cwd(), 'dist.tar.gz');
  // Use tar to create archive (available on Windows via Git)
  try {
    execSync(`tar -czf dist.tar.gz -C dist .`, { stdio: 'pipe' });
    return zipPath;
  } catch(e) {
    // Fallback: try powershell zip
    const zipPathAlt = path.join(process.cwd(), 'dist.zip');
    execSync(`powershell -Command "Compress-Archive -Path dist\\* -DestinationPath dist.zip -Force"`, { stdio: 'pipe' });
    return zipPathAlt;
  }
}

function uploadReport(token, archivePath) {
  const archiveContent = fs.readFileSync(archivePath);
  const isZip = archivePath.endsWith('.zip');
  const boundary = '----LxrUpload' + Date.now().toString(36);

  const metadataJson = JSON.stringify({
    id: reportId,
    name: reportTitle,
    description: reportDesc,
    version: version,
    defaultConfig: pkg.leanixReport.defaultConfig || {}
  });

  // Build multipart body
  const parts = [];
  
  // Metadata part
  parts.push(Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="report"\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    metadataJson + '\r\n'
  ));

  // File part
  const filename = isZip ? 'report.zip' : 'report.tar.gz';
  const contentType = isZip ? 'application/zip' : 'application/gzip';
  parts.push(Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
    `Content-Type: ${contentType}\r\n\r\n`
  ));
  parts.push(archiveContent);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

  const body = Buffer.concat(parts);

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: host,
      path: '/services/pathfinder/v1/reports/upload',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length
      }
    }, (res) => {
      let respBody = '';
      res.on('data', d => respBody += d);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log('✓ Report uploaded successfully!');
          console.log(`  ID: ${reportId}`);
          console.log(`  Version: ${version}`);
          resolve(respBody);
        } else {
          reject(new Error(`Upload failed (${res.statusCode}): ${respBody}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  try {
    console.log(`Uploading ${reportId} v${version} to ${host}...`);
    const token = await getToken();
    console.log('✓ Authenticated');
    
    console.log('Creating archive...');
    const archivePath = createZip();
    console.log(`✓ Archive created: ${path.basename(archivePath)}`);
    
    await uploadReport(token, archivePath);
    
    // Cleanup
    fs.unlinkSync(archivePath);
  } catch (e) {
    console.error('✗ Error:', e.message);
    process.exit(1);
  }
}

main();
