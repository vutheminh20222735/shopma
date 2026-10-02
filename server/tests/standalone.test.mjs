import test, {before,after} from 'node:test';
import {spawn,execFileSync} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

// Each test run creates a temporary database and real password accounts.
const projectRoot=process.cwd();
const temporary=mkdtempSync(path.join(tmpdir(),'ma-shop-tests-'));
let server,origin,adminCookie='',env,serverLog='';
const ownerPassword='Test-owner-password-2026';
const customerPassword='Test-customer-password-2026';
async function startServer(){
 server=spawn(process.execPath,['--import','tsx','server/index.ts'],{cwd:projectRoot,env,stdio:['ignore','pipe','pipe']});
 server.stdout.on('data',chunk=>{serverLog+=chunk.toString();});
 server.stderr.on('data',chunk=>{serverLog+=chunk.toString();});
 for(let attempt=0;attempt<80;attempt++){
  if(server.exitCode!==null)throw new Error(serverLog);
  try {if((await fetch(new URL('/api/health',origin))).ok)return;}catch{}
  await new Promise(resolve=>setTimeout(resolve,50));
 }
 throw new Error('Server did not start: '+serverLog);
}
async function stopServer(){
 if(server&&server.exitCode===null){const exited=once(server,'exit');server.kill('SIGTERM');await exited;}
}
before(async()=>{
 const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');
 const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
 origin=new URL('http://127.0.0.1:'+port);
 env={...process.env,PORT:String(port),HOST:'127.0.0.1',APP_ORIGIN:origin.origin,DATABASE_PATH:path.join(temporary,'shop.sqlite'),NODE_ENV:'test',ADMIN_NAME:'Chủ shop kiểm tra',ADMIN_EMAIL:'owner@example.test',ADMIN_PASSWORD:ownerPassword};
 execFileSync(process.execPath,['--import','tsx','server/scripts/setup-admin.ts'],{cwd:projectRoot,env,stdio:'pipe'});
 await startServer();
});
after(async()=>{await stopServer();rmSync(temporary,{recursive:true,force:true});});
let checks=0;
async function call(route,{method='GET',body,cookie=adminCookie,expected=200,headers={}}={}){
 const response=await fetch(new URL(route,origin),{method,headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...(cookie?{Cookie:cookie}:{}),...headers},body:body===undefined?undefined:JSON.stringify(body)});
 const raw=await response.text();
 const data=response.headers.get('content-type')?.includes('application/json')?JSON.parse(raw):raw;
 assert.equal(response.status,expected,route+' '+JSON.stringify(data).slice(0,150));checks++;
 return {data,cookie:response.headers.getSetCookie().map(value=>value.split(';')[0]).filter(value=>!value.endsWith('=')).join('; ')};
}
const api=(route,options={})=>call('/api/shop/'+route,options);
const preview=async role=>adminCookie+'; '+(await api('preview',{method:'POST',body:{role}})).cookie;

