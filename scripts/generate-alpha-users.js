const accounts = [
  { name: "India Radio", wallet: "SPWC8WEDY5N5DJXCDAR8X5ANNQFJNXK4B4WKCWRM" },
  { name: "Andy", wallet: "SP15JWQG030Z9ZR9W3QNDY6EBQMPDTBZT9NQ0948P" },
  { name: "Felix", wallet: "SP25S5J6H5J09PC8VNK34EZVV3Q10HE7R7DWWRYV0" },
  { name: "edm.nyc", wallet: "SP3SRDEWCN6X3W9F9A8AY4XG1S82PN5F2GKMDXA05" },
  { name: "felix video", wallet: "SP1SM7KFN4MEW0QX4564GZREA8AZQBW4W9RGZ4PJW" },
  { name: "felix radio curation", wallet: "SP2V2M3X338BR7VF7XJ863C4MYYK3RV6HQYEK0D0T" }
];

function generateInviteCode(name) {
  const prefix = "MIXMI-";
  const num = Math.floor(Math.random() * 9) + 1;
  const cleanName = name.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
  const suffix = Math.random().toString(36).substring(2, 4).toUpperCase();
  return prefix + num + cleanName + suffix;
}

console.log("-- SQL to insert new alpha users\n");
console.log("INSERT INTO alpha_users (wallet_address, artist_name, invite_code, is_active, created_at)");
console.log("VALUES");

const values = accounts.map((acc, i) => {
  const code = generateInviteCode(acc.name);
  acc.code = code;
  const comma = i < accounts.length - 1 ? "," : ";";
  return "  ('" + acc.wallet + "', '" + acc.name + "', '" + code + "', true, NOW())" + comma;
});

console.log(values.join("\n"));

console.log("\n\n-- Reference Table:");
console.log("-- Artist Name              | Wallet Address                              | Invite Code");
console.log("-- " + "-".repeat(90));
accounts.forEach(acc => {
  const paddedName = (acc.name + "                         ").slice(0, 25);
  console.log("-- " + paddedName + " | " + acc.wallet + " | " + acc.code);
});
