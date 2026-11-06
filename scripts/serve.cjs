/* Development server with the same /pokemon-draft/ path as GitHub Pages. */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const appRoot = path.resolve(__dirname,'..');
// Mirror the portfolio root when the planner is nested in its website checkout.
const siteRoot = path.resolve(appRoot,'..');
const hasPortfolio = fs.existsSync(path.join(siteRoot,'index.html'));
const root = hasPortfolio ? siteRoot : appRoot;
const port = Number(process.env.PORT || 4173);
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.txt':'text/plain; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.json':'application/json'};
const server = http.createServer((req,res)=>{
  let pathname;
  try {pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);res.end('Bad request');return;}
  if(pathname==='/pokemon-draft'||(!hasPortfolio&&pathname==='/')){res.writeHead(302,{Location:'/pokemon-draft/'});res.end();return;}
  if(!hasPortfolio&&!pathname.startsWith('/pokemon-draft/')){res.writeHead(404);res.end('Open /pokemon-draft/ to use the planner.');return;}
  const relative=(hasPortfolio?pathname.slice(1):pathname.slice('/pokemon-draft/'.length))+(pathname.endsWith('/')?'index.html':'');
  const filename=path.resolve(root,relative);
  if(!filename.startsWith(root+path.sep)||relative.split('/').some(part=>part.startsWith('.'))){res.writeHead(403);res.end('Forbidden');return;}
  fs.readFile(filename,(error,contents)=>{
    if(error){res.writeHead(404);res.end('Not found');return;}
    res.writeHead(200,{'Content-Type':types[path.extname(filename)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(contents);
  });
});
server.listen(port,'127.0.0.1',()=>console.log(`Draft Lab: http://127.0.0.1:${port}/pokemon-draft/`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
