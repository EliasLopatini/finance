# Caderneta — Controle Financeiro

App instalável (PWA) só seu, com saldo, entradas/saídas e importação de extratos em PDF.
Tudo roda no navegador — os dados ficam salvos **só no seu celular**, não vão pra nenhum servidor.

## Como hospedar (grátis)

Escolha uma opção. Depois de hospedado, abra o link no celular e instale.

### Opção 1 — GitHub Pages (recomendado)
1. Crie um repositório novo no GitHub (pode ser privado).
2. Suba todos os arquivos desta pasta (`index.html`, `styles.css`, `app.js`, `manifest.json`, `sw.js`, pasta `icons/`).
3. Vá em **Settings → Pages**, escolha a branch `main` e pasta `/root`.
4. Espere alguns minutos — o GitHub te dá um link tipo `https://seuusuario.github.io/seu-repo/`.

### Opção 2 — Netlify
1. Acesse netlify.com, arraste a pasta inteira no "Deploy manually".
2. Pronto, ele já te dá o link.

## Como instalar no celular

**Android (Chrome):** abra o link → menu (⋮) → "Adicionar à tela inicial" / "Instalar app".
**iPhone (Safari):** abra o link → botão de compartilhar → "Adicionar à Tela de Início".

Depois de instalado, abre como um app normal, com ícone próprio, sem barra de navegador.

## Importante sobre os dados

- Os dados ficam salvos no armazenamento local do navegador daquele celular/instalação.
- Se você desinstalar o app, limpar dados do navegador, ou trocar de celular, os dados **não vão junto** — por isso a aba Extrato tem um botão de **Exportar backup** (salva um `.json`) e **Restaurar backup**.
- Recomendo exportar um backup de vez em quando.

## Sobre a importação de PDF

Extratos de bancos têm formatos bem diferentes entre si. O app tenta reconhecer automaticamente linhas com data + valor, mas **sempre mostra uma tela de revisão antes de salvar** — confira se o tipo (entrada/saída), valor e descrição de cada linha estão certos, e desmarque o que não fizer sentido.

## Estrutura dos arquivos

```
index.html    → estrutura do app
styles.css    → visual (tema "caderneta")
app.js        → toda a lógica (dados, PDF, formulários)
manifest.json → configuração do PWA (nome, ícone)
sw.js         → cache offline
icons/        → ícones do app
```
