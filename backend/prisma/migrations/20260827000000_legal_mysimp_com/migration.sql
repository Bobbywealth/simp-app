-- Data-only migration: rebrand the contact emails on the published
-- ToS + Privacy Policy rows from @simp.app to @mysimp.com.
--
-- Per Bobby: SIMP only uses mysimp.com — no other domains. The seed
-- in src/legal/seedLegal.ts only inserts new (type, version) rows and
-- never updates existing ones (so the historical "what the user
-- agreed to" record is preserved). The live /legal/* endpoints read
-- straight from this table, so a one-shot UPDATE here gets the
-- published pages in sync without bumping the version (which would
-- force every signed-in user to re-accept the ToS).
--
-- `simp.app` does not appear as a substring anywhere else in the
-- legal content (only as part of email addresses like legal@simp.app),
-- so a literal REPLACE is safe. Verified via grep over LEGAL_DOCUMENTS
-- in src/legal/legalContent.ts.

UPDATE "TosVersion"
SET
    "content"  = REPLACE("content",  'simp.app', 'mysimp.com'),
    "summary"  = REPLACE("summary",  'simp.app', 'mysimp.com')
WHERE "content" LIKE '%simp.app%'
   OR "summary" LIKE '%simp.app%';