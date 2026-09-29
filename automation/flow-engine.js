const fs=require("fs"),path=require("path");
class FlowEngine{
 constructor(account,logger){this.account=account;this.logger=logger;}
 async configure(page,{model,ratio,quantity}){
  // Flow exposes these settings in its settings panel. Use semantic text/labels and tolerate UI changes.
  const settingsCandidates=[
   'button[aria-label*="Cài đặt"]','button:has-text("Cài đặt")','[aria-label*="Settings"]'
  ];
  for(const s of settingsCandidates){const l=page.locator(s).first();if(await l.count().catch(()=>0)){await l.click().catch(()=>{});break;}}
  if(ratio){const x=page.getByText(ratio,{exact:true}).last();if(await x.count().catch(()=>0))await x.click().catch(()=>{});}
  if(quantity){const x=page.getByText("x"+quantity,{exact:true}).last();if(await x.count().catch(()=>0))await x.click().catch(()=>{});}
  if(model){const x=page.getByText(model,{exact:true}).last();if(await x.count().catch(()=>0))await x.click().catch(()=>{});}
  const save=page.locator('button.settings-save-button').first();if(await save.count().catch(()=>0))await save.click().catch(()=>{});
 }
 async uploadReferences(page,refs){
  if(!refs?.length)return;
  // Try Flow's add-media control and native file chooser. Exact menu structure can change, so fail with a useful log rather than fake success.
  for(const file of refs){
   if(!fs.existsSync(file))throw Error("Không tìm thấy ảnh tham chiếu: "+file);
   const add=page.locator("button.add-menu-trigger").first();
   if(!await add.count().catch(()=>0))throw Error("Flow không có nút thêm media ở giao diện hiện tại.");
   const chooser=page.waitForEvent("filechooser",{timeout:10000}).catch(()=>null);
   await add.click();const fc=await chooser;
   if(fc){await fc.setFiles(file);continue;}
   const input=page.locator('input[type=file]').last();if(await input.count())await input.setInputFiles(file);else throw Error("Không tìm thấy vùng tải ảnh tham chiếu.");
  }
 }
 async generate({mode="video",prompt,refs,settings,outputDir,taskId,onStage}){
  const page=this.account.page; await page.bringToFront().catch(()=>{});
  onStage("OPENING_FLOW",10); await page.goto(settings.flowUrl||"https://flow.google.com/",{waitUntil:"domcontentloaded",timeout:60000}).catch(()=>{});
  const email=await page.locator('a[aria-label^="Tài khoản Google:"]').first().count().catch(()=>0);
  if(!email)throw Error("Chrome chưa đăng nhập Google/Flow.");
  onStage("ENTERING_PROMPT",25);
  const editor=page.locator('div[contenteditable="true"].ProseMirror').first();await editor.waitFor({state:"visible",timeout:30000});
  await editor.fill(prompt);
  onStage("CONFIGURING",35);await this.configure(page,settings);
  await this.uploadReferences(page,refs);
  const candidates=[];const handler=async response=>{const ct=(await response.headerValue("content-type").catch(()=>null))||"";const u=response.url();if(/video|mp4|media|asset/i.test(ct+" "+u))candidates.push({url:u,ct});};
  page.on("response",handler);
  try{
   onStage("GENERATING",45);const gen=page.locator('button[type="submit"][aria-label="Bắt đầu tạo"]').first();await gen.waitFor({state:"visible",timeout:30000});await gen.click();
   const deadline=Date.now()+settings.timeoutMs;
   onStage(mode==="image"?"WAITING_IMAGE":"WAITING_VIDEO",60);
   while(Date.now()<deadline){
    const vids=await page.locator("video").evaluateAll(es=>es.map(e=>e.currentSrc||e.src).filter(Boolean)).catch(()=>[]);
    const imgs=await page.locator("img").evaluateAll(es=>es.map(e=>e.currentSrc||e.src).filter(u=>/^https?:/i.test(u))).catch(()=>[]);
    const links=await page.locator('a[href]').evaluateAll(es=>es.map(e=>e.href).filter(u=>mode==="image"?(/\.(png|jpe?g|webp)($|\?)/i.test(u)):(/\.mp4($|\?)/i.test(u)))).catch(()=>[]);
    const urls=[...candidates.map(x=>x.url),...(mode==="image"?imgs:vids),...links];
    if(urls.length){onStage("DOWNLOADING",80);const u=urls.find(x=>/^https?:/i.test(x));if(u){const file=await this.download(u,outputDir,taskId,page,mode);onStage("VERIFYING",95);return file;}}
    await new Promise(r=>setTimeout(r,1500));
   }
   throw Error("Timeout chờ video/asset sau khi Generate.");
  }finally{page.off("response",handler);}
 }
 async download(url,dir,taskId,page,mode="video"){
  fs.mkdirSync(dir,{recursive:true});const ext=mode==="image"?(url.match(/\.(png|jpe?g|webp)(?:\?|$)/i)?.[1]||"png"):"mp4";const out=path.join(dir,taskId+"-"+Date.now()+"."+ext);
  const cookies=await page.context().cookies(url);const cookie=cookies.map(c=>`${c.name}=${c.value}`).join("; ");const res=await fetch(url,{headers:{"Cookie":cookie,"User-Agent":await page.evaluate(()=>navigator.userAgent)}});
  if(!res.ok)throw Error("Tải video thất bại HTTP "+res.status);const buf=Buffer.from(await res.arrayBuffer());fs.writeFileSync(out,buf);
  if(!fs.existsSync(out)||fs.statSync(out).size<1024)throw Error("File video không hợp lệ.");return out;
 }
}
module.exports={FlowEngine};