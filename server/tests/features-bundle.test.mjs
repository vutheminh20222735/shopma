import test, {before,after} from 'node:test';
import {spawn,execFileSync} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdtempSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
import assert from 'node:assert/strict';
import {randomUUID,createHmac} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';

// Feature bundle: offers, orders race, uploads, payments webhook, reviews, reports, notifications.
// Mỗi lần chạy dùng DB + thư mục upload tạm và server thật qua HTTP.
const projectRoot=process.cwd();
const temporary=mkdtempSync(path.join(tmpdir(),'ma-shop-features-'));
const ownerPassword='Test-owner-password-2026',customerPassword='Test-customer-password-2026';
const paymentSecret='test-payment-secret',shippingSecret='test-shipping-secret';
let server,origin,env,serverLog='',adminCookie='',checks=0;
async function startServer(){
 server=spawn(process.execPath,['--import','tsx','server/index.ts'],{cwd:projectRoot,env,stdio:['ignore','pipe','pipe']});
 server.stdout.on('data',chunk=>{serverLog+=chunk.toString();});
 server.stderr.on('data',chunk=>{serverLog+=chunk.toString();});
 for(let attempt=0;attempt<100;attempt++){
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
 env={...process.env,PORT:String(port),HOST:'127.0.0.1',APP_ORIGIN:origin.origin,DATABASE_PATH:path.join(temporary,'shop.sqlite'),UPLOAD_DIR:path.join(temporary,'uploads'),NODE_ENV:'test',OTP_MODE:'test',PAYMENT_WEBHOOK_SECRET:paymentSecret,SHIPPING_WEBHOOK_SECRET:shippingSecret,ADMIN_NAME:'Chủ shop kiểm tra',ADMIN_EMAIL:'owner@example.test',ADMIN_PASSWORD:ownerPassword};
 execFileSync(process.execPath,['--import','tsx','server/scripts/setup-admin.ts'],{cwd:projectRoot,env,stdio:'pipe'});
 await startServer();
 adminCookie=(await api('auth/login',{cookie:'',method:'POST',body:{email:'owner@example.test',password:ownerPassword}})).cookie;
});
after(async()=>{await stopServer();rmSync(temporary,{recursive:true,force:true});});

async function call(route,{method='GET',body,cookie=adminCookie,expected=200,headers={},raw}={}){
 const payload=raw!==undefined?raw:body===undefined?undefined:JSON.stringify(body);
 const response=await fetch(new URL(route,origin),{method,headers:{...(payload===undefined?{}:{'Content-Type':'application/json'}),...(cookie?{Cookie:cookie}:{}),...headers},body:payload});
 const text=await response.text();
 const data=/json/.test(response.headers.get('content-type')||'')?JSON.parse(text):text;
 if(Array.isArray(expected)?!expected.includes(response.status):response.status!==expected)assert.fail(route+' -> '+response.status+' '+JSON.stringify(data).slice(0,200));
 checks++;
 return {status:response.status,data,headers:response.headers,cookie:response.headers.getSetCookie().map(value=>value.split(';')[0]).filter(value=>!value.endsWith('=')).join('; ')};
}
const api=(route,options={})=>call('/api/shop/'+route,options);
const delivery={customer_name:'Khách kiểm tra',phone:'0900000000',address:'Địa chỉ mẫu trên máy cục bộ',payment:'cod',note:'features bundle'};
let userCounter=0;
async function registerCustomer(extra={}){
 const email=`feature-${++userCounter}-${randomUUID().slice(0,6)}@example.test`;
 const result=await api('auth/register',{cookie:'',method:'POST',body:{name:'Khách Tính Năng',email,password:customerPassword,...extra},expected:201});
 return {cookie:result.cookie,user:result.data.user,email};
}
const vnToday=()=>new Date(Date.now()+7*3600000).toISOString().slice(0,10);
const stockOf=async(productId,variantId)=>(await api('products/'+productId)).data.variants.find(v=>v.id===variantId).stock;
const tee=async()=>{const p=(await api('products/essential-tee')).data;return {p,variant:p.variants.find(v=>v.size==='M'&&v.color==='Trắng')};};
async function addToCart(cookie,variant,quantity=1){
 await api('cart',{cookie,method:'POST',body:{product_id:variant.product_id,size:variant.size,color:variant.color,quantity}});
}
const placeOrder=(cookie,extra={},expected=200)=>api('orders',{cookie,method:'POST',body:{...delivery,idempotency_key:randomUUID(),...extra},expected});
const sign=(secret,raw)=>createHmac('sha256',secret).update(raw).digest('hex');
const patchStatus=(id,status,expected=200)=>api('orders/'+id,{method:'PATCH',body:{status},expected});

