# Banco de dados — estrutura ST12

## Diagnóstico e decisão

O modelo anterior concentrava histórico no usuário e não possuía persistência operacional para favoritos, funções personalizadas ou medições IoT. A nova estrutura usa collections independentes para recursos de crescimento variável; isso evita documentos `users` grandes, permite paginação e preserva ownership. Não há migração: a estrutura antiga foi descartada conforme a decisão do projeto.

## Ambientes

| Ambiente | `MONGODB_DATABASE` | Regra |
| --- | --- | --- |
| development | `ceos_dev` | dados locais/de desenvolvimento |
| test | `ceos_test` | dados descartáveis de testes |
| production | `ceos` | dados principais; nomes contendo `test` são bloqueados |

`MONGO_URI` e `MONGODB_DATABASE` são obrigatórios em produção. Nunca reutilize as credenciais de produção nos arquivos de desenvolvimento ou teste.

## Collections e relacionamentos

| Collection | Ownership / relação | Campos principais |
| --- | --- | --- |
| `users` | raiz | nome, email, senhaHash, role, tokenVersion, timestamps |
| `historicos` | N:1 para `users` por `userId` | tipo, valores, resultado, criadoEm |
| `favorites` | N:1 para `users` por `userId` | resourceId, resourceType, nome, descricao |
| `custom-functions` | N:1 para `users` por `userId` | nome, categoria, tipo, parâmetros, fórmula |
| `iot-measurements` | N:1 para `users` por `userId` | deviceId, sensorId, sensorTipo, valor, unidade, timestamp |

O usuário autenticado é o dono dos seus favoritos, funções e medições. Consultas e alterações desses recursos sempre filtram por `userId`.

## Índices

- `users.email` é único.
- `favorites(userId, resourceId, resourceType)` é único e impede duplicatas.
- `favorites(userId, criadoEm)` suporta listagem do usuário.
- `custom-functions(userId, criadoEm)` e `(userId, categoria)` suportam consulta.
- `iot-measurements(deviceId, timestamp)`, `(sensorId, timestamp)` e `(deviceId, sensorId, timestamp)` suportam filtros temporais.
- `iot-measurements.idempotencyKey` é único esparso para retransmissões.

## IoT e streaming

Medições são eventos independentes, com instante de captura (`timestamp`) e instante de recepção (`criadoEm`). `idempotencyKey` permite deduplicação e `processado` deixa o modelo preparado para um consumidor de streaming futuro. O endpoint pagina os resultados e não acopla o schema a broker específico.
