// Generates a VAPID keypair for Web Push. Run with:
//   npm run generate:vapid
// or
//   npx tsx scripts/generate-vapid-keys.ts
//
// Prints the keys to stdout. The PRIVATE key is secret — store only in env vars.

import webpush from 'web-push';

const keys = webpush.generateVAPIDKeys();

console.log('Add these to your backend environment:\n');
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log(`VAPID_SUBJECT=mailto:admin@simp.app`);
console.log('\nThe PRIVATE key must be kept secret. Do not commit it to git.');
