# API Play Panel

API em Node.js, Fastify e TypeScript para integrar workflows ao painel Play Panel. As credenciais de login no painel são recebidas em cada requisição; não há usuário ou senha padrão no código ou nas variáveis de ambiente.

## Instalação

Use Node.js com suporte a `fetch` nativo e npm. O Redis é opcional: se estiver indisponível, a aplicação usa cache e controles locais em memória. Para autenticar no painel, configure pelo menos um serviço de captcha.

```bash
npm ci
# Crie .env a partir de .env.example e configure os serviços.
npm run build
npm start
```

Para desenvolvimento, use `npm run dev`. A porta padrão é `3004`. A documentação interativa fica em `/reference`.

## Configuração

Exemplo de `.env`:

```ini
PORT=3004
APIKEY=substitua_por_uma_chave_secreta
REDIS_URL=redis://127.0.0.1:6379
CAPMONSTER_KEY=
CAPTCHA2_API_KEY=
PLAYPANEL_URL=https://api.playpainel.com/
PLAYPANEL_PANEL_URL=https://playpainel.com/login
PLAYPANEL_RECAPTCHA_SITEKEY=0x4AAAAAAFAORi8vAjtQe9Lx
```

Configure `CAPMONSTER_KEY` ou `CAPTCHA2_API_KEY` com uma chave válida. O CapMonster é tentado primeiro; o 2Captcha é o fallback. O solver seleciona Turnstile para sitekeys iniciadas por `0x4`, e reCAPTCHA v2 para as demais. A sitekey deve corresponder ao painel configurado.

`APIKEY` autentica o consumidor desta API e é diferente da senha de login no painel. O código ainda usa `123456` como fallback de API key: configure uma chave própria antes de publicar a aplicação.

`DEFAULT_PLAYPANEL_USER` e `DEFAULT_PLAYPANEL_PASS` foram removidos e não são utilizados, mesmo se continuarem presentes em um ambiente antigo.

## Autenticação e credenciais por chamada

Todas as rotas de negócio exigem:

| Campo | Local | Obrigatório | Uso |
| --- | --- | --- | --- |
| `panelUser` | Query string | Sim | Usuário para login no painel |
| `panelPass` | Query string | Sim | Senha para login no painel |
| `apikey` ou `x-api-key` | Header | Sim, uma das formas | Chave de acesso desta API |

A API também aceita `apikey` na query string. Prefira o header. As credenciais de painel ausentes ou vazias retornam HTTP 400; sem API key válida, uma requisição com parâmetros válidos retorna HTTP 401. `/` e `/reference` são públicos.

No n8n, receba as credenciais de um webhook ou de um nó anterior. Configure cada nó HTTP Request com:

```text
Query Parameters:
  panelUser = {{ $json.login }}
  panelPass = {{ $json.senha }}

Headers:
  apikey = <sua chave de API>
```

Se as credenciais estiverem em outro nó, ajuste as expressões para referenciar esse nó. Não substitua esses campos por credenciais fixas no código da API.

As credenciais são obrigatórias inclusive quando existe uma sessão em cache. Isso não implica novo login no painel em toda requisição: sessões válidas podem ser reutilizadas.

## Organização no Reference

Os endpoints aparecem em três grupos, nesta ordem:

- `playpanel`: `/find`, `/find-all`, `/renew`, `/pacotes` e `/create-test-user`, sob o prefixo `/playpanel`.
- `playpanelReseller`: todas as operações sob `/playpanelreseller`.
- `Outros`: status da API (`/`), login, estatísticas, bloqueio, exclusão, limpeza de expirados, extrato de créditos e alteração de senha.

## Rotas de clientes e administração

Todas as rotas abaixo usam exclusivamente o prefixo `/playpanel`. Por exemplo: `/playpanel/find` e `/playpanel/pacotes`. Os caminhos de negócio sem prefixo não estão disponíveis. Os antigos aliases `/findAll` de clientes, `/find-all` de revendas e GET de `/playpanelreseller/updateCredits` foram removidos e retornam HTTP 404.

Todas exigem `panelUser`, `panelPass` e API key. Os parâmetros adicionais também são enviados na query string.

