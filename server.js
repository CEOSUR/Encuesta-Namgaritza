const http = require('http');
const fs = require('fs');
const path = require('path');
const port = process.env.PORT || 3000;
http.createServer((req,res)=>{
  const url = decodeURIComponent((req.url||'/').split('?')[0]);
  if(url!=='/' && url!=='/index.html'){res.writeHead(404);return res.end('Not found');}
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  fs.createReadStream(path.join(__dirname,'index.html')).pipe(res);
}).listen(port,'0.0.0.0',()=>console.log('CEO SUR listening on '+port));
