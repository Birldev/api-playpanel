const assert = require('node:assert/strict');
process.env.REDIS_URL = '';
// Old environment values must not become fallback credentials.
process.env.DEFAULT_PLAYPANEL_USER = 'ignored-environment-user';
process.env.DEFAULT_PLAYPANEL_PASS = 'ignored-environment-password';
const Fastify = require('fastify');
const { validatorCompiler, serializerCompiler } = require('fastify-type-provider-zod');
const { envParsed } = require('../dist/config/env');
const clientSchemas = require('../dist/schemas/playpanel.schema');
const resellerSchemas = require('../dist/schemas/playpanel.reseller.schema');
const { playpanelLoginService } = require('../dist/services/playpanel.login.service');
const { playpanelFetchService } = require('../dist/services/playpanel.fetch.service');
const { playpanelRoutes } = require('../dist/routes/playpanel.routes');
const { playpanelResellerRoutes } = require('../dist/routes/playpanel.reseller.routes');

(async () => {
  assert.equal(envParsed.DEFAULT_PLAYPANEL_USER, undefined);
  assert.equal(envParsed.DEFAULT_PLAYPANEL_PASS, undefined);
  for (const schema of Object.values({...clientSchemas, ...resellerSchemas})) {
    for (const input of [{}, {panelUser: 'user'}, {panelPass: 'password'}, {panelUser: '', panelPass: 'password'}, {panelUser: 'user', panelPass: ''}]) {
      const parsed = schema.safeParse(input);
      assert.equal(parsed.success, false);
      assert(parsed.error.issues.some(issue => ['panelUser', 'panelPass'].includes(issue.path[0])));
    }
  }
  assert.equal((await playpanelLoginService.login({ panelUser: 'user', panelPass: '' })).success, false);
  assert.equal((await playpanelLoginService.login({})).success, false);

  const app = Fastify();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.register(playpanelRoutes, {prefix: '/playpanel'});
  app.register(playpanelResellerRoutes, {prefix: '/reseller'});
  let received;
  playpanelFetchService.get = async (endpoint, options) => { received = {endpoint, ...options}; return {success: true}; };
  const headers = {apikey: envParsed.APIKEY};
  for (const url of ['/playpanel/stats', '/playpanel/stats?panelUser=user', '/playpanel/stats?panelUser=user&panelPass=', '/reseller/findAll']) {
    assert.equal((await app.inject({method: 'GET', url, headers})).statusCode, 400);
  }
  const response = await app.inject({method: 'GET', url: '/playpanel/stats?panelUser=request-user&panelPass=request-password', headers});
  assert.equal(response.statusCode, 200);
  assert.deepEqual(received, {endpoint: 'stats', panelUser: 'request-user', panelPass: 'request-password'});
  await app.close();
  console.log('PASS: all schemas reject missing/empty credentials; environment fallback removed; HTTP 400 verified; provided credentials forwarded unchanged.');
})().catch(error => { console.error(error); process.exitCode = 1; });
