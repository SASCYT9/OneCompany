fetch('http://localhost:3001/api/shop/cart')
  .then(res => res.text())
  .then(console.log)
  .catch(console.error)
  .finally(() => process.exit(0));
