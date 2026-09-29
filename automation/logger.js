const fs=require("fs"),path=require("path");
class Logger{
 constructor(dir){this.dir=dir;fs.mkdirSync(dir,{recursive:true});this.file=path.join(dir,"automation.jsonl");}
 log(level,message,meta={}){const x={time:new Date().toISOString(),level,message,...meta};fs.appendFileSync(this.file,JSON.stringify(x)+"\n");this.emit&&this.emit(x);}
 readTail(n=500){try{return fs.readFileSync(this.file,"utf8").trim().split("\n").slice(-n).map(x=>JSON.parse(x));}catch{return[];}}
}
module.exports={Logger};