test('Welcome offer ok but birthday offer blocked for a brand-new account',async()=>{
 const c=await registerCustomer({phone:'0912 345 678'});
 const mine=(await api('my-offers',{cookie:c.cookie})).data;
 const welcome=mine.offers.find(o=>o.kind==='welcome');
 assert.ok(welcome,'welcome offer granted on register with phone');
 assert.deepEqual([welcome.percent,welcome.max_discount,welcome.minimum,welcome.status],[5,30000,200000,'active']);
 assert.ok(Date.parse(welcome.expires_at)-Date.now()>29*86400000-60000);
 // một số điện thoại chỉ nhận một lần chào mừng
 const second=await registerCustomer({phone:'+84912345678'});
 assert.equal((await api('my-offers',{cookie:second.cookie})).data.offers.filter(o=>o.kind==='welcome').length,0);
 // đặt ngày sinh hôm nay + xác minh OTP (OTP_MODE=test -> 000000) vẫn không đủ vì tài khoản < 30 ngày
 // sinh nhật rơi vào thời hạn mã chào mừng (tài khoản mới): chỉ hiện mã chào mừng, không có mã sinh nhật
 const profile=(await api('profile',{cookie:c.cookie,method:'PATCH',body:{birthday:vnToday().replace(/^\d{4}/,'1995')}})).data;
 assert.ok(profile.birthday_updated_at,'đổi ngày sinh đặt lại birthday_updated_at');
 const windowView=(await api('my-offers',{cookie:c.cookie})).data;
 assert.equal(windowView.birthday.in_welcome_window,true);assert.equal(windowView.birthday.eligible,false);
 assert.deepEqual(windowView.offers.map(o=>o.kind),['welcome']);
 // đặt sinh nhật 100 ngày nữa: ngoài thời hạn chào mừng nhưng vẫn bị chặn vì tài khoản < 30 ngày
 const later=new Date(Date.now()+(7*24+100*24+1)*3600000).toISOString().slice(0,10).replace(/^\d{4}/,'1995');
 await api('profile',{cookie:c.cookie,method:'PATCH',body:{birthday:later}});
 await api('profile',{cookie:c.cookie,method:'PATCH',body:{birthday:'1995-02-31'},expected:400});
 await api('otp/send',{cookie:c.cookie,method:'POST',body:{phone:'0912345678'}});
 await api('otp/send',{cookie:c.cookie,method:'POST',body:{phone:'0912345678'},expected:429});
 await api('otp/verify',{cookie:c.cookie,method:'POST',body:{code:'111111'},expected:400});
 assert.equal((await api('otp/verify',{cookie:c.cookie,method:'POST',body:{code:'000000'}})).data.verified,true);
 const after=(await api('my-offers',{cookie:c.cookie})).data;
 assert.equal(after.offers.some(o=>o.kind==='birthday'),false);
 assert.equal(after.birthday.eligible,false);
 assert.ok(after.birthday.reasons.some(reason=>/30 ngày/.test(reason)),JSON.stringify(after.birthday.reasons));
 assert.ok(after.birthday.reasons.some(reason=>/đơn đã giao/.test(reason)));
 await api('offers',{cookie:c.cookie,expected:403});
});

test('A member offer cannot be used twice (concurrent checkout) and does not stack with coupons',async()=>{
 const c=await registerCustomer({phone:'0933333333'});
 const code=(await api('my-offers',{cookie:c.cookie})).data.offers.find(o=>o.kind==='welcome').code;
 const {variant}=await tee();
 await addToCart(c.cookie,variant,1);
 await api('orders',{cookie:c.cookie,method:'POST',body:{...delivery,idempotency_key:randomUUID(),coupon:'MA10',offer_code:code},expected:400});
 const quote=(await api('offers/apply',{cookie:c.cookie,method:'POST',body:{code,subtotal:249000}})).data;
 assert.equal(quote.discount,12450);
 await api('offers/apply',{cookie:c.cookie,method:'POST',body:{code,subtotal:100000},expected:400});
 const results=await Promise.all([1,2].map(()=>placeOrder(c.cookie,{coupon:code},[200,400,409])));
 assert.deepEqual(results.map(r=>r.status).sort(),[200,400],'exactly one concurrent checkout may use the code');
 const order=results.find(r=>r.status===200).data;
 assert.equal(order.discount,12450);
 assert.equal(order.total,249000-12450+30000);
 assert.equal((await api('my-offers',{cookie:c.cookie})).data.offers.find(o=>o.code===code).status,'used');
 await addToCart(c.cookie,variant,1);
 const reuse=await placeOrder(c.cookie,{coupon:code},400);
 assert.match(reuse.data.error,/đã được sử dụng/);
 // Hủy đơn trả lại mã còn hạn
 await api(`orders/${order.id}/cancel`,{cookie:c.cookie,method:'POST',body:{}});
 assert.equal((await api('my-offers',{cookie:c.cookie})).data.offers.find(o=>o.code===code).status,'active');
 assert.equal((await placeOrder(c.cookie,{coupon:code})).status,200);
 // mã của người khác không dùng được
 const other=await registerCustomer();
 await addToCart(other.cookie,variant,1);
 await placeOrder(other.cookie,{coupon:code},400);
 await api('cart',{cookie:other.cookie,method:'GET'});
});

