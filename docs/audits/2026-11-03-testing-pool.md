# SIMP demo exploration pool

- 60 additive sample profiles: 30 women looking for men, 30 men looking for women; all ages 24–38.
- Names and bios explicitly label sample accounts. No identity-verification badges are fabricated.
- Each profile has a distinct portrait source, three prompts, three interests, a city and completed profile state.
- Portraits come from Random User Generator, which supplies application-testing data. Source URLs are recorded in prisma/fixtures/testing-profiles.json; files are hosted locally by SIMP.
- Discovery and interest-based exploration isolate reserved @simp-seed.demo/App Store review identities from real accounts. Direct cross-pool swipes are rejected too.
- Existing account passwords, profiles, swipes, matches and conversations are never replaced. The seeder skips an existing email entirely.
- New cards are login-disabled fixtures. Existing Kenji and Maya demo logins provide the two testing perspectives; their credentials are unchanged.
- Normal users and roles remain normal users; no test account receives admin access.
- Seed script: node scripts/seed-testing-pool.cjs --apply, from backend, with DATABASE_URL supplied securely. Default mode is a read-only dry run; writes are transactionally verified and advisory-locked.
- 143 regression tests pass before deployment. Production totals and both discovery decks must be verified after seeding.