| Caminho completo | Método | Parâmetros adicionais | Comportamento |
| --- | --- | --- | --- |
| `/playpanel/login` | GET | `forceNewLogin` opcional | Retorna token e dados da sessão; `true` força novo login |
| `/playpanel/stats` | GET | Nenhum | Encaminha a resposta de estatísticas do painel |
| `/playpanel/find` | GET | `username` obrigatório | Busca um cliente oficial pelo nome de usuário; não retorna testes |
| `/playpanel/find-all` | GET | `teste`, `filtro`, `tipo`, `cooldown` opcionais | Lista clientes com filtros |
| `/playpanel/pacotes` | GET | Nenhum | Retorna bouquets como objetos com `id` e `name` |
| `/playpanel/create-test-user` | GET | `plano`, `horas`, `username`, `password` opcionais | Cria um teste |
| `/playpanel/renew` | GET | `id` ou `username`; `months`, `force`, `cooldown` opcionais | Renova um cliente |
| `/playpanel/toggle-status` | GET | `id` ou `username` | Alterna bloqueio/desbloqueio |
| `/playpanel/delete` | GET | `id` ou `username` | Exclui um cliente |
| `/playpanel/delete-expired` | GET | `testes`, `tipo` opcionais | Exclui expirados em lote |
| `/playpanel/logs/creditos` | GET | `id`, `start`, `length` opcionais | Consulta o extrato de créditos |
| `/playpanel/alterar-senha` | GET | `oldPassword`, `newPassword`, `confirmPassword` obrigatórios | Altera a senha da conta no painel |

A rota pública `GET /` informa `service`, `status` e `date` e aparece em `Outros`. O OpenAPI está disponível em `/reference/openapi.json`.

### Criação de teste

`plano` tem padrão `4`. `horas` aceita de 1 a 72, com padrão 3. O usuário personalizado deve ter de 12 a 20 caracteres; a senha personalizada deve ter pelo menos 12. O serviço gera uma nova senha se a informada não contiver maiúscula, minúscula e número.

Na resposta de sucesso, os dados são expostos na raiz e em `data.result`, incluindo `id` quando fornecido pelo painel, `username`, `password`, `horas` e vencimento. Os links ficam em `data.result.links`. O vencimento retornado na criação é calculado localmente a partir de `horas`.

### Consulta e listagem

`/playpanel/find` retorna apenas clientes oficiais (campo `is_trial=0` no backend, `is_trial: false` na resposta) em `data`. A busca compara o username completo sem diferenciar maiúsculas de minúsculas, primeiro nas listas próprias e depois na lista geral. Contas de teste (`is_trial=1` no backend) não são retornadas; se somente um teste corresponder ao username, a resposta é HTTP 404. Datas formatadas incluem `exp_date_local` no formato `DD/MM/YYYY`; não há campo `vencimento` criado por este serviço. `master_username` deriva de `member_id` e `as_number` é uma string vazia.

Em `/playpanel/find-all`, `filtro` aceita `todas` (padrão), `ativa` ou `expirada`. `tipo` aceita `minhas` (padrão), `revendas` ou `todas`. `teste=true` seleciona testes, `teste=false` seleciona clientes oficiais, e a ausência desse parâmetro não filtra por teste. `cooldown` tem padrão de 15 segundos. A resposta contém `total` e `data`: `total` é a quantidade efetivamente retornada após o filtro, e não o total de registros existentes no painel. Chamadas bloqueadas pelo cooldown retornam HTTP 400, inclusive quando alteram os filtros da mesma conta.

A implementação solicita até 1.000 registros em uma única página. A listagem não garante recuperar todos os clientes de contas maiores, e `/find` também depende desse limite por lista consultada.

Os campos `exp_date` e `created_at` são timestamps Unix em segundos; os campos com sufixo `_iso` usam UTC. Datas e horários com sufixo `_local` usam `America/Sao_Paulo`. As respostas de consulta incluem a senha do cliente e links de reprodução; trate esse conteúdo como confidencial.

### Renovação

Informe `id`, ou use `username` para localizar o ID. Se ID e username forem enviados juntos, o ID determina o alvo da renovação. `months` aceita valores entre 1 e 12, com padrão 1; o serviço envia `tempo` ao backend. `cooldown` aceita de 5 a 600 segundos, com padrão 60. `force=true` ignora as verificações da trava, inclusive a de operação em andamento.

A renovação aceita testes pela busca interna, embora `/playpanel/find` retorne somente clientes oficiais. No teste real realizado, uma renovação de um mês converteu o teste em cliente oficial (`is_trial: false`). A aprovação e o vencimento final são definidos pelo painel.

O retorno de sucesso inclui `message` e pode incluir `data` com o cliente atualizado. Workflows que comparam vencimentos devem verificar a existência de `data` antes de acessá-lo.

## Revendedores

Use exclusivamente o prefixo `/playpanelreseller`, por exemplo `/playpanelreseller/find`. Todas as rotas exigem as mesmas credenciais por chamada e API key.

