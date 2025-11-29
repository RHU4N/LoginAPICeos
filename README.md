# Login API (loginAPI)

Breve descrição
----------------
API de autenticação e gerenciamento de usuários para o ecossistema CEOS. Fornece endpoints para login, registro, verificação de token e recuperação de senha.

Principais funcionalidades
-------------------------
- Autenticação via JWT.
- Criptografia de senhas (Bcrypt).
- Endpoints para login, registro, verificação de token e gerenciamento de usuários.
- Middleware de autenticação (`infrastructure/middleware/AuthMiddleware.js`).

Colaboradores
-------------
- Leonardo
- Mauricio
- Rhuan
- Vitor



Tecnologias utilizadas
----------------------
- Node.js
- Express
- MongoDB (local ou Atlas)
- Mongoose
- Bcrypt
- JWT
- Testes: Jest
- Docker (opcional)

Estrutura relevante
-------------------
- `src/infrastructure/providers/` — provedores como `BcryptPasswordHasher` e `JwtTokenProvider`.
- `src/interfaces/controllers/` — controllers HTTP.
- `src/infrastructure/repositories/` — implementação do repositório de usuários.
- `db.js` — inicialização do banco.

Executando localmente
---------------------
1. Instale dependências e configure `.env` com variáveis (ex.: `JWT_SECRET`, `MONGO_URI`):

```cmd
cd loginAPI
npm install
```

2. Inicie a API:

```cmd
npm start
```

3. Executar testes:

```cmd
npm test
```

Endpoints principais
-------------------
- `POST /user` — Cadastro de usuário
- `POST /user/login` — Login
- `GET /user` — Listar usuários
- `GET /user/:id` — Buscar usuário por ID
- `PUT /user/:id` — Atualizar usuário
- `DELETE /user/:id` — Remover usuário
- `POST /user/historico` — Adicionar histórico (autenticado)
- `GET /user/historico` — Listar histórico (autenticado)

Exemplo de requisição (Cadastro)
------------------------------
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

Observações
-----------
- Use o token JWT retornado no login para acessar rotas protegidas.
- Atualize `Colaboradores` se necessário e preencha `URL pública` somente se houver deploy.

Testes e CI
----------
- Unit tests: Jest (`__tests__`) — execute com `npm test`.
- Postman collection: `postman/login.postman_collection.json`.
- Deploy: `render.yaml` e Dockerfile incluídos para facilitar deploy/containerização.


