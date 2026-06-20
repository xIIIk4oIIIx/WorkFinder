// Test script to run the nofluffjobs scraper and check generated URLs
const { nofluffjobsScraper } = require('./src/scrapers/nofluffjobs');

nofluffjobsScraper.fetchJobs()
  .then(jobs => {
    console.log(`Scraped ${jobs.length} jobs`);
    
    if (jobs.length > 0) {
      console.log('First job:');
      console.log(JSON.stringify(jobs[0], null, 2));
      
      // Check if URL contains job/ or posting/
      const url = jobs[0].sourceUrl;
      console.log(`URL: ${url}`);
      if (url.includes('/pl/job/')) {
        console.log('✅ URL correctly uses /job/ path');
      } else if (url.includes('/pl/posting/')) {
        console.log('❌ URL still uses /posting/ path');
      } else {
        console.log('⚠️  URL uses unexpected path');
      }
    } else {
      console.log('No jobs scraped - this might be due to network issues or API changes');
    }
  })
  .catch(error => {
    console.error('Error running scraper:', error.message);
  });