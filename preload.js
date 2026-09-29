const {contextBridge,ipcRenderer}=require("electron");
contextBridge.exposeInMainWorld("hoai",{
 getState:()=>ipcRenderer.invoke("state:get"), saveSettings:s=>ipcRenderer.invoke("settings:save",s),
 addAccount:()=>ipcRenderer.invoke("account:add"), openAccount:id=>ipcRenderer.invoke("account:open",id),
 refreshAccount:id=>ipcRenderer.invoke("account:refresh",id), removeAccount:id=>ipcRenderer.invoke("account:remove",id),
 importQueue:()=>ipcRenderer.invoke("queue:import"), addPrompt:(p,mode,refs)=>ipcRenderer.invoke("queue:add",{prompt:p,mode,refs}),
 clearQueue:()=>ipcRenderer.invoke("queue:clear"), start:()=>ipcRenderer.invoke("run:start"),
 pause:()=>ipcRenderer.invoke("run:pause"), resume:()=>ipcRenderer.invoke("run:resume"), stop:()=>ipcRenderer.invoke("run:stop"),
 retry:id=>ipcRenderer.invoke("task:retry",id), openFolder:p=>ipcRenderer.invoke("folder:open",p),
 chooseDir:()=>ipcRenderer.invoke("dialog:chooseDir"), getLogs:()=>ipcRenderer.invoke("log:get"),
 onTasks:fn=>ipcRenderer.on("tasks:update",(_,x)=>fn(x)), onAccounts:fn=>ipcRenderer.on("accounts:update",(_,x)=>fn(x)),
 onLog:fn=>ipcRenderer.on("log",(_,x)=>fn(x))
});