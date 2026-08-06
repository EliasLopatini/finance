# Finanças — controle financeiro pessoal

App pessoal (PWA) para controlar suas finanças, com visual inspirado no Nubank
(trocando o roxo pelo vermelho), importação de extrato do Sicredi (.ofx) e um
painel informativo de investimentos.

Tudo roda **100% no navegador**: os dados ficam salvos no `localStorage` do
seu iPhone, dentro do próprio app instalado. Nada é enviado para nenhum
servidor (o GitHub Pages só serve os arquivos estáticos).

## Como publicar no GitHub Pages

1. Crie um repositório novo no GitHub (pode ser privado ou público — como os
   dados ficam só no seu aparelho, tanto faz para a privacidade financeira,
   mas privado evita que outras pessoas vejam o código).
2. Suba todos os arquivos desta pasta para a raiz do repositório (mantenha a
   estrutura de pastas `css/`, `js/`, `icons/`).
3. No repositório, vá em **Settings → Pages**.
4. Em "Source", selecione a branch `main` e a pasta `/ (root)`. Salve.
4. Aguarde 1–2 minutos. O GitHub vai te dar uma URL do tipo:
   `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`

## Como instalar no iPhone (virar PWA)

1. Abra a URL do passo anterior no **Safari** do iPhone (precisa ser Safari,
   não funciona pelo Chrome no iOS).
2. Toque no ícone de compartilhar (quadrado com seta para cima).
3. Toque em **"Adicionar à Tela de Início"**.
4. Pronto — vai aparecer um ícone vermelho na tela do seu iPhone, abrindo em
   tela cheia como um app nativo.

## Como usar

- **Importar**: no site/app do Sicredi, exporte o extrato em formato **OFX**
  (geralmente em Extrato → Exportar → OFX) e importe pelo app, na aba
  "Importar". Ele mostra uma pré-visualização antes de confirmar e pula
  automaticamente lançamentos que você já importou antes (usando o
  identificador único de cada transação do próprio banco).
- **Categorias**: são atribuídas automaticamente por palavra-chave (iFood →
  Alimentação, Uber → Transporte, etc). Toque em qualquer lançamento para
  trocar a categoria manualmente.
- **Investimentos**: mostra Selic, CDI e IPCA atuais (dados públicos do Banco
  Central) e um simulador comparando Poupança, CDB e Tesouro Selic. É só
  educativo/informativo — não é recomendação personalizada.

## Limitações importantes

- Os dados ficam salvos **só naquele navegador/aparelho**. Se você trocar de
  iPhone ou apagar os dados do Safari, o histórico se perde. Não há backup
  automático (dá para evoluir isso depois, se quiser).
- O app não se conecta à conta do Sicredi automaticamente — a importação é
  sempre manual, via arquivo OFX que você baixa e anexa.
- As taxas de investimento dependem de internet (API pública do Banco
  Central). Sem conexão, o app continua funcionando normalmente para o resto
  (extrato, importação, dashboard), só essa aba fica sem dados atualizados.

## Estrutura de arquivos

```
index.html          página única (dashboard, extrato, importar, investimentos)
css/style.css        visual estilo Nubank em vermelho
js/app.js             estado, navegação, categorização, renderização
js/ofx-parser.js       leitor de arquivos .ofx
js/investments.js      busca de taxas (BCB) + simulador
manifest.json         configuração do PWA
sw.js                 service worker (funcionamento offline)
icons/                ícones do app
```
