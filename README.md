# LoginAPICeos - API de Autenticação Refatorada v2.0

**Status:** ✅ Arquitetura Refatorada | Testes Implementados | Pronto para Produção

> API segura, escalável e preparada para a evolução do projeto CEOS com suporte a Favoritos, Funções Personalizadas e IoT

---

## 🎯 Resumo Executivo

Esta é a versão **completamente refatorada** da API de autenticação do CEOS. Implementa:

✅ Autenticação segura com JWT (access + refresh tokens)
✅ Proteção contra brute force
✅ Arquitetura em camadas com separação clara de responsabilidades
✅ DTOs para validação de entrada/saída
✅ Tratamento de erros padronizado
✅ Configuração centralizada e segura por ambiente
✅ Suporte a múltiplos ambientes (DEV/TEST/PROD)
✅ Preparada para Favoritos, Funções Personalizadas e IoT
✅ Estrutura pronta para Data Streaming

---

## 🏗️ Arquitetura

### Fluxo de Requisição

```
1. HTTP Request
    ↓
2. Middleware (Autenticação, BruteForce, Validação)
    ↓
3. Controller (Receber e validar com DTOs)
    ↓
4. Use Case (Lógica de negócio)
    ↓
5. Repository (Acesso ao MongoDB)
    ↓
6. HTTP Response (Padronizado)
```

### Estrutura de Diretórios

```
LoginAPICeos/
├── src/
│   ├── config/                    # Configuração centralizada
│   │   ├── environment.js         # Variáveis e validação
│   │   ├── database.js            # Conexão MongoDB
│   │   └── auth.js                # Segurança JWT/Senha
│   │
│   ├── domain/
│   │   ├── entities/              # Modelos MongoDB
│   │   │   ├── User.js
│   │   │   ├── Historico.js
│   │   │   ├── Favorite.js
│   │   │   ├── CustomFunction.js
│   │   │   └── IoTMeasurement.js
│   │   └── repositories/          # Interfaces
│   │
│   ├── application/
│   │   ├── use_cases/             # Lógica de negócio
│   │   │   ├── LoginUseCase.js
│   │   │   ├── RefreshTokenUseCase.js
│   │   │   ├── ChangePasswordUseCase.js
│   │   │   └── UserUseCases.js
│   │   └── errors/                # (DEPRECATED)
│   │
│   ├── infrastructure/
│   │   ├── db/                    # Inicialização BD
│   │   ├── middleware/            # Middlewares Express
│   │   │   ├── AuthMiddleware.js
│   │   │   ├── BruteForceMiddleware.js
│   │   │   └── ErrorHandler.js
│   │   ├── providers/             # Serviços
│   │   │   ├── JwtTokenProvider.js
│   │   │   └── BcryptPasswordHasher.js
│   │   └── repositories/          # Implementação
│   │
│   ├── interfaces/
│   │   ├── controllers/           # Handlers HTTP
│   │   ├── routes/                # Definição de rotas
│   │   └── ...
│   │
│   ├── dto/                       # Data Transfer Objects
│   │   ├── auth.dto.js
│   │   ├── favorite.dto.js
│   │   ├── custom-function.dto.js
│   │   └── iot.dto.js
│   │
│   └── errors/                    # Erros padronizados
│       └── AppError.js
│
├── __tests__/                     # Suite de testes
├── swagger/                       # Documentação API
├── .env.example                   # Template de variáveis
├── index.js                       # Ponto de entrada
├── package.json
└── README.md
```

---

## 🔐 Segurança

### 1️⃣ Autenticação

- **JWT Access Token:** 15 minutos (curta duração)
- **JWT Refresh Token:** 7 dias (longa duração)
- **Algoritmo:** HS256
- **Validações:** Issuer, expiração, signature

```bash
Header: Authorization: Bearer <access_token>
```

### 2️⃣ Senhas

