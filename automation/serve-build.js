// build/ 폴더를 http://localhost:4174 로 띄우는 간단한 정적 서버 (의존성 없음)
// BrowserRouter라서 없는 경로(/sub1, /cart 등)는 index.html로 돌려줌
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 4174;
const ROOT = path.join(__dirname, '..', 'build');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.webp': 'image/webp', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
};

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let file = path.join(ROOT, path.normalize(url));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(ROOT, 'index.html');
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

if (require.main === module) server.listen(PORT, () => console.log(`build 서버: http://localhost:${PORT}/`));
module.exports = server;
