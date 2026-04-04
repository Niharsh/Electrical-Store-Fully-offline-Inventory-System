function generateLicenseKey(prefix = '') {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  
  function randomSegment(length = 4) {
    let segment = '';
    for (let i = 0; i < length; i++) {
      segment += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return segment;
  }
  
  if (prefix) {
    const p = prefix.toUpperCase().substring(0, 4).padEnd(4, 'X');
    return `${p}-${randomSegment()}-${randomSegment()}-${randomSegment()}`;
  }
  
  return `${randomSegment()}-${randomSegment()}-${randomSegment()}-${randomSegment()}`;
}

console.log('=== Choudhary Electrical Store - License Key Generator ===\n');

console.log('--- Standard Keys ---');
for (let i = 1; i <= 5; i++) {
  console.log(`Key ${i}: ${generateLicenseKey()}`);
}

console.log('\n--- Electrical Branded Keys ---');
for (let i = 1; i <= 5; i++) {
  console.log(`Key ${i}: ${generateLicenseKey('ELEC')}`);
}

console.log('\n=== Instructions ===');
console.log('1. Open the app');
console.log('2. Enter any key above in activation window');
console.log('3. License valid for 1 YEAR from activation');
console.log('\n=== Reset License ===');
console.log('Delete: %APPDATA%\\choudhary-electrical-store\\license.dat');