test('Cancel vs confirm race: exactly one wins, stock and timeline stay consistent',async()=>{
 const c=await registerCustomer();
 const {p,variant}=await tee();
 for(let round=0;round<4;round++){
  const before=await stockOf(p.id,variant.id);
  await addToCart(c.cookie,variant,1);
  const order=(await placeOrder(c.cookie)).data;
  assert.equal(await stockOf(p.id,variant.id),before-1);
  const cancel=()=>call(`/api/shop/orders/${order.id}/cancel`,{cookie:c.cookie,method:'POST',body:{},expected:[200,403,409]});
  const confirm=()=>call(`/api/shop/orders/${order.id}`,{method:'PATCH',body:{status:'confirmed'},expected:[200,403,409]});
  const results=await Promise.all(round%2?[cancel(),confirm()]:[confirm(),cancel()]);
  const winners=results.filter(r=>r.status===200);
  assert.equal(winners.length,1,'one winner: '+JSON.stringify(results.map(r=>r.status)));
  const detail=(await api('orders/'+order.id)).data;
  const statuses=detail.events.map(e=>e.status);
  assert.deepEqual(statuses.filter(s=>s==='pending'),['pending']);
  if(detail.status==='cancelled'){
   assert.equal(await stockOf(p.id,variant.id),before,'stock restored once');
   assert.equal(statuses.includes('confirmed'),false);assert.equal(detail.confirmed_at,null);
  }else{
   assert.equal(detail.status,'confirmed');assert.ok(detail.confirmed_at);
   assert.equal(await stockOf(p.id,variant.id),before-1);
   await api(`orders/${order.id}/cancel`,{cookie:c.cookie,method:'POST',body:{},expected:403});
   await api(`orders/${order.id}`,{method:'PATCH',body:{status:'cancelled'}});
   assert.equal(await stockOf(p.id,variant.id),before);
  }
  assert.equal(detail.events[0].status,'pending');
 }
 // đổi size khi đang chờ xác nhận: kho cũ/mới cập nhật nguyên tử
 await addToCart(c.cookie,variant,2);
 const order=(await placeOrder(c.cookie)).data;
 const oldStock=await stockOf(p.id,variant.id);
 const large=p.variants.find(v=>v.size==='L'&&v.color==='Trắng');
 const largeBefore=await stockOf(p.id,large.id);
 const resized=(await api(`orders/${order.id}/resize`,{cookie:c.cookie,method:'POST',body:{variant_id:variant.id,size:'L'}})).data;
 assert.equal(resized.price_delta,0);
 assert.equal(await stockOf(p.id,variant.id),oldStock+2);
 assert.equal(await stockOf(p.id,large.id),largeBefore-2);
 assert.equal(resized.order.items[0].size,'L');
 await api(`orders/${order.id}/resize`,{cookie:c.cookie,method:'POST',body:{variant_id:large.id,size:'L'},expected:400});
 await patchStatus(order.id,'confirmed');
 await api(`orders/${order.id}/resize`,{cookie:c.cookie,method:'POST',body:{variant_id:large.id,size:'M'},expected:409});
});

