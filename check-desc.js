const { Client } = require('pg');
require('dotenv').config();
const client = new Client({ connectionString: process.env.DATABASE_URL });
(async () => {
  await client.connect();
  const res = await client.query(`SELECT COUNT(*)::int as total, COUNT(description)::int as with_desc FROM "JobOffer"`);
  console.log('Stats:', res.rows[0]);
  const sample = await client.query(`SELECT title, company, LEFT(description, 100) as desc_preview FROM "JobOffer" WHERE description IS NOT NULL LIMIT 3`);
  console.log('Sample with description:', sample.rows);
  await client.end();
})();
