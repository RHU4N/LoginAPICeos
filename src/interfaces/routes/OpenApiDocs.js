/**
 * @swagger
 * tags:
 *   - name: Autenticação
 *   - name: Usuários
 *   - name: Histórico
 *   - name: Favoritos
 *   - name: Funções personalizadas
 *   - name: IoT
 * components:
 *   schemas:
 *     Erro:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: false }
 *         error:
 *           type: object
 *           properties:
 *             code: { type: string, example: VALIDATION_ERROR }
 *             message: { type: string, example: Dados inválidos. }
 *             statusCode: { type: integer, example: 400 }
 *     HistoricoEntrada:
 *       type: object
 *       required: [tipo, valores, resultado]
 *       properties:
 *         tipo: { type: string, example: equacao-segundo-grau }
 *         valores: { type: object, additionalProperties: true }
 *         resultado: { type: object, additionalProperties: true }
 *     FavoritoEntrada:
 *       type: object
 *       required: [resourceId, resourceType, nome]
 *       properties:
 *         resourceId: { type: string, example: 66d0a0000000000000000001 }
 *         resourceType: { type: string, enum: [custom-function, calculation, iot-device] }
 *         nome: { type: string, example: Fórmula de Bhaskara }
 *         descricao: { type: string }
 *     FuncaoEntrada:
 *       type: object
 *       required: [nome, categoria, tipo, formula]
 *       properties:
 *         nome: { type: string, example: Área do círculo }
 *         categoria: { type: string, enum: [matematica, fisica, quimica, financeira, outro] }
 *         tipo: { type: string, example: expressao }
 *         parametros: { type: array, items: { type: string }, example: [raio] }
 *         formula: { type: string, example: PI * raio ^ 2 }
 *         tags: { type: array, items: { type: string } }
 *         publica: { type: boolean, default: false }
 *     MedicaoIoTEntrada:
 *       type: object
 *       required: [deviceId, sensorId, sensorTipo, valor, unidade, timestamp]
 *       properties:
 *         deviceId: { type: string, example: ESP32-001 }
 *         sensorId: { type: string, example: temperature-01 }
 *         sensorTipo: { type: string, enum: [temperatura, umidade, pressao, luz, movimento, gas, outro] }
 *         valor: { type: number, example: 24.5 }
 *         unidade: { type: string, example: C }
 *         timestamp: { type: string, format: date-time }
 *         localizacao: { type: string }
 *         metadata: { type: object, additionalProperties: true }
 *         idempotencyKey: { type: string, description: Evita duplicidade em retransmissões. }
 */

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Autenticação]
 *     security: []
 *     summary: Inicia sessão e grava cookies JWT HttpOnly
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, senha]
 *             properties: { email: { type: string, format: email }, senha: { type: string, format: password } }
 *     responses: { '200': { description: Sessão criada }, '400': { description: Dados inválidos }, '401': { description: Credenciais inválidas } }
 * /auth/logout:
 *   post:
 *     tags: [Autenticação]
 *     summary: Encerra a sessão atual
 *     responses: { '200': { description: Sessão encerrada }, '401': { description: Não autenticado } }
 * /auth/refresh:
 *   post:
 *     tags: [Autenticação]
 *     summary: Renova o access token com o cookie refreshToken
 *     responses: { '200': { description: Sessão renovada }, '400': { description: Refresh token ausente }, '401': { description: Refresh token inválido } }
 * /auth/me:
 *   get:
 *     tags: [Autenticação]
 *     summary: Retorna o usuário autenticado
 *     responses: { '200': { description: Usuário atual }, '401': { description: Não autenticado } }
 * /auth/change-password:
 *   post:
 *     tags: [Autenticação]
 *     summary: Troca a senha, exigindo a senha atual, e encerra a sessão
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [senhaAtual, novaSenha, confirmaNovaSenha]
 *             properties: { senhaAtual: { type: string, format: password }, novaSenha: { type: string, format: password }, confirmaNovaSenha: { type: string, format: password } }
 *     responses: { '200': { description: Senha alterada }, '400': { description: Senha inválida }, '401': { description: Senha atual incorreta } }
 */

