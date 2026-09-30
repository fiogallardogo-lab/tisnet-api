// Local HTTP contract verification. Guards/service are stubbed; this is NOT staging evidence.
require('reflect-metadata');
const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
const { Test } = require('@nestjs/testing');
const { ValidationPipe } = require('@nestjs/common');
const { DeliverablesController } = require('../dist/deliverables/deliverables.controller');
const { DeliverablesService } = require('../dist/deliverables/deliverables.service');
const { JwtAuthGuard } = require('../dist/auth/guards/jwt-auth.guard');
const { RolesGuard } = require('../dist/auth/guards/roles.guard');
const { HttpExceptionFilter } = require('../dist/common/filters/http-exception/http-exception.filter');
const { TransformInterceptor } = require('../dist/common/interceptors/transform/transform.interceptor');
(async () => {
  const mod = await Test.createTestingModule({controllers:[DeliverablesController],providers:[{provide:DeliverablesService,useValue:{review:async(_p,_d,_a,dto)=>({id:10,status:dto.decision==='APPROVE'?'APPROVED':'OBSERVED'})}}]})
    .overrideGuard(JwtAuthGuard).useValue({canActivate:c=>{c.switchToHttp().getRequest().user={id:1,role:'CLIENT'};return true;}})
    .overrideGuard(RolesGuard).useValue({canActivate:()=>true}).compile();
  const app=mod.createNestApplication();
  try {
    const main=fs.readFileSync('src/main.ts','utf8');
    vm.runInNewContext(main.slice(main.indexOf('  const configuredOrigins'),main.indexOf("  app.setGlobalPrefix")),{app,process:{env:{FRONTEND_URL:'http://localhost:5173'}}});
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({transform:true,whitelist:true,forbidNonWhitelisted:true}));
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.listen(0,'127.0.0.1');
    const base=await app.getUrl(), route='/api/v1/projects/7/deliverables/10/review', evidence=[];
    const headers={Origin:'http://localhost:5173','Access-Control-Request-Method':'PATCH','Access-Control-Request-Headers':'authorization,content-type'};
    let r=await fetch(base+route,{method:'OPTIONS',headers});
    assert.equal(r.status,204);assert.equal(r.headers.get('access-control-allow-origin'),headers.Origin);
    assert.ok(r.headers.get('access-control-allow-methods').includes('PATCH'));
    assert.ok(r.headers.get('access-control-allow-headers').toLowerCase().includes('authorization'));
    evidence.push({method:'OPTIONS',url:base+route,request:{headers},http:r.status,responseHeaders:Object.fromEntries(r.headers),response:null});
    for(const [body,status] of [[{},400],[{decision:null},400],[{decision:'INVALID'},400],[{status:'APPROVED'},400],[{decision:'APPROVE',status:'OBSERVED'},400],[{decision:'APPROVE'},200]]){
      r=await fetch(base+route,{method:'PATCH',headers:{'Content-Type':'application/json',Origin:headers.Origin},body:JSON.stringify(body)});
      const response=await r.json();assert.equal(r.status,status);assert.equal(r.headers.get('access-control-expose-headers'),'Content-Disposition');
      evidence.push({method:'PATCH',url:base+route,request:body,http:r.status,response});
    }
    fs.writeFileSync('docs/frontend-a/evidence-local.json',JSON.stringify({environment:'LOCAL_ISOLATED_NOT_STAGING',authentication:'stubbed',database:'stubbed',createdAt:new Date().toISOString(),evidence},null,2)+'\n');
    console.log('PASS: local OPTIONS 204, exposed header, 5 invalid requests 400 and explicit approval 200. Not staging.');
  } finally {await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
