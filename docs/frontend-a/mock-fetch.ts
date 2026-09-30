
/** Local-only mock transport. No network fallback, no mutation persistence. */
export interface MockOperation {id:string;method:string;path:string;successStatus:number;responseExample:unknown;binary?:string;alsoBinary?:string}
export function createMockFetch(operations:MockOperation[],pdf?:Blob) {
 const overrides=new Map<string,{status:number;body:unknown}>();
 return {
  setResponse(operationId:string,status:number,body:unknown){overrides.set(operationId,{status,body});},
  reset(){overrides.clear();},
  async fetch(input:string,init:RequestInit={}):Promise<Response>{
   const url=new URL(input,'https://mock.example.test');
   const path=url.pathname.replace(/^\/api\/v1/,'');
   const op=operations.find(o=>o.method===(init.method||'GET').toUpperCase()&&new RegExp('^'+o.path.replace(/\{[^}]+\}/g,'[^/]+')+'$').test(path));
   if(!op)return Response.json({success:false,message:'Ruta fuera del catálogo de mocks',error:'NotFoundException'},{status:404});
   const custom=overrides.get(op.id);if(custom)return Response.json(custom.body,{status:custom.status});
   if(op.binary||(op.alsoBinary&&url.searchParams.get('format')==='pdf'))return pdf?new Response(pdf,{status:200,headers:{'Content-Type':'application/pdf'}}):Response.json({success:false,message:'Proporciona mock-document.pdf al mock',error:'MockPdfMissing'},{status:501});
   return Response.json(op.responseExample,{status:op.successStatus});
  }
 };
}
