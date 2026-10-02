import express from 'express';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { config } from '@server/shared/config';
import { handleShopRequest } from '@server/routes/shop';
import { database } from '@server/shared/database';
import { ensureCatalog } from '@database/seeds/initialize';

const app = express();
app.disable('x-powered-by');
const authAttempts = new Map<string,{count:number;expires:number}>();
let apiQueue: Promise<void> = Promise.resolve();
app.use((_req,res,next)=>{
    res.set('X-Content-Type-Options','nosniff');
    res.set('X-Frame-Options','DENY');
    res.set('Referrer-Policy','strict-origin-when-cross-origin');
    next();
});
app.get('/api/health',(_req,res)=>res.json({status:'ok',shop:'M&A Shop'}));
app.use('/api/shop',express.raw({type:'application/json',limit:'64kb'}));
app.use('/api/shop',async(req,res,next)=>{
    let authKey: string | undefined;
    const origin = req.get('origin');
    if (origin && config.allowedOrigins.has(origin)) {
        res.set('Access-Control-Allow-Origin',origin);
        res.set('Access-Control-Allow-Credentials','true');
        res.set('Vary','Origin');
    }
    if(req.method==='OPTIONS') {
        if (!origin || !config.allowedOrigins.has(origin)) { res.status(403).json({error:'Nguồn yêu cầu không được phép.'}); return; }
        res.set('Access-Control-Allow-Methods','GET,POST,PATCH,DELETE');
        res.set('Access-Control-Allow-Headers','Content-Type');
        res.status(204).end();return;
    }
    if (req.method==='POST' && /^\/api\/shop\/auth\/(login|register)(?:\?|$)/.test(req.originalUrl)) {
        const now=Date.now();
        for(const [key,value] of authAttempts) if(value.expires<=now)authAttempts.delete(key);
        const key=req.ip||'unknown';
        authKey=key;
        const bucket=authAttempts.get(key)||{count:0,expires:now+900000};
        if(bucket.count>=30 || (!authAttempts.has(key)&&authAttempts.size>=10000)) {
            res.set('Retry-After',String(Math.max(1,Math.ceil((bucket.expires-now)/1000))));
            res.status(429).json({error:'Quá nhiều lần đăng nhập. Vui lòng thử lại sau.'});return;
        }
        bucket.count++;authAttempts.set(key,bucket);
    }
    // SQLite transactions remain synchronous; queue requests so the read/validate/
    // write steps of an order cannot interleave within this process.
    const task=apiQueue.then(async()=>{
        const headers=new Headers();
        for(const [name,value] of Object.entries(req.headers)) {
            if(typeof value==='string')headers.set(name,value);
            else if(Array.isArray(value))headers.set(name,value.join(', '));
        }
        const body=['GET','HEAD'].includes(req.method)?undefined:(Buffer.isBuffer(req.body)?req.body.toString('utf8'):undefined);
        const request=new Request(new URL(req.originalUrl,config.appOrigin),{method:req.method,headers,body});
        const response=await handleShopRequest(request);
        if (authKey && response.ok) authAttempts.delete(authKey);
        res.status(response.status);
        response.headers.forEach((value,name)=>{if(name.toLowerCase()!=='set-cookie')res.set(name,value);});
        const cookies=response.headers.getSetCookie();
        if(cookies.length)res.setHeader('Set-Cookie',cookies);
        res.send(Buffer.from(await response.arrayBuffer()));
    });
    apiQueue=task.then(()=>{},()=>{});
    try { await task; } catch(error) { next(error); }
});
app.use('/api',(_req,res)=>res.status(404).json({error:'Không tìm thấy API.'}));
const clientDist=path.join(config.projectRoot,'client/dist');
app.use(express.static(clientDist,{index:false}));
app.use((req,res,next)=>{
    if(req.method!=='GET') {next();return;}
    const index=path.join(clientDist,'index.html');
    if(!existsSync(index)) {res.status(503).send('Chưa build giao diện. Chạy npm run build hoặc mở giao diện qua npm run dev.');return;}
    res.sendFile(index);
});
app.use((error: {status?:number;type?:string},_req:express.Request,res:express.Response,_next:express.NextFunction)=>{
    const status=error.status===413?413:500;
    if(status===500)console.error('API error',error);
    res.status(status).json({error:status===413?'Dữ liệu gửi lên quá lớn.':'Không thể hoàn thành thao tác. Vui lòng thử lại.'});
});
await ensureCatalog();
const server=app.listen(config.port,config.host,()=>console.log(`M&A Shop API: http://${config.host}:${config.port}`));
for(const signal of ['SIGTERM','SIGINT'] as const)process.on(signal,()=>server.close(()=>{database().close();process.exit(0);}));
