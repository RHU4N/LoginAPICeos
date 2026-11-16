# Rotação coordenada da `CEOS_SERVICE_KEY` (sem janela de falha)

A `CEOS_SERVICE_KEY` autentica a Azure Function `func-ceos-iot-v0kc1f` na LoginAPI em três caminhos: ingresso v2 (`/iot/internal/prepare`), despacho do READ_ONCE (`/iot/internal/dispatch`) e Consumer (`/iot/internal/measurements`). Com `CEOS_SERVICE_KEY_PREVIOUS`, a LoginAPI aceita a chave nova **e** a anterior durante a troca, então a Function pode mudar depois sem 401 nem mensagens na poison.

**Não executar durante apresentações.** Cada alteração de App Setting reinicia o app (observado: 1–2 min de lentidão na LoginAPI).

## Pré-requisitos

1. Este PR mesclado e implantado (a LoginAPI precisa suportar `CEOS_SERVICE_KEY_PREVIOUS`).
2. Fila `ceos-iot-medicoes` em 0 e nenhuma solicitação READ_ONCE ativa.
3. Sessão PowerShell sem transcrição; **todo** comando `az ... appsettings set/delete` com `-o none` (sem isso a CLI imprime todos os App Settings com valores).

## Procedimento

```powershell
$L = '<assinatura de Leonardo>'; $R = '<assinatura IoT de Rhuan>'
$dir = Join-Path $env:LOCALAPPDATA ('rot-' + [guid]::NewGuid().ToString('N')); New-Item -ItemType Directory $dir | Out-Null
$acl = New-Object System.Security.AccessControl.DirectorySecurity; $acl.SetAccessRuleProtection($true, $false)
$acl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule([Security.Principal.WindowsIdentity]::GetCurrent().Name, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')))
Set-Acl $dir $acl

# 1) Nova chave (CSPRNG, 64 caracteres) e chave atual, somente em memória — nunca imprimir
$b = New-Object byte[] 48; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); $nova = [Convert]::ToBase64String($b)
$atual = az webapp config appsettings list --subscription $L -g rg-ceos-a02 -n loginapi-ceos --query "[?name=='CEOS_SERVICE_KEY'].value | [0]" -o tsv

# 2) LoginAPI aceita as duas (1 reinício)
ConvertTo-Json -InputObject @(@{ name = 'CEOS_SERVICE_KEY'; value = $nova; slotSetting = $false }, @{ name = 'CEOS_SERVICE_KEY_PREVIOUS'; value = $atual; slotSetting = $false }) |
  Set-Content "$dir\login.json" -Encoding UTF8
az webapp config appsettings set --subscription $L -g rg-ceos-a02 -n loginapi-ceos --settings "@$dir\login.json" -o none
#    Verificar: GET /health 200; Function ainda com a chave anterior continua funcionando (PUSH 202 e persistido).

# 3) Function passa a usar a nova (1 reinício da Function)
ConvertTo-Json -InputObject @(@{ name = 'CEOS_SERVICE_KEY'; value = $nova; slotSetting = $false }) | Set-Content "$dir\func.json" -Encoding UTF8
az functionapp config appsettings set --subscription $R -g rg-ceos-iot-v0kc1f -n func-ceos-iot-v0kc1f --settings "@$dir\func.json" -o none
#    Verificar: PUSH pelo botão verde persistido; "Solicitar leitura" até COMPLETED; fila 0; poison sem novas mensagens.

# 4) Encerrar a transição: remover a anterior (1 reinício)
az webapp config appsettings delete --subscription $L -g rg-ceos-a02 -n loginapi-ceos --setting-names CEOS_SERVICE_KEY_PREVIOUS -o none
#    Verificar de novo o PUSH e o READ_ONCE.

# 5) Limpeza
Remove-Item -Recurse -Force $dir; Remove-Variable nova, atual, b; [GC]::Collect()
```

Depois: atualizar o `.env`/`.secrets` **de desenvolvimento** com uma chave própria de desenvolvimento (não reutilizar a de produção).

## Verificação sem expor valores

- `GET https://loginapi-ceos.azurewebsites.net/health` → 200.
- Um evento PUSH do dispositivo pareado aparece no histórico do CEOS (202 sozinho não basta).
- Uma solicitação READ_ONCE chega a `COMPLETED`.
- Métricas: fila `QueueMessageCount` volta a 0; nenhuma mensagem nova em `ceos-iot-medicoes-poison`.

## Rollback

| Momento da falha | Ação |
|---|---|
| Após o passo 2 | Voltar `CEOS_SERVICE_KEY` da LoginAPI para a anterior e remover `CEOS_SERVICE_KEY_PREVIOUS` (a Function não mudou) |
| Após o passo 3 | Voltar a Function para a chave anterior (ainda aceita, pois `CEOS_SERVICE_KEY_PREVIOUS` existe) |
| Após o passo 4 | A anterior deixa de valer por desenho; se algo ainda a usar, recriar `CEOS_SERVICE_KEY_PREVIOUS` temporariamente |

Se a chave atual tiver sido exposta (incidente A da A02), não manter `CEOS_SERVICE_KEY_PREVIOUS` além do necessário para a troca.
