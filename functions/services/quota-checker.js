import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery({ location: 'EU' });

// ✅ CONFIGURAZIONE
const BILLING_TABLE = `familytasktracker-c2dfe.billing_export.gcp_billing_export_v1_015509_B48C2F_A679B0`;
export const FREE_TIER_LIMIT = 1000000; // 1 Milione di caratteri
export const USAGE_THRESHOLD = 0.85; // Si blocca all'85% (850,000 caratteri)

// ✅ CACHE GIORNALIERO (persiste per tutta la durata dell'istanza Cloud Function)
let dailyQuotaCache = {
  date: null,
  month: null,
  isBlocked: false,
  charactersUsed: 0,
  lastChecked: null
};

// ✅ QUERY SUPER OTTIMIZZATA - restituisce solo true/false
async function checkTtsQuotaBigQuery() {
  const query = `
    SELECT 
      CASE 
        WHEN COALESCE(SUM(usage.amount), 0) >= ${Math.floor(FREE_TIER_LIMIT * USAGE_THRESHOLD)}
        THEN true 
        ELSE false 
      END as quota_exceeded,
      COALESCE(SUM(usage.amount), 0) as total_chars
    FROM \`${BILLING_TABLE}\`
    WHERE service.description = 'Cloud Text-to-Speech API'
    AND usage_start_time >= TIMESTAMP_TRUNC(CURRENT_TIMESTAMP(), MONTH)
    AND usage.unit = 'characters'
  `;

  try {
    console.log(`📊 Eseguo controllo quota BigQuery (location: EU)...`);
    const [job] = await bigquery.createQueryJob({ 
      query: query,
      location: 'EU'
    });
    
    const [rows] = await job.getQueryResults();
    
    if (rows.length > 0) {
      const quotaExceeded = rows[0].quota_exceeded;
      const totalChars = parseInt(rows[0].total_chars || 0);
      
      console.log(`✅ BigQuery check completato:`);
      console.log(`   📊 Caratteri utilizzati: ${totalChars.toLocaleString()}`);
      console.log(`   🎯 Soglia (${(USAGE_THRESHOLD * 100)}%): ${(FREE_TIER_LIMIT * USAGE_THRESHOLD).toLocaleString()}`);
      console.log(`   🚫 Quota superata: ${quotaExceeded ? 'SÌ' : 'NO'}`);
      
      return {
        quotaExceeded: quotaExceeded,
        charactersUsed: totalChars
      };
    }
    
    return {
      quotaExceeded: false,
      charactersUsed: 0
    };
    
  } catch (error) {
    console.error('❌ Errore BigQuery:', error.message);
    // In caso di errore, NON bloccare il servizio (fail-safe)
    return {
      quotaExceeded: false,
      charactersUsed: 0,
      error: true
    };
  }
}

// ✅ FUNZIONE PRINCIPALE - controlla cache giornaliero
export async function isDailyQuotaExceeded() {
  const now = new Date();
  const today = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
  
  // ✅ CONTROLLO SE È UN NUOVO MESE (riabilita il servizio)
  if (dailyQuotaCache.month && dailyQuotaCache.month !== currentMonth) {
    console.log(`🔄 Nuovo mese rilevato (${currentMonth}). Reset quota.`);
    dailyQuotaCache = {
      date: null,
      month: currentMonth,
      isBlocked: false,
      charactersUsed: 0,
      lastChecked: null
    };
  }
  
  // ✅ CONTROLLO SE È GIÀ STATO FATTO IL CHECK OGGI
  if (dailyQuotaCache.date === today) {
    console.log(`💾 Uso cache giornaliero: quota ${dailyQuotaCache.isBlocked ? 'SUPERATA' : 'OK'} (${dailyQuotaCache.charactersUsed.toLocaleString()} chars)`);
    return {
      quotaExceeded: dailyQuotaCache.isBlocked,
      charactersUsed: dailyQuotaCache.charactersUsed,
      fromCache: true,
      lastChecked: dailyQuotaCache.lastChecked
    };
  }
  
  // ✅ PRIMO CHECK DEL GIORNO - esegui query BigQuery
  console.log(`🔍 Primo check del giorno ${today}. Controllo BigQuery...`);
  
  const result = await checkTtsQuotaBigQuery();
  
  // ✅ AGGIORNA CACHE GIORNALIERO
  dailyQuotaCache = {
    date: today,
    month: currentMonth,
    isBlocked: result.quotaExceeded,
    charactersUsed: result.charactersUsed,
    lastChecked: now.toISOString()
  };
  
  console.log(`💾 Cache aggiornato per ${today}: quota ${result.quotaExceeded ? 'SUPERATA' : 'OK'}`);
  
  return {
    quotaExceeded: result.quotaExceeded,
    charactersUsed: result.charactersUsed,
    fromCache: false,
    lastChecked: dailyQuotaCache.lastChecked,
    error: result.error || false
  };
}

// ✅ FUNZIONE PER RESET MANUALE (se necessario)
export function resetDailyQuotaCache() {
  console.log(`🔄 Reset manuale cache quota`);
  dailyQuotaCache = {
    date: null,
    month: null,
    isBlocked: false,
    charactersUsed: 0,
    lastChecked: null
  };
}

// ✅ FUNZIONE PER DEBUG/STATUS
export function getQuotaCacheStatus() {
  return {
    ...dailyQuotaCache,
    cacheAge: dailyQuotaCache.lastChecked ? 
      Math.floor((Date.now() - new Date(dailyQuotaCache.lastChecked).getTime()) / 1000 / 60) + ' minuti' : 
      'Mai controllato'
  };
}