test('Product images: magic bytes, size/count limits, staff grants',async()=>{
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==','base64');
 const dataUrl=(mime,buffer)=>`data:${mime};base64,${buffer.toString('base64')}`;
 // nội dung không phải ảnh nhưng khai báo image/png
 const fake=await api('uploads/essential-tee',{method:'POST',body:{data_url:dataUrl('image/png',Buffer.from('<?php echo "not an image, only text bytes"; ?>'))},expected:400});
 assert.match(fake.data.error,/không phải ảnh/);
 await api('uploads/essential-tee',{method:'POST',body:{data_url:dataUrl('image/png',Buffer.concat([Buffer.from('GIF89a'),Buffer.alloc(80)]))},expected:400});
 await api('uploads/essential-tee',{method:'POST',body:{data_url:dataUrl('image/svg+xml',Buffer.from('<svg onload=alert(1)></svg>'))},expected:400});
 await api('uploads/essential-tee',{method:'POST',body:{data_url:dataUrl('image/jpeg',png)},expected:400}); // mime không khớp magic bytes
 await api('uploads/essential-tee',{method:'POST',body:{data_url:'data:image/png;base64,@@@'},expected:400});
 await api('uploads/essential-tee',{method:'POST',body:{data_url:dataUrl('image/jpeg',Buffer.concat([Buffer.from([0xff,0xd8,0xff]),Buffer.alloc(5.5*1024*1024)]))},expected:413});
 await api('uploads/no-such-product',{method:'POST',body:{data_url:dataUrl('image/png',png)},expected:404});
 // khách / nhân viên chưa được cấp quyền
 const customer=await registerCustomer();
 await api('uploads/essential-tee',{cookie:customer.cookie,method:'POST',body:{data_url:dataUrl('image/png',png)},expected:403});
 await api('members',{method:'POST',body:{email:'staff-upload@example.test',name:'Nhân viên ảnh',role:'staff',password:customerPassword},expected:201});
 const staff=(await api('auth/login',{cookie:'',method:'POST',body:{email:'staff-upload@example.test',password:customerPassword}}));
 await api('uploads/essential-tee',{cookie:staff.cookie,method:'POST',body:{data_url:dataUrl('image/png',png)},expected:403});
 const grants=(await api('product-grants')).data;
 const staffGrant=grants.find(g=>g.email==='staff-upload@example.test');
 await api('product-grants/'+staffGrant.id,{method:'PATCH',body:{can_edit:true}});
 const first=(await api('uploads/essential-tee',{cookie:staff.cookie,method:'POST',body:{data_url:dataUrl('image/png',png)},expected:201})).data;
 assert.match(first.path,/^\/uploads\/products\/[0-9a-f-]{36}\.png$/);
 const served=await fetch(new URL(first.path,origin));
 assert.equal(served.status,200);assert.equal(served.headers.get('content-type'),'image/png');checks++;
 assert.ok(existsSync(path.join(temporary,'uploads','products',path.basename(first.path))));
 // nhân viên có quyền sửa nhưng không thêm sản phẩm mới / không ngừng bán
 const detail=(await api('products/essential-tee')).data;
 const edit={name:detail.name,category:detail.category,gender:detail.gender,price:detail.price,original_price:detail.original_price,image:detail.image,description:detail.description,material:detail.material,colors:detail.colors,sizes:detail.sizes,is_new:detail.is_new};
 await api('products/essential-tee',{cookie:staff.cookie,method:'PATCH',body:{...edit,description:'Mô tả do nhân viên có quyền sửa'}});
 await api('products',{cookie:staff.cookie,method:'POST',body:edit,expected:403});
 await api('products/essential-tee',{cookie:staff.cookie,method:'DELETE',body:{},expected:403});
 await api('product-grants/'+staffGrant.id,{method:'PATCH',body:{can_edit:false}});
 await api('products/essential-tee',{cookie:staff.cookie,method:'PATCH',body:edit,expected:403});
 // tối đa 8 ảnh (ảnh gốc tính 1)
 let accepted=2; // ảnh gốc + ảnh nhân viên đã tải
 for(let i=0;i<9;i++){const r=await api('uploads/essential-tee',{method:'POST',body:{data_url:dataUrl('image/png',png)},expected:[201,400]});if(r.status===201)accepted++;}
 const images=(await api('products/essential-tee')).data.images;
 assert.equal(images.length,8);assert.equal(accepted,8);assert.equal(images.filter(i=>i.is_primary).length,1);
 // ảnh chính đổi và xóa
 await api('uploads/essential-tee/primary',{method:'POST',body:{image_id:first.id}});
 assert.equal((await api('products/essential-tee')).data.image,first.path);
 await api('uploads/'+first.id,{method:'DELETE',body:{}});
 assert.equal(existsSync(path.join(temporary,'uploads','products',path.basename(first.path))),false);
 // ngừng bán mềm giữ lịch sử
 await api('products/straight-jeans',{method:'DELETE',body:{}});
 await api('products/straight-jeans',{cookie:'',expected:404});
 assert.equal((await api('products/straight-jeans?manage=1')).data.active,0);
 await api('products/straight-jeans/restore',{method:'POST',body:{}});
 assert.equal((await api('products/straight-jeans',{cookie:''})).data.active,1);
});

