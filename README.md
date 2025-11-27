# LoginAPI Clean Architecture

API de autenticação e gerenciamento de usuários seguindo o padrão Clean Architecture.

## Desenvolvedores
- Rhuan
- Mauricio
- Leonardo
- Vitor

## Estrutura do Projeto

```
src/
  domain/
    entities/
    repositories/
  application/
    errors/
    use_cases/
  infrastructure/
    db/
    middleware/
    providers/
    repositories/
  interfaces/
    controllers/
    routes/
index.js
package.json
```

## Como rodar

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Configure a string de conexão do MongoDB em `src/infrastructure/db/db.js` se necessário.
3. Inicie o servidor:
   ```bash
   npx nodemon index.js
   ```
   ou
   ```bash
   node index.js
   ```

## Endpoints principais

- `POST /user` — Cadastro de usuário
- `POST /user/login` — Login
- `GET /user` — Listar usuários
- `GET /user/:id` — Buscar usuário por ID
- `PUT /user/:id` — Atualizar usuário
- `DELETE /user/:id` — Remover usuário
- `POST /user/historico` — Adicionar histórico (autenticado)
- `GET /user/historico` — Listar histórico (autenticado)

## Exemplo de requisição

Cadastro:
```json
POST /user
{
  "nome": "João",
  "email": "joao@email.com",
  "senha": "123456",
  "telefone": "11999999999",
  "assinante": true
}
```

Login:
```json
POST /user/login
{
  "email": "joao@email.com",
  "senha": "123456"
}
```

## Observações
- Use o token JWT retornado no login para acessar rotas protegidas (exemplo: histórico).
- Projeto estruturado para fácil manutenção, testes e escalabilidade.

## Testes e CI

- Unit tests: Jest (`__tests__`). Execute com `npm test`.
- Integração: Postman collection em `postman/login.postman_collection.json` — o CI usa Newman para rodar estas coleções contra um serviço de testes (Actions service: Mongo).
- Performance: `tests/perf/k6_test.js` disponível para smoke/perf tests.
- Segurança: `snyk` + `npm audit` workflows (Snyk requer `SNYK_TOKEN`).

## Deploy / Health

- Deploy: `render.yaml` presente — projetado para deploys no Render. Render realiza health checks periódicos (configuráveis via dashboard ou `render.yaml`).

**Last updated:** 2025-11-27
