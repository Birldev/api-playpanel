const assert = require('node:assert/strict');
process.env.REDIS_URL = '';
const Fastify = require('fastify');
const swagger = require('@fastify/swagger');
const { validatorCompiler, serializerCompiler, jsonSchemaTransform } = require('fastify-type-provider-zod');
const { envParsed } = require('../dist/config/env');
const schemas = require('../dist/schemas/playpanel.schema');
const resellerSchemas = require('../dist/schemas/playpanel.reseller.schema');
const { playpanelService } = require('../dist/services/playpanel.service');
const { playpanelResellerService } = require('../dist/services/playpanel.reseller.service');
const { playpanelRoutes } = require('../dist/routes/playpanel.routes');
const { playpanelResellerRoutes } = require('../dist/routes/playpanel.reseller.routes');
const credentials = {panelUser:'test-user', panelPass:'test-password'};

(async () => {
  for (const schema of [schemas.queryRenewSchema, schemas.queryToggleStatusSchema, schemas.queryDeleteUserSchema]) {
    assert.equal(schema.safeParse(credentials).success, false);
    assert.equal(schema.safeParse({...credentials, id:'123'}).success, true);
    assert.equal(schema.safeParse({...credentials, username:'test-client'}).success, true);
    assert.equal(schema.safeParse({...credentials, id:'../other'}).success, false);
    assert.equal(schema.safeParse({...credentials, id:'123', unexpectedField:'value'}).success, false);
  }
  for (const value of ['-1','0','Infinity','not-a-number','']) {
    assert.equal(resellerSchemas.queryUpdateResellerCreditsSchema.safeParse({...credentials,id:'123',amount:value}).success,false);
  }
  assert.equal(resellerSchemas.queryUpdateResellerCreditsSchema.parse({...credentials,id:'123',amount:'10'}).amount,10);
  assert.equal(resellerSchemas.queryUpdateResellerCreditsSchema.safeParse({...credentials,amount:'10'}).success,false);
  for (const value of ['-1','0','601','1.5']) assert.equal(schemas.queryFindAllSchema.safeParse({...credentials,cooldown:value}).success,false);
  for (const value of ['true','false','1','0']) {
    assert.equal(schemas.queryFindAllSchema.parse({...credentials,teste:value}).teste, value==='true'||value==='1');
  }
  assert.equal(schemas.queryFindAllSchema.safeParse({...credentials,teste:'yes'}).success,false);
  assert.equal(schemas.queryCreateTestUserSchema.safeParse({...credentials,horas:'1.5'}).success,false);
  assert.equal(schemas.queryRenewSchema.safeParse({...credentials,id:'123',months:'1.5'}).success,false);
  for (const schema of [schemas.queryCreditLogsSchema,resellerSchemas.queryFindAllResellerSchema]) {
    assert.equal(schema.safeParse({...credentials,start:'-1'}).success,false);
    assert.equal(schema.safeParse({...credentials,length:'1001'}).success,false);
  }
  assert.equal(schemas.queryChangePasswordSchema.safeParse({...credentials,oldPassword:'old',newPassword:'new-pass',confirmPassword:'different'}).success,false);

  const app=Fastify();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  await app.register(swagger,{openapi:{info:{title:'Play Panel',version:'1.0.0'}},transform:jsonSchemaTransform});
  app.register(playpanelRoutes,{prefix:'/playpanel'});
  app.register(playpanelResellerRoutes,{prefix:'/playpanelreseller'});
  let received;
  playpanelService.renewUser=async props => { received=props; return {success:true,message:'mock renewal'}; };
  playpanelResellerService.updateResellerCredits=async props => { received=props; return {success:true,message:'mock credits',credits:10}; };
  const headers={apikey:envParsed.APIKEY};
  const query=new URLSearchParams(credentials).toString();
  assert.equal((await app.inject({url:'/playpanel/renew?'+query,headers})).statusCode,400);
  const renewed=await app.inject({url:'/playpanel/renew?'+query+'&id=123&months=3',headers});
  assert.equal(renewed.statusCode,200);
  assert.equal(received.id,'123');
  assert.equal(received.months,3);
  assert.deepEqual(Object.keys(renewed.json()).sort(),['message','status','success','user']);
  for (const method of ['POST']) {
    const response=await app.inject({method,url:'/playpanelreseller/updateCredits?'+query+'&id=456&amount=10',headers});
    assert.equal(response.statusCode,200);
    assert.equal(received.id,'456');
    assert.equal(received.amount,10);
    assert.deepEqual(Object.keys(response.json()).sort(),['data','message','status','success']);
  }
  for (const url of ['/pacotes','/create-test-user','/reseller/find','/playpanel/reseller/find','/playpanel/findAll','/playpanelreseller/find-all']) {
    assert.equal((await app.inject({url,headers})).statusCode,404);
  }
  assert.equal((await app.inject({url:'/playpanelreseller/updateCredits?'+query+'&id=456&amount=10',headers})).statusCode,404);
  const document=app.swagger();
  assert.ok(Object.keys(document.paths).every(p=>p.startsWith('/playpanel/')||p.startsWith('/playpanelreseller/')));
  assert.ok(!document.paths['/playpanel/findAll']);
  assert.ok(!document.paths['/playpanelreseller/find-all']);
  assert.ok(!document.paths['/playpanelreseller/updateCredits'].get);
  assert.equal(document.paths['/playpanelreseller/updateCredits'].post.parameters.find(p=>p.name==='amount').required,true);
  assert.deepEqual(document.paths['/playpanel/renew'].get.parameters.map(p=>p.name).sort(),['apikey','cooldown','force','id','months','panelPass','panelUser','username']);
  await app.close();
  console.log('PASS: input validation, canonical response fields, controller forwarding and OpenAPI contracts.');
})().catch(error=>{console.error(error);process.exitCode=1;});
