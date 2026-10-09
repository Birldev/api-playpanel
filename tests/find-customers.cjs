const assert = require('node:assert/strict');
process.env.REDIS_URL = '';
const Fastify = require('fastify');
const {validatorCompiler,serializerCompiler} = require('fastify-type-provider-zod');
const {envParsed}=require('../dist/config/env');
const {playpanelFetchService}=require('../dist/services/playpanel.fetch.service');
const {playpanelRoutes}=require('../dist/routes/playpanel.routes');
const row=(id,is_trial)=>({id,is_trial,username:'matched-user',password:'test-password',status:'1',exp_date:'1800000000',created_at:'1700000000',max_con:'1'});
(async()=>{
  const app=Fastify();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.register(playpanelRoutes);
  const url='/find?panelUser=test&panelPass=test&username=matched-user';
  const headers={apikey:envParsed.APIKEY};
  for(const pages of [ {'listas/minhas':[row('1','1')],'listas/todas':[row('1','1')]}, {'listas/minhas':[],'listas/todas':[row('2',1)]} ]){
    playpanelFetchService.post=async endpoint=>({data:pages[endpoint]||[]});
    const response=await app.inject({url,headers});
    assert.equal(response.statusCode,404);
    assert.equal(response.json().user,false);
  }
  for(const pages of [ {'listas/minhas':[row('1','1'),row('3','0')],'listas/todas':[]}, {'listas/minhas':[row('1','1')],'listas/todas':[row('1','1'),row('3',0)]} ]){
    playpanelFetchService.post=async endpoint=>({data:pages[endpoint]||[]});
    const response=await app.inject({url,headers});
    assert.equal(response.statusCode,200);
    assert.equal(response.json().data.id,'3');
    assert.equal(response.json().data.is_trial,false);
  }
  // Status management still locates trial accounts internally.
  playpanelFetchService.post=async()=>({data:[row('1','1')]});
  let managedEndpoint;
  playpanelFetchService.get=async endpoint=>{managedEndpoint=endpoint;return {result:true};};
  const managed=await app.inject({url:'/toggle-status?panelUser=test&panelPass=test&username=matched-user',headers});
  assert.equal(managed.statusCode,200);
  assert.equal(managedEndpoint,'listas/1/toogleLista');
  await app.close();
  console.log('PASS: /find excludes trials in both scopes and preserves internal trial management.');
})().catch(error=>{console.error(error);process.exitCode=1;});