- **Hashing:** Bcrypt com 10 rounds
- **Nunca em texto plano**
- **Política de força:**
  - Mínimo 8 caracteres
  - Pelo menos 1 maiúscula
  - Pelo menos 1 número
  - Pelo menos 1 caractere especial (!@#$%^&\*)

### 3️⃣ Proteção Brute Force

- **Limite:** 5 tentativas
- **Janela:** 15 minutos
- **Bloqueio:** 30 minutos

```
Tentativa 1-5:   ✅ Permitido
Tentativa 6:     🚫 Bloqueado por 30 min
Após 30 min:     ✅ Desbloqueado
```

### 4️⃣ DTOs e Validação

Toda entrada é validada com DTOs:

```javascript
const loginDTO = new LoginDTO(email, senha);
loginDTO.validate(); // Lança erro se inválido
```

### 5️⃣ Separação de Ambientes

```bash
NODE_ENV=development  → Database: ceos_dev
NODE_ENV=production   → Database: ceos
```

Produção **NUNCA** pode conectar a banco de testes.

---

## 📊 Banco de Dados

### Collections

#### `users`

```javascript
{
  _id: ObjectId,
  nome: String,
  email: String (unique, index),
  senhaHash: String (nunca retorna),
  telefone: String,
  assinante: Boolean,
  ativo: Boolean,

  // Segurança
  tentativasLogin: Number,
  bloqueadoAte: Date,
  ultimoLogin: Date,
  tokenRefreshRevoked: Array,

  // Contadores
  countFavoritos: Number,
  countFuncoesPersonalizadas: Number,

  criadoEm: Date,
  atualizadoEm: Date
}
```

#### `historicos` (NEW - antes era subdocumento)

```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref User),
  tipo: String,
  valores: String,
  resultado: Mixed,
  criadoEm: Date (index, auto-delete após 90 dias)
}
```

#### `favorites` (NEW)

```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  resourceId: ObjectId,
  resourceType: String (enum),
  nome: String,
  descricao: String,
  criadoEm: Date
}
```

#### `custom-functions` (NEW)

Funções personalizadas criadas pelos usuários

#### `iot-measurements` (NEW)

Medições de sensores IoT com índices otimizados para time-series

---

## 📡 API Endpoints

###登 Autenticação

**`POST /auth/login`** - Login

```json
{
  "email": "usuario@email.com",
  "senha": "Senha123!"
}
```

**Resposta:**

```json
{
  "success": true,
  "data": {
    "expiresIn": "15m",
    "user": { "id": "...", "nome": "...", "email": "..." }
  }
}
```

Os tokens JWT são enviados exclusivamente em cookies `HttpOnly` (`accessToken`
e `refreshToken`); eles não aparecem no corpo da resposta nem são guardados
no `localStorage`.

**`POST /auth/refresh`** - Renovar Token

```json
{
  "refreshToken": "eyJhbGc..."
}
```

**`POST /auth/change-password`** (🔒 Autenticado)

```json
{
  "senhaAtual": "Senha123!",
  "novaSenha": "NovaSenha456!",
  "confirmaNovaSenha": "NovaSenha456!"
}
```

**`POST /auth/logout`** (🔒 Autenticado)
Revogar tokens

**`GET /auth/me`** (🔒 Autenticado)
Dados do usuário logado

### Usuários

**`POST /users`** - Registrar
**`GET /users/:id`** (🔒) - Obter
**`PATCH /users/:id`** (🔒) - Atualizar
**`DELETE /users/:id`** (🔒) - Deletar

### Histórico

**`POST /historicos`** (🔒) - Adicionar
**`GET /historicos`** (🔒) - Listar com paginação
**`DELETE /historicos/:id`** (🔒) - Remover item
**`DELETE /historicos?confirmed=true`** (🔒) - Limpar tudo

### Favoritos

**`POST /favorites`** (🔒) - Criar favorito

**`GET /favorites`** (🔒) - Listar favoritos do usuário
**`DELETE /favorites/:id`** (🔒) - Remover favorito próprio

### Funções personalizadas

**`POST /custom-functions`** (🔒) - Criar função

**`GET /custom-functions`** (🔒) - Listar funções do usuário

**`GET /custom-functions/:id`** (🔒) - Consultar função própria

**`PATCH /custom-functions/:id`** (🔒) - Atualizar função própria
**`DELETE /custom-functions/:id`** (🔒) - Remover função própria

### IoT

**`POST /iot/measurements`** (🔒) - Registrar medição

**`GET /iot/measurements`** (🔒) - Listar medições próprias com paginação/filtros

**`GET /iot/measurements/:id`** (🔒) - Consultar medição própria

**`GET /iot/devices/:deviceId/measurements`** (🔒) - Filtrar por dispositivo
**`GET /iot/sensors/:sensorId/measurements`** (🔒) - Filtrar por sensor

---

## 🚀 Como Usar

### Instalação

```bash
git clone https://github.com/RHU4N/LoginAPICeos
cd LoginAPICeos
npm install
```

### Configurar Ambiente

```bash
cp .env.example .env
```

Editar `.env`:

```env
NODE_ENV=development
MONGO_URI=mongodb+srv://user:pass@cluster/ceos?retryWrites=true&w=majority
MONGODB_DATABASE=ceos_dev
JWT_SECRET=seu-segredo-super-seguro-aqui-minimo-32-caracteres
PORT=8081
```

### Executar

```bash
# Desenvolvimento (com hot reload)
npm run dev

# Produção
npm start

# Testes
npm test

# Testes com cobertura
npm test -- --coverage
```

### Verificar Saúde da API

```bash
curl http://localhost:8081/health
```

Resposta:

```json
{
  "success": true,
  "data": {
    "status": "OK",
    "environment": "development",
    "database": "connected"
  }
}
```

---

## 🧪 Testes

```bash
# Executar todos
npm test

# Teste específico
npm test -- LoginUseCase.new.test.js

# Watch mode
npm test -- --watch
```

### Cobertura

Testes implementados para:

- ✅ Login/Logout
- ✅ Criação de usuários
- ✅ Validação de senhas
- ✅ JWT (geração e validação)
- ✅ Proteção brute force
- ✅ Tratamento de erros
- ✅ DTOs
- ✅ Favoritos
- ✅ Funções personalizadas
- ✅ IoT

---

## 📚 Documentação API

Acesso local em: `http://localhost:8081/docs`.

Swagger/OpenAPI documenta os endpoints, campos de entrada e autenticação por
cookie. Ele é habilitado em desenvolvimento e desabilitado em produção por
padrão; use `ENABLE_SWAGGER=true` somente em ambiente controlado.

---

## 🔧 Troubleshooting

| Erro                                   | Causa                                  | Solução                           |
| -------------------------------------- | -------------------------------------- | --------------------------------- |
| `MONGO_URI não definido`               | Variável de ambiente faltando          | Adicionar ao `.env`               |
| `JWT_SECRET não é seguro`              | Segredo muito curto                    | Usar 32+ caracteres               |
| `Produção conectou ao banco de testes` | NODE_ENV/MONGODB_DATABASE desalinhados | Verificar `.env`                  |
| `Muitas tentativas bloqueadas`         | Brute force ativado                    | Aguardar 30 min ou limpar memória |
| `CORS error`                           | Origin não permitida                   | Verificar `CORS_ORIGIN` em `.env` |

---

## ⚙️ Variáveis de Ambiente

| Variável                  | Exemplo                 | Descrição                       |
| ------------------------- | ----------------------- | ------------------------------- |
| `NODE_ENV`                | `development`           | Ambiente (dev/test/prod)        |
| `PORT`                    | `8081`                  | Porta HTTP                      |
| `MONGO_URI`               | `mongodb+srv://...`     | String de conexão MongoDB       |
| `MONGODB_DATABASE`        | `ceos_dev`              | Nome do banco                   |
| `JWT_SECRET`              | `seu-segredo...`        | Chave de assinatura JWT         |
| `JWT_EXPIRY_ACCESS`       | `15m`                   | Expiração access token          |
| `JWT_EXPIRY_REFRESH`      | `7d`                    | Expiração refresh token         |
| `BCRYPT_ROUNDS`           | `10`                    | Custo Bcrypt                    |
| `RATE_LIMIT_MAX_ATTEMPTS` | `5`                     | Tentativas login antes bloqueio |
| `CORS_ORIGIN`             | `http://localhost:3000` | CORS permitido                  |
| `ENABLE_SWAGGER`          | `true`                  | Exibe `/docs` em ambiente controlado |

---

## 🐳 Docker

```bash
docker-compose up -d
```

---

## 📈 Roadmap

- [x] Autenticação refatorada
- [x] Proteção brute force
- [x] DTOs e validação
- [x] Tratamento de erros padronizado
- [x] Histórico em collection separada
- [x] Favoritos (endpoints)
- [x] Funções Personalizadas (endpoints)
- [x] IoT Measurements (endpoints)
- [ ] Rate limiting com Redis
- [ ] Integração com Data Streaming

---

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch: `git checkout -b feature/nome`
3. Commit: `git commit -am 'Adiciona feature'`
4. Push: `git push origin feature/nome`
5. Pull Request

---

## 👥 Colaboradores

- **Rhuan** - Arquitetura e Refatoração
- **Leonardo** - Features
- **Mauricio** - Features
- **Vitor** - Features

---

## 📄 Licença

ISC

---

## 📞 Suporte

Documentação completa em: [docs/DATABASE.md](docs/DATABASE.md)
Issues: https://github.com/RHU4N/LoginAPICeos/issues

### Estrutura de dados ST12

Favoritos, funções personalizadas e medições IoT possuem collections, índices,
DTOs, persistência e endpoints próprios. O diagnóstico da estrutura antiga, os
ambientes, relacionamentos e índices estão documentados em
[docs/DATABASE.md](docs/DATABASE.md).
