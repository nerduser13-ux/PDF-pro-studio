const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { execSync } = require('child_process');

console.log('=== Step 1: Packing dist directory into compressed asset bundle ===');
const distDir = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(distDir)) {
  console.log('dist directory not found, running build first...');
  execSync('npm run build', { stdio: 'inherit' });
}

function getFiles(dir, base = '') {
  let entries = {};
  const list = fs.readdirSync(dir);
  for (const f of list) {
    const full = path.join(dir, f);
    const rel = path.join(base, f).replace(/\\/g, '/');
    if (fs.statSync(full).isDirectory()) {
      Object.assign(entries, getFiles(full, rel));
    } else {
      entries[rel] = fs.readFileSync(full).toString('base64');
    }
  }
  return entries;
}

const fileMap = getFiles(distDir);
const fileCount = Object.keys(fileMap).length;
console.log(`Gathered ${fileCount} files from dist`);

const jsonStr = JSON.stringify(fileMap);
const gzipped = zlib.gzipSync(Buffer.from(jsonStr, 'utf-8'));
console.log(`Compressed dist bundle: ${(gzipped.length / 1024 / 1024).toFixed(2)} MB`);

console.log('=== Step 2: Generating SEA runtime wrapper ===');
const runtimeScript = `
const http = require('http');
const path = require('path');
const zlib = require('zlib');
const { exec } = require('child_process');

// Embedded gzipped assets dictionary
const gzippedBase64 = ${JSON.stringify(gzipped.toString('base64'))};
const decompressedJson = zlib.gunzipSync(Buffer.from(gzippedBase64, 'base64')).toString('utf-8');
const assets = JSON.parse(decompressedJson);

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.wasm': 'application/wasm'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }
  let lookupKey = reqPath.startsWith('/') ? reqPath.slice(1) : reqPath;
  lookupKey = decodeURIComponent(lookupKey);

  let fileContentBase64 = assets[lookupKey];
  if (!fileContentBase64 && assets[lookupKey + '.html']) {
    lookupKey = lookupKey + '.html';
    fileContentBase64 = assets[lookupKey];
  }
  if (!fileContentBase64 && !path.extname(lookupKey)) {
    // SPA fallback
    lookupKey = 'index.html';
    fileContentBase64 = assets[lookupKey];
  }

  if (fileContentBase64) {
    const ext = path.extname(lookupKey).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    const body = Buffer.from(fileContentBase64, 'base64');
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': body.length,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff'
    });
    res.end(body);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found: ' + lookupKey);
  }
});

// Listen on loopback random free port
server.listen(0, '127.0.0.1', () => {
  const port = server.address().port;
  const appUrl = 'http://127.0.0.1:' + port;
  console.log('PDF Pro Studio desktop server listening at:', appUrl);

  // Launch on Windows using default browser / msedge app mode
  if (process.platform === 'win32') {
    // Attempt launching with Edge in application mode for native app feel, fallback to start
    const edgeAppCmd = 'start msedge --app="' + appUrl + '" --window-size=1280,840';
    exec(edgeAppCmd, (err) => {
      if (err) {
        exec('start "" "' + appUrl + '"');
      }
    });
  } else {
    // Cross-platform open
    const openCmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
    exec(openCmd + ' "' + appUrl + '"');
  }
});

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
`;

const buildDir = path.join(__dirname, '..', 'build-win');
fs.mkdirSync(buildDir, { recursive: true });

const seaEntryPath = path.join(buildDir, 'sea-entry.js');
const seaConfigPath = path.join(buildDir, 'sea-config.json');
const seaBlobPath = path.join(buildDir, 'sea-prep.blob');

fs.writeFileSync(seaEntryPath, runtimeScript, 'utf-8');
fs.writeFileSync(
  seaConfigPath,
  JSON.stringify({
    main: seaEntryPath,
    output: seaBlobPath,
    disableExperimentalSEAWarning: true
  }, null, 2),
  'utf-8'
);

console.log('=== Step 3: Compiling SEA blob ===');
execSync(`node --experimental-sea-config "${seaConfigPath}"`, { stdio: 'inherit' });

console.log('=== Step 4: Extracting official Windows x64 binary ===');
const baseExePath = '/tmp/nodewin/package/bin/node.exe';
if (!fs.existsSync(baseExePath)) {
  console.log('Extracting node.exe runtime...');
  execSync('mkdir -p /tmp/nodewin && cd /tmp/nodewin && tar -zxvf /tmp/gjsify-node-runtime-win32-x64-0.64.2.tgz package/bin/node.exe', { stdio: 'inherit' });
}

const targetConsoleExe = path.join(buildDir, 'PDF-Pro-Studio-debug.exe');
const targetGuiExe = path.join(buildDir, 'PDF-Pro-Studio.exe');

fs.copyFileSync(baseExePath, targetConsoleExe);

console.log('=== Step 5: Injecting SEA blob via postject ===');
const postjectBin = path.join(__dirname, '..', 'node_modules', '.bin', 'postject');
execSync(`"${postjectBin}" "${targetConsoleExe}" NODE_SEA_BLOB "${seaBlobPath}" --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`, { stdio: 'inherit' });

console.log('=== Step 6: Converting to Windows GUI subsystem (no cmd terminal popup) ===');
const createNodewBin = path.join(__dirname, '..', 'node_modules', '.bin', 'create-nodew-exe');
execSync(`"${createNodewBin}" "${targetConsoleExe}" "${targetGuiExe}"`, { stdio: 'inherit' });

console.log('=== Success! Windows executable created ===');
const stats = fs.statSync(targetGuiExe);
console.log(`Executable: ${targetGuiExe}`);
console.log(`Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
