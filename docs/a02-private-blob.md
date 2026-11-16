# Imagens do CEOS no Blob privado

O container existente saceos02/ceos-files permanece privado. O gateway GET /assets/site/:name publica apenas as 12 ilustrações não sensíveis definidas em SiteAssets.js. Não há endpoint público de upload nem listagem. Tipo MIME fixo, limite de 4 MiB, timeout, cache e erros sem detalhes do provedor preservam a fronteira com o Storage.

O runtime utiliza ManagedIdentityCredential. Antes de habilitar, é necessário configurar identidade gerenciada no App Service e conceder Storage Blob Data Reader **somente no container ceos-files**, além dos ajustes abaixo. O backend não recebe chave do navegador e não gera SAS público. O frontend usa o rewrite /api/login existente e mantém os assets locais como fallback de disponibilidade.

Configurações privadas do servidor (nomes e valores públicos): AZURE_SITE_ASSETS_ACCOUNT=saceos02 e AZURE_SITE_ASSETS_CONTAINER=ceos-files. Deixar a conta ausente desabilita o gateway com 503, preservando o comportamento atual. Não adicionar Storage Account Key nem connection string em REACT_APP_*.

Upload administrativo: scripts/upload-site-assets.ps1 requer assinatura explícita e diretório público do frontend; usa Entra ID por padrão. O operador precisa de permissão de dados no container. O switch UseSharedKey é uma alternativa administrativa explícita, mantendo a chave somente na CLI. O script preserva todos os objetos existentes e cria apenas nomes ausentes com overwrite=false. Não altera permissões, retenção, container ou Storage Account.

Validação A02: o servidor local de POC leu as imagens reais, verificou hashes contra os arquivos públicos e confirmou bloqueio anônimo. Uma imagem ausente foi enviada sem sobrescrita. A POC administrativa usou uma chave apenas em memória do servidor; essa não é a autenticação prevista no runtime publicado. O frontend passou em 28 verificações de imagem/responsividade/monitoramento em três tamanhos. Não se deve declarar integração de produção até aprovar configuração, merge/deploy do backend, leitura do gateway e depois ativação do frontend.

Não há novo recurso com mensalidade fixa: reutiliza o Storage existente. Transações, poucos MiB adicionais e eventual transferência continuam sujeitos à tarifação normal; não se promete custo zero. Uma indisponibilidade do Blob mantém o fallback de imagens locais.