| Caminho completo | Método | Parâmetros adicionais |
| --- | --- | --- |
| `/playpanelreseller/find` | GET | `search` obrigatório: ID, username ou e-mail |
| `/playpanelreseller/findAll` | GET | `start` padrão 0; `length` padrão 100 |
| `/playpanelreseller/findByMaster` | GET | `masterId` e `search` opcionais |
| `/playpanelreseller/updateCredits` | POST | `id` e `amount` obrigatórios; `reason` opcional |

No POST de `/playpanelreseller/updateCredits`, os parâmetros são enviados na query string. A recarga utiliza cooldown de 60 segundos e pode retornar `Credits already inserted` quando bloqueada.

O backend é definido por `PLAYPANEL_URL`, sem seleção de destino por requisição.

`/findByMaster` tenta a rota de hierarquia quando recebe `masterId`. Se essa chamada lançar erro, recorre à listagem de revendedores próprios e aplica `search`, quando presente. Esse fallback não filtra automaticamente por `masterId`. Quando a rota de hierarquia responde com sucesso, o parâmetro `search` não é aplicado.

## Contratos de entrada e resposta

As requisições aceitam somente os parâmetros documentados. Parâmetros desconhecidos retornam HTTP 400. Use `id` para identificar clientes e revendedores; clientes também podem ser localizados por `username` nas operações de renovação, bloqueio e exclusão.

Os IDs devem conter apenas dígitos. Paginação exige `start` inteiro não negativo e `length` inteiro entre 1 e 1.000. `horas` e `months` são inteiros nos intervalos documentados. `cooldown` da listagem aceita de 1 a 600 segundos. `amount` deve ser finito e maior que zero. Booleanos aceitam `true`, `false`, `1` e `0`.

As respostas padronizadas de clientes e revendedores usam `success` para indicar sucesso. Clientes ficam em `data`; a criação de teste inclui `data.result`. `/playpanel/stats` repassa o JSON do painel. Campos opcionais dependem do backend; nem toda resposta usa o mesmo envelope.

O Reference declara as três formas alternativas de API key e documenta respostas JSON sem alterar a serialização em execução. Os corpos são descritos como objetos abertos, pois o backend pode fornecer campos adicionais. HTTP 200, por si só, não garante sucesso de negócio: confira `success` ou o indicador do backend nas respostas repassadas.

## Sessões e limites dos controles atuais

O cache usa memória e, quando disponível, Redis, com validade local de quatro horas. Em HTTP 401 ou mensagem reconhecida de sessão expirada, o serviço tenta novo login e repete a chamada uma vez.

As travas de renovação e recarga usam bloqueio local em andamento e registro de cooldown em memória e, quando disponível, no Redis após sucesso. Não constituem um lock distribuído atômico nem garantem idempotência financeira. A listagem também possui bloqueio local e cooldown; isso não substitui limitação geral de requisições.

O bloqueio temporário de login ocorre quando a mensagem do backend contém `inválido`, por cinco minutos e por combinação de credenciais em memória. Não é uma proteção geral contra força bruta.

A remoção das credenciais padrão não corrige o cache Redis indexado apenas por usuário, que pode reutilizar uma sessão com outra senha informada. A alteração de senha também não invalida explicitamente o cache local. Esses pontos exigem correções separadas.

As operações de alteração continuam disponíveis em GET. Use HTTPS e evite armazenar URLs com credenciais; logs em modo DEBUG/desenvolvimento podem registrar URLs completas e a resposta de login. A documentação descreve o comportamento atual, sem garantia de segurança ou compatibilidade integral com workflows externos.

## Validação local

```bash
npm test
```

O comando compila o projeto e verifica credenciais obrigatórias, validação de parâmetros, encaminhamento aos serviços, respostas padronizadas, contratos OpenAPI, remoção de aliases e exclusão de testes em `/find`, preservando a busca interna para gerenciamento. As verificações usam chamadas locais e transporte simulado, sem autenticar em um painel real.

Também foram executadas chamadas reais pelo Reference para login, pacotes, criação de teste, renovação, `/find` e `/find-all`. A consulta após a renovação retornou o cliente oficial com o novo vencimento; a listagem com `teste=false` retornou 125 clientes sem testes. Esses números registram a validação realizada, não valores fixos ou garantidos pela API. Credenciais, chaves e dados reais de clientes não devem ser incluídos nos exemplos versionados.

Para repetir a consulta no Reference, abra `playpanel`, informe `panelUser` e `panelPass`, configure uma das alternativas de API key e envie `/playpanel/find` com um username conhecido. Em `/playpanel/find-all`, use `teste=false`, `filtro=todas` e `tipo=minhas` para consultar clientes oficiais próprios. Aguarde o cooldown antes de repetir a listagem. Um túnel temporário depende da aplicação e do processo de túnel ativos e não é uma URL de produção.
