# Integração com a mensageria CEOS

O serviço existente recebe eventos da Azure Function `processar_medicao_ceos` em
`POST /iot/internal/measurements`. A API Express continua em processo separado da
Function App. As rotas REST `/iot/measurements` permanecem autenticadas por JWT.

## Configuração

- `CEOS_SERVICE_KEY`: segredo aleatório com ao menos 32 caracteres, igual ao da
  Function App. Enviar em `x-ceos-service-key`; não aceitar JWT de usuário nesta rota.
- `CEOS_DEVICE_OWNERS`: objeto JSON controlado pelo operador, com `deviceId` como
  chave e ObjectId ou e-mail de uma conta cadastrada como valor. Exemplo:
  `{"wokwi-esp32-001":"usuario@example.com"}`. Nunca aceitar `userId` do payload.
- `TRUST_PROXY_HOPS`: configurar `1` somente atrás do proxy confiável do Render.
  Em produção, a rota interna exige `req.secure`. HTTP local serve apenas aos testes.
- `MONGO_URI` e `MONGODB_DATABASE`: manter os valores do serviço existente.

`GET /iot/internal/health`, com a mesma chave, verifica os proprietários ativos e
garante a disponibilidade do índice único antes de retornar `data.ready=true`.
O endpoint não devolve e-mails, IDs de usuários ou credenciais. Não habilitar o
Consumer se esta verificação falhar.

## Contrato e persistência

O contrato v1 completo e uma amostra estão em
`src/application/contracts/IoTEventContract.js` e `tests/fixtures/event-v1.json`.
São quatro medições de dois sensores físicos (DHT22 e BMP180). Temperatura usa
`C`, conforme o DTO existente; umidade `%`; pressão `hPa`. O campo `timestamp`
representa o recebimento, identificado por `timestampOrigin=receivedAt`.

O UseCase valida o evento completo antes da primeira gravação e resolve a conta
confiável no banco. O Repository faz upsert atômico por `eventId:sensorId` e exige
o índice único esparso existente em `idempotencyKey`. A chave legada do transporte
fica em `metadata.sourceIdempotencyKey`; a chave canônica evita duplicatas entre
eventos legados e novos. Reentregas retornam os mesmos IDs. Alterar o conteúdo de
uma medição mantendo a chave retorna 409. Falhas parciais retornam 503: o retry
completa as medições faltantes sem transações MongoDB.

A coleção real é determinada pelo Mongoose: `iot-measurements`, uma coleção
comum. Não converter para time series: esta estratégia exige índice único e
upsert. Não usar `syncIndexes`, apagar coleções ou reconstruir o banco.
O TTL já existente elimina dados após 90 dias: a garantia de idempotência acompanha
essa retenção; não reprocessar eventos fora da janela sem análise específica.

Sucesso: HTTP 200, `success=true`, `data.eventId`, `data.deviceId`, `data.persisted=4`
e `data.measurements` com quatro recibos `{id,idempotencyKey}`. O 200 só ocorre
depois de todas as gravações confirmadas com write concern majority.
Erros: 400 contrato/JSON; 401 serviço; 403 HTTPS/dispositivo/proprietário;
409 conflito de conteúdo; 503 configuração, índice ou banco indisponível.

## Validação

```powershell
npm ci
npm run lint
npm test -- --silent
npm run test:integration
```

A suíte de integração inicia um MongoDB local descartável (MongoDB Memory Server),
usa o Repository real e consulta as rotas JWT existentes. Cobre cinco entregas
concorrentes, persistência parcial, conflito, isolamento, health interno e chaves
legadas. Nunca utiliza o MongoDB Atlas de produção para limpeza ou falhas injetadas.
O teste com Azure Functions host e Azurite está em `ceos-mensageria/functions`.

## Segurança e publicação

O histórico Git contém URIs MongoDB com autenticação em commits antigos, inclusive
`345b22d`, `6256501` e `4628410`. Rotacionar os usuários/senhas MongoDB relacionados,
revogar acessos antigos e atualizar os segredos do serviço. Os valores não são
reproduzidos aqui. A limpeza atual não revoga credenciais expostas no histórico.
Não reescrever branches compartilhadas durante esta entrega.

O serviço Render existente é `srv-d12shlruibrs73fiv2jg`, branch `master`.
Publicar primeiro o Backend, validar o health interno e depois publicar a Function
App existente, inicialmente com Consumer desabilitado. Rollback de código deve
usar um deploy anterior ou revert via PR; manter dados e índices, sem exclusões.
