const fs=require("fs"),path=require("path");const XLSX=require("xlsx");const {FlowEngine}=require("./flow-engine");
class TaskManager{
 constructor(accounts,logger,settings,emit){this.accounts=accounts;this.logger=logger;this.settings=settings;this.emit=emit;this.tasks=[];this.running=false;this.paused=false;this.stopFlag=false;this.seq=0;}
 snapshot(){return this.tasks;}
 addTasks(rows){const out=[];for(const r of rows){if(!r.prompt)continue;const t={id:"task-"+(++this.seq)+"-"+Date.now(),mode:r.mode||"video",prompt:String(r.prompt),refs:(r.refs||[]).slice(0,3),status:"QUEUED",progress:0,stage:"QUEUED",output:null,error:null,accountId:null};this.tasks.push(t);out.push(t);}this.emit("tasks:update",this.snapshot());return out;}
 clearPending(){this.tasks=this.tasks.filter(t=>!["QUEUED","FAILED"].includes(t.status));this.emit("tasks:update",this.snapshot());}
 async importFile(file){const ext=path.extname(file).toLowerCase();if(ext===".txt")return fs.readFileSync(file,"utf8").split(/\r?\n/).map(prompt=>({prompt:prompt.trim()})).filter(x=>x.prompt);
 if(ext===".json"){const x=JSON.parse(fs.readFileSync(file,"utf8"));return (Array.isArray(x)?x:[]).map(v=>typeof v==="string"?{prompt:v}:{prompt:v.prompt,refs:[v.reference1,v.reference2,v.reference3].filter(Boolean)});}
 const wb=XLSX.readFile(file);const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:""});return rows.map(r=>({prompt:r.prompt||r.Prompt||Object.values(r)[0],refs:[r.reference1||r["Reference 1"],r.reference2||r["Reference 2"],r.reference3||r["Reference 3"]].filter(Boolean)}));}
 start(){if(this.running)return;this.running=true;this.paused=false;this.stopFlag=false;this.run().catch(e=>this.logger.log("error",e.message));}
 pause(){this.paused=true;this.emit("log",{level:"info",message:"Queue paused"});}
 resume(){this.paused=false;this.emit("log",{level:"info",message:"Queue resumed"});}
 stop(){this.stopFlag=true;this.running=false;this.emit("log",{level:"info",message:"Queue stopped"});}
 retry(id){const t=this.tasks.find(x=>x.id===id);if(t){t.status="QUEUED";t.error=null;t.progress=0;t.stage="QUEUED";this.emit("tasks:update",this.snapshot());}}
 eligible(){return this.accounts.accounts.filter(a=>a.email&&a.status!=="disabled"&&(a.credit==null||a.credit>=this.settings.creditThreshold));}
 async run(){const n=Math.max(1,Math.min(Number(this.settings.workers)||1,this.accounts.accounts.length||1));const workers=Array.from({length:n},(_,i)=>this.worker(i));await Promise.all(workers);this.running=false;this.emit("tasks:update",this.snapshot());}
 async worker(index){
  while(this.running&&!this.stopFlag){
   while(this.paused&&!this.stopFlag)await new Promise(r=>setTimeout(r,500));
   if(this.stopFlag)break;const t=this.tasks.find(x=>x.status==="QUEUED");if(!t)break;
   const acc=this.eligible().find(a=>!this.tasks.some(x=>x.status==="GENERATING"&&x.accountId===a.id));
   if(!acc){t.status="WAITING_ACCOUNT";t.stage="WAITING_ACCOUNT";this.emit("tasks:update",this.snapshot());await new Promise(r=>setTimeout(r,3000));continue;}
   t.accountId=acc.id;t.status="GENERATING";
   try{const rt=await this.accounts.ensure(acc.id,this.settings.flowUrl);const engine=new FlowEngine(rt,this.logger);const out=await engine.generate({mode:t.mode,prompt:t.prompt,refs:t.refs,settings:this.settings,outputDir:this.settings.outputDir,taskId:t.id,onStage:(stage,p)=>{t.stage=stage;t.progress=p;this.emit("tasks:update",this.snapshot());}});t.output=out;t.status="COMPLETED";t.progress=100;t.stage="COMPLETED";acc.credit=acc.credit==null?null:Math.max(0,acc.credit-1);this.logger.log("info","Task completed",{taskId:t.id,output:out});}
   catch(e){t.status="FAILED";t.stage="FAILED";t.error=e.message;t.progress=0;this.logger.log("error",e.message,{taskId:t.id,accountId:acc.id});}
   this.emit("tasks:update",this.snapshot());
  }
 }
 shutdown(){this.stopFlag=true;this.running=false;}
}
module.exports={TaskManager};