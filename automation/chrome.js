const fs=require("fs"),path=require("path"),{spawn}=require("child_process");
const {chromium}=require("playwright-core");
function chromeCandidates(){
 const e=process.env; return [
  path.join(e.PROGRAMFILES||"","Google","Chrome","Application","chrome.exe"),
  path.join(e["PROGRAMFILES(X86)"]||"","Google","Chrome","Application","chrome.exe"),
  path.join(e.LOCALAPPDATA||"","Google","Chrome","Application","chrome.exe")
 ].filter(Boolean);
}
function findChrome(){for(const p of chromeCandidates())if(fs.existsSync(p))return p;return null;}
async function launch(profileDir,port,url){
 const exe=findChrome(); if(!exe)throw new Error("Không tìm thấy Google Chrome. Hãy cài Chrome hoặc cấu hình đường dẫn Chrome.");
 fs.mkdirSync(profileDir,{recursive:true});
 const child=spawn(exe,[`--remote-debugging-port=${port}`,`--user-data-dir=${profileDir}`,"--no-first-run","--no-default-browser-check","--start-maximized","--enable-automation",url],{detached:true,stdio:"ignore",windowsHide:false});
 child.unref();
 for(let i=0;i<40;i++){try{const b=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);return {browser:b,child};}catch{await new Promise(r=>setTimeout(r,500));}}
 throw new Error("Không thể kết nối Chrome qua CDP.");
}
module.exports={launch,findChrome};