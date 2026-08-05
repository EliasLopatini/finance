/**
 * Parser simples de OFX (formato SGML usado por bancos, incluindo Sicredi).
 * Não depende de bibliotecas externas — só regex, já que OFX geralmente
 * não fecha todas as tags individuais (SGML), mas os blocos <STMTTRN> costumam
 * vir fechados corretamente.
 */
const OfxParser = (() => {

  function getTag(block, tag) {
    // pega o conteúdo entre <TAG> e a próxima quebra de linha ou próxima tag <
    const re = new RegExp('<' + tag + '>([^<\\r\\n]*)', 'i');
    const m = block.match(re);
    return m ? m[1].trim() : '';
  }

  function parseOfxDate(raw) {
    // formato: YYYYMMDD[HHMMSS[.sss[:GMT]]]
    if (!raw || raw.length < 8) return null;
    const y = raw.substr(0, 4);
    const mo = raw.substr(4, 2);
    const d = raw.substr(6, 2);
    return `${y}-${mo}-${d}`;
  }

  function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return 'h' + Math.abs(hash);
  }

  /**
   * @param {string} text conteúdo bruto do arquivo .ofx
   * @returns {Array} lista de transações { id, date, description, amount, rawType }
   */
  function parse(text) {
    // normaliza quebras de linha
    const clean = text.replace(/\r\n/g, '\n');

    const blocks = clean.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi);
    if (!blocks) {
      throw new Error('Não encontrei lançamentos (tag <STMTTRN>) neste arquivo. Confirme se é um extrato OFX válido.');
    }

    const transactions = blocks.map(block => {
      const trnType = getTag(block, 'TRNTYPE');
      const dtPosted = getTag(block, 'DTPOSTED');
      const amtRaw = getTag(block, 'TRNAMT');
      const fitId = getTag(block, 'FITID');
      const name = getTag(block, 'NAME');
      const memo = getTag(block, 'MEMO');
      const checkNum = getTag(block, 'CHECKNUM');

      const amount = parseFloat(amtRaw.replace(',', '.')) || 0;
      const description = (name || memo || trnType || 'Lançamento').trim();
      const date = parseOfxDate(dtPosted);

      const id = fitId || simpleHash(`${dtPosted}|${amtRaw}|${description}|${checkNum}`);

      return {
        id,
        date,
        description,
        amount,
        rawType: trnType
      };
    }).filter(t => t.date && !isNaN(t.amount));

    // ordena por data desc
    transactions.sort((a, b) => (a.date < b.date ? 1 : -1));

    return transactions;
  }

  return { parse };
})();
