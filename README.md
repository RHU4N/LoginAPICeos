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
    use_cases/
  infrastructure/
    db/
    repositories/
  interfaces/
    controllers/
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
