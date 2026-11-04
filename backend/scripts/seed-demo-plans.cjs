/* Additive sample plans for the test accounts. Hosts are the non-loginable @simp-seed.demo fixtures;
   real members never see these (the API separates the two audiences). Dry run unless --apply. */
const { Client } = require('pg');
const { randomUUID } = require('node:crypto');
const apply = process.argv.includes('--apply');
const day = 86400000;
const at = (days, hourUtc) => { const d = new Date(Date.now() + days * day); d.setUTCHours(hourUtc, 0, 0, 0); return d; };
// [host email, title, category, city, venue, priceCents, capacity, startsAt, description, logistics]
const plans = [
  ['testing-women-02', 'Rooftop Dinner & Skyline', 'DINNER', 'Jersey City', 'Harborside terrace', 6500, 6, at(4, 23), 'A long table, shared plates and the best view of the Manhattan skyline.', 'Arrive 10 minutes early. Smart casual. Vegetarian options on request.'],
  ['testing-men-03', 'Jazz Night at the Blue Room', 'CONCERT', 'Newark', 'Ironbound listening room', 3500, 8, at(6, 1), 'A small live set, a few drinks, and good conversation between songs.', 'Doors at 8 PM. Standing room near the bar, a few seats up front.'],
  ['testing-women-05', 'Sunrise Hike & Coffee', 'ADVENTURE', 'Montclair', 'Eagle Rock Reservation', 0, 6, at(8, 11), 'Easy 4 km loop for the sunrise view, then coffee and pastries nearby.', 'Wear sturdy shoes. We meet at the main lot and head out at 6:45 AM.'],
  ['testing-men-08', 'Rooftop Cocktails & Vinyl', 'DRINKS', 'Hoboken', 'Rooftop bar on Washington St', 2800, 6, at(5, 23), 'Craft cocktails with a vinyl set. Come as you are.', 'First round on the host. Open tab after that.'],
  ['testing-women-11', 'Pasta from Scratch', 'EVENT', 'Bloomfield', 'Host kitchen', 4500, 5, at(10, 22), 'We make fresh pasta and sauce together, then eat everything.', 'Aprons provided. Tell me about any allergies when you request a spot.'],
  ['testing-men-14', 'Gallery Opening & Late Dinner', 'EVENT', 'New York', 'Chelsea gallery district', 0, 8, at(12, 23), 'A new show opens, then we walk to a nearby spot for a late dinner.', 'Gallery is free. Dinner is split on the night.'],
  ['testing-women-17', 'Weekend Escape to the Catskills', 'TRAVEL', 'New York', 'Meet at Port Authority', 18000, 4, at(21, 14), 'Two nights in a cabin, long walks and a fire pit. Four spots only.', 'Cabin and one group dinner included. Carpool from the city.'],
  ['testing-men-20', 'Sneaker & Vintage Shopping Crawl', 'SHOPPING', 'Brooklyn', 'Williamsburg and Greenpoint', 0, 6, at(7, 17), 'Browse the best thrift and sneaker shops, with coffee stops in between.', 'We walk about 3 km. Bring a tote bag.'],
  ['testing-women-23', 'VIP Table at the Skyline Lounge', 'VIP', 'New York', 'Midtown lounge', 12000, 6, at(9, 2), 'A reserved table, bottle service and a good crowd. Dress up.', 'Dress code enforced. ID required.'],
  ['testing-men-26', 'Sunset Paddle & Tacos', 'ADVENTURE', 'Hoboken', 'Pier 13 launch', 3000, 8, at(14, 21), 'Kayak at golden hour, then tacos on the pier.', 'Gear included. Waterproof bag recommended.'],
];
async function run() {
  if (!process.env.DATABASE_URL) throw Error('DATABASE_URL is required');
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL.includes('render.com') ? { rejectUnauthorized: false } : undefined });
  await client.connect();
  try {
    const emails = plans.map((p) => `${p[0]}@simp-seed.demo`);
    const hosts = await client.query('SELECT id, email FROM "User" WHERE email = ANY($1::text[])', [emails]);
    const hostId = new Map(hosts.rows.map((r) => [r.email, r.id]));
    const missing = emails.filter((e) => !hostId.has(e));
    const toInsert = [];
    for (const p of plans) {
      const id = hostId.get(`${p[0]}@simp-seed.demo`);
      if (!id) continue;
      const exists = await client.query('SELECT 1 FROM "Experience" WHERE "hostId" = $1 AND title = $2', [id, p[1]]);
      if (!exists.rowCount) toInsert.push({ id, p });
    }
    if (!apply) { console.log(JSON.stringify({ mode: 'dry-run', wouldAdd: toInsert.length, missingHosts: missing })); return; }
    await client.query('BEGIN');
    for (const { id, p } of toInsert) {
      await client.query(
        `INSERT INTO "Experience" (id, title, description, category, city, "startsAt", "priceCents", currency, capacity, "isActive", "hostId", status, venue, logistics, "createdAt", "updatedAt")
         VALUES ($1,$2,$3,$4::"ExperienceCategory",$5,$6,$7,'USD',$8,true,$9,'OPEN',$10,$11,NOW(),NOW())`,
        [randomUUID(), p[1], `SAMPLE PLAN: ${p[8]}`, p[2], p[3], p[7], p[5] || null, p[6], id, p[4], p[9]],
      );
    }
    await client.query('COMMIT');
    console.log(JSON.stringify({ mode: 'applied', added: toInsert.length, alreadyThere: plans.length - toInsert.length - missing.length, missingHosts: missing }));
  } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; } finally { await client.end(); }
}
run().catch((e) => { console.error(e.message); process.exit(1); });
