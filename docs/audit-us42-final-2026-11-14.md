# Auditoria final US42 / SCRUM-81 — 14 de novembro de 2026

**Veredito: BLOCKED para liberação.** A implementação anterior está nas principais, mas a auditoria reproduziu defeitos reais e abriu cinco PRs de correção. Os checks de validação desses PRs passaram. Nenhum merge ou promoção de produção foi executado. O Vercel gerou automaticamente um preview do PR Web; preview não constitui aprovação visual ou promoção.

Esta revisão preserva os relatórios anteriores. As [evidências estruturadas](evidence/audit-20261114/audit.json) contêm horários UTC, comandos, resultados, hashes dos logs, comparações Git, checks/URLs, smoke tests, dependências, nuvem e limites. Os logs completos permanecem na pasta local `audit-us42-20261114/evidence`; logs de CI podem ser abertos pelos links abaixo. Falhas anteriores estão registradas, não foram apagadas ou consideradas aprovadas.

## Git, integração e correções

Os cinco checkouts estavam limpos na abertura. Foram executados fetch/prune inicial e final, inspeção de PRs e comparação de todos os refs remotos. MathAPI estava um commit atrás: fast-forward apenas para o workflow Azure já existente. Não houve reset, force push, reescrita de histórico, conflito ou alteração de trabalho local de terceiros.

