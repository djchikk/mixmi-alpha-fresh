// 🎫 SUGGEST INVITE CODES FOR ALPHA USERS
// Run this to get suggested codes for your users

// Generate alpha invite code in format: MIXMI-ABC123
function generateInviteCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const randomPart = Array.from({ length: 6 }, () => 
    chars.charAt(Math.floor(Math.random() * chars.length))
  ).join('');
  return `MIXMI-${randomPart}`;
}

console.log('🎫 SUGGESTED ALPHA INVITE CODES\n');
console.log('Use these codes for your 5 alpha users:\n');

// Generate 5 unique codes
const codes = new Set();
while (codes.size < 5) {
  codes.add(generateInviteCode());
}

const codeArray = Array.from(codes);
codeArray.forEach((code, i) => {
  console.log(`User ${i + 1}: ${code}`);
});

console.log('\n📝 SQL UPDATE COMMANDS:');
console.log('Copy these into Supabase after running add-invite-codes.sql:\n');

// Show SQL update commands template
codeArray.forEach((code, i) => {
  console.log(`-- User ${i + 1}`);
  console.log(`UPDATE alpha_users SET invite_code = '${code}' WHERE wallet_address = 'YOUR_USER_${i + 1}_WALLET';`);
  console.log('');
});

console.log('🔐 SECURITY BENEFIT:');
console.log('✅ Forms will show "Enter alpha invite code" instead of wallet addresses');
console.log('✅ Backward compatibility: Backend accepts both codes AND wallets');
console.log('✅ No sensitive wallet addresses visible in UI');