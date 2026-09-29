const {app,BrowserWindow,ipcMain,dialog,shell,protocol,net} = require("electron");
const path=require("path"), fs=require("fs");
const { AccountManager }=require("./automation/account-manager");
const { TaskManager }=require("./automation/task-manager");
const { Logger }=require("./automation/logger");

let win, accounts, tasks, logger;
const dataDir=path.join(app.getPath("userData"),"data");
const stateFile=path.join(dataDir,"state.json");

function ensure(){fs.mkdirSync(dataDir,{recursive:true});fs.mkdirSync(path.join(dataDir,"profiles"),{recursive:true});}
function loadState(){try{return JSON.parse(fs.readFileSync(stateFile,"utf8"));}catch{return {accounts:[],settings:{
  flowUrl:"https://flow.google.com/",outputDir:path.join(app.getPath("documents"),"Hoai VideoAi Automation","output"),
  workers:3,creditThreshold:10,retries:2,timeoutMs:900000,model:"",ratio:"16:9",quantity:1
}};}}
function saveState(){fs.writeFileSync(stateFile,JSON.stringify({accounts:accounts.toJSON(),settings:tasks.settings},null,2));}

async function create(){
  ensure(); const s=loadState();
  logger=new Logger(path.join(dataDir,"logs")); accounts=new AccountManager(path.join(dataDir,"profiles"),s.accounts,logger);
  tasks=new TaskManager(accounts,logger,s.settings,emit);
  win=new BrowserWindow({width:1500,height:950,minWidth:1100,minHeight:700,show:false,webPreferences:{preload:path.join(__dirname,"preload.js"),contextIsolation:true,nodeIntegration:false,sandbox:false}});
  win.on("closed",()=>win=null); await win.loadFile(path.join(__dirname,"renderer","index.html")); win.show();
}
function emit(channel,payload){if(win&&!win.isDestroyed())win.webContents.send(channel,payload);}

ipcMain.handle("state:get",()=>({accounts:accounts.toJSON(),settings:tasks.settings,tasks:tasks.snapshot()}));
ipcMain.handle("settings:save",(_,s)=>{tasks.settings={...tasks.settings,...s};saveState();return tasks.settings;});
ipcMain.handle("account:add",async()=>{const r=await accounts.addInteractive(tasks.settings.flowUrl);saveState();return r;});
ipcMain.handle("account:open",async(_,id)=>accounts.open(id,tasks.settings.flowUrl));
ipcMain.handle("account:refresh",async(_,id)=>{const r=await accounts.refresh(id,tasks.settings.flowUrl);saveState();return r;});
ipcMain.handle("account:remove",async(_,id)=>{accounts.remove(id);saveState();return true;});
ipcMain.handle("queue:import",async()=>{const r=await dialog.showOpenDialog(win,{properties:["openFile"],filters:[{name:"Prompts",extensions:["txt","csv","xlsx","json"]}]});if(r.canceled)return [];const rows=await tasks.importFile(r.filePaths[0]);tasks.addTasks(rows);emit("tasks:update",tasks.snapshot());return rows;});
ipcMain.handle("queue:add",(_,item)=>{const t=tasks.addTasks([item]);emit("tasks:update",tasks.snapshot());return t;});
ipcMain.handle("queue:clear",()=>{tasks.clearPending();emit("tasks:update",tasks.snapshot());return true;});
ipcMain.handle("run:start",async()=>{tasks.start();return true;});
ipcMain.handle("run:pause",()=>{tasks.pause();return true;});
ipcMain.handle("run:resume",()=>{tasks.resume();return true;});
ipcMain.handle("run:stop",()=>{tasks.stop();return true;});
ipcMain.handle("task:retry",(_,id)=>{tasks.retry(id);return true;});
ipcMain.handle("folder:open",(_,p)=>shell.openPath(p));
ipcMain.handle("dialog:chooseDir",async()=>{const r=await dialog.showOpenDialog(win,{properties:["openDirectory","createDirectory"]});return r.canceled?null:r.filePaths[0];});
ipcMain.handle("log:get",()=>logger.readTail(500));
app.whenReady().then(create);
app.on("window-all-closed",()=>{if(process.platform!=="darwin")app.quit();});
app.on("before-quit",()=>{try{saveState();tasks?.shutdown();}catch{}});
