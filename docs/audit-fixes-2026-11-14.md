# Correções da auditoria US42 — 14/11/2026

Base: `master`, `0dd73a4d9e41bf9256410c7f39e47e1c16957f91`. PRs #12/#13 já estavam integrados; não foram repetidos merges.

O Web envia `Idempotency-Key` ao solicitar READ_ONCE. O preflight real do Render e do App Service Azure não autorizava esse header. A correção adiciona somente esse header à lista CORS existente. Testes novos reproduziram a falha antes da correção e verificam tanto a origem confiável com credenciais quanto a ausência de autorização para origem maliciosa.

O pipeline Azure publicava um artefato sem instalar dependências ou executar testes no job de liberação. Agora o build executa instalação limpa, lint, unidade e integração antes do upload. PRs validam sem publicar; o deploy exige master e é serializado. Foram preservados OIDC, secrets existentes, destino e runtime Node 24 do workflow. Não foram criadas identidades, concedidos papéis ou removidas proteções.

O MongoDB local levou 52,3 segundos para iniciar nesta máquina, superando o padrão de dez segundos. Os fixtures de integração/UI permitem 90 segundos para iniciar; não foram alterados prazos de negócio nem removidas asserções.

Validação independente: `npm ci`; lint; 61 testes em 17 suítes; 16 cenários de integração com MongoDB real isolado. Segurança inclui ownerId imutável, IDOR, medições/notificações isoladas, rejeição de envio/polling e solicitação após revogação, leases, replay, cinco slots simultâneos, cancelamento, expiração e histórico arquivado. Zero cenários ignorados. Audit de produção sem vulnerabilidades; seis achados baixos na cadeia de testes.

O fluxo HTTPS real Render→Azure Queue/Consumer→Atlas foi repetido com a conta técnica autorizada e um novo dispositivo HTTP virtual, desvinculado ao terminar. Não é comprovação de hardware. Os dois contratos de evento permanecem equivalentes byte a byte após normalizar finais de linha.

O App Service `loginapi-ceos.azurewebsites.net` autenticou a conta técnica, mas as rotas IoT retornaram `403 HTTPS_REQUIRED` sob HTTPS. Isso precisa de inspeção da topologia/configuração de proxy, não de remoção do requisito HTTPS. Não foi alterado o tráfego dos clientes nem aplicada configuração de produção sem os gates.

Os últimos workflows Azure das duas APIs passaram; issuer, subject e audience OIDC correspondem à master de cada repositório. O erro antigo `No subscriptions found` não se repetiu nessas execuções. A inspeção administrativa de Client/Tenant/Subscription e IAM no App Service continuou bloqueada por token Azure expirado em outra assinatura. Não é correto concluir que a configuração IAM inteira foi revisada apenas porque o deploy passou.

O scanner não encontrou credenciais nos arquivos versionáveis atuais, mas detectou URIs MongoDB autenticadas no histórico antigo. A revogação dessas credenciais não foi comprovada; é pendência de segurança até confirmação administrativa. Valores foram omitidos e o histórico preservado.

Esta revisão fica em PR. A liberação aguarda QA visual Web, resolução dos bloqueios de segurança/configuração e integração das correções. SCRUM-81 e SCRUM-402 permanecem Em análise. O relatório final datado reúne as evidências dos cinco repositórios sem substituir a documentação de entrega anterior.