test('Independent project: password auth, pages, four roles, cart, orders and persistence',async()=>{
 assert.equal((await api('session',{cookie:''})).data.user,null);
 await api('cart',{cookie:'',expected:401});
 await api('auth/login',{cookie:'',method:'POST',body:{email:'owner@example.test',password:'wrong-password'},expected:401});
 adminCookie=(await api('auth/login',{cookie:'',method:'POST',body:{email:'owner@example.test',password:ownerPassword}})).cookie;
 assert.match(adminCookie,/^ma_session=/);
 const session=(await api('session')).data;
 assert.equal(session.user.role,'admin');assert.equal(session.canPreview,true);
 const products=(await api('products')).data;assert.ok(products.length>=8);
 for(const route of ['/','/san-pham?q=ao','/san-pham/'+products[0].id,'/yeu-thich','/gio-hang','/thanh-toan','/tai-khoan','/lien-he','/chinh-sach','/quan-tri']){
  const {data}=await call(route);assert.match(data,/M(?:&amp;|&)A Shop/);
 }
 for(const role of ['admin','manager','staff','customer']){
  const cookie=await preview(role);
  assert.equal((await api('session',{cookie})).data.user.role,role);
  await api('members',{cookie,expected:role==='admin'?200:403});
  await api('inventory',{cookie,expected:role==='customer'?403:200});
  await api('dashboard',{cookie,expected:['admin','manager'].includes(role)?200:403});
  await api('orders?manage=1',{cookie,expected:role==='customer'?403:200});
  if(role!=='admin')await api('settings',{cookie,method:'PATCH',body:{},expected:403});
  if(['staff','customer'].includes(role))await api('products',{cookie,method:'POST',body:{},expected:403});
 }

 let cookie=await preview('customer');
 const detail=(await api('products/'+products[0].id)).data;
 const variant=detail.variants.find(v=>v.stock>=2);assert.ok(variant);
 const selection={product_id:detail.id,size:variant.size,color:variant.color,quantity:2};
 await api('favorites/'+detail.id,{cookie,method:'POST',body:{}});
 assert.ok((await api('favorites',{cookie})).data.includes(detail.id));
 await api('cart',{cookie,method:'POST',body:selection});
 assert.equal((await api('cart',{cookie})).data[0].quantity,2);
 assert.equal((await api('coupon',{cookie,method:'POST',body:{code:'MA10'}})).data.percent,10);
 const key=randomUUID(),delivery={customer_name:'Kiểm tra module',phone:'0900000000',address:'Địa chỉ mẫu trên máy cục bộ',payment:'cod',note:'Feature module test'};
 const order=(await api('orders',{cookie,method:'POST',body:{...delivery,coupon:'MA10',idempotency_key:key}})).data;
 assert.equal(order.subtotal,detail.price*2);
 assert.equal(order.discount,Math.round(order.subtotal*.1));
 assert.equal(order.total,order.subtotal-order.discount+(order.subtotal>=699000?0:30000));
 assert.equal((await api('orders',{cookie,method:'POST',body:{...delivery,idempotency_key:key}})).data.id,order.id);
 assert.equal((await api('cart',{cookie})).data.length,0);
 const stock=async()=>((await api('products/'+detail.id)).data.variants.find(v=>v.id===variant.id).stock);
 assert.equal(await stock(),variant.stock-2);
 await api('orders/'+order.id,{cookie,method:'PATCH',body:{status:'cancelled'}});
 assert.equal(await stock(),variant.stock);
 await api('orders/'+order.id,{cookie,method:'PATCH',body:{status:'cancelled'},expected:403});
 assert.equal(await stock(),variant.stock);
 await api('cart',{cookie,method:'POST',body:{...selection,quantity:1}});
 await api('orders',{cookie,method:'POST',body:{...delivery,coupon:'MA10',idempotency_key:randomUUID()},expected:400});
 const nextOrder=(await api('orders',{cookie,method:'POST',body:{...delivery,idempotency_key:randomUUID()}})).data;
 const otherLogin=await api('auth/register',{cookie:'',method:'POST',body:{name:'Khách khác',email:'other@example.test',password:customerPassword,role:'admin'},expected:201});
 assert.equal(otherLogin.data.user.role,'customer');
 assert.equal(JSON.stringify(otherLogin.data).includes('password'),false);
 const otherOptions={cookie:otherLogin.cookie};
 const otherSession=(await api('session',otherOptions)).data;
 assert.equal(otherSession.user.role,'customer');assert.equal(otherSession.canPreview,false);
 assert.equal((await api('orders',otherOptions)).data.length,0);
 await api('orders/'+nextOrder.id,{...otherOptions,method:'PATCH',body:{status:'cancelled'},expected:403});
 await api('preview',{...otherOptions,method:'POST',body:{role:'admin'},expected:403});
 await api('members',{...otherOptions,expected:403});
 await api('auth/register',{cookie:'',method:'POST',body:{name:'Khách khác',email:'other@example.test',password:customerPassword},expected:409});
 await api('auth/register',{cookie:'',method:'POST',body:{name:'Khách',email:'short@example.test',password:'123'},expected:400});
 await api('session',{cookie:'ma_session=forged',headers:{'x-user-role':'admin'}}).then(result=>assert.equal(result.data.user,null));

 cookie=await preview('staff');
 await api('orders/'+nextOrder.id,{cookie,method:'PATCH',body:{status:'cancelled'},expected:403});
 for(const status of ['confirmed','packing','shipping','delivered'])await api('orders/'+nextOrder.id,{cookie,method:'PATCH',body:{status}});
 cookie=await preview('admin');
 const dashboard=(await api('dashboard',{cookie})).data;
 assert.ok(dashboard.revenue>=nextOrder.total);
 const productBody={name:'Kiểm tra module '+randomUUID().slice(0,8),category:'Áo thun',gender:'Unisex',price:199000,original_price:239000,image:'/images/tee.jpg',description:'Sản phẩm kiểm tra cục bộ',material:'Cotton',colors:['Đen'],sizes:['M'],stock:3,is_new:1};
 const created=(await api('products',{cookie,method:'POST',body:productBody})).data;
 await api('products/'+created.id,{cookie,method:'PATCH',body:{...productBody,description:'Đã chỉnh sửa module'}});
 const createdDetail=(await api('products/'+created.id)).data;
 assert.equal(createdDetail.description,'Đã chỉnh sửa module');
 await api('inventory/'+encodeURIComponent(createdDetail.variants[0].id),{cookie,method:'PATCH',body:{stock:7}});
 assert.equal((await api('products/'+created.id)).data.variants[0].stock,7);
 const staffCreated=await api('members',{cookie,method:'POST',body:{email:'module-member@example.test',name:'Thành viên mẫu',role:'staff',password:customerPassword},expected:201});
 assert.ok(staffCreated.data.id);
 assert.ok((await api('members',{cookie})).data.members.some(v=>v.email==='module-member@example.test'&&v.role==='staff'));
 const staffLogin=await api('auth/login',{cookie:'',method:'POST',body:{email:'module-member@example.test',password:customerPassword}});
 assert.equal(staffLogin.data.user.role,'staff');
 const settings={phone:'0900000000',zalo:'https://zalo.me/0900000000',facebook:'https://www.facebook.com/',address:'Địa chỉ kiểm tra cục bộ',hours:'09:00 – 21:00'};
 await api('settings',{cookie,method:'PATCH',body:settings});
 assert.equal((await api('settings')).data.zalo,settings.zalo);
 await api('settings',{cookie,method:'PATCH',body:{...settings,facebook:'https://example.test/'},expected:400});
 await api('coupons',{cookie,method:'POST',body:{code:'MODULE15',percent:15,minimum:100000}});
 assert.ok((await api('coupons',{cookie})).data.some(v=>v.code==='MODULE15'&&v.percent===15));
 await api('coupons/MODULE15',{cookie,method:'DELETE',body:{}});
 await api('coupon',{cookie,method:'POST',body:{code:'MODULE15'},expected:400});
 await api('products/'+created.id,{cookie,method:'DELETE',body:{}});
 await api('products/'+created.id,{expected:404});
 assert.equal((await api('products/'+created.id+'?manage=1',{cookie})).data.active,0);
 await api('settings',{method:'PATCH',body:settings,headers:{Origin:'https://example.test'},expected:403});
 await api('preview',{cookie,method:'POST',body:{role:'exit'}});
 // Actual password accounts obey the same guards as role preview.
 const staffOptions={cookie:staffLogin.cookie};
 const staffSession=(await api('session',staffOptions)).data;
 assert.equal(staffSession.user.role,'staff');
 await api('inventory',staffOptions);
 await api('inventory/'+encodeURIComponent(variant.id),{...staffOptions,method:'PATCH',body:{stock:3},expected:403});
 await api('members',{...staffOptions,expected:403});
 await api('dashboard',{...staffOptions,expected:403});
 await api('members',{method:'POST',body:{email:'manager@example.test',name:'Quản lý mẫu',role:'manager',password:customerPassword},expected:201});
 const managerLogin=await api('auth/login',{cookie:'',method:'POST',body:{email:'manager@example.test',password:customerPassword}});
 const managerOptions={cookie:managerLogin.cookie};
 assert.equal((await api('session',managerOptions)).data.user.role,'manager');
 await api('dashboard',managerOptions);
 await api('inventory',managerOptions);
 await api('members',{...managerOptions,expected:403});
 await api('settings',{...managerOptions,method:'PATCH',body:settings,expected:403});
 await api('members',{method:'POST',body:{email:'no-password@example.test',name:'Thiếu mật khẩu',role:'manager'},expected:400});
 await api('members',{method:'POST',body:{email:'module-member@example.test',name:'Trùng email',role:'staff',password:customerPassword},expected:409});
 await api('members',{method:'POST',body:{email:'created-by-admin@example.test',name:'Nhân viên mới',role:'staff',password:customerPassword},expected:201});
 // Concurrent checkouts cannot oversell the final unit.
 const savedStock=await stock();
 await api('inventory/'+encodeURIComponent(variant.id),{method:'PATCH',body:{stock:1}});
 const firstCart=await preview('customer');
 await api('cart',{cookie:firstCart,method:'POST',body:{...selection,quantity:1}});
 await api('cart',{cookie:otherLogin.cookie,method:'POST',body:{...selection,quantity:1}});
 const concurrent=await Promise.all([firstCart,otherLogin.cookie].map(async buyer=>{
  const response=await fetch(new URL('/api/shop/orders',origin),{method:'POST',headers:{Cookie:buyer,'Content-Type':'application/json'},body:JSON.stringify({...delivery,idempotency_key:randomUUID()})});
  const data=await response.json();checks++;
  return {status:response.status,data,cookie:buyer};
 }));
 assert.deepEqual(concurrent.map(result=>result.status).sort(),[200,400]);
 assert.equal(await stock(),0);
 const accepted=concurrent.find(result=>result.status===200);
 await api('orders/'+accepted.data.id,{cookie:accepted.cookie,method:'PATCH',body:{status:'cancelled'}});
 assert.equal(await stock(),1);
 await api('inventory/'+encodeURIComponent(variant.id),{method:'PATCH',body:{stock:savedStock}});
 await api('preview',{method:'POST',body:{role:'exit'}});
 // Locked accounts lose access even if their cookie was issued earlier.
 await api('members/'+staffSession.user.id,{method:'PATCH',body:{role:'staff',active:0}});
 await api('orders?manage=1',{...staffOptions,expected:401});
 await api('auth/login',{cookie:'',method:'POST',body:{email:'module-member@example.test',password:customerPassword},expected:401});
 await api('members/'+staffSession.user.id,{method:'PATCH',body:{role:'staff',active:1}});
 // Owner can permanently delete non-admin accounts.
 const deleteTarget=await api('auth/register',{cookie:'',method:'POST',body:{name:'Tài khoản xóa',email:'delete-me@example.test',password:customerPassword},expected:201});
 await api('members/'+deleteTarget.data.user.id,{method:'DELETE',body:{}});
 await api('auth/login',{cookie:'',method:'POST',body:{email:'delete-me@example.test',password:customerPassword},expected:401});
 await api('members/'+(await api('session')).data.user.id,{method:'DELETE',body:{},expected:400});
 // Forgot / reset password flow (email logged when SMTP is unset; debugResetUrl in test).
 const resetUser=await api('auth/register',{cookie:'',method:'POST',body:{name:'Khách quên MK',email:'forgot@example.test',password:customerPassword},expected:201});
 const forgotUnknown=await api('auth/forgot-password',{cookie:'',method:'POST',body:{email:'nobody@example.test'}});
 assert.equal(forgotUnknown.data.ok,true);
 assert.equal(forgotUnknown.data.debugResetUrl,undefined);
 const forgot=await api('auth/forgot-password',{cookie:'',method:'POST',body:{email:'forgot@example.test'}});
 assert.ok(forgot.data.debugResetUrl);
 assert.ok(forgot.data.debugResetCode);
 assert.equal(String(forgot.data.debugResetCode).length,6);
 const resetToken=new URL(forgot.data.debugResetUrl).searchParams.get('token');
 assert.ok(resetToken);
 await api('auth/reset-password',{cookie:'',method:'POST',body:{token:'00'.repeat(32),password:'New-password-2026'},expected:400});
 await api('auth/reset-password',{cookie:'',method:'POST',body:{token:resetToken,password:'New-password-2026'}});
 await api('auth/login',{cookie:'',method:'POST',body:{email:'forgot@example.test',password:customerPassword},expected:401});
 const afterReset=await api('auth/login',{cookie:'',method:'POST',body:{email:'forgot@example.test',password:'New-password-2026'}});
 assert.equal(afterReset.data.user.email,'forgot@example.test');
 await api('auth/reset-password',{cookie:'',method:'POST',body:{token:resetToken,password:'Another-password-2026'},expected:400});
 const forgot2=await api('auth/forgot-password',{cookie:'',method:'POST',body:{email:'forgot@example.test'}});
 await api('auth/reset-password',{cookie:'',method:'POST',body:{email:'forgot@example.test',code:forgot2.data.debugResetCode,password:'Code-password-2026'}});
 assert.equal((await api('auth/login',{cookie:'',method:'POST',body:{email:'forgot@example.test',password:'Code-password-2026'}})).data.user.email,'forgot@example.test');
 void resetUser;
 // Data and opaque sessions remain valid across server restarts.
 await stopServer();await startServer();
 assert.equal((await api('session')).data.user.role,'admin');
 assert.equal((await api('settings')).data.phone,settings.phone);
 assert.ok((await api('dashboard')).data.revenue>=nextOrder.total);
 const relogin=await api('auth/login',{cookie:adminCookie,method:'POST',body:{email:'owner@example.test',password:ownerPassword}});
 const oldCookie=adminCookie;adminCookie=relogin.cookie;
 assert.equal((await api('session',{cookie:oldCookie})).data.user,null);
 await api('auth/logout',{method:'POST',body:{}});
 assert.equal((await api('session')).data.user,null);
 await api('orders',{expected:401});
 console.log('Passed '+checks+' local HTTP checks for the independent project.');
});
