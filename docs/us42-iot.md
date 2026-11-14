# SCRUM-81 — API IoT multiusuário

Implementação: `IoTPlatform` (cadastro, identidade e ciclo assíncrono), modelos persistentes em `src/domain/entities/IoTPlatform.js`, rotas `IoTPlatformRoutes` e integração v1/v2 em `IoTUseCases`. A rota `/notifications` usa a sessão existente.

O [guia de arquitetura e contrato](https://github.com/RHU4N/ceos-mensageria/blob/feat/SCRUM-81-iot-multiusuario/docs/us42-platform.md) inclui endpoints, provisionamento, outbox de comandos MongoDB, Azure Timer, estados, segurança, firmware, implantação/rollback e matriz SCRUM-394–403.

Configuração adicional: `CEOS_IOT_COMMANDS_ENABLED=false` por padrão, `CEOS_IOT_REQUEST_TTL_SECONDS=180` (30–600), `CEOS_IOT_LEGACY_MIGRATION_ENABLED=false`. Preservar `CEOS_DEVICE_OWNERS`, `CEOS_SERVICE_KEY`, Mongo e JWT existentes. Em produção HTTPS é obrigatório e Render usa `TRUST_PROXY_HOPS=1`.

Verificação: `npm run lint`, `npm test -- --silent`, `npm run test:integration`. As 13 integrações usam bancos MongoDB descartáveis; não apontar esse teste para Atlas. O harness opcional `node scripts/iot-ui-harness.cjs` abre somente 127.0.0.1:18081, gera credenciais na `.cache` ignorada e utiliza um dispositivo explicitamente simulado quando `.cache/iot-ui-device.json` contém suas credenciais e respond=true. Não implantar o harness em produção. A integração de Azure real isolada vive no repositório de mensageria.