/**
 * @swagger
 * /users:
 *   post:
 *     tags: [Usuários]
 *     security: []
 *     summary: Cria uma conta
 *   get:
 *     tags: [Usuários]
 *     summary: Lista usuários (somente administrador)
 * /users/{id}:
 *   get:
 *     tags: [Usuários]
 *     summary: Consulta a própria conta (ou uma conta, se administrador)
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *   patch:
 *     tags: [Usuários]
 *     summary: Atualiza nome e telefone da própria conta
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *   delete:
 *     tags: [Usuários]
 *     summary: Exclui a própria conta
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 */

/**
 * @swagger
 * /historicos:
 *   post:
 *     tags: [Histórico]
 *     summary: Salva uma operação do usuário autenticado
 *     requestBody: { required: true, content: { application/json: { schema: { $ref: '#/components/schemas/HistoricoEntrada' } } } }
 *   get:
 *     tags: [Histórico]
 *     summary: Lista o histórico do usuário autenticado
 *   delete:
 *     tags: [Histórico]
 *     summary: Limpa o histórico; requer confirmed=true
 *     parameters: [{ in: query, name: confirmed, required: true, schema: { type: boolean } }]
 * /historicos/{id}:
 *   delete:
 *     tags: [Histórico]
 *     summary: Remove uma operação própria
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 * /favorites:
 *   post:
 *     tags: [Favoritos]
 *     summary: Cria um favorito do usuário autenticado
 *     requestBody: { required: true, content: { application/json: { schema: { $ref: '#/components/schemas/FavoritoEntrada' } } } }
 *   get:
 *     tags: [Favoritos]
 *     summary: Lista os favoritos próprios
 * /favorites/{id}:
 *   delete:
 *     tags: [Favoritos]
 *     summary: Remove um favorito próprio
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 */

/**
 * @swagger
 * /custom-functions:
 *   post:
 *     tags: [Funções personalizadas]
 *     summary: Cria uma função personalizada
 *     requestBody: { required: true, content: { application/json: { schema: { $ref: '#/components/schemas/FuncaoEntrada' } } } }
 *   get:
 *     tags: [Funções personalizadas]
 *     summary: Lista as funções próprias
 * /custom-functions/{id}:
 *   get:
 *     tags: [Funções personalizadas]
 *     summary: Busca uma função própria
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *   patch:
 *     tags: [Funções personalizadas]
 *     summary: Atualiza uma função própria
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *   delete:
 *     tags: [Funções personalizadas]
 *     summary: Remove uma função própria
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 * /iot/measurements:
 *   post:
 *     tags: [IoT]
 *     summary: Persiste uma medição IoT vinculada ao usuário autenticado
 *     requestBody: { required: true, content: { application/json: { schema: { $ref: '#/components/schemas/MedicaoIoTEntrada' } } } }
 *   get:
 *     tags: [IoT]
 *     summary: Lista medições próprias, com filtros e paginação
 *     parameters:
 *       - { in: query, name: deviceId, schema: { type: string } }
 *       - { in: query, name: sensorId, schema: { type: string } }
 *       - { in: query, name: sensorTipo, schema: { type: string } }
 *       - { in: query, name: page, schema: { type: integer, minimum: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, maximum: 1000 } }
 * /iot/measurements/{id}:
 *   get:
 *     tags: [IoT]
 *     summary: Busca uma medição própria
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 * /iot/devices/{deviceId}/measurements:
 *   get:
 *     tags: [IoT]
 *     summary: Lista as medições próprias de um dispositivo
 *     parameters: [{ in: path, name: deviceId, required: true, schema: { type: string } }]
 * /iot/sensors/{sensorId}/measurements:
 *   get:
 *     tags: [IoT]
 *     summary: Lista as medições próprias de um sensor
 *     parameters: [{ in: path, name: sensorId, required: true, schema: { type: string } }]
 */