| Repositório | Principal auditada | PRs anteriores confirmados MERGED | Correção desta revisão / SHA do código |
|---|---|---|---|
| Ceos | main `e72bc69c6fa181f33bcdb64bfc476e98dcd15ad2` | [#9](https://github.com/RHU4N/Ceos/pull/9), [#10](https://github.com/RHU4N/Ceos/pull/10) | [#11](https://github.com/RHU4N/Ceos/pull/11), `feeab71b5825b3513404757bd07dc31a5abd9ed5` |
| CeosApp | main `f2cfb929398681d25f79d369cff696b55e4f961a` | [#1](https://github.com/RHU4N/CeosApp/pull/1) | [#2](https://github.com/RHU4N/CeosApp/pull/2), `ca41c7d635de29b9b049cc61a128952f4298c978` |
| LoginAPICeos | master `0dd73a4d9e41bf9256410c7f39e47e1c16957f91` | [#12](https://github.com/RHU4N/LoginAPICeos/pull/12), [#13](https://github.com/RHU4N/LoginAPICeos/pull/13) | [#14](https://github.com/RHU4N/LoginAPICeos/pull/14), `ec0b8885aed19ecd2c1504a3d872b4b30d8db231` |
| ceos-mensageria | main `90b3ecce6d873d04046303bc7a567b2f1337afea` | [#2](https://github.com/RHU4N/ceos-mensageria/pull/2), [#3](https://github.com/RHU4N/ceos-mensageria/pull/3) | [#4](https://github.com/RHU4N/ceos-mensageria/pull/4), `bca4cae5de126b409e4dd45c23dc8c47c2bbeab8` |
| MathAPI | master `0d7c07bb995c4ce59c4592e2d571ac681cf3a5d6` | sem implementação IoT nova | [#15](https://github.com/RHU4N/MathAPI/pull/15), `d1cc99aa4e19fdf6a059fe80b9b0344f4871b3d5` |

A tabela identifica commits de código validados; este relatório e o JSON são um acréscimo documental posterior no mesmo PR Backend. O HEAD final está disponível no PR e no manifesto local de encerramento, sem inventar um SHA autorreferente para o relatório.

Não há commit aprovado para promoção enquanto os gates estiverem bloqueados. Quando forem resolvidos, usar o HEAD validado do PR, incluindo a revisão documental, e registrar seu SHA exato antes de publicar.

As branches anteriores feat/fix da US42 têm **ahead=0** em relação às principais. Inicialmente os quatro projetos IoT eram classe **A** (código integrado), e MathAPI **E** (nenhuma integração IoT necessária). Após os achados, todos têm classe **C** por haver um PR corretivo aberto; não houve classe B ou D. Os commits novos estão nas branches remotas dos PRs, não perdidos ou mesclados redundantemente.

Somente quatro branches antigas Snyk de Ceos tinham commits exclusivos fora da US42: `df41fdb`, `78bf7f2`, `6204714`, `39f9ac5`. Permanecem separadas. Branches devops e de evidência antigas integradas não foram mescladas de novo. A API GitHub informou `protected=false` nas cinco principais; nenhuma regra foi removida. Configurar required checks/revisões nas principais é uma ação administrativa recomendada.

## Defeitos comprovados e correções

1. **CORS Backend:** o Web envia `Idempotency-Key`, mas o preflight não o permitia. Reproduzido em teste antes da correção e nos dois Backends publicados. Corrigida somente a lista de headers permitidos para origens já confiáveis; regressão também rejeita origem maliciosa.
2. **Sessão Web:** 503 no refresh apagava o perfil devido ao 401 original; a restauração inicial atrasada também substituía um login mais recente. Dois testes falharam antes e passaram após as guardas de erro/versão da sessão.
3. **Sessão Mobile:** resposta de uma conta anterior podia repetir uma operação com o bearer da conta seguinte ou entregar dados após logout. Refresh tardio podia regravar credenciais, e sua rejeição 401 podia limpar a nova conta. Versão de sessão, validações antes de aplicar respostas e serialização no Secure Store corrigem os caminhos reproduzidos.
4. **Pipelines Azure:** os jobs que liberavam os artefatos não instalavam nem testavam o código. Agora Backend executa ci/lint/unidade/integração e MathAPI ci/regressão antes de liberar upload/deploy. PRs validam sem publicar; deploy exige master e é serializado. OIDC, referências a secrets e destinos foram preservados.
5. **Dependências:** aplicados patches compatíveis demonstrados pelo audit, sem `--force`, quatro patches oficiais do SDK Expo 57 e backport de segurança CommonJS do decoder usado pelo Router. Zod das ferramentas foi atualizado na faixa já suportada por seus consumidores. Não houve mudança de major do SDK ou downgrade de CRA/Expo para satisfazer o scanner.
6. **Infraestrutura de testes:** o MongoDB isolado iniciou em 52,3 s nesta máquina; o padrão de 10 s falhou antes das asserções. Fixtures agora permitem 90 s para iniciar, preservando os prazos de negócio. Export gerado em `.cache` também passou a ser ignorado por Git/ESLint; erros do bundle gerado não foram mascarados como erros de fonte.

O código atual foi inspecionado: ownership e sanitização de DTOs, hashes de provisionamento, consumo único/expiração, credenciais individuais, rotação/revogação, filtros/paginação, v1/v2, outbox durável, leases/correlação, recibos, idempotência, conclusão após persistência, notificações e histórico arquivado. Os contratos Backend/Function são equivalentes byte a byte após normalizar finais de linha (SHA-256 `867ed93bd7c6e8c67f39665586a7059ba9e8b9bebddaea8da9e14ecd719c1810`). Os testes abaixo verificam os comportamentos essenciais, sem substituir inspeção por documentação antiga.

## Execuções novas e CI

| Componente | Execução e resultado final | Evidência CI |
|---|---|---|
| Backend | npm ci; lint; **61 testes / 17 suítes**; **16 cenários** com MongoDB real isolado, aprovados | [IoT](https://github.com/RHU4N/LoginAPICeos/actions/runs/43634119987), [Azure build validado](https://github.com/RHU4N/LoginAPICeos/actions/runs/43634119944), [Newman/infra](https://github.com/RHU4N/LoginAPICeos/actions/runs/43634119938) |
| Mensageria | npm ci; lint; **40 testes**; **10 cenários** reais isolados com Functions Host, Azurite, Express e MongoDB | [Unit/runtime](https://github.com/RHU4N/ceos-mensageria/actions/runs/43632552348) |
| Web | npm ci; CI=true npm test -- --watchAll=false --runInBand; **29 testes / 9 suítes**; build CI=true aprovado | [Build/teste/infra](https://github.com/RHU4N/Ceos/actions/runs/43633485262) |
| Mobile | npm ci repetido com o backport; lint; **18 testes**; Doctor **21/21**; parsing/imports JS por TypeScript; export Web/Android/iOS | [CI do último código](https://github.com/RHU4N/CeosApp/actions/runs/43638693534) |
| MathAPI | npm ci; **88 testes / 10 suítes** antes e após o lockfile corrigido | [Regressão/Newman/infra](https://github.com/RHU4N/MathAPI/actions/runs/43632542990), [Azure build](https://github.com/RHU4N/MathAPI/actions/runs/43632543087) |

Nenhum teste de unidade/integração foi aprovado como ignorado. Jobs de **deploy** em PR foram deliberadamente SKIPPED, não contados como testes executados. As falhas de regressão anteriores, os dois timeouts MongoDB, o quoting PowerShell inicial do caminho `(app)` e o lint inicial dos arquivos gerados estão no JSON, seguidos das reexecuções bem-sucedidas. O TypeScript usa `allowJs` e `checkJs=false`: comprova parsing/resolução, não tipagem estrita. Os exports Android/iOS geraram bundles Hermes, sem build assinado.

## Segurança

O teste com MongoDB real validou A sem acesso ao dispositivo/evento/request de B, B sem medições de A e sem poder marcar sua notificação, ownerId imutável no PATCH, credencial revogada sem polling/envio e leitura rejeitada, rotação, replay/lease antigo, rate limit, cinco solicitações simultâneas, cancelamento e expiração. Falha de persistência mantém o pedido incompleto e o retry não duplica medições/notificações.

Em produção, login técnico e endpoints autenticados foram consultados, o endpoint interno sem chave retornou 401 e o ingresso Azure sem credencial individual retornou 401. Cookies Web foram recebidos com HttpOnly/Secure/SameSite=None e tokens ausentes do corpo Web; o cliente Mobile usa bearer. O comportamento de cookies entre sites no navegador real continua **NOT_VERIFIED**. HTTPS/CSRF/CORS não foram relaxados para contornar os bloqueios.

O scanner não encontrou segredos nos arquivos versionáveis atuais dos cinco projetos. Uma verificação adicional de quatro valores privados conhecidos, sem imprimi-los, não encontrou literais em arquivos/histórico ou URLs Function com chave aparente. Isso não é garantia absoluta de ausência de segredos. **Há URIs MongoDB autenticadas em commits antigos do Backend.** Não foi comprovada sua revogação; a divergência em relação à configuração local não prova que estejam inutilizadas. Metadados sanitizados, sem valores, constam no JSON. O conector Atlas repetiu a solicitação de autenticação; não foi usado para alegar rotação concluída. Não foram reescritos commits, excluídos usuários ou alteradas credenciais de produção às cegas.

| Dependências | Audit completo antes → depois | Recorte de produção após correções |
|---|---|---|
| Backend | 6 baixos → 6 baixos | zero |
| Mensageria | 10 moderados + 3 altos, ferramentas | zero; ferramentas omitidas do pacote |
| Web | 72, incluindo 3 críticos → 38: 17 baixos, 8 moderados, 13 altos, zero críticos | CRA está em dependencies; omit=dev ainda inclui ferramentas de build |
| Mobile | 20 → 8 moderados, zero altos/críticos | 3 moderados na cadeia de ferramentas Expo |
| MathAPI | 19, incluindo 1 crítico → 6 baixos | zero |

No Web foram atualizados Axios 1.21.1, Router 7.18.5 e transitivas; os altos restantes estão na cadeia CRA/build/dev, sem servidor Express publicado pelo site estático. Na MathAPI foram corrigidos body-parser 2.4.0, proxy-addr 2.0.8 e transitivas. Um exit 1 de `npm audit fix` registra advisories residuais, não falha de execução dos testes.

**O DoS Mobile foi reproduzido e corrigido:** a entrada malformada, passando pelo `query-string` real do Router, excedeu dez segundos em worker isolado. O backport aplica o algoritmo oficial corrigido [0.5.1](https://github.com/advisories/GHSA-qr28-fpjm-wq7f), preservando licença MIT, integridade npm e hash da fonte. O corpo do algoritmo é intacto; foi acrescentado somente export CommonJS síncrono com a normalização legada de `+`. O override resolve o consumidor real para essa implementação. Após a correção, a regressão terminou em cerca de 343–368 ms. Há testes de proveniência por hash e compatibilidade UTF-8, flags, arrays e links de request; npm ci, Doctor e exports foram repetidos. O SDK continua 57. Zod do lint foi atualizado para 4.6.7 dentro da faixa `^3.25.0 || ^4.0.0` já declarada pelos consumidores. Os advisories moderados de ferramentas continuam explícitos; check de audit/Snyk não significa ausência deles.

## Ambientes publicados, sem confundir os destinos

| Destino | Versão constatada | Estado funcional / classificação |
|---|---|---|
| LoginAPI Render | `0dd73a4...`, [dep-dbs9sfe417fc73f9p0j0](https://dashboard.render.com/web/srv-d12shlruibrs73fiv2jg) live | Login, ownership, medições, notificações e readiness aprovados; preflight Idempotency-Key ainda falha. **NEEDS_FIX** |
| LoginAPI Azure App Service | workflow master `0dd73a4...`; deployment `7e2b91f3-51c0-4c38-aff2-d9ef17f84ce6` | Login e /auth/me 200; /iot/devices e /iot/measurements retornam **403 HTTPS_REQUIRED sob HTTPS**. CORS idem. **NEEDS_FIX**, administração **NOT_VERIFIED** |
| MathAPI Azure | workflow master `0d7c07b...`; deployment `212ff311-97b3-4612-961c-c3b5ee5f0111` | Área do quadrado com lado/altura 5 retornou 25. **DEPLOYED**, atualização de dependências ainda em PR |
| MathAPI Render | `0d7c07b...`, `dep-dbs9pr5bedkc73but1rg` live | Mesmo cálculo 200/25; usado pelos clientes. **DEPLOYED**, lockfile corretivo ainda não promovido |
| Azure Function | pacote `26fcf79e-7e6c-4fcc-9a96-9172cc05a9be.zip` | **DEPLOYED**; runtime Node 22, HTTPS e comandos ativos, Consumer habilitado, Backend Render |
| Web Vercel | `e72bc69...`, [dpl_6NmsaHBtjM5JVEne355XCKA2uxtX](https://vercel.com/rhu4ns-projects/ceos/6NmsaHBtjM5JVEne355XCKA2uxtX), Production READY | bundle/rota presentes; correções não promovidas e QA visual ausente. Liberação **BLOCKED** |
| Mobile | principal `f2cfb929...`; candidato no PR #2 | Android local validado; sem distribuição assinada ou iOS executado. **BLOCKED** pelos gates pendentes |

O bundle Vercel `main.6003acf7.js` (SHA-256 `373a41405cad2ad6f8c2fc6486b17b71985d1268a01d5975c5267341d1a9d8ac`) contém `https://loginapiceos.onrender.com` e `https://mathapi.onrender.com`. O Mobile nativo de produção usa esses defaults, com overrides por EXPO_PUBLIC_*; não existe evidência de um binário distribuído que permita afirmar qual override foi usado nele. A QA local usou localhost:18081 explicitamente. Nenhum cliente foi redirecionado para Azure.

O pacote Function atual foi baixado para backup privado e comparado com `origin/main`: **11 arquivos de fonte/host/package/lock correspondem**, sem diferenças após normalizar finais de linha. As únicas correções novas de mensageria são fixture/documentação, portanto não há motivo para redeploy da Function. O hash do pacote atual é `A55E91757EE2203BF86305907E288B0811557AEC6EBA354117942E5A54AA7DA2`, 5.707.553 bytes.

## Fluxo real em nuvem e limites do E2E

Com a conta técnica já autorizada foi criado e pareado o dispositivo virtual `ceos-8cac75b4-23fc-46d0-bde2-b48e81a67093`. READ_ONCE retornou 202; Timer despachou, o emissor obteve lease/ACK e enviou ao ingresso Azure. Queue/Consumer persistiram no Atlas, o pedido `f336578e-0497-47c6-99db-d66bcbeca02e` ficou COMPLETED, com duas medições do evento `f47d0b55-e92d-48fb-a4c6-8aaa69ef7dd3` e uma notificação. Um push separado também persistiu duas medições.

Ao terminar, o dispositivo foi desvinculado; o dashboard/histórico do proprietário permaneceu e a credencial antiga recebeu 401 no polling. Não houve exclusão de medições ou mudança de proprietário. Filas principal e poison tinham contagem aproximada zero na checagem posterior às 19:35:43 UTC. Falhas destrutivas, retry/duplicação/poison, indisponibilidade de persistência e expiração offline foram exercitados no ambiente isolado, não injetados em produção.

Esse é um teste HTTP real entre serviços de nuvem com **emissor virtual**. Não é E2E da UI Web até Azure e não comprova hardware físico, execução Wokwi ou leituras ambientais reais.

## QA visual

**Web: BLOCKED.** Tentativas novas de conexão retornaram `No browser is available` / `[]`, inclusive na conferência final. Não foram executados desktop/tablet/mobile em navegador, screenshots Web, console/rede ou revisão visual completa dos estados vazio/loading/erro/arquivado. Testes React/JSDOM, build e preview Vercel não substituem isso.

**Android:** nova execução no Pixel_5/Android 17, 1080×2340, Expo Go 57.0.9. Confirmados login, estado vazio, cadastro, pareamento por HTTP local, inventário atualizado, READ_ONCE pela UI, navegação, notificação global em Funções, resultado com quatro sensores/unidades/horários, histórico após reinício e logout. Foram [salvos e inspecionados oito screenshots e os registros QA](https://github.com/RHU4N/CeosApp/tree/fix/SCRUM-81-session-isolation/docs/evidence/audit-20261114), incluindo a revisão após o decoder. O screenshot `logout.png` é o diálogo; `logged-out.png` comprova o estado final.

A QA Android usa MongoDB/Express descartáveis e emissor explícito de valores fixos, sem fila Azure nesse caminho. O fluxo em nuvem foi validado separadamente. Depois da guarda para refresh rejeitado e do backport, o Metro foi reconstruído após npm ci; a nova verificação nativa confirmou login e o link de request com UTF-8, `+` e bytes percentuais malformados, exibindo novamente os quatro valores persistidos. O [registro complementar](https://github.com/RHU4N/CeosApp/blob/fix/SCRUM-81-session-isolation/docs/evidence/audit-20261114/qa-decoder.json) contém hashes das fontes e screenshot. O payload grande de DoS foi testado no worker, não como intent Android de 224 KB. Erros/offline visuais específicos não foram reexercitados no emulador. Logs do processo Expo Go não mostraram FATAL EXCEPTION ou erros ReactNativeJS nas consultas registradas; crashes UWB do sistema do emulador não foram atribuídos ao app. A bolha Tools do Expo Go aparece no cabeçalho dos screenshots.

**iOS:** export Hermes concluído, interface não executada. Sem build assinado/EAS Update/lojas. **Firmware/hardware:** não executados nesta auditoria; não se reutiliza compilação anterior como prova nova.

## Azure OIDC, IAM e providências administrativas

As últimas execuções [LoginAPI 43622839899](https://github.com/RHU4N/LoginAPICeos/actions/runs/43622839899) e [MathAPI 43622331101](https://github.com/RHU4N/MathAPI/actions/runs/43622331101) terminaram com deploy bem-sucedido. Os logs confirmam issuer `https://token.actions.githubusercontent.com`, audience `api://AzureADTokenExchange` e subjects `repo:RHU4N/LoginAPICeos:ref:refs/heads/master` / `repo:RHU4N/MathAPI:ref:refs/heads/master`. O erro antigo de LoginAPI em 43622428649 não se repetiu na execução posterior. Não se alega que toda a configuração IAM foi inspecionada.

O CLI acessa a assinatura da Function; a consulta de App Services em outra assinatura continuou falhando por token expirado AADSTS70043. `az account show` usa cache e não comprova acesso de administração ao destino. Os valores de Client/Tenant/Subscription em GitHub Secrets não foram impressos nem lidos por uma API que só fornece seus nomes.

Para o administrador concluir com as **identidades existentes**:

1. Renovar login no tenant da assinatura que contém os dois App Services; selecionar essa assinatura e localizar os recursos com `az webapp list --subscription <assinatura-existente>`. Registrar somente nomes/RG e se a consulta passou.
2. No Deployment Center e nos secrets já referenciados pelos workflows, conferir correspondência de Client ID, Tenant ID e Subscription ID, sem colocá-los em comentários/logs. Identificar se a federação é de app Entra ou identidade gerenciada atribuída pelo usuário; listar a federação desse recurso existente e comparar issuer/audience/subjects acima.
3. Listar os papéis efetivos da mesma identidade no ID de cada App Service. Se faltar permissão, avaliar `Website Contributor` **somente no App Service específico**, conforme [orientação Microsoft](https://learn.microsoft.com/en-us/azure/app-service/deploy-github-actions), sem Owner/Contributor de assinatura e sem duplicar service principal. O sucesso atual de OIDC não justifica mudar IAM sem diagnóstico.
4. Inspecionar HTTPS Only, runtime e configuração de proxy do loginapi-ceos. O 403 demonstra que Express não reconhece a terminação TLS. Verificar os headers/topologia que o App Service garante e configurar o `TRUST_PROXY_HOPS` já suportado no menor valor validado; não habilitar confiança irrestrita nem remover a guarda HTTPS. Alterar configuração somente com os gates aplicáveis e rollback preparado. Repetir login, sessão, preflight com Idempotency-Key, IoT autenticado/owner, notificações e integração antes de qualquer troca de tráfego.
5. No Atlas, confirmar a revogação das credenciais antigas apontadas no histórico. Se ainda ativas, preparar rotação coordenada nos consumidores Render/Azure, validar a nova conexão e então revogar as antigas; registrar só data/identificador da rotação. Não excluir dados ou alterar owners.

## Jira e critérios da história

Foram consultadas somente SCRUM-81 e SCRUM-394–403. SCRUM-81 e SCRUM-402 estavam e permanecem **Em análise**; as outras nove estavam Concluído. Não foram alteradas outras histórias ou fechados itens com QA pendente.

| Item | Evidência atual / limite |
|---|---|
| 394 — dados/indicadores | contratos canônicos, sensores/unidades/origem e tests de ambos os contratos |
| 395 — estrutura Web | /iot, Navbar, dashboard, filtros/estados em fonte e 29 testes; visual final pendente |
| 396 — integração Backend | ownership/GET/dashboard/paginação testados com MongoDB e consultas reais; CORS READ_ONCE corrigido no PR aberto |
| 397 — temperatura/umidade | C/% exibidos no resultado Android; duas temperaturas, umidade e pressão com sensores distintos |
| 398 — histórico | consulta isolada/paginada, reinício Android e desvinculação em nuvem preservando histórico |
| 399 — gráficos/indicadores Web | SVG por sensor/unidade coberto por teste; apresentação no navegador não aprovada |
| 400 — Mobile | Router, cards/indicadores nativos, navegação e QA Android com screenshots; iOS não executado |
| 401 — vazio/erros | vazio Android, rejeições e falhas de API/persistência/retry automatizadas; não todos os estados de erro visuais |
| 402 — apresentação nas duas plataformas | **BLOCKED**, falta navegador Web e revisão dos estados/responsividade/console/rede |
| 403 — documentação | guias anteriores preservados e relatórios datados novos em todos os cinco PRs |

Os critérios de dados, unidades, horário, histórico, sensor, atualização e notificações têm evidências de código/testes/Android/nuvem nos respectivos escopos. Responsividade e apresentação Web continuam sem comprovação visual. Os comentários de encerramento da auditoria devem apontar este relatório e os cinco PRs; manter a história em análise.

## Rollback e próxima promoção

Não houve mudança de produção a reverter nesta auditoria. Para uma promoção futura, preservar os atuais: Render LoginAPI `dep-dbs9sfe417fc73f9p0j0` / SHA `0dd73a4...`; Render MathAPI `dep-dbs9pr5bedkc73but1rg` / SHA `0d7c07b...`; Vercel `dpl_6NmsaHBtjM5JVEne355XCKA2uxtX` / SHA `e72bc69...`; Function ZIP/hash acima, salvo privadamente em `.secrets/audit-20261114-live.zip`.

Azure mantém os artefatos `node-app` dos runs atuais: LoginAPI **14124826459** e MathAPI **14124038807**, não expirados na consulta, válidos até 12/02/2027. Guardar cópia privada antes de futura publicação; artifact ID não substitui um smoke test pós-rollback. A assinatura App Service precisa estar acessível para confirmar configuração e disponibilidade de rollback antes de promover. Não existe distribuição Mobile assinada identificada para um rollback de loja.

Após resolver os bloqueios: validar as correções em ambiente isolado com navegador, concluir revisão/CI do commit exato, integrar somente PRs necessários e promover Backend compatível → Functions **somente se o código runtime mudou** → Web → Mobile, se aplicável. Preservar settings/secrets e owners; não executar Terraform apply/destroy/import, exclusão de MongoDB ou migração destrutiva. Revalidar login/cookies, preflight, ownership, 202/lease/fila/persistência/COMPLETED/notificação/histórico e os destinos separados. Rollback utiliza o artefato/commit anterior e mantém dados aditivos; não apaga medições.

## Respostas finais

- **US42 100% implementada?** O escopo está presente, mas não há aprovação de 100%: foram encontrados defeitos corrigidos em PR e pendências de segurança/QA.
- **100% integrada ao GitHub?** A implementação anterior sim; a revisão auditada ainda não, porque os cinco PRs corretivos permanecem abertos por segurança.
- **Web validado?** Testes/build/HTTP sim; validação visual obrigatória não.
- **Mobile validado?** Android e fluxo local descrito sim; iOS executado/distribuição e aprovação de segurança completa não.
- **Backend atualizado?** Render e Azure receberam o SHA anterior da principal; ainda não receberam a correção CORS. O Azure rejeita IoT por HTTPS/proxy.
- **Azure App Service atualizado?** Deploys de código constatados; LoginAPI não aprovada funcionalmente e inspeção IAM/configuração incompleta. Math passou no smoke, sem o lockfile corretivo ainda.
- **Mensageria funcionando?** Sim, comprovada no runtime isolado e em Azure/Render/Atlas reais com emissor virtual; código Function corresponde à principal.
- **Sistema pronto?** **Não. BLOCKED.**
- **Falta o quê?** Navegador e QA Web completa; conclusão da configuração HTTPS/proxy e inspeção Azure; comprovação da revogação dos segredos históricos; tratamento dos riscos residuais de ferramentas; revisão/integração dos PRs, promoção apenas necessária e smoke/QA após promoção. Hardware/iOS não executados permanecem limites explícitos, sem provas inventadas.
