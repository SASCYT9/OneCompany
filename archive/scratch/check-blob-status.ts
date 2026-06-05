async function main() {
  const url = 'https://rfip333zgtfizdii.public.blob.vercel-storage.com/media/library/urban/urb-sid-26006229-v1.png';
  console.log(`Checking URL: ${url}`);
  try {
    const res = await fetch(url, { method: 'HEAD' });
    console.log(`Status: ${res.status} ${res.statusText}`);
    console.log('Headers:');
    res.headers.forEach((val, key) => {
      console.log(`  ${key}: ${val}`);
    });
  } catch (err: any) {
    console.error('Error fetching URL:', err.message);
  }
}

main();