test('Payment webhook: bad signature rejected, valid one idempotent, redirect never marks paid',async()=>{
 const c=await registerCustomer();
 const {variant}=await tee();
 await addToCart(c.cookie,variant,1);
 const order=(await placeOrder(c.cookie,{payment:'transfer'})).data;
 const event={provider:'stub',event_id:'evt-'+randomUUID(),order_id:order.id,amount:order.total,status:'paid',provider_ref:'BANK-1'};
 const raw=JSON.stringify(event);
 await api('payments/webhook',{cookie:'',method:'POST',raw,expected:401});
 await api('payments/webhook',{cookie:'',method:'POST',raw,headers:{'x-signature':'0'.repeat(64)},expected:401});
 await api('payments/webhook',{cookie:'',method:'POST',raw,headers:{'x-signature':sign('wrong-secret',raw)},expected:401});
 await api('payments/webhook',{cookie:'',method:'POST',raw,headers:{'x-signature':sign(paymentSecret,raw+' ')},expected:401});
 await api('payments/webhook',{cookie:'',method:'POST',raw,headers:{'x-signature':'zz'},expected:401});
 // chưa thanh toán; redirect/return không đổi trạng thái
 const created=(await api(`payments/${order.id}/create`,{cookie:c.cookie,method:'POST',body:{}})).data;
 assert.equal(created.live,false);assert.equal(created.status,'pending');
 const back=(await api(`payments/return?order=${order.id}`,{cookie:c.cookie})).data;
 assert.equal(back.paid,false);
 assert.equal((await api('orders/'+order.id,{cookie:c.cookie})).data.payment_status,'unpaid');
 // sai số tiền
 const badAmount=JSON.stringify({...event,event_id:'evt-'+randomUUID(),amount:order.total-1000});
 await api('payments/webhook',{cookie:'',method:'POST',raw:badAmount,headers:{'x-signature':sign(paymentSecret,badAmount)},expected:422});
 assert.equal((await api('orders/'+order.id,{cookie:c.cookie})).data.payment_status,'unpaid');
 // hợp lệ + gửi lại (idempotent)
 const ok=await api('payments/webhook',{cookie:'',method:'POST',raw,headers:{'x-signature':'sha256='+sign(paymentSecret,raw)}});
 assert.equal(ok.data.duplicate,false);
 const replay=await api('payments/webhook',{cookie:'',method:'POST',raw,headers:{'x-signature':sign(paymentSecret,raw)}});
 assert.equal(replay.data.duplicate,true);
 const paid=(await api('orders/'+order.id,{cookie:c.cookie})).data;
 assert.equal(paid.payment_status,'paid');
 assert.equal(paid.events.filter(e=>e.status==='paid').length,1);
 assert.equal(paid.payment_info.transactions.filter(t=>t.status==='paid').length,1);
 // hủy đơn đã thanh toán -> yêu cầu hoàn tiền chờ xác nhận
 await api(`orders/${order.id}/cancel`,{cookie:c.cookie,method:'POST',body:{}});
 let cancelled=(await api('orders/'+order.id,{cookie:c.cookie})).data;
 assert.equal(cancelled.refund_status,'pending');
 assert.equal(cancelled.refund_info.refund.amount,order.total);
 await api(`payments/${order.id}/refund-confirm`,{cookie:c.cookie,method:'POST',body:{},expected:403});
 await api(`payments/${order.id}/refund-confirm`,{method:'POST',body:{}});
 cancelled=(await api('orders/'+order.id,{cookie:c.cookie})).data;
 assert.equal(cancelled.refund_status,'refunded');
 assert.ok(cancelled.events.some(e=>e.status==='refund_confirmed'));
 // webhook vận chuyển
 const shipRaw=JSON.stringify({tracking_code:'NOPE',status:'delivered'});
 await api('shipping/webhook',{cookie:'',method:'POST',raw:shipRaw,headers:{'x-signature':'1'.repeat(64)},expected:401});
 await api('shipping/webhook',{cookie:'',method:'POST',raw:shipRaw,headers:{'x-signature':sign(shippingSecret,shipRaw)},expected:404});
});

