// Search for Kostya in Airtable and show ALL fields
const AIRTABLE_PAT = process.env.AIRTABLE_PAT || '';
const BASE_ID = 'app70wZOSKU5xSoGX';
const TABLE_ID = 'tbl9b8G7z2Ceks72Y';

async function main() {
  // Search for records containing "Кост" in name
  const formula = encodeURIComponent(`SEARCH("Кост", {Название})`);
  const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?filterByFormula=${formula}&maxRecords=10`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${AIRTABLE_PAT}` },
  });
  const data = await res.json();
  
  console.log(`Found ${data.records?.length || 0} records matching "Кост"\n`);
  
  for (const rec of (data.records || [])) {
    console.log(`=== ${rec.fields['Название']} (${rec.id}) ===`);
    for (const [key, value] of Object.entries(rec.fields).sort()) {
      const val = typeof value === 'object' ? JSON.stringify(value) : value;
      console.log(`  "${key}" => ${val}`);
    }
    console.log('');
  }

  // Also check if ANY record has an Email-like field
  console.log('\n=== Checking ALL records for email-like fields ===');
  const url2 = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?maxRecords=100`;
  const res2 = await fetch(url2, { headers: { Authorization: `Bearer ${AIRTABLE_PAT}` } });
  const data2 = await res2.json();
  
  const allFields = new Set();
  let emailFound = 0;
  for (const rec of data2.records) {
    for (const key of Object.keys(rec.fields)) {
      allFields.add(key);
      if (key.toLowerCase().includes('mail') || key.toLowerCase().includes('почт') || key.toLowerCase().includes('email')) {
        emailFound++;
        console.log(`  Found "${key}" in record "${rec.fields['Название']}": ${rec.fields[key]}`);
      }
    }
  }
  console.log(`\nTotal records checked: ${data2.records.length}`);
  console.log(`Records with email-like field: ${emailFound}`);
  console.log(`\nALL unique field names across ${data2.records.length} records:`);
  [...allFields].sort().forEach(f => console.log(`  - ${f}`));
  
  process.exit(0);
}
main();
