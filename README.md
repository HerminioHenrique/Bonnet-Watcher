# Zoe Bonnet Watcher Online

Versão online do monitor, separada da edição local Windows. Esta variante foi desenhada para rodar 24/7 em hospedagem gratuita com:

- **Netlify** para site estático e funções agendadas
- **Supabase** para banco remoto e histórico
- **SMTP** opcional para alertas por e-mail

## Backup da versão anterior

A versão local original foi preservada em:

- [windows-local-20260604_195202](C:\Users\hermi\Documents\Script Bonnet Zoe - Codex\backups\windows-local-20260604_195202)

## Arquitetura escolhida

### Por que não reutilizar WhatsApp Web online

O sistema antigo usava uma sessão persistente do WhatsApp Web gravada no Windows. Em host gratuito 24/7 isso deixa de ser confiável porque:

- a função sobe e desce sob demanda
- não existe sessão gráfica persistente como no seu PC
- sessões automatizadas do WhatsApp Web tendem a expirar ou quebrar com mais facilidade

Por isso, nesta versão online eu troquei o alerta automático para:

- fila remota de alertas no Supabase
- painel online com os candidatos recentes
- e-mail opcional via SMTP

Se você quiser manter WhatsApp no futuro, o caminho mais estável seria uma API oficial ou um gateway dedicado, não o WhatsApp Web automatizado.

## O que esta versão faz

- roda com agendamento automático no Netlify
- dispara a coleta em background
- salva histórico remoto no Supabase
- evita alertas duplicados
- mantém um painel web com:
  - último ciclo
  - quantidade de anúncios compatíveis
  - alertas pendentes
  - principais resultados
- pode mandar e-mail sem API paga, usando SMTP

## Referências oficiais usadas na arquitetura

- Netlify Scheduled Functions:
  - [docs.netlify.com/build/functions/scheduled-functions](https://docs.netlify.com/build/functions/scheduled-functions/)
- Netlify Background Functions:
  - [docs.netlify.com/functions/background-functions](https://docs.netlify.com/functions/background-functions/)
- Supabase schedule com cron:
  - [supabase.com/docs/guides/functions/schedule-functions](https://supabase.com/docs/guides/functions/schedule-functions)

## Estrutura

```text
zoe_bonnet_watcher_online/
|-- public/
|   |-- index.html
|   `-- app.js
|-- netlify/
|   `-- functions/
|       |-- kickoff-scheduled.mjs
|       |-- watch-background.mjs
|       |-- status.mjs
|       `-- test-alert.mjs
|-- src/
|   |-- config.mjs
|   |-- notifier.mjs
|   |-- run-watch.mjs
|   |-- scoring.mjs
|   |-- sources.mjs
|   |-- supabase.mjs
|   `-- utils.mjs
|-- supabase/
|   `-- schema.sql
|-- scripts/
|   `-- test-run.mjs
|-- package.json
|-- netlify.toml
`-- .env.example
```

## Configuração

Copie `.env.example` para `.env` e preencha:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `BACKGROUND_RUN_TOKEN`

`SUPABASE_PUBLISHABLE_KEY` pode ser preenchida também, mas nesta versão ela não é obrigatória.

### eBay oficial

Para a fonte do eBay ficar realmente robusta, esta versão agora suporta a **Browse API oficial do eBay**.

Preencha também:

- `EBAY_CLIENT_ID`
- `EBAY_CLIENT_SECRET`
- `EBAY_MARKETPLACE_ID=EBAY_GB`

Sem essas chaves, o sistema continua tentando RSS, HTML e fallback via Google, mas a API oficial tende a ser o caminho mais confiável.

Se quiser alerta por e-mail, também configure:

- `ALERT_EMAIL_ENABLED=true`
- `ALERT_EMAIL_TO`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

Nesta versão, o destino padrão já está definido como `herminiohuk@gmail.com`.

Os e-mails também saem com cabeçalhos de alta prioridade e assunto com prefixo `[IMPORTANT]`.
Isso ajuda clientes de e-mail a destacar a mensagem, mas a decisão final de marcar como “Importante” ainda depende do Gmail ou do provedor de destino.

## Supabase

No SQL Editor do Supabase, execute:

- [schema.sql](C:\Users\hermi\Documents\Script Bonnet Zoe - Codex\zoe_bonnet_watcher_online\supabase\schema.sql)

Isso cria:

- `listings`
- `listing_history`
- `alerts`
- `watch_runs`

### Onde encontrar as chaves no Supabase atual

Pela interface atual do Supabase, as chaves costumam ficar em:

- `Project Settings`
- `API Keys`

Lá você deve procurar:

- `Project URL`
- `Secret key`
- `Publishable key`

Se aparecer um botão como `Create new API keys`, clique nele para gerar as chaves novas.

Se o seu projeto ainda estiver no modelo antigo, você também pode ver uma aba de chaves legadas com:

- `anon`
- `service_role`

Nesta aplicação online, a única chave realmente obrigatória do Supabase é a `Secret key`.

## Rodar localmente

Dentro da pasta [zoe_bonnet_watcher_online](C:\Users\hermi\Documents\Script Bonnet Zoe - Codex\zoe_bonnet_watcher_online):

```bash
npm install
npm run dev
```

Para disparar uma coleta manual em ambiente local:

```bash
npm run test-run
```

## Deploy no Netlify

### 1. Suba esta pasta para um repositório Git

Você pode publicar só a pasta `zoe_bonnet_watcher_online` ou manter como subpasta do seu repositório principal.

### 2. Conecte ao Netlify

Na criação do site:

- publish directory: `public`
- functions directory: `netlify/functions`

### 3. Configure as environment variables

Adicione no painel do Netlify os valores do `.env`.

### 4. Publique

Após publicar:

- o site estático mostrará o painel
- a scheduled function chamará a background function a cada 30 minutos

## Endpoints principais

- `/.netlify/functions/status`
  - dados do painel
- `/.netlify/functions/watch-background`
  - executa uma rodada completa
- `/.netlify/functions/test-alert`
  - testa o e-mail configurado

Os endpoints `watch-background` e `test-alert` exigem `Authorization: Bearer BACKGROUND_RUN_TOKEN`.

## Limitações importantes

- esta versão usa scraping HTTP simples, não navegador real
- Google, Gumtree, eBay e outros podem alterar HTML ou limitar tráfego automatizado
- hosts gratuitos não garantem execução absolutamente contínua sem pausas ocasionais
- WhatsApp Web não foi mantido nesta versão online por confiabilidade operacional

## Melhorias futuras fáceis

- adicionar ack visual para alertas pendentes
- criar filtros por score no painel
- anexar screenshot de anúncios usando um worker com navegador dedicado
- adicionar múltiplos destinos de alerta, como e-mail e webhook
