function isPrime(n) {
  if (n < 2) return false;
  for (let i = 2; i * i <= n; i++) {
    if (n % i === 0) return false;
  }
  return true;
}

for (let n = 2; n <= 30; n++) {
  if (isPrime(n)) {
    console.log(n);
  }
}