test('Delivered+paid orders feed reviews, reports and notifications',async()=>{
 const c=await registerCustomer();
 const {p,variant}=await tee();
 await addToCart(c.cookie,variant,2);
 const order=(await placeOrder(c.cookie)).data;
 // thông báo cho nhân viên, không trùng
 const notes=(await api('notifications')).data;
 assert.ok(notes.items.some(n=>n.type==='order_new'&&n.ref_key===order.id));
 assert.equal(notes.items.filter(n=>n.ref_key===order.id&&n.type==='order_new').length,1);
 assert.ok(notes.unread>=1);
 await api('notifications/'+notes.items[0].id+'/read',{method:'POST',body:{}});
 await api('notifications/read-all',{method:'POST',body:{}});
 assert.equal((await api('notifications/unread-count')).data.unread,0);
 await api('notifications',{cookie:c.cookie,expected:403});
 // chưa giao -> chưa được đánh giá
 await api('reviews',{cookie:c.cookie,method:'POST',body:{product_id:p.id,rating:5,content:'Áo rất đẹp và vừa vặn'},expected:403});
 // vận đơn stub + webhook vận chuyển giao hàng (COD thu tiền)
 await patchStatus(order.id,'confirmed');await patchStatus(order.id,'packing');
 const shipment=(await api(`shipping/${order.id}/create`,{method:'POST',body:{}, expected:201})).data.shipment;
 await patchStatus(order.id,'shipping');
 const raw=JSON.stringify({tracking_code:shipment.tracking_code,status:'delivered',cod_collected:order.total});
 await api('shipping/webhook',{cookie:'',method:'POST',raw,headers:{'x-signature':sign(shippingSecret,raw)}});
 const delivered=(await api('orders/'+order.id,{cookie:c.cookie})).data;
 assert.equal(delivered.status,'delivered');assert.equal(delivered.payment_status,'paid');assert.equal(delivered.tracking.code,shipment.tracking_code);
 assert.deepEqual([...new Set(delivered.events.map(e=>e.status))].filter(s=>['pending','confirmed','packing','shipping','delivered'].includes(s)),['pending','confirmed','packing','shipping','delivered']);
 // đánh giá
 await api('reviews',{cookie:c.cookie,method:'POST',body:{product_id:p.id,rating:5,content:'<script>alert(1)</script> đẹp lắm'},expected:400});
 await api('reviews',{cookie:c.cookie,method:'POST',body:{product_id:p.id,rating:5,content:'aaaaaaaaaaaaaaaaaaaa'},expected:400});
 await api('reviews',{cookie:c.cookie,method:'POST',body:{product_id:p.id,rating:9,content:'Áo rất đẹp và vừa vặn'},expected:400});
 const review=(await api('reviews',{cookie:c.cookie,method:'POST',body:{product_id:p.id,rating:4,content:'<b>Áo</b> rất đẹp & vừa vặn <img src=x>'},expected:201})).data;
 assert.equal(review.verified_purchase,true);
 await api('reviews',{cookie:c.cookie,method:'POST',body:{product_id:p.id,rating:5,content:'Đánh giá lần hai của tôi'},expected:409});
 const stranger=await registerCustomer();
 await api('reviews',{cookie:stranger.cookie,method:'POST',body:{product_id:p.id,rating:5,content:'Tôi chưa mua sản phẩm này'},expected:403});
 await api('reviews/'+review.id,{cookie:stranger.cookie,method:'PATCH',body:{rating:1},expected:403});
 await api('reviews/'+review.id,{cookie:c.cookie,method:'PATCH',body:{rating:3}});
 let list=(await api(`products/${p.id}/reviews?stars=3`,{cookie:''})).data;
 assert.equal(list.count,1);assert.equal(list.average,3);assert.equal(list.items.length,1);
 assert.ok(list.items[0].verified_purchase);assert.equal(list.items[0].verified_label,'Đã mua hàng');
 assert.ok(!/[<>]/.test(list.items[0].content),list.items[0].content);
 assert.equal((await api(`products/${p.id}/reviews?stars=5`,{cookie:''})).data.items.length,0);
 // ẩn đánh giá: cần lý do + admin/manager, không đổi rating
 await api(`reviews/${review.id}/hide`,{cookie:c.cookie,method:'POST',body:{reason:'tự ẩn'},expected:403});
 await api(`reviews/${review.id}/hide`,{method:'POST',body:{},expected:400});
 await api(`reviews/${review.id}/hide`,{method:'POST',body:{reason:'Ngôn từ không phù hợp'}});
 list=(await api(`products/${p.id}/reviews`,{cookie:''})).data;
 assert.equal(list.count,0);assert.equal(list.items.length,0);
 const asAdmin=(await api(`products/${p.id}/reviews?include_hidden=1`)).data;
 assert.equal(asAdmin.items[0].rating,3);assert.equal(asAdmin.items[0].hidden,true);
 // hỏi đáp
 await api(`products/${p.id}/comments`,{cookie:'',method:'POST',body:{content:'Áo này có form rộng không?'},expected:401});
 await api(`products/${p.id}/comments`,{cookie:c.cookie,method:'POST',body:{content:'<script>x</script> hello'},expected:400});
 const question=(await api(`products/${p.id}/comments`,{cookie:c.cookie,method:'POST',body:{content:'Áo này có form rộng không?'},expected:201})).data;
 const answer=(await api(`products/${p.id}/comments`,{method:'POST',body:{content:'Form relaxed, bạn có thể chọn đúng size nhé.',parent_id:question.id},expected:201})).data;
 assert.equal(answer.is_staff_reply,true);
 const thread=(await api(`products/${p.id}/comments`,{cookie:''})).data;
 assert.equal(thread.items[0].replies[0].is_staff_reply,true);
 await api(`comments/${question.id}/hide`,{cookie:c.cookie,method:'POST',body:{reason:'x'},expected:403});
 await api(`comments/${question.id}/hide`,{method:'POST',body:{reason:'Spam quảng cáo'}});
 assert.equal((await api(`products/${p.id}/comments`,{cookie:''})).data.items.length,0);
 // báo cáo doanh thu (giờ Việt Nam), phí ship tách riêng, điền ngày trống, CSV
 const report=(await api('reports/revenue?granularity=day')).data;
 assert.equal(report.timezone,'Asia/Ho_Chi_Minh');assert.equal(report.data.length,30);assert.equal(report.profit_available,false);
 const today=report.data.find(d=>d.period===vnToday());
 assert.equal(today.orders,1);assert.equal(today.shipping,order.shipping);assert.equal(today.total,order.total);assert.equal(today.goods,order.subtotal);
 assert.equal(report.data.filter(d=>d.orders===0&&d.total===0).length,29);
 assert.equal('profit' in report.totals,false);
 const month=(await api('reports/revenue?granularity=month&from='+vnToday().slice(0,4)+'-01-01&to='+vnToday())).data;
 assert.ok(month.data.length>=1&&month.totals.orders>=1);
 const csv=await api('reports/revenue?granularity=day&from='+vnToday()+'&to='+vnToday()+'&format=csv');
 assert.match(csv.headers.get('content-type'),/text\/csv/);assert.ok(csv.data.includes(vnToday()));
 await api('reports/revenue?granularity=week',{expected:400});
 await api('reports/revenue',{cookie:c.cookie,expected:403});
});

