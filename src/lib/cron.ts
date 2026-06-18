import cron from 'node-cron';
import { runAllScrapers } from '@/scrapers';

let isRunning = false;

export function startCronJob() {
  if (process.env.CRON_ENABLED !== 'true') {
    console.log('[Cron] Disabled via CRON_ENABLED env var');
    return;
  }

  cron.schedule('0 * * * *', async () => {
    if (isRunning) {
      console.log('[Cron] Previous job still running, skipping');
      return;
    }

    isRunning = true;
    console.log('[Cron] Starting sync...');

    try {
      const result = await runAllScrapers();
      console.log(`[Cron] Sync complete: ${result.total} total, ${result.new} new, ${result.updated} updated`);
      if (result.errors.length > 0) {
        console.log(`[Cron] Errors: ${result.errors.join(', ')}`);
      }
    } catch (error) {
      console.error('[Cron] Sync failed:', error);
    } finally {
      isRunning = false;
    }
  });

  console.log('[Cron] Scheduled hourly sync');
}
