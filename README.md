# Api Play Panel 🚀

API de alto desempenho desenvolvida em **Node.js**, **Fastify** e **TypeScript** para automação e integração completa do painel **Play Panel** ([https://playpainel.com/](https://playpainel.com/)).

Baseada na arquitetura da **API Central** e com referência na **Easyplay API**, mantendo rigorosamente as mesmas regras de aplicação, funcionamento e negócio, com **100% de chamadas via método GET**, requisições diretas sem proxy e total compatibilidade plug-and-play com workflows do **n8n**.

---

## 📑 Sumário

- [Visão Geral e Diferenciais](#-visão-geral-e-diferenciais)
- [Requisitos e Instalação](#-requisitos-e-instalação)
- [Variáveis de Ambiente (.env)](#-variáveis-de-ambiente-env)
- [Autenticação](#-autenticação)
- [Endpoints para Integração no n8n (Todas em GET)](#-endpoints-para-integração-no-n8n-todas-em-get)
  - [1. Criar Teste Rápido (`/create-test-user`)](#1-criar-teste-rápido-create-test-user)
  - [2. Localizar Cliente (`/find`)](#2-localizar-cliente-find)
  - [3. Renovar Cliente (`/renew`)](#3-renovar-cliente-renew)
  - [4. Listar Todos os Clientes (`/find-all`)](#4-listar-todos-os-clientes-find-all)
  - [5. Consultar Estatísticas e Saldo (`/stats`)](#5-consultar-estatísticas-e-saldo-stats)
  - [6. Demais Endpoints Administrativos](#6-demais-endpoints-administrativos)
- [Mapeamento e Migração no n8n](#-mapeamento-e-migração-no-n8n)
- [Mecanismos de Segurança e Defesa](#-mecanismos-de-segurança-e-defesa)

---

## ⚡ Visão Geral e Diferenciais

* **100% das Chamadas via GET**: Todos os endpoints foram projetados para serem acionados via método `GET`, facilitando a integração em webhooks, nós HTTP do n8n e chamadas diretas via navegador ou links.
* **Compatibilidade Plug-and-Play com n8n**: Estruturas de retorno e nomes de campos 100% alinhados aos nós de condição `IF (existe)`, `IF (verificarTeste)`, `IF (validarRenew)` e nós `Code` de manipulação de datas.
* **Sem Uso de Proxy**: Requisições diretas ao backend oficial do Play Panel (`https://api.playpainel.com/`), garantindo menor latência, estabilidade e sem risco de proxies lentos ou indisponíveis.
* **Resolução Inteligente de Captcha**: Integração com **CapMonster** (primário) e **2Captcha** (fallback automático) para o Google reCAPTCHA v2 do painel.
* **Gestão de Sessão Multinível**: Cache de autenticação em memória local e Redis com auto-healing (renovação transparente e repetição da chamada quando a sessão expirar).
* **Proteção Contra Renovação Dupla Acidental**: Trava atômica em memória e Redis (*in-flight mutex* + janela de *cooldown* de 60s) que impede que cliques duplos cobrem créditos em duplicidade.
* **Anti-Hammering em Listagens**: Fila concorrente e cooldown para proteger a conta contra sobrecarga em buscas de todas as listas.
* **Roteamento Flexível**: Aceita chamadas tanto diretamente na raiz (`/find`, `/renew`), prefixadas por `/playpanel/...` (`/playpanel/find`, `/playpanel/renew`) quanto por `/central/...` (`/central/find`, `/central/renew`).

---

## 🛠️ Requisitos e Instalação

* **Node.js**: v18.0.0 ou superior (testado em v20.x e v22.x)
* **Redis**: Instância ativa local ou remota (porta padrão 6379, com degradação suave em memória caso indisponível)
* **Gerenciador de Pacotes**: npm, pnpm ou yarn

```bash
# 1. Instalar dependências
npm install

# 2. Compilar TypeScript
npm run build

# 3. Iniciar em produção
npm start

# Ou iniciar em modo de desenvolvimento com recarregamento automático
npm run dev
```

A documentação interativa Swagger/Scalar estará disponível em: `http://localhost:3004/reference`.

### Executando com Docker:
```bash
docker compose up -d --build
```

---

## ⚙️ Variáveis de Ambiente (.env)

Crie um arquivo `.env` na raiz do projeto configurando suas variáveis:

```ini
PORT=3004
APIKEY=123456
REDIS_URL=redis://127.0.0.1:6379
CAPMONSTER_KEY=seu_token_capmonster
CAPTCHA2_API_KEY=seu_token_2captcha
PLAYPANEL_URL=https://api.playpainel.com/
PLAYPANEL_PANEL_URL=https://playpainel.com/login
PLAYPANEL_RECAPTCHA_SITEKEY=6LeoXPYfAAAAAESd3YBOkZDLnDrXvMv0vHtM0Qbh
DEFAULT_PLAYPANEL_USER=Marcelo15
DEFAULT_PLAYPANEL_PASS=10203040wW
```

---

## 🔐 Autenticação

Todas as rotas exigem a autenticação da API. A chave pode ser enviada de qualquer uma das seguintes formas:

1. **Header HTTP** (Recomendado):
   ```http
   apikey: 123456
   ```
   ou
   ```http
   x-api-key: 123456
   ```
2. **Query Parameter**:
   ```
   ?apikey=123456
   ```

---

## 📡 Endpoints para Integração no n8n (Todas em GET)

### 1. Criar Teste Rápido (`/create-test-user`)

Gera uma nova conta de teste no painel, calcula vencimento e devolve os links de DNS e playlists.

* **Método**: `GET`
* **Rotas**: `/create-test-user`, `/playpanel/create-test-user` ou `/central/create-test-user`

#### Parâmetros (Query String):
| Parâmetro | Tipo | Obrigatório | Descrição |
| :--- | :--- | :---: | :--- |
| `panelUser` | String | Não | Usuário do revendedor (usa padrão do `.env` se omitido) |
| `panelPass` | String | Não | Senha do revendedor (usa padrão do `.env` se omitido) |
| `horas` | Number | Não | Duração do teste em horas (Padrão: `3`) |
| `plano` | String | Não | ID do Bouquet/Plano (Padrão: `"4"` - Completo) |
| `username` | String | Não | Usuário customizado (gerado automaticamente se omitido) |
| `password` | String | Não | Senha customizada (gerada automaticamente se omitido) |

#### Exemplo de Requisição no n8n:
* **Node**: `HTTP Request`
* **Method**: `GET`
* **URL**: `https://sua-api.com/create-test-user`
* **Query Parameters**:
  * `panelUser`: `={{ $json.login }}`
  * `panelPass`: `={{ $json.senha }}`
  * `horas`: `2`
* **Headers**:
  * `apikey`: `123456`

#### Exemplo de Resposta (Compatível com o nó `verificarTeste`):
```json
{
  "status": 200,
  "user": true,
  "success": true,
  "id": "2399970",
  "username": "gjB6fK2UT3Mz",
  "password": "6rKr@8yCAB7f",
  "horas": 2,
  "exp_date": 1790086099,
  "exp_date_iso": "2026-09-22T14:08:19.000Z",
  "exp_date_local": "22/09/2026",
  "message": "Teste gerado com sucesso!",
  "data": {
    "sucess": true,
    "success": true,
    "result": {
      "id": "2399970",
      "username": "gjB6fK2UT3Mz",
      "password": "6rKr@8yCAB7f",
      "horas": 2,
      "exp_date": 1790086099,
      "exp_date_iso": "2026-09-22T14:08:19.000Z",
      "exp_date_local": "22/09/2026",
      "links": {
        "dns": {
          "smarters_xciptv": "http://exz75.link:80",
          "stb_novo": "212.102.61.90",
          "stb_antigo": "212.102.61.91",
          "webplayer": "http://eyplayer.io",
          "epg": "http://eyepg.io/"
        },
        "playlists": {
          "mpegts": "http://exz75.link/get.php?username=gjB6fK2UT3Mz&password=6rKr@8yCAB7f&type=m3u_plus&output=ts",
          "hls": "http://exz75.link/get.php?username=gjB6fK2UT3Mz&password=6rKr@8yCAB7f&type=m3u_plus&output=m3u8",
          "ssiptv_ts": "http://exz75.link/get.php?username=gjB6fK2UT3Mz&password=6rKr@8yCAB7f&type=ss&output=ts",
          "ssiptv_hls": "http://exz75.link/get.php?username=gjB6fK2UT3Mz&password=6rKr@8yCAB7f&type=ss&output=m3u8"
        }
      }
    }
  }
}
```

> **Integração no n8n**:
> - O nó `IF (verificarTeste)` checa `{{ $json.data.result.id }}` (Retorna **TRUE**).
> - O nó `Edit Fields` extrai diretamente `{{ $json.data.result.username }}`, `password` e `exp_date`.

---

### 2. Localizar Cliente (`/find`)

Busca os dados de um cliente ou teste cadastrado.

* **Método**: `GET`
* **Rotas**: `/find`, `/playpanel/find` ou `/central/find`

#### Parâmetros (Query String):
| Parâmetro | Tipo | Obrigatório | Descrição |
| :--- | :--- | :---: | :--- |
| `username` | String | **Sim** | Nome de usuário do cliente |
| `panelUser` | String | Não | Usuário do revendedor |
| `panelPass` | String | Não | Senha do revendedor |

#### Exemplo de Requisição no n8n:
* **Node**: `HTTP Request`
* **Method**: `GET`
* **URL**: `https://sua-api.com/find`
* **Query Parameters**:
  * `panelUser`: `={{ $json.login }}`
  * `panelPass`: `={{ $json.senha }}`
  * `username`: `={{ $json.username }}`
* **Headers**:
  * `apikey`: `123456`

#### Exemplo de Resposta (Compatível com os nós `IF (existe)` e `Code`):
```json
{
  "status": 200,
  "user": true,
  "success": true,
  "data": {
    "id": "2399970",
    "username": "gjB6fK2UT3Mz",
    "password": "6rKr@8yCAB7f",
    "status": "1",
    "status_desc": "Ativo",
    "is_trial": true,
    "exp_date": 1790086100,
    "exp_date_iso": "2026-09-22T14:08:20.000Z",
    "exp_date_local": "22/09/2026",
    "exp_date_time_local": "22/09/2026, 11:08:20",
    "created_at": 1790078899,
    "created_at_iso": "2026-09-22T12:08:19.000Z",
    "created_at_local": "22/09/2026",
    "created_at_time_local": "22/09/2026, 09:08:19",
    "max_connections": 1,
    "conexoes": "-",
    "reseller_notes": "",
    "member_id": "Marcelo15",
    "master_username": "Marcelo15",
    "as_number": "",
    "links": {
      "dns": {
        "smarters_xciptv": "http://exz75.link:80",
        "stb_novo": "212.102.61.90",
        "stb_antigo": "212.102.61.91",
        "webplayer": "http://eyplayer.io",
        "epg": "http://eyepg.io/"
      },
      "playlists": {
        "mpegts": "http://exz75.link/get.php?username=...&password=...&type=m3u_plus&output=ts",
        "hls": "http://exz75.link/get.php?username=...&password=...&type=m3u_plus&output=m3u8",
        "ssiptv_ts": "http://exz75.link/get.php?username=...&password=...&type=ss&output=ts",
        "ssiptv_hls": "http://exz75.link/get.php?username=...&password=...&type=ss&output=m3u8"
      }
    }
  }
}
```

> **Integração no n8n**:
> - O nó `IF (existe)` checa `{{ $json.status }} == 200` e `{{ $json.data.id }}` (Retorna **TRUE**).
> - O nó `Code` divide `vencimento.split('/')` sem erros, pois `exp_date_local` vem formatado estritamente em `DD/MM/YYYY`.
> - Os campos `master_username`, `as_number` e `max_connections` vêm sempre preenchidos.

---

### 3. Renovar Cliente (`/renew`)

Renova o acesso de um cliente ou teste por X meses, com verificação pós-renovação e trava anti-duplicidade.

* **Método**: `GET`
* **Rotas**: `/renew`, `/playpanel/renew` ou `/central/renew`

#### Parâmetros (Query String):
| Parâmetro | Tipo | Obrigatório | Descrição |
| :--- | :--- | :---: | :--- |
| `id` ou `idcentral` | String | Condicional* | ID numérico do cliente no painel (*ou informe `username`)* |
| `username` | String | Condicional* | Nome de usuário (se informado, busca o ID automaticamente) |
| `months` | Number | Não | Meses a adicionar (Padrão: `1`) |
| `cooldown` | Number | Não | Janela de proteção em segundos contra cliques duplos (Padrão: `60`) |
| `force` | Boolean | Não | `true` para ignorar a proteção de cooldown |
| `panelUser` | String | Não | Usuário do revendedor |
| `panelPass` | String | Não | Senha do revendedor |

#### Exemplo de Requisição no n8n:
* **Node**: `HTTP Request`
* **Method**: `GET`
* **URL**: `https://sua-api.com/renew`
* **Query Parameters**:
  * `idcentral`: `={{ $('find').item.json.data.id }}`
  * `panelUser`: `={{ $json.login }}`
  * `panelPass`: `={{ $json.senha }}`
  * `months`: `1`
* **Headers**:
  * `apikey`: `123456`

#### Exemplo de Resposta (Compatível com o nó `validarRenew`):
```json
{
  "status": 200,
  "user": true,
  "success": true,
  "message": "Cliente renovado com sucesso!",
  "data": {
    "id": "2399970",
    "username": "gjB6fK2UT3Mz",
    "exp_date_local": "22/10/2026",
    "exp_date_time_local": "22/10/2026, 11:08:20",
    "master_username": "Marcelo15",
    "status": "1"
  }
}
```

> **Integração no n8n**:
> - O nó `IF (validarRenew)` compara `{{ $('find').item.json.data.exp_date_local }} != {{ $json.data.exp_date_local }}` (Retorna **TRUE** porque a nova data avançou com sucesso).
> - Se uma renovação repetida for disparada acidentalmente dentro do cooldown, a API bloqueia e responde:
>   `{ "status": 400, "user": false, "success": false, "message": "Operação de renovação bloqueada por duplicidade..." }`

---

### 4. Listar Todos os Clientes (`/find-all`)

Retorna a relação completa de usuários, com opções de filtros de status e tipo.

* **Método**: `GET`
* **Rotas**: `/find-all`, `/findAll`, `/playpanel/find-all` ou `/central/find-all`

#### Parâmetros (Query String):
| Parâmetro | Tipo | Padrão | Descrição |
| :--- | :--- | :---: | :--- |
| `filtro` | String | `"todas"` | `"todas"`, `"ativa"`, `"expirada"` |
| `tipo` | String | `"minhas"` | `"minhas"` (apenas suas), `"revendas"` ou `"todas"` (incluindo sub-revendas) |
| `teste` | Boolean | - | `true` para apenas testes, `false` para apenas oficiais |
| `cooldown` | Number | `15` | Proteção anti-hammering de consultas repetidas |

#### Exemplo de Resposta (Compatível com o nó `IF (existe1)`):
```json
{
  "status": 200,
  "user": true,
  "success": true,
  "total": 45,
  "data": [
    {
      "id": "2399970",
      "username": "gjB6fK2UT3Mz",
      "status": "1",
      "is_trial": true,
      "exp_date_local": "22/09/2026",
      "master_username": "Marcelo15"
    }
  ]
}
```

---

### 5. Consultar Estatísticas e Saldo (`/stats`)

* **Método**: `GET`
* **Rotas**: `/stats`, `/playpanel/stats` ou `/central/stats`
* **Retorno**: Retorna saldo de créditos (`credits`), total de listas ativas, testes ativos e revendedores.

```json
{
  "result": true,
  "data": {
    "credits": "65",
    "active_lists": "12",
    "total_lists": "45",
    "testes_ativos": "3"
  }
}
```

---

### 6. Demais Endpoints Administrativos (Todos em GET)

| Rota | Método | Parâmetros Principais | Descrição |
| :--- | :---: | :--- | :--- |
| `/pacotes` | `GET` | - | Lista todos os bouquets disponíveis para ativação de clientes |
| `/toggle-status` | `GET` | `id` ou `username` | Bloqueia ou desbloqueia um cliente |
| `/delete` | `GET` | `id` ou `username` | Deleta um cliente do painel |
| `/delete-expired` | `GET` | `testes` (boolean), `tipo` | Exclui listas ou testes expirados em lote |
| `/logs/creditos` | `GET` | `id`, `start`, `length` | Retorna o extrato detalhado de consumo e recarga de créditos |
| `/alterar-senha` | `GET` | `oldPassword`, `newPassword`, `confirmPassword` | Altera a senha da conta do revendedor no painel |
| `/login` | `GET` | `forceNewLogin` | Valida as credenciais e força novo login com captcha |

---

### 7. Sistema de Revendas e Sub-Revendas (`/reseller` e `/centralreseller`)

Módulo completo para controle e gestão de sub-revendedores, correspondente às regras e contratos do **Central Reseller**:

* **Método**: `GET` (todas as operações de revenda disponíveis em GET)
* **Rotas**: Prefixadas com `/reseller`, `/centralreseller` ou `/playpanel/reseller`

#### 7.1 Localizar Revendedor (`/reseller/find`)
* **URL**: `/reseller/find` ou `/centralreseller/find`
* **Query Parameters**:
  * `search`: Nome de usuário, ID ou e-mail do revendedor
  * `panelUser`, `panelPass`: Credenciais opcionais
* **Exemplo de Retorno**:
```json
{
  "status": 200,
  "sucess": true,
  "success": true,
  "data": {
    "id": "1840",
    "username": "revenda_joao",
    "owner_id": "Marcelo15",
    "email": "joao@email.com",
    "status": "1",
    "status_desc": "Ativo",
    "credits": 25,
    "created_at": "05/09/2026 14:22:10",
    "last_login": "08/10/2026 09:15:00"
  }
}
```

#### 7.2 Listar Todos os Revendedores (`/reseller/findAll`)
* **URL**: `/reseller/findAll`, `/reseller/find-all` ou `/centralreseller/findAll`
* **Query Parameters**:
  * `start`: Índice inicial (padrão `0`)
  * `length`: Quantidade por página (padrão `100`)
* **Exemplo de Retorno**:
```json
{
  "status": 200,
  "sucess": true,
  "success": true,
  "total": 12,
  "data": [
    {
      "id": "1840",
      "username": "revenda_joao",
      "owner_id": "Marcelo15",
      "status": "1",
      "credits": 25
    }
  ]
}
```

#### 7.3 Buscar por Master / Hierarquia (`/reseller/findByMaster`)
* **URL**: `/reseller/findByMaster` ou `/centralreseller/findByMaster`
* **Query Parameters**:
  * `masterId`: ID do master para inspeção de hierarquia
  * `search`: Filtro opcional por nome

#### 7.4 Adicionar Créditos ao Revendedor (`/reseller/updateCredits`)
* **URL**: `/reseller/updateCredits` ou `/centralreseller/updateCredits`
* **Método**: `GET` (e compatibilidade adicional via `POST`)
* **Query Parameters**:
  * `idcentral` ou `id`: ID numérico do revendedor
  * `creditos` ou `amount`: Quantidade de créditos a recarregar
  * `reason`: Motivo da recarga (opcional)
* **Proteção Anti-Duplicação**: Possui trava idêntica ao `checkAlreadyInsertedCredits(id, 'central-revenda')` do Central, bloqueando requisições duplicadas dentro da janela de cooldown com a mensagem `"Credits already inserted"`.
* **Exemplo de Retorno**:
```json
{
  "status": 200,
  "sucess": true,
  "success": true,
  "message": "Créditos atualizados com sucesso, quantidade adicionada: 10",
  "data": {
    "credits": 35
  }
}
```

---

## 🔄 Mapeamento e Migração no n8n

Para migrar qualquer workflow do n8n para a **Api Play Panel**, basta atualizar o campo **URL** dos nós HTTP Request:

| Operação / Fluxo | URL Anterior Central | Nova URL Api Play Panel | Método |
| :--- | :--- | :--- | :---: |
| **Localizar Cliente** | `/central/find` | `/find` ou `/playpanel/find` | `GET` |
| **Renovar Cliente** | `/central/renew` | `/renew` ou `/playpanel/renew` | `GET` |
| **Criar Teste Rápido** | `/central/create-test-user` | `/create-test-user` | `GET` |
| **Listar Todos** | `/central/find-all` | `/find-all` ou `/findAll` | `GET` |
| **Consultar Saldo** | `/central/stats` | `/stats` | `GET` |
| **Localizar Revendedor** | `/centralreseller/find` | `/reseller/find` | `GET` |
| **Listar Revendedores** | `/centralreseller/findAll` | `/reseller/findAll` | `GET` |
| **Recarga de Revenda** | `/centralreseller/updateCredits` | `/reseller/updateCredits` | `GET` |

---

## 🛡️ Camadas Defensivas e Comparação com a API Central

Todas as camadas defensivas presentes na API Central e na Easyplay API foram implementadas e preservadas rigorosamente:

| Camada Defensiva | Implementação no Central | Implementação na Api Play Panel |
| :--- | :--- | :--- |
| **Trava de Renovação Dupla (Clientes)** | `checkAlreadyInsertedCredits` (Central) | `RenewLock` com mutex in-flight e cooldown de 60s por ID |
| **Trava de Recarga Dupla (Revenda)** | `checkAlreadyInsertedCredits` ('central-revenda') | `RenewLock` chave `reseller_credit_${id}` com retorno `"Credits already inserted"` |
| **Anti-Hammering de Listagens** | `checkAlreadyFindAll` (Central) | `FindAllLock` com fila concorrente e cooldown de 15s |
| **Auto-Healing de Sessão** | Retry em caso de HTTP 401 (`fetch.service.ts`) | Intercepta 401 e sessão expirada, renova token e repete a chamada transparente |
| **Resolução de Captcha** | 2Captcha e CapMonster (Turnstile / Recaptcha) | `CaptchaSolver` dinâmico (Turnstile `0x4...` e reCAPTCHA v2) com CapMonster + 2Captcha |
| **Proteção de Força Bruta** | Bloqueio temporário em memória (`blockedUsers`) | Bloqueio de 5 minutos por tentativas consecutivas com credenciais erradas |
| **Conexão Direta** | Impit / Fetch sem proxy | Conexão HTTP nativa e direta sem proxy para máxima velocidade |

