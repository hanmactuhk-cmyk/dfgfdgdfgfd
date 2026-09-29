const fs=require("fs"),path=require("path");const {launch}=require("./chrome");
const {chromium}=require("playwright-core");
function safe(s){return String(s||"account").replace(/[^a-z0-9._-]/gi,"_").slice(0,60);}
class AccountManager{
 constructor(root,list,logger){this.root=root;this.logger=logger;this.accounts=list||[];this.runtime=new Map();this.nextPort=9222+this.accounts.length;}
 toJSON(){return this.accounts;}
 get(id){return this.accounts.find(a=>a.id===id);}
 async ensure(id,url){
  const a=this.get(id);if(!a)throw Error("Không tìm thấy tài khoản");
  if(this.runtime.has(id))return this.runtime.get(id);
  const r=await launch(a.profilePath,a.port||this.allocatePort(),url);a.port=a.port||r.port||this.nextPort++;
  const browser=r.browser; const contexts=browser.contexts();const context=contexts[0]||await browser.newContext();let page=context.pages()[0]||await context.newPage();
  await page.bringToFront().catch(()=>{});
  const rt={browser,context,page,child:r.child};this.runtime.set(id,rt);return rt;
 }
 allocatePort(){return this.nextPort++;}
 async detect(page){await page.waitForLoadState("domcontentloaded",{timeout:30000}).catch(()=>{});const email=await page.locator('a[aria-label^="Tài khoản Google:"]').first().getAttribute("aria-label").catch(()=>null);return email?.match(/\(([^)]+@[^)]+)\)/)?.[1]||null;}
 async readCredit(page){
  const body=await page.locator("body").innerText().catch(()=> "");
  let m=body.match(/(\d+)\s*(?:tín dụng Google Flow|Google Flow credits|Flow credits)/i);if(m)return Number(m[1]);
  return null;
 }
 async addInteractive(url){
  const id="account-"+Date.now();const profilePath=path.join(this.root,id);const port=this.allocatePort();
  const a={id,name:"Tài khoản mới",email:"",profilePath,port,credit:null,status:"login_required"};
  this.accounts.push(a);this.logger.log("info","Mở Chrome để đăng nhập",{id});
  const r=await launch(profilePath,port,url);this.runtime.set(id,{...r,context:r.browser.contexts()[0],page:r.browser.contexts()[0]?.pages()[0]});
  const page=this.runtime.get(id).page||await this.runtime.get(id).context.newPage();this.runtime.get(id).page=page;
  for(let i=0;i<600;i++){const email=await this.detect(page);if(email){a.email=email;a.name=email.split("@")[0];a.status="ready";a.credit=await this.readCredit(page);break;}await new Promise(x=>setTimeout(x,1000));}
  if(!a.email)a.status="login_required";
  this.logger.log("info","Account added",{id,email:a.email,credit:a.credit});return a;
 }
 async open(id,url){const r=await this.ensure(id,url);const a=this.get(id);a.status="ready";const email=await this.detect(r.page);if(email)a.email=email;a.credit=await this.readCredit(r.page);return a;}
 async refresh(id,url){return this.open(id,url);}
 remove(id){this.accounts=this.accounts.filter(a=>a.id!==id);this.runtime.delete(id);}
 async shutdown(){for(const r of this.runtime.values())try{await r.browser.close();}catch{}}
}
module.exports={AccountManager};