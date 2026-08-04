# Livro-Caixa — Controle Financeiro Pessoal

Site estático (HTML/CSS/JS puro, sem backend) para:
- Importar o extrato CSV do Sicredi e ver entradas, saídas e saldo resumidos.
- Ver categorias de gasto (Pix, boletos, cartão, etc. — detectadas por palavras-chave na descrição).
- Consultar indicadores públicos de mercado (Selic, CDI, IPCA, dólar, bitcoin) via APIs abertas.

Tudo roda no seu navegador. O CSV **não é enviado a nenhum servidor** — só fica na memória
e no `localStorage` do seu próprio navegador (para lembrar do último extrato importado).

## Como usar

1. No internet banking / app do Sicredi, exporte o extrato em **CSV**.
2. Abra o site e arraste o arquivo (ou clique para escolher).
3. Se as colunas não forem reconhecidas automaticamente, o site vai te perguntar qual coluna
   é "Data", "Descrição", "Valor" (ou "Entrada"/"Saída" separadas).

Como o formato exato do CSV pode variar por cooperativa/versão do internet banking, o parser
tenta reconhecer automaticamente cabeçalhos comuns (Data, Histórico, Descrição, Valor, Saldo)
e cai para uma tela de mapeamento manual se não conseguir — então funciona mesmo que o seu
arquivo tenha nomes de coluna um pouco diferentes.

## Sobre os indicadores de mercado

O painel "Indicadores do mercado" busca dados públicos em tempo real:
- **Selic e CDI**: API do Banco Central (SGS) — séries 432 e 4391.
- **IPCA 12 meses**: acumulado calculado a partir da série mensal 433 do SGS.
- **Dólar e Bitcoin**: AwesomeAPI (cotações públicas).

Isso é só um retrato do que o mercado está pagando agora — **não é recomendação de
investimento**. Nenhuma API "recomenda" o melhor investimento pra você, porque isso depende
do seu perfil de risco, prazo e objetivos. Se quiser, dá pra evoluir esse painel depois para
comparar esses indicadores com o rendimento de aplicações específicas suas.

Se algum código de série do Banco Central mudar ou parecer errado, os códigos oficiais podem
ser conferidos em https://www3.bcb.gov.br/sgspub — basta trocar o número no `script.js`
(função `loadInvestments`).

## Publicar no GitHub Pages

1. Crie um repositório novo no GitHub (pode ser privado, já que é uso pessoal).
2. Suba os 3 arquivos: `index.html`, `style.css`, `script.js`.
3. Vá em **Settings → Pages**, escolha a branch `main` e pasta `/ (root)`.
4. Aguarde alguns minutos — o site fica disponível em
   `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`.

> Dica: como o extrato tem dados financeiros sensíveis, mesmo o arquivo ficando só no seu
> navegador, prefira deixar o **repositório privado** no GitHub (Pages funciona normalmente
> com repositório privado se você tiver GitHub Pro, ou publique o código sem nunca commitar
> o CSV em si — o CSV nunca precisa ir pro repositório, só é lido localmente pelo navegador).

## Limitações conhecidas

- Categorização de gastos é por palavras-chave simples na descrição — ajuste as regras em
  `CATEGORY_RULES` no `script.js` conforme os nomes que aparecem no seu extrato.
- O parser assume valores em formato brasileiro (R$ 1.234,56) e datas dd/mm/aaaa.