test('Offer configs: admin CRUD writes history; anniversary job is idempotent',async()=>{
 const configs=(await api('offers')).data;
 const birthday=configs.find(cfg=>cfg.kind==='birthday');
 assert.deepEqual([birthday.percent,birthday.max_discount,birthday.minimum,birthday.valid_days],[10,100000,500000,7]);
 await api('offers/'+birthday.id,{method:'PATCH',body:{percent:12}});
 await api('offers/'+birthday.id,{method:'PATCH',body:{percent:90},expected:400});
 await api('offers/'+birthday.id,{method:'PATCH',body:{percent:10}});
 const history=(await api('offers/history')).data;
 assert.equal(history.filter(h=>h.config_id===birthday.id).length,2);
 await api('offers',{method:'POST',body:{kind:'anniversary',milestone:3,percent:5,max_discount:1000,minimum:0,valid_days:1},expected:409});
 const c=await registerCustomer();
 await api('offers/'+birthday.id,{cookie:c.cookie,method:'PATCH',body:{percent:50},expected:403});
});

test('Time helpers: Feb 29 anniversaries and whole years since account',async()=>{
 const {anniversaryDateForYear,yearsSinceAccount,toYmd,addDays}=await import('../shared/time.ts');
 assert.equal(anniversaryDateForYear('2024-02-29',2025),'2025-02-28');
 assert.equal(anniversaryDateForYear('2024-02-29',2028),'2028-02-29');
 assert.equal(anniversaryDateForYear('2023-05-10',2030),'2030-05-10');
 assert.equal(yearsSinceAccount('2024-02-29T05:00:00.000Z','2025-02-27'),0);
 assert.equal(yearsSinceAccount('2024-02-29T05:00:00.000Z','2025-02-28'),1);
 assert.equal(yearsSinceAccount('2024-02-29T05:00:00.000Z','2027-02-28'),3);
 assert.equal(toYmd('2026-01-01T18:00:00.000Z'),'2026-01-02'); // 01:00 giờ Việt Nam
 assert.equal(addDays('2026-02-27',2),'2026-03-01');
});

