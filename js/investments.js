/**
 * Painel de investimentos — dados públicos e educativos.
 * Fonte: API SGS do Banco Central do Brasil (sem necessidade de chave/autenticação).
 * Isto NÃO é uma recomendação personalizada de investimento.
 */
const Investments = (() => {

  const SERIES = {
    selic: 432,   // Meta Selic (% a.a.)
    cdi: 12,      // CDI (% a.a. acumulado, série diária anualizada aproximada via 4392 tb ok)
    ipca12m: 13522 // IPCA acumulado 12 meses (%)
  };

  async function fetchSerie(code) {
    const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${code}/dados/ultimos/1?formato=json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Falha ao consultar BCB');
    const data = await res.json();
    return data[0]; // { data: 'dd/mm/aaaa', valor: 'x.xx' }
  }

  async function loadRates() {
    const [selic, cdi, ipca] = await Promise.allSettled([
      fetchSerie(SERIES.selic),
      fetchSerie(SERIES.cdi),
      fetchSerie(SERIES.ipca12m)
    ]);

    return {
      selic: selic.status === 'fulfilled' ? parseFloat(selic.value.valor) : null,
      cdi: cdi.status === 'fulfilled' ? parseFloat(cdi.value.valor) : null,
      ipca: ipca.status === 'fulfilled' ? parseFloat(ipca.value.valor) : null,
      updatedAt: selic.status === 'fulfilled' ? selic.value.data : null
    };
  }

  /**
   * Simulação simples de rendimento bruto (sem imposto de renda) para comparação educativa.
   * @param {number} valor
   * @param {number} meses
   * @param {object} rates {selic, cdi}
   */
  function simulate(valor, meses, rates) {
    const selicAA = rates.selic ?? 10.5;
    const cdiAA = rates.cdi ?? (selicAA - 0.1);

    // poupança: regra simplificada (0.5% a.m. + TR≈0 se Selic > 8.5% a.a., senão 70% da Selic a.a.)
    const poupancaAA = selicAA > 8.5 ? (Math.pow(1.005, 12) - 1) * 100 : selicAA * 0.7;

    const cdbAA = cdiAA * 1.0;       // CDB referência a 100% do CDI
    const tesouroSelicAA = selicAA - 0.1; // taxa custódia aproximada

    const toMonths = (aa) => Math.pow(1 + aa / 100, meses / 12) - 1;

    return [
      { name: 'Poupança', rateAA: poupancaAA, result: valor * (1 + toMonths(poupancaAA)) },
      { name: 'CDB (100% CDI)', rateAA: cdbAA, result: valor * (1 + toMonths(cdbAA)) },
      { name: 'Tesouro Selic', rateAA: tesouroSelicAA, result: valor * (1 + toMonths(tesouroSelicAA)) }
    ];
  }

  return { loadRates, simulate };
})();
