
// Regenerates fixtures, curated Swagger and operation guide from the reviewed catalog.
const fs=require('fs'),path=require('path'),ts=require('typescript');
const root=__dirname;const operations=JSON.parse(fs.readFileSync(path.join(root,'operations.json'),'utf8'));
const sourcePath=path.join(root,'contracts.ts');const program=ts.createProgram([sourcePath],{strict:true,skipLibCheck:true,target:ts.ScriptTarget.ES2022});const checker=program.getTypeChecker(),source=program.getSourceFile(sourcePath),schemas={};
function schema(type,depth=0){
 if(depth>12)return {};
 if(type.flags & ts.TypeFlags.Any || type.flags & ts.TypeFlags.Unknown)return {};
 if(type.isUnion()){
  const nullable=type.types.some(t=>t.flags & ts.TypeFlags.Null);
  const rest=type.types.filter(t=>!(t.flags & (ts.TypeFlags.Null|ts.TypeFlags.Undefined)));
  if(!rest.length)return {nullable:true};
  let result;
  if(rest.every(t=>t.isStringLiteral()))result={type:'string',enum:rest.map(t=>t.value)};
  else if(rest.every(t=>t.flags & ts.TypeFlags.BooleanLiteral))result={type:'boolean'};
  else result=rest.length===1?schema(rest[0],depth+1):{oneOf:rest.map(t=>schema(t,depth+1))};
  return nullable?{...result,nullable:true}:result;
 }
 if(type.isStringLiteral())return {type:'string',enum:[type.value]};
 if(type.isNumberLiteral())return {type:'number',enum:[type.value]};
 if(type.flags & ts.TypeFlags.StringLike)return {type:'string'};
 if(type.flags & ts.TypeFlags.NumberLike)return {type:'number'};
 if(type.flags & ts.TypeFlags.BooleanLike)return {type:'boolean',...(type.intrinsicName==='true'?{enum:[true]}:type.intrinsicName==='false'?{enum:[false]}:{})};
 if(type.flags & ts.TypeFlags.Null)return {nullable:true};
 if(checker.isArrayType(type))return {type:'array',items:schema(checker.getTypeArguments(type)[0],depth+1)};
 const properties={},required=[];
 for(const p of checker.getPropertiesOfType(type)){properties[p.name]=schema(checker.getTypeOfSymbolAtLocation(p,p.valueDeclaration||p.declarations?.[0]||source),depth+1);if(!(p.flags&ts.SymbolFlags.Optional))required.push(p.name);}
 return {type:'object',properties,...(required.length?{required}:{}),additionalProperties:!!checker.getIndexTypeOfType(type,ts.IndexKind.String)};
}
for(const node of source.statements)if(ts.isInterfaceDeclaration(node)||ts.isTypeAliasDeclaration(node)){if(node.typeParameters?.length)continue;schemas[node.name.text]=schema(checker.getTypeAtLocation(node));}
for(const name of ['UploadRequest','EvidenceMultipart'])if(schemas[name]?.properties.file)schemas[name].properties.file={type:'string',format:'binary'};
schemas.PhotoRequest.properties.photo={type:'string',format:'binary'};
const doc={openapi:'3.0.3',info:{title:'TISNET — Frontend A (Cliente/Developer)',version:'2026-09-30.0ef120d',description:'Contrato revisado contra controladores/servicios. Solo rutas implementadas. Ejemplos sintéticos. Fecha de despliegue no confirmada; ver README y pendientes.'},servers:[{url:'/api/v1',description:'Mismo origen o configurar URL del entorno; no hay staging confirmado'}],components:{securitySchemes:{bearer:{type:'http',scheme:'bearer',bearerFormat:'JWT'}},schemas},paths:{}};
let fixtures="import type * as C from './contracts';\n";
let guide='# Operaciones confirmadas — Frontend A\n\nBase /api/v1. Verificado en código 2026-09-30, commit 0ef120d. No se confirma despliegue. Datos sintéticos; fechas futuras deben ajustarse al ejecutar. Errores comunes incluyen 401/403, 429 y 500 genérico; permisos específicos prevalecen. Todas las listas de este catálogo carecen de paginación del servidor.\n';
const raw=JSON.parse(fs.readFileSync(path.join(root,'swagger.backend.json'),'utf8'));
const normalize=p=>p.replace(/\{[^}]+\}/g,'{}');
for(const o of operations){
 if(!Object.entries(raw.paths).some(([p,m])=>normalize(p)===normalize('/api/v1'+o.path)&&m[o.method.toLowerCase()]))throw Error('Unregistered route '+o.method+' '+o.path);
 if(o.requestType)fixtures+='export const '+o.id+'Request = '+JSON.stringify(o.requestExample)+' satisfies C.'+o.requestType+';\n';
 if(o.responseType)fixtures+='export const '+o.id+'Response = '+JSON.stringify(o.responseExample)+' satisfies C.ApiSuccess<C.'+o.responseType+'>;\n';
 const parameters=[...o.path.matchAll(/\{([^}]+)\}/g)].map(m=>({in:'path',name:m[1],required:true,schema:m[1]==='code'?{type:'string'}:o.path.startsWith('/client/quotes/')&&m[1]==='id'?{oneOf:[{type:'integer',minimum:1},{type:'string',pattern:'^(quote-)?[0-9]+$'}]}:{type:'integer',minimum:1}}));
 for(const q of o.query||[])parameters.push({in:'query',name:q.name,required:!!q.required,schema:{type:q.type,...(q.enum?{enum:q.enum}:{})},example:q.example});
 const responseContent=o.binary?{[o.binary]:{schema:{type:'string',format:'binary'}}}:{'application/json':{schema:{type:'object',required:['success','message','data'],properties:{success:{type:'boolean',enum:[true]},message:{type:'string'},data:o.responseType?{$ref:'#/components/schemas/'+o.responseType}:{nullable:true}}},example:o.responseExample}};
 if(o.alsoBinary)responseContent[o.alsoBinary]={schema:{type:'string',format:'binary'}};
 const operation={operationId:o.id,summary:o.method+' '+o.path,description:'Permisos: '+o.permissions+'. Estados: '+o.allowedStates+'. '+(o.notes||'')+' Disponible en código al 2026-09-30; despliegue no confirmado.',tags:[o.path.split('/')[1]],security:(['login','refresh'].includes(o.id)||o.permissions==='Público')?[]:[{bearer:[]}],parameters,responses:{[o.successStatus]:{description:'Éxito',content:responseContent}},'x-availability':o.availability,'x-permissions':o.permissions,'x-allowed-states':o.allowedStates,'x-pagination':'none'};
 for(const [code,message]of Object.entries(o.errors))operation.responses[code]={description:message,content:{'application/json':{schema:{$ref:'#/components/schemas/ApiError'},example:{success:false,message,error:Number(code)===500?'INTERNAL_SERVER_ERROR':'HttpException'}}}};
 if(o.requestType){const content={[o.contentType||'application/json']:{schema:{$ref:'#/components/schemas/'+o.requestType},example:o.requestExample}};if(o.multipartType)content['multipart/form-data']={schema:{$ref:'#/components/schemas/'+o.multipartType}};operation.requestBody={required:true,content};}
 (doc.paths[o.path]??={})[o.method.toLowerCase()]=operation;
 guide+='\n## '+o.id+' — '+o.method+' '+o.path+'\n\n- Disponibilidad: implementado, verificado 30/09/2026; staging sin confirmar.\n- Permisos: '+o.permissions+'.\n- Estados: '+o.allowedStates+'.\n- HTTP éxito: '+o.successStatus+'. Paginación: ninguna.\n- Request: '+(o.requestType||'sin body')+(o.query?' · query '+JSON.stringify(o.query):'')+'.\n- Response: '+(o.binary?'Blob '+o.binary:'ApiSuccess<'+(o.responseType||'null')+'>')+'.\n'+(o.fileLimitBytes?'- Archivo máximo: '+o.fileLimitBytes+' bytes.\n':'')+(o.aliasOf?'- Alias funcional de '+o.aliasOf+'.\n':'')+(o.notes?'- '+o.notes+'\n':'')+'\n### Request de ejemplo\n\n~~~json\n'+JSON.stringify(o.requestExample,null,2)+'\n~~~\n\n### Response de ejemplo\n\n~~~'+(o.binary?'text':'json')+'\n'+(o.binary?o.responseExample:JSON.stringify(o.responseExample,null,2))+'\n~~~\n\n### Errores\n\n'+Object.entries(o.errors).map(([code,description])=>'- '+code+': '+description).join('\n')+'\n';
}
fs.writeFileSync(path.join(root,'fixtures.ts'),fixtures);
fs.writeFileSync(path.join(root,'swagger.frontend-a.json'),JSON.stringify(doc,null,2)+'\n');
fs.writeFileSync(path.join(root,'OPERACIONES.md'),guide);
fs.writeFileSync(path.join(root,'mock-data.json'),JSON.stringify(Object.fromEntries(operations.map(o=>[o.id,{status:o.successStatus,body:o.responseExample}])),null,2)+'\n');
console.log('Verified '+operations.length+' registered operations; generated '+Object.keys(schemas).length+' schemas.');
