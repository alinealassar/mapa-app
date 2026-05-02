# Auto-commit hook do MAPA
# Roda automaticamente depois que Claude termina cada turno.
# Se houver mudanças no projeto, faz git add + commit + push pra main.
# Falha silenciosamente se algo der errado (não trava o turno).

$ErrorActionPreference = 'SilentlyContinue'

$repo = 'C:\Users\aline\Documents\projetos\mapa-app'

# Sai se a pasta do projeto não existir (proteção extra)
if (-not (Test-Path $repo)) {
    exit 0
}

Set-Location $repo

# Verifica se há mudanças não comitadas
$changes = git status --porcelain 2>$null

if (-not $changes) {
    # Nada pra commitar — sai sem fazer nada
    exit 0
}

# Monta mensagem com timestamp
$timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm'
$msg = "auto: atualizacao da sessao Claude ($timestamp)"

# Stage + commit + push (todos com supressão de erro pra não travar o turno)
git add -A 2>$null
git commit -m $msg 2>$null
git push origin main 2>$null

exit 0
