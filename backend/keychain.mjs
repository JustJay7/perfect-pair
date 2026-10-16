import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const storageError=message=>Object.assign(new Error(message),{code:'credential_storage',status:503});

export function keychainStore({service='com.perfect-pair.aws.'+createHash('sha256').update(fileURLToPath(new URL('../',import.meta.url))).digest('hex').slice(0,16)}={}){
 const available=process.platform==='darwin';
 function call(action,value){
  if(!available)return Promise.reject(storageError('Secure saving requires macOS Keychain.'));
  return new Promise((resolve,reject)=>{
   const child=spawn('/usr/bin/python3',[fileURLToPath(new URL('./keychain.py',import.meta.url))],{stdio:['pipe','pipe','ignore']});let out='';
   const timer=setTimeout(()=>{child.kill();},30000);
   child.stdout.on('data',b=>{out+=b;if(out.length>100000)child.kill();});
   const fail=()=>reject(storageError('Keychain access failed. Allow access on this Mac and try again.'));
   child.on('error',()=>{clearTimeout(timer);fail();});
   child.stdin.on('error',()=>{});
   child.on('close',code=>{clearTimeout(timer);if(code!==0)return fail();try{resolve(JSON.parse(out));}catch{fail();}});
   child.stdin.end(JSON.stringify({action,service,value}));
  });
 }
 return {available,read:()=>call('read'),write:v=>call('write',v),delete:()=>call('delete')};
}
export class SavedConnection {
 constructor(service,store){this.service=service;this.store=store;this.saved=false;this.restoring=false;this.storageError=null;}
 status(){return {...this.service.status(),rememberAvailable:!!this.store?.available,remembered:this.saved,restoring:this.restoring,storageError:this.storageError};}
 async restore(){
  if(!this.store?.available)return;
  this.restoring=true;
  try{const input=await this.store.read();if(input){this.saved=true;await this.service.connect(input);}}
  catch{if(!this.service.status().error)this.storageError='Could not restore the saved Keychain connection. Open Connect AWS to retry.';}
  finally{this.restoring=false;}
 }
 async connect(input){
  let credentials=input;
  if(!input.accessKeyId&&!input.secretAccessKey&&!input.sessionToken&&this.saved){const saved=await this.store.read();if(saved){credentials={...saved,...input};for(const key of ['accessKeyId','secretAccessKey','sessionToken'])credentials[key]=saved[key];}}
  await this.service.connect(credentials);
  this.storageError=null;
  if(input.remember){
   if(!this.store?.available)throw storageError('Secure saving requires macOS Keychain.');
   if(!credentials.accessKeyId)throw storageError('Enter the three credential fields once to save this connection.');
   const value={...this.service.config};for(const key of ['accessKeyId','secretAccessKey','sessionToken'])value[key]=credentials[key];
   try{await this.store.write(value);this.saved=true;}catch{this.storageError='Connected for now, but Keychain saving failed. Allow Keychain access and try again.';throw storageError(this.storageError);}
  }else if(this.saved){await this.store.delete();this.saved=false;}
  return this.status();
 }
 async disconnect(){if(this.store?.available)await this.store.delete();this.saved=false;this.storageError=null;this.service.disconnect();return this.status();}
}
