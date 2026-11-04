/* Additive-only demo fixture seed. Existing users, credentials and histories are never replaced. */
const { Client } = require('pg');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const profiles = JSON.parse(fs.readFileSync(path.join(__dirname,'../prisma/fixtures/testing-profiles.json'),'utf8'));
const apply = process.argv.includes('--apply');
const hobbies = [
 ['coffee','books','travel'],['hiking','fitness','photography'],['cooking','music','movies'],['art','museums','travel'],['dogs','coffee','outdoors'],['food','dancing','music'],['tennis','fitness','travel'],['books','art','coffee'],['gaming','movies','cooking'],['yoga','hiking','photography'],
];
const scenes = ['finding the best neighborhood coffee shop','a weekend hike followed by brunch','trying a new recipe and sharing the results','a museum visit and live jazz','a park walk with a really good conversation','finding a hidden-gem dinner spot','a friendly game and a spontaneous day trip','bookstores and a quiet cafe','a movie night with homemade snacks','sunset photos and a relaxed walk'];
const cities = ['Bloomfield','Montclair','Newark','Hoboken','Jersey City','New York'];
async function run(){
 if(!process.env.DATABASE_URL)throw Error('DATABASE_URL is required');
 if(profiles.length!==60||profiles.filter(x=>x.gender==='WOMAN').length!==30||profiles.filter(x=>x.gender==='MAN').length!==30||new Set(profiles.map(x=>x.email)).size!==60)throw Error('Fixture balance invariant failed');
 for(const row of profiles)if(!/^testing-(women|men)-\d{2}@simp-seed\.demo$/.test(row.email))throw Error('Refusing non-demo identity');
 const client=new Client({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_URL.includes('render.com')?{rejectUnauthorized:false}:undefined});await client.connect();
 try {
  const existing=await client.query('SELECT email FROM "User" WHERE email = ANY($1::text[])',[profiles.map(p=>p.email)]);
  if(!apply){console.log(JSON.stringify({mode:'dry-run',total:60,new:60-existing.rowCount,existingUntouched:existing.rowCount}));return;}
  await client.query('BEGIN');await client.query("SELECT pg_advisory_xact_lock(hashtext('simp-testing-pool-v1'))");let added=0,skipped=0;
  for(const row of profiles){
   const id=randomUUID();const insert=await client.query(`INSERT INTO "User" (id,email,"passwordHash","emailVerified","emailVerifiedAt","ageConfirmedAt","onboardingStep","onboardingCompletedAt","onboardingState",presence,"updatedAt") VALUES ($1,$2,'!disabled-demo-fixture',true,NOW(),NOW(),7,NOW(),'{}'::jsonb,'offline',NOW()) ON CONFLICT(email) DO NOTHING RETURNING id`,[id,row.email]);
   if(!insert.rowCount){skipped++;continue;}
   const i=row.index;const age=24+(i%15);const birth=new Date(Date.UTC(new Date().getUTCFullYear()-age,0,15));
   const bio=`DEMO PROFILE — sample account for testing only, not a real dating member. I enjoy ${scenes[i%scenes.length]}. Try exploring our shared interests and sending a practice like.`;
   await client.query(`INSERT INTO "Profile" (id,"userId","displayName",bio,"birthDate",gender,"lookingFor",city,occupation,"heightCm","profileCompletedAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW())`,[randomUUID(),id,row.displayName,bio,birth,row.gender,row.lookingFor,cities[i%cities.length],['Designer','Teacher','Engineer','Chef','Photographer','Nurse','Architect','Writer','Entrepreneur','Researcher'][i%10],row.gender==='WOMAN'?158+i%18:173+i%20]);
   await client.query(`INSERT INTO "Photo" (id,"userId",url,position,status,width,height,"updatedAt") VALUES ($1,$2,$3,0,'APPROVED',128,128,NOW())`,[randomUUID(),id,'https://mysimp.com'+row.photo]);
   await client.query(`INSERT INTO "DiscoveryPreference" (id,"userId","minAge","maxAge","locationLat","locationLng","locationPrecisionKm","updatedAt") VALUES ($1,$2,18,99,$3,$4,10,NOW())`,[randomUUID(),id,40.80+(i%6)*0.008,-74.18+(i%6)*0.015]);
   await client.query(`INSERT INTO "NotificationPreference" (id,"userId",marketing,"updatedAt") VALUES ($1,$2,false,NOW())`,[randomUUID(),id]);
   for(const [position,question,answer] of [[0,'A perfect weekend',`Demo scenario: ${scenes[i%scenes.length]}.`],[1,'An easy conversation starter','Ask me about the interests on this test profile.'],[2,'What to know before matching','This is a labeled sample account for safe product testing, not a real person seeking dates.']])await client.query(`INSERT INTO "Prompt" (id,"userId",question,answer,position,"updatedAt") VALUES ($1,$2,$3,$4,$5,NOW())`,[randomUUID(),id,question,answer,position]);
   for(const slug of hobbies[i%hobbies.length]){const interest=await client.query(`INSERT INTO "Interest" (id,slug,label) VALUES ($1,$2,$3) ON CONFLICT(slug) DO UPDATE SET slug=EXCLUDED.slug RETURNING id`,[randomUUID(),slug,slug[0].toUpperCase()+slug.slice(1)]);await client.query(`INSERT INTO "UserInterest" ("userId","interestId") VALUES ($1,$2) ON CONFLICT DO NOTHING`,[id,interest.rows[0].id]);}
   added++;
  }
  const verify=await client.query(`SELECT p.gender,COUNT(*)::int count FROM "User" u JOIN "Profile" p ON p."userId"=u.id WHERE u.email=ANY($1::text[]) GROUP BY p.gender`,[profiles.map(p=>p.email)]);
  if(verify.rows.some(r=>r.count!==30)||verify.rows.length!==2)throw Error('Post-seed balance verification failed');
  await client.query('COMMIT');console.log(JSON.stringify({mode:'applied',added,existingUntouched:skipped,verified:verify.rows,credentialPolicy:'New fixture accounts cannot log in; use existing test accounts to explore.'}));
 }catch(e){await client.query('ROLLBACK').catch(()=>{});throw e}finally{await client.end()}
}
run().catch(e=>{console.error(e.message);process.exit(1)});