test('Birthday/anniversary offers for a mature account, once per phone; anniversary catch-up on boot',async()=>{
 const dbPath=path.join(temporary,'shop.sqlite');
 const mutate=sql=>{const db=new DatabaseSync(dbPath);db.exec('PRAGMA busy_timeout=5000');try{db.exec(sql);}finally{db.close();}};
 const daysAgo=n=>new Date(Date.now()-n*86400000).toISOString();
 const insertOrder=(memberId,status,paymentStatus)=>mutate(`INSERT INTO orders (id,customer_id,customer_name,phone,address,note,total,subtotal,shipping,discount,status,payment,items,created_at,idempotency_key,payment_status) VALUES ('MA-${randomUUID().slice(0,8)}','${memberId}','x','0900000000','địa chỉ mẫu để thử','',300000,300000,0,0,'${status}','cod','[]','${daysAgo(60)}','${randomUUID()}','${paymentStatus}')`);
 const birthdayToday=vnToday().replace(/^\d{4}/,'1990');
 const prepare=async(extra,orderState)=>{
  const c=await registerCustomer(extra);
  mutate(`UPDATE members SET created_at='${daysAgo(368)}',birthday='${birthdayToday}',birthday_updated_at='${daysAgo(100)}',phone_verified=1 WHERE id='${c.user.id}'`);
  if(orderState)insertOrder(c.user.id,...orderState);
  return c;
 };
 const good=await prepare({phone:'0944444444'},['delivered','paid']);
 const mine=(await api('my-offers',{cookie:good.cookie})).data;
 const birthday=mine.offers.find(o=>o.kind==='birthday');
 assert.ok(birthday,JSON.stringify(mine.birthday));
 assert.deepEqual([birthday.percent,birthday.max_discount,birthday.minimum,birthday.status],[10,100000,500000,'active']);
 assert.ok(Math.abs(Date.parse(birthday.expires_at)-Date.parse(birthday.starts_at)-7*86400000)<1000,'valid for 7 days');
 assert.equal(mine.offers.filter(o=>o.kind==='birthday').length,1);
 assert.equal((await api('my-offers',{cookie:good.cookie})).data.offers.filter(o=>o.kind==='birthday').length,1,'idempotent');
 const anniversary=mine.offers.find(o=>o.kind==='anniversary');
 assert.ok(anniversary);assert.equal(anniversary.milestone,1);assert.equal(anniversary.percent,8);
 // cùng số điện thoại (đã xác minh) ở tài khoản khác: không nhận thêm mã sinh nhật trong năm
 mutate(`UPDATE members SET phone_verified=0 WHERE id='${good.user.id}'`);
 const clone=await prepare({},['delivered','paid']);
 mutate(`UPDATE members SET phone_e164='+84944444444' WHERE id='${clone.user.id}'`);
 assert.equal((await api('my-offers',{cookie:clone.cookie})).data.offers.some(o=>o.kind==='birthday'),false);
 // chỉ có đơn đã hoàn tiền / chưa giao -> bị chặn
 const refunded=await prepare({phone:'0955555555'},['delivered','refunded']);
 const view=(await api('my-offers',{cookie:refunded.cookie})).data;
 assert.equal(view.offers.some(o=>o.kind==='birthday'),false);
 assert.ok(view.birthday.reasons.some(reason=>/đơn đã giao/.test(reason)));
 // chưa xác minh OTP thật (OTP_MODE=test bỏ qua) -> kiểm tra tài khoản thật bị chặn khi thiếu số điện thoại
 const noPhone=await prepare({},['delivered','paid']);
 assert.ok((await api('my-offers',{cookie:noPhone.cookie})).data.birthday.reasons.some(reason=>/số điện thoại/.test(reason)));
 // job kỷ niệm: bù khi khởi động lại, không cấp trùng
 const old=await prepare({},null);
 mutate(`DELETE FROM job_runs WHERE name='anniversary'`);
 await stopServer();await startServer();
 const countFor=id=>{const db=new DatabaseSync(dbPath);try{return db.prepare("SELECT COUNT(*) AS n FROM member_offers WHERE member_id=? AND kind='anniversary'").get(id).n;}finally{db.close();}};
 assert.equal(countFor(old.user.id),1,'granted by boot catch-up job');
 await stopServer();await startServer();
 assert.equal(countFor(old.user.id),1,'unique per member+milestone');
 adminCookie=(await api('auth/login',{cookie:'',method:'POST',body:{email:'owner@example.test',password:ownerPassword}})).cookie;
});

test('Notification SSE stream pushes new orders to staff only',async()=>{
 const customer=await registerCustomer();
 assert.equal((await fetch(new URL('/api/shop/notifications/stream',origin),{headers:{Cookie:customer.cookie}})).status,403);
 assert.equal((await fetch(new URL('/api/shop/notifications/stream',origin))).status,401);
 const controller=new AbortController();
 const stream=await fetch(new URL('/api/shop/notifications/stream',origin),{headers:{Cookie:adminCookie},signal:controller.signal});
 assert.equal(stream.status,200);assert.match(stream.headers.get('content-type'),/text\/event-stream/);
 const reader=stream.body.getReader();const decoder=new TextDecoder();let received='';
 const waitFor=async pattern=>{const deadline=Date.now()+5000;while(!pattern.test(received)&&Date.now()<deadline){const {value,done}=await reader.read();if(done)break;received+=decoder.decode(value);}return pattern.test(received);};
 assert.ok(await waitFor(/event: ready/));
 const {variant}=await tee();
 await addToCart(customer.cookie,variant,1);
 const order=(await placeOrder(customer.cookie)).data;
 assert.ok(await waitFor(/event: notification/),received);
 assert.ok(received.includes(order.id));
 controller.abort();
 // since= dùng cho client không có SSE
 const since=(await api('notifications?since='+encodeURIComponent(new Date(Date.now()-60000).toISOString()))).data;
 assert.ok(since.items.some(n=>n.ref_key===order.id));
});

test('Stats',()=>{console.log('Passed '+checks+' feature-bundle HTTP checks.');});
