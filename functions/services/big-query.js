import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery();

// ✅ CONFIGURAZIONE PER IL CONTROLLO DEL FREE TIER
const BILLING_TABLE = `familytasktracker-c2dfe.gcp_billing_export_v1_015509_B48C2F_A679B0`; // 👈 SOSTITUISCI CON IL TUO ID TABELLA
const FREE_TIER_LIMIT = 1000000; // 1 Milione di caratteri
export const USAGE_THRESHOLD = 0.85; // Si blocca al 95% della soglia (950,000 caratteri)


export async function getTtsCharacterCount() {
  const query = `
      SELECT SUM(usage.amount) as total_chars
      FROM \`${BILLING_TABLE}\`
      WHERE service.description = 'Cloud Text-to-Speech API'
      AND usage_start_time >= TIMESTAMP_TRUNC(CURRENT_TIMESTAMP(), MONTH)
      AND usage.unit = 'characters'
  `;

  try {
    const [job] = await bigquery.createQueryJob({ query });
    console.log(`📊 Eseguo job BigQuery: ${job.id}`);
    const [rows] = await job.getQueryResults();

    if (rows.length > 0 && rows[0].total_chars) {
      return rows[0].total_chars;
    }
    return 0; // Nessun utilizzo registrato questo mese
  } catch (error) {
    console.error('❌ Errore durante la query a BigQuery:', error);
    // In caso di errore nella verifica, blocca la richiesta per sicurezza
    return FREE_TIER_LIMIT; 
  }
}