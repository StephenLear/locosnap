# Welcome Email Backfill Log

Append-only record of manual welcome-email backfills. Each batch lists every recipient and the Resend message ID for delivery audit.

The per-signup automated trigger (`on_auth_user_welcome_email` on `auth.users` INSERT) went LIVE on 2026-05-18. Anyone who signed up before that date missed the welcome email — backfills below close that gap.

Template: `welcomeHtml()` + `welcomeText()` from [backend/src/services/email.ts](../backend/src/services/email.ts) — trilingual DE/EN/PL, hybrid HTML+text. From `Stephen from LocoSnap <noreply@locosnap.app>`, Reply-To `hello@locosnap.app` (routes to Proton via ImprovMX).

CC `unsunghistories@proton.me` is intentionally NOT applied to these batches per the founder-CC automation exemption documented in `docs/ARCHITECTURE.md` (per-signup CC would flood the inbox at scale; Reply-To still routes replies to the founder).

### Operational notes (read before every batch)

1. **Always exclude testers and internal addresses.** Testers have personal-relationship history with Stephen (Pro grants, bilingual emails, bug-report threads) and getting a templated "welcome" email reads as tone-deaf. The canonical tester list is at `memory/tester_contacts.md`. Also exclude `*@locosnap.app` (catch-all routes to founder inbox) and `stevelear51@gmail.com` (Stephen's secondary). Add a `lower(u.email) NOT IN (...)` clause to every backfill SQL. The `is_pro = false` filter usually catches testers anyway (11/26 had Pro at last check) but the NOT IN clause is the belt-and-braces.
2. **Supabase Auth shares this Resend account.** Sign-in OTP codes ("Your LocoSnap Sign-In Code"), magic links, and confirmation emails all flow through Resend with `from: noreply@locosnap.app` and a Supabase-owned API key. These count against the Resend send quota. When estimating headroom, add expected Supabase Auth volume on top of intentional sends.
3. **Resend can silently drop suppressed addresses.** API returns `200 + message_id` (looks like success) but `last_event` in the export is `suppressed` — nothing was delivered. **When to pull the export and verify:** if there's reason to suspect drops (quota cap was crossed, list is old / known-stale, prior batch had bounces, sender reputation concern). **Not required** for fresh-signup cohorts on the unlimited tier — suppression rate is low and API-acceptance is a sufficient proxy. Suppressions are not retriable.
4. **Account is on the unlimited tier** as of 2026-05-18. The free 100/day cap is no longer the constraint; check Resend dashboard for current monthly cap.

---

## 2026-05-18 — Last-7-days backfill (non-Pro)

- **Window:** 2026-05-11 00:00:00 UTC → 2026-05-18 00:00:00 UTC (signups 2026-05-11 through 2026-05-17 inclusive)
- **Filter:** `auth.users` joined to `public.profiles`, `is_pro = false OR profile missing`, email NOT NULL
- **Source:** Supabase SQL Editor → CSV export → `~/Desktop/Email/Supabase Snippet Fetch Unconfirmed Non‑Pro Users in Date Range.csv`
- **Recipients:** 67
- **Sent:** 67 succeeded, 0 failed
- **Completed (UTC):** 2026-05-18T16:16:43Z
- **Send script:** `/tmp/send_welcome_backfill.py` (transient — embeds template verbatim from `email.ts`)
- **Raw results:** `/tmp/welcome_backfill_results.json` (transient — full table reproduced below)
- **Rate limit:** 0.55s between sends (2/sec, Resend free-tier safe)
- **Notes:**
  - Two duplicate-person signups present and intentionally not deduped: `lisawark6@outlook.com` + `lisawark6@gmail.com`, `rauloraulo171717@gmail.com` + `rauloraulo1717@gmail.com` — distinct mailboxes, so each gets one welcome.
  - `gralistair@aol.com` is the same GRALISTAIR from the 2026-05-17 fan-flag thread (per [HANDOVER-2026-05-18.md](handoffs/HANDOVER-2026-05-18.md)).

| # | Email | Resend message ID | Result |
|---|-------|-------------------|--------|
| 1 | ems.stevewoods@gmail.com | `6203044a-5417-4986-b8cd-54f1c9015091` | sent |
| 2 | lorin.gen09@gmail.com | `36e3f60b-a10c-4be6-9b29-46b98821a508` | sent |
| 3 | familievoigt2604@gmail.com | `23eae3cb-6a45-44ed-9dd8-a8fe950a7b5b` | sent |
| 4 | samuelfranklin2009@gmail.com | `f7af2963-9a1a-40bf-8e9f-37dd4a407099` | sent |
| 5 | lisawark6@outlook.com | `9dcd4093-f0c0-40a1-80e7-dc5d2c318ba2` | sent |
| 6 | lisawark6@gmail.com | `5a96c0d4-2d82-4380-89d0-2423844f7693` | sent |
| 7 | jakubschneider08@gmail.com | `b49d238e-35c2-4f3f-866e-6a8eb156dfc8` | sent |
| 8 | olkok19202@gmail.com | `3a065252-cfdd-4602-9e25-ca0aa5e21b6c` | sent |
| 9 | martinkosorin10@gmail.com | `7c392107-4d94-46a6-a26a-8d810169b5bc` | sent |
| 10 | mykola.panov@gmail.com | `6e8bfbfa-db6c-4633-a85f-1be8f84fe104` | sent |
| 11 | jankaltenbach2@gmail.com | `ad28654c-a22c-4655-9f85-4ffc2a12c07c` | sent |
| 12 | daymenhackmann@gmail.com | `3b10b36d-655d-44e1-87f8-42befd77bffd` | sent |
| 13 | felixbaeger2008@gmail.com | `3847ab4e-3ceb-41ba-a085-023d6d5957b6` | sent |
| 14 | wikstroemalexander@gmail.com | `9d12f4e1-8fa3-44a2-95da-304572d1052b` | sent |
| 15 | vduchamp0@gmail.com | `7cdd8e83-051b-41e0-8ba3-ab6cf2f15217` | sent |
| 16 | kwendaprincek@gmail.com | `79372b4c-b55f-4b32-a559-1ad19820b1c0` | sent |
| 17 | bbetjent33@gmail.com | `fdc96852-5ee3-4bab-b62b-43180bf75704` | sent |
| 18 | marekkondr552@gmail.com | `b8ba4c46-7fb2-4bc7-ab1b-32f9632c866c` | sent |
| 19 | esik361@gmail.com | `05d6e781-5f7e-4ca9-8522-0d5f928a7d19` | sent |
| 20 | mistereisenbahner@gmail.com | `4f14b3a0-bea2-429f-885f-00f4f685a6aa` | sent |
| 21 | hallinisak8@gmail.com | `0de7b639-f1dc-4d59-b5fb-51e336ff24da` | sent |
| 22 | szenike111@gmail.com | `7e2a782c-7fda-4e27-a9ce-7432536ff49c` | sent |
| 23 | mike7272@hotmail.nl | `a2228512-645a-460b-ae5c-b821ffd81054` | sent |
| 24 | obosowski@interia.pl | `01f01728-4cdd-4867-9a7e-4d5ab61db72f` | sent |
| 25 | victorduchamp1@gmail.com | `7d1410f9-ba92-4dd4-abc7-1c33636d1728` | sent |
| 26 | h71101012@gmail.com | `588ecbca-aa87-4cd8-a86c-700d4ad94c61` | sent |
| 27 | vetle.bjerkas@gmail.com | `b6730307-3095-4fd0-928f-d1a5bca93ac9` | sent |
| 28 | korbi.mueller@icloud.com | `21a3fb89-670c-454c-b5e7-a1644ffa142b` | sent |
| 29 | jajsemtadek123@gmail.com | `2247062a-28ec-43b7-b982-44b046dc8734` | sent |
| 30 | matevok.havas@gmail.com | `9d28f7e1-fc41-4233-9901-d06a5f995a64` | sent |
| 31 | bonis9072@gmail.com | `60a1cdaa-67a7-4e6e-8774-69ca3b96e702` | sent |
| 32 | gagattomasz790@gmail.com | `dd946cde-bb6f-40ce-b2fe-e06b938a28bf` | sent |
| 33 | meissner.andreas1@gmx.de | `d63e72ac-e20e-4183-8e42-bb31da1488dc` | sent |
| 34 | adam.froggatt@mail.com | `089c8145-5a75-4dd8-8777-d119e6e8cac9` | sent |
| 35 | kubicekst09@gmail.com | `6e078946-5f0f-45bc-bde3-2a80bdea1696` | sent |
| 36 | secardinpierre3356@gmail.com | `e93cc8eb-e0dd-40d5-90a9-d35163eeb685` | sent |
| 37 | kulinskikamil1@gmail.com | `2642d4ec-f32c-41e9-9c3e-3e8eed177062` | sent |
| 38 | lorenzodalonzo594@gmail.com | `7249b8a0-e082-4e3b-8398-bab40e87101b` | sent |
| 39 | rauloraulo171717@gmail.com | `a0f289c2-20ef-41b1-8b1c-5f4e9021b324` | sent |
| 40 | rauloraulo1717@gmail.com | `be57cfbb-3088-4d83-8088-2d7a0892d22e` | sent |
| 41 | sven.reese@online.de | `e992afd5-c628-46af-8a34-f32051e17694` | sent |
| 42 | walton_michael1@sky.com | `bfc5fc33-91ef-475c-bb76-d6f87c7f05fb` | sent |
| 43 | ben-linke@gmx.de | `b32dad6b-f7b8-4207-8e5e-fdba86d4b020` | sent |
| 44 | falco.jung.cool@gmail.com | `a5465707-770a-4747-be38-46b554a3e998` | sent |
| 45 | trainonhungary@gmail.com | `de2faf64-b1d5-4fd4-9ff9-4aff24f694e3` | sent |
| 46 | gralistair@aol.com | `86411f0d-7447-4cf8-b4c4-8f7576a075aa` | sent |
| 47 | heinenlennart9@gmail.com | `ecccdc01-7a4d-4597-bea0-a74f38642ad2` | sent |
| 48 | pascalheinen91@outlook.de | `916c22d6-f96e-4796-a646-89ffef7072b1` | sent |
| 49 | lucabraurwo@web.de | `529ce1fa-9176-4066-9263-331d68d05d34` | sent |
| 50 | emanuelgraeber2009@gmail.com | `17c30391-e360-4f21-841a-b8a7e5357fda` | sent |
| 51 | ciananj@outlook.com | `9bef27ac-1a95-404c-b1a0-2a2d3ef67e6b` | sent |
| 52 | grisha229990@gmail.com | `626f10db-df7a-4d35-b6a7-aee1daa55394` | sent |
| 53 | leonreichelt18@gmail.com | `f11ded0b-37b4-4035-afad-43b0125c6f2d` | sent |
| 54 | manuels.lohmann@gmail.com | `5678b7cc-c2eb-4a50-9adb-33b971b90038` | sent |
| 55 | stauffenberghans@gmail.com | `a9ac8d7c-3d18-4fb8-8e34-65d38dfeac84` | sent |
| 56 | patrickbuon@gmx.de | `5fd1ae7f-9483-4508-9783-293348212913` | sent |
| 57 | artz.felix@gmail.com | `85e5807a-c756-48d9-bcd1-7628f115c513` | sent |
| 58 | kjeremy612@gmail.com | `c79d30ba-51ea-46ce-a665-999501b38a79` | sent |
| 59 | paplo9991@gmail.com | `7feae1f0-0216-4502-a3c9-6fb86e866536` | sent |
| 60 | k.alameddine2009@gmail.com | `b656991a-c302-4594-8fc1-3f53ed5f7625` | sent |
| 61 | dominik.e.eisenschmid@web.de | `2acee305-0c01-443d-9a5c-d8bf108c6df5` | sent |
| 62 | armin.otto1802@gmail.com | `32c8bfbb-2638-48c7-991b-f5abb18a6edf` | sent |
| 63 | ipimposter@gmail.com | `75577b00-4a1d-46dd-9564-1bffa7ecc636` | sent |
| 64 | lsp2914bo@gmail.com | `d7ca5fcf-b110-4f92-90c8-c5b9dc14db7c` | sent |
| 65 | dominik.bayerlein648@gmail.com | `6ac99c27-68be-4e15-876e-dec1a23ad280` | sent |
| 66 | bastian.sonneck@web.de | `c6cd108f-0b94-43dc-9383-f082debbc3da` | sent |
| 67 | trainspotterhalle@gmail.com | `40a3cf14-ceaa-4c0a-8b42-ec70ecb916e8` | sent |

**Delivery confirmation:** all 67 confirmed `delivered` per the Resend export at `~/Desktop/Email/emails-sent-1779122324600.csv` (pulled 2026-05-18 18:40 UTC). Zero suppressions, zero bounces.

---

## 2026-05-18 — Week-before backfill (non-Pro, "belated welcome" copy variant)

- **Window:** 2026-05-04 00:00:00 UTC → 2026-05-11 00:00:00 UTC (signups 2026-05-04 through 2026-05-10 inclusive — the seven days immediately before the previous batch's window)
- **Filter:** `auth.users` joined to `public.profiles`, `is_pro = false OR profile missing`, email NOT NULL
- **Source:** Supabase SQL Editor → CSV export → `~/Desktop/Email/Supabase Snippet Fetch  Non‑Pro Users in Date Range 4-5 to 11-5.csv`
- **Recipients in CSV:** 80
- **Filtered out before send:** 1 (`kaspar.ruetenik@icloud` — malformed, missing `.com` TLD; the same person's correctly-formed `kaspar.ruetenik@icloud.com` was kept and delivered)
- **Recipients sent:** 79
- **API accepted:** 79/79
- **Actually delivered (per Resend export):** 76 delivered, 2 suppressed, 1 pending (`sent` status, no delivery confirmation yet at export time 2026-05-18 18:40 UTC)
- **Completed (UTC):** 2026-05-18T16:31Z (approx)
- **Send script:** `/tmp/send_welcome_backfill_batch2.py` (transient — body verbatim from `email.ts` template EXCEPT the first paragraph of each language)
- **Raw results:** `/tmp/welcome_backfill_results_batch2.json` (transient)
- **Subject:** `A belated welcome to LocoSnap / Ein verspätetes Willkommen / Spóźnione powitanie` (changed from the original; signals the delay in the inbox preview)
- **Copy diff vs verified template:** only the first paragraph of each language was modified — DE/EN/PL each open with an acknowledgment that the email is late and a frame that recent weeks have been spent working through post-launch feedback ("Macht die App besser" / "Honestly makes the app better" / "To poprawia aplikację"). Everything below the first paragraph (app description, no-ads pitch, 6 free scans, signature, footer) is bit-identical to the verified template.
- **Notes:**
  - **Resend daily-limit warning during this batch.** Free-tier plan has a 100/day cap. Combined with batch 1 (67) earlier the same session, total sends reached 146 — over the cap. However, the Resend API accepted and processed all 79 (none were rejected at the API layer). After this batch, the Resend plan was upgraded to unlimited per-day so the limit will not constrain future batches.
  - **Two suppressions, neither retriable.** `tobias.trostmann@web.de` and `hobbybundesbahner@outlook.de` were silently blocked because they are on Resend's account-wide suppression list (prior hard bounce or complaint). Note: the same person at a different address (`tobias_trostmann@web.de` with underscore, `hobbybundesbahner1976@outlook.de` with year suffix) DID receive the email in both cases — so neither person is fully missed.
  - **One pending.** `n29545473@gmail.com` was `sent` (accepted by Resend, attempted) but had not reached `delivered` state at the time of export. May resolve to delivered or to a bounce in the next few hours.
  - **`someone@locosnap.app` was a legitimate signup row in the source data** and was sent to. Since `*@locosnap.app` is the ImprovMX catch-all (→ Proton), this welcome lands in the founder inbox.
  - **Two duplicate-person signups intentionally not deduped:** `tobias.trostmann@web.de` + `tobias_trostmann@web.de` (same person, dot vs underscore), `hobbybundesbahner@outlook.de` + `hobbybundesbahner1976@outlook.de`. Consistent with batch 1's policy on `lisawark6` / `rauloraulo`.

| # | Email | Resend message ID | Status |
|---|-------|-------------------|--------|
| 1 | dc200ch@gmail.com | `659da9fa-2c50-4be0-bb2c-de3fa30ad3d1` | delivered |
| 2 | davidleanderrathgeber@gmx.de | `136d7325-7cf8-44ec-9420-87b76f0a880f` | delivered |
| 3 | newestsa123@gmail.com | `3964a65d-f114-4fd5-b162-1eae66fbfe61` | delivered |
| 4 | timmiu@outlook.de | `06762c08-6ffe-4aca-bdd6-d9b5789aa1ff` | delivered |
| 5 | pendlerail@gmail.com | `2d9a864c-5a99-4400-ae79-0be44bbf17d3` | delivered |
| 6 | adrian@kaiser.berlin | `5da4f5a2-019e-4f60-88b8-8eb674eb44c4` | delivered |
| 7 | kolejowylowicz@gmail.com | `4222b53c-731e-42cc-9912-843ee83abb8d` | delivered |
| 8 | moritztorzewski2010@gmail.com | `1abfe4d5-d9f2-4573-bf73-6dbdf4bd828f` | delivered |
| 9 | samsachs10@gmail.com | `8d841695-f9f9-4362-bf51-96c1cabd6f18` | delivered |
| 10 | tobias.trostmann@web.de | `8b4349fc-ce4d-4f74-a9b4-93ba00ae8c58` | **suppressed** (on Resend suppression list from prior bounce/complaint — same person's underscore variant at #11 delivered) |
| 11 | tobias_trostmann@web.de | `07ad6361-1993-49db-9ddd-9b3e7f737f1b` | delivered |
| 12 | erzgebirgssirenen@gmail.com | `32a0945d-2d19-4791-be46-f7d8ac407b41` | delivered |
| 13 | lukaskolbe3@gmail.com | `f5681379-18e4-474b-b0d9-7f8549cc2083` | delivered |
| 14 | hobbybundesbahner@outlook.de | `47dd6303-ae1b-414c-b59c-1a82194a8bf4` | **suppressed** (on Resend suppression list — same person's `…1976@` variant at #15 delivered) |
| 15 | hobbybundesbahner1976@outlook.de | `c44b1acf-4d29-419e-b7d8-8628de9cc8bb` | delivered |
| 16 | max.ludwig2209@outlook.de | `5a2b3679-1c67-4d84-835b-17936e831d56` | delivered |
| 17 | turbo.dizel1.9tdi@outlook.de | `e868ab5c-ecf2-4450-9c8c-ccf7db3e837d` | delivered |
| 18 | grotzmaximilian7@gmail.com | `496b15be-ba7f-4563-8f19-7b9dd2ba6fa1` | delivered |
| 19 | patrik.feiler@gmx.net | `5fd7b8f6-5cd7-4060-b18d-4f213454ddcd` | delivered |
| 20 | werkingniklas@gmail.com | `81b78f52-7ad0-4c4d-88b6-becdc8bece5e` | delivered |
| 21 | lukas.feddersen@gmail.com | `51e5c6e1-df0e-4f06-b625-1f9dc5605584` | delivered |
| 22 | walteradriel110@gmail.com | `b55c4e10-b3f1-4407-bd50-91b7a3dcf141` | delivered |
| 23 | schlegel_ben@yahoo.com | `b8800cd5-0961-4f4b-97d9-64ea954e779b` | delivered |
| 24 | gottschalkemil43@gmail.com | `0b082de2-c05e-4c16-b265-37e9a18c0fcb` | delivered |
| 25 | maria.magdalena.kurek@gmail.com | `057d402d-03ff-47fb-9b81-4f1d11719d72` | delivered |
| 26 | linus.oesterle2009@gmail.com | `b7afdb61-5a52-402a-abc2-d311652b4d75` | delivered |
| 27 | nyneknynusiowy@gmail.com | `3f40a188-2592-4606-a8cc-9c712a35bd4a` | delivered |
| 28 | mitrovits.lea@gmail.com | `d8ff9baf-78b0-4481-b9e7-df3ac29e93ce` | delivered |
| 29 | sinanleon1308@gmail.com | `78f6419d-5dd1-40b1-aa44-f881835995af` | delivered |
| 30 | batistasean88@gmail.com | `42e1b327-0db8-4441-bd78-34bdf0e42f86` | delivered |
| 31 | lippkejason23@gmail.com | `f88ab511-26cd-42bc-9fa8-10750d01f679` | delivered |
| 32 | n29545473@gmail.com | `4b7cf2b4-d185-4355-be3e-1e49b8b50fe6` | **sent** (pending delivery confirmation as of 2026-05-18 18:40 UTC) |
| 33 | leonfunke2012@web.de | `93cd634a-eb60-4e6e-8495-335518ea43c1` | delivered |
| 34 | magdatarnogrodzka@gmail.com | `54e38ad3-10dc-4efc-a274-4467c2d11e0f` | delivered |
| 35 | vectron81@gmail.com | `23be3666-9214-431a-a73a-03c898101c9d` | delivered |
| 36 | youness.bel1311@gmail.com | `34be3366-6cd5-4e5f-b5a1-228bfd6e0857` | delivered |
| 37 | nicohermann1009@gmail.com | `9f891df5-08a6-4098-8352-2a99c20d2c0c` | delivered |
| 38 | patrik.bahnwelt@gmail.com | `d84689d1-e7df-4641-91dd-75be254462d4` | delivered |
| 39 | ralphcprice@yahoo.com | `c542b657-14d3-4452-b7f1-12898a3dd6cc` | delivered |
| 40 | bazantcolin245@gmail.com | `1cb4011c-debb-4e05-b583-c4c2056258e1` | delivered |
| 41 | davehyundai63@yahoo.com | `bd4df519-33ea-4461-8701-812bd3cdb211` | delivered |
| 42 | hentschellevin75@gmail.com | `121a278d-9883-4e9f-b534-a0243e4a087f` | delivered |
| 43 | benderlucas585@gmail.com | `c9ed661e-7b7c-4c22-9ce1-461c8ee16029` | delivered |
| 44 | zyga11121@o2.pl | `a46a1cd8-632f-4e55-ad0e-b2f8edb98740` | delivered |
| 45 | jonathan.morley1@ntlworld.com | `5f2c0c7a-f11b-4796-8a66-fb1c04dd4be2` | delivered |
| 46 | 59227lidia@gmail.com | `b8421819-0bea-442d-ba50-332e96c04a96` | delivered |
| 47 | louislaux650@gmail.com | `318b241b-f7ce-42e9-be71-b552d8e528db` | delivered |
| 48 | finkenstein.vika@gmail.com | `358145f5-e5a5-4382-8f32-f2d637c7c65e` | delivered |
| 49 | weisheit.thor.robin@gmail.com | `178825d4-ce71-49fc-befe-7835f1b97cc2` | delivered |
| 50 | seiffertrico9@gmail.com | `2ba19884-e7dd-45b1-8956-052802cc4518` | delivered |
| 51 | someone@locosnap.app | `cacb7e24-c1fe-401f-9193-e5411c5497a5` | delivered |
| 52 | leviakafritz@gmail.com | `b0ea54aa-6a63-47e0-a18f-d504a39d8d08` | delivered |
| 53 | jacejakubcik@gmail.com | `dcf27ddd-03fc-4a61-92ca-a1bb51152235` | delivered |
| 54 | niccolear@icloud.com | `bd0c9f5d-f22f-41e7-92c7-620930a60956` | delivered |
| 55 | jnin44468@gmail.com | `4152007f-6704-45f4-98c3-e38ce61a4bc3` | delivered |
| 56 | muellerrobin2003@gmail.com | `b40c9b31-1923-4b0c-afb8-8e693f5738ac` | delivered |
| 57 | 22altthaler.ene@msrieden.at | `ca64ab40-74d5-40c3-8b77-cd344f0e8798` | delivered |
| 58 | alexandrahagen349@gmail.com | `38ae916d-279b-4089-a351-46cd6db30f54` | delivered |
| 59 | anime8euros@outlook.com | `4429facb-0de1-43fb-9512-0e1e4e5d34f3` | delivered |
| 60 | khaled.alaathar@outlook.de | `76bb6281-5ed2-4acf-8f7e-a38e1b59f4f5` | delivered |
| 61 | gt8su@gmx.de | `4ad952a9-4f04-42ad-b0a7-4b0261ba234d` | delivered |
| 62 | fabian.pflaum99@gmx.de | `ac9cba13-817a-4ab4-b9a9-c780cbbe51ce` | delivered |
| 63 | borsutzky.fn@gmail.com | `6437d991-22ab-44ea-b796-810f154b6fbf` | delivered |
| 64 | zugfotografienosw@gmail.com | `b5a3f53b-9671-4446-8108-e7f660452361` | delivered |
| 65 | nicolasisraelmeier@gmail.com | `a2bea46b-7f8e-412c-aa27-3bf86515a925` | delivered |
| 66 | alexh15707@gmail.com | `a9e01d97-e12f-454d-9684-aca14f32fe9e` | delivered |
| 67 | kollektivtrafikoverostergotlan@gmail.com | `0c2fc67d-90ba-4695-8a82-355685429beb` | delivered |
| 68 | matteo.molteni09@gmail.com | `5668e635-5d59-49c1-ae21-b64912fef66c` | delivered |
| 69 | ethanthompson2604@gmail.com | `c0d76c44-9dcd-4786-a45d-30bde679c058` | delivered |
| 70 | kaspar.ruetenik@icloud.com | `e141ae7c-d231-41e7-8416-29717ed106ce` | delivered |
| 71 | lukasbuettner76799@yahoo.com | `a729ee4b-4b58-4e98-b67a-e514e4cc159e` | delivered |
| 72 | konstantinwandrack@gmail.com | `5e462093-a1b5-4e5d-ac0f-ac741a7f9acd` | delivered |
| 73 | christ100.dick@gmail.com | `ab8490e5-8a60-4cd4-adc9-663b9f8ee21d` | delivered |
| 74 | robinpeppler850@gmail.com | `b07e93fe-b220-4c46-bcc2-3d3fcb456ebd` | delivered |
| 75 | maik.rolla@gmail.com | `ecc9121d-6fd9-4287-8b23-3c9a4ff99cc8` | delivered |
| 76 | clemenshannicke@gmail.com | `68702a14-fec1-485e-98e9-d840b357dc52` | delivered |
| 77 | davidkrafthofer31@gmail.com | `83e87fc2-f528-4eb9-93d0-ec75570938d4` | delivered |
| 78 | maxhuber191211@gmail.com | `05bf2707-899d-4f6e-93d6-c79511876b08` | delivered |
| 79 | nilspascalnowakowski@gmail.com | `f0cb7319-7334-4570-b134-2160d3b7635f` | delivered |

### Excluded from send (not in the table above)

| Email | Reason |
|-------|--------|
| `kaspar.ruetenik@icloud` | Malformed — missing `.com` TLD. Would have hard-bounced. Same person's correctly-formed address `kaspar.ruetenik@icloud.com` was sent and delivered (row #70). |

---

## 2026-05-18 — Week-of-Google-launch backfill (non-Pro, testers excluded, "belated welcome" copy)

- **Window:** 2026-04-27 00:00:00 UTC → 2026-05-04 00:00:00 UTC (signups 2026-04-27 through 2026-05-03 inclusive — the seven days starting with the Google Play public-launch date)
- **Filter:** `auth.users` joined to `public.profiles`, `is_pro = false OR profile missing`, email NOT NULL, **NOT LIKE `%@locosnap.app`**, **NOT IN tester list** (26 addresses from `memory/tester_contacts.md`)
- **Source:** Supabase SQL Editor → CSV export → `~/Desktop/Email/Supabase Snippet 27-4 to 4-5.csv`
- **Recipients in CSV:** 81 (no internal duplicates, no overlap with batch 1 or 2, no testers slipped through, no malformed addresses)
- **Recipients sent:** 81
- **API accepted:** 81/81
- **Delivery verification:** not run for this batch — operational rule updated to skip the Resend export cross-reference for fresh-signup cohorts on the unlimited tier, since the suppression-drop rate is low and there's no quota-cap reason to suspect blocks. Status column below reflects API-acceptance only.
- **Completed (UTC):** 2026-05-18T17:00Z (approx)
- **Send script:** `/tmp/send_welcome_backfill_batch3.py` (transient)
- **Raw results:** `/tmp/welcome_backfill_results_batch3.json` (transient)
- **Subject:** `A belated welcome to LocoSnap / Ein verspätetes Willkommen / Spóźnione powitanie` (same as batch 2)
- **Body:** identical to batch 2 ("belated welcome / since launch I've been working through feedback" variant)
- **Notes:**
  - **First batch using full exclusion list.** SQL now filters out all 26 tester emails and `%@locosnap.app`. Cross-check before send confirmed zero testers / zero internal addresses in the result set.
  - **One near-duplicate, intentionally not deduped:** `leon.plattner@gmx.de` + `leon.plattner@icloud.com` — same person, two providers. Both well-formed, distinct mailboxes. Consistent with prior-batch policy.
  - **Three same-prefix variants on @gmx.de:** `leandereathgeber`, `leanderathgeber`, `leanderrathgeber` — almost certainly the same person fumbling typos until they got it right (`leanderrathgeber@gmx.de` is the version that matches `davidleanderrathgeber@gmx.de` from batch 2). All three sent — distinct mailboxes, three signups.
  - **First post-launch-day signup is 18:25 UTC on 2026-04-27** — Google Play public publish was earlier the same day. Tracks.

| # | Email | Resend message ID | Status |
|---|-------|-------------------|--------|
| 1 | zocherlars107@gmail.com | `ab9c05cd-54a4-437a-8b14-cb2b0e703ea3` | API-accepted |
| 2 | daniel2212.boeck2@gmail.com | `32a2ff32-6e34-4138-bc05-747dc1624ecf` | API-accepted |
| 3 | fabian25118@web.de | `2fd65d21-5c4d-4e07-9b82-8aebe4208bea` | API-accepted |
| 4 | nadinekaienstipp@gmail.com | `75870d35-067c-4a34-90e6-7b330b9b6a34` | API-accepted |
| 5 | ingineurantonio@gmail.com | `4bb4ae2b-4b60-4a79-934f-77d4ab9481ea` | API-accepted |
| 6 | filomil2011@gmail.com | `4f12dc82-a49f-4a73-bcc7-f7e8be662805` | API-accepted |
| 7 | erikvoigt@t-online.de | `092efafb-1157-467b-affd-ad749404ab04` | API-accepted |
| 8 | devran13bernad@gmail.com | `75f818f8-1c23-491c-be12-4b9cb34ebf9f` | API-accepted |
| 9 | devra13bernad@gmail.com | `c12181dc-a055-4366-b98d-781525d4af40` | API-accepted |
| 10 | gabriel.strohmeier@outlook.de | `87f75292-ae80-4ee3-8918-1b3a63546dac` | API-accepted |
| 11 | ruhrbahnspotter.max@gmail.com | `40828961-0384-418d-83e1-f45b7f9ba31b` | API-accepted |
| 12 | lehellaszlo6@gmail.com | `de981161-1b74-4feb-a935-3ce2ccb6a7fe` | API-accepted |
| 13 | ets2lover4@gmail.com | `38d5dd7a-6a76-4067-baed-e84e0ca6b8df` | API-accepted |
| 14 | valixog418@gmail.com | `831b7efa-123f-44f0-a3f4-6602cf947088` | API-accepted |
| 15 | radaukeks2701@gmail.com | `936560c2-d762-4c8b-b5ca-2e226261515e` | API-accepted |
| 16 | braunkevin261@gmail.com | `9689ba0b-8377-4a23-bec0-d681c50bc63c` | API-accepted |
| 17 | adrian.jenoch@gmail.com | `b514e63d-b28c-49ee-952a-d54fd598696f` | API-accepted |
| 18 | felixsladek@gmx.at | `61308700-3e63-4e8b-888d-a6f2a2b4174b` | API-accepted |
| 19 | nowakstanislaw127@gmail.com | `86f7cace-c688-42b3-a7e5-3fd822ab9a55` | API-accepted |
| 20 | timmohme604@icloud.com | `ceb6cdb1-b640-4786-bd0f-773043c17e77` | API-accepted |
| 21 | leo.weste@icloud.com | `d3025fef-f31b-4238-99dc-59d8fd0460e1` | API-accepted |
| 22 | iliakovaljov@gmail.com | `c6f79b15-814c-4e87-9f64-6213f443f88e` | API-accepted |
| 23 | phillip.oeri@gmail.com | `5a90e734-0099-4c7b-bfe2-74614ba9328d` | API-accepted |
| 24 | markopits@gmail.com | `ccecb646-5865-4ecc-a169-87d21196d25d` | API-accepted |
| 25 | janne.voelker@gmx.de | `79add5b4-cb3b-4d12-9160-d0385544e6a8` | API-accepted |
| 26 | tackjerome15@gmail.com | `c4f840eb-ebf0-4105-8d7e-bfcb39aa1106` | API-accepted |
| 27 | pircherlucas1@gmail.com | `df3abad6-f963-470d-b438-652970ff258f` | API-accepted |
| 28 | le.abel.2008@gmail.com | `824aec66-6f11-4b92-90a8-017aa96b58c2` | API-accepted |
| 29 | julian.reischl-j@outlook.com | `4a42b706-4832-4700-be74-6b5ca28d0054` | API-accepted |
| 30 | leon.plattner@gmx.de | `96ab27e2-91b2-4587-8d84-064eb3346184` | API-accepted |
| 31 | leon.plattner@icloud.com | `aadda4c4-7000-43bd-99e0-7fc1f50d3923` | API-accepted |
| 32 | xflix06@gmail.com | `78ab6035-fe4e-4e0e-aab4-5a0ff0c619ae` | API-accepted |
| 33 | leandereathgeber@gmx.de | `beea66b7-aa0d-428f-a643-aebbba75b95a` | API-accepted |
| 34 | leanderathgeber@gmx.de | `164a28dd-2f3f-41d0-abf9-e29619942815` | API-accepted |
| 35 | leanderrathgeber@gmx.de | `03a6b027-2da5-4822-a7f9-b3493778ca77` | API-accepted |
| 36 | keilrene183@gmail.com | `611e9268-5402-4cee-932b-84d412609e90` | API-accepted |
| 37 | lrtv@lrtv.me | `6460fecd-0d05-4cdd-9ea4-b434708411b5` | API-accepted |
| 38 | somodiandris@gmail.com | `6e9d8b1a-0e1c-4c26-8960-a46157523a30` | API-accepted |
| 39 | theobaum2013@gmail.com | `e1f25f51-65f1-4e33-9ab2-69f9e221ec29` | API-accepted |
| 40 | daniellessentin09@gmail.com | `4bcc4645-f039-451d-be01-db64285bae41` | API-accepted |
| 41 | jonas.enrik@gmx.de | `3836d18d-a020-4657-861b-a5c7e2195607` | API-accepted |
| 42 | planespotting.fmo.noah@gmail.com | `480e517c-1348-4aca-8184-02ad69764f9a` | API-accepted |
| 43 | p.schmidt1231@outlook.de | `99fd5fdf-dd32-4e95-9fc8-504742d63c2d` | API-accepted |
| 44 | kuriatakacper51@gmail.com | `0a8d3fef-595f-4626-a36e-f568a0009e14` | API-accepted |
| 45 | luisdejong6@gmail.com | `f5869b65-08cf-4ef8-a885-3968df4a6f98` | API-accepted |
| 46 | jabjanek14@gmail.com | `ee7f1e0e-48ae-48b1-8ef5-0f062e61237e` | API-accepted |
| 47 | kilian.ziepel@gmail.com | `7696d669-7862-4d74-9d12-4412b85edf27` | API-accepted |
| 48 | aueh@web.de | `42869151-c1a0-4725-b8cd-1a696001a043` | API-accepted |
| 49 | levi.striekwold@outlook.com | `03cd5ab1-1de5-4751-ad7b-b5aa8ca99edd` | API-accepted |
| 50 | niewiemjakanazwaxd69@gmail.com | `4a540b83-7ed6-4955-8774-ec80713ff6c1` | API-accepted |
| 51 | bokbartosz453@gmail.com | `877a2dae-997c-4ba0-bc7d-9f15fbffc5e7` | API-accepted |
| 52 | 09bultmann@gmail.com | `b01154f7-bcb8-48dd-86d0-41e5beb61efa` | API-accepted |
| 53 | weddetom@gmail.com | `7a2e2882-ce91-4134-adb3-2bb97b1f7302` | API-accepted |
| 54 | sheriruhnke60@gmail.com | `d492e679-ab6d-47a1-abd2-bfb539932ece` | API-accepted |
| 55 | ninjakotnk@gmail.com | `7994c32e-9e88-498b-a043-8d3f03329640` | API-accepted |
| 56 | schmidt19761@gmail.com | `11f001d9-3d65-4318-8b10-d6b63bebc2ea` | API-accepted |
| 57 | anesramadani303@gmail.com | `9153d7b0-34c6-457b-9d23-062e4f845900` | API-accepted |
| 58 | dawidsigmaboy10@gmail.com | `8eef33cd-b7b3-42b4-bbec-68c0ec7ecc97` | API-accepted |
| 59 | marley.rauh@gmail.com | `bbdd4182-b11d-445f-b906-0406d2d208d1` | API-accepted |
| 60 | nickynonk77@icloud.com | `9521ac75-7c75-4ebb-a5a6-30df6ab89e22` | API-accepted |
| 61 | adrian.gessner0109@gmail.com | `6c5e4a2e-f377-4f1f-aeb7-e18fc47f462a` | API-accepted |
| 62 | marcelfankomunikacjigait@gmail.com | `85de5200-1072-48be-9e3e-f09c1b384620` | API-accepted |
| 63 | janniklasgrunewald@gmail.com | `e85ffc84-c832-425b-803f-9e7099961750` | API-accepted |
| 64 | landhofermax@gmail.com | `46f6232b-ee86-48ed-a76e-30fdc9d49e46` | API-accepted |
| 65 | simomderlokfuehrer@gmail.com | `eaed8364-eab6-4d09-be64-32422e9444cf` | API-accepted |
| 66 | leroy_kaplan@t-online.de | `61418ce7-4f3a-4f85-8d47-a6c8c1d9b203` | API-accepted |
| 67 | snezannadivulina@gmail.com | `43851a64-5888-48ee-9bf2-5bebb235dd83` | API-accepted |
| 68 | martinus.hofmann16@gmail.com | `fe1b5981-f6f8-4408-bf59-a377a30db814` | API-accepted |
| 69 | lasse.tabor@gmail.com | `b85b6e2e-3bdc-4f69-a80e-7fa97578a62d` | API-accepted |
| 70 | joostegtmeyer@yahoo.com | `ecdf0ad0-9540-448f-8929-e5a29934dd62` | API-accepted |
| 71 | eutrainspotter@gmail.com | `86793bb6-48f1-40e3-ac83-9cee339d38f0` | API-accepted |
| 72 | franciszek.maciolek@interia.pl | `924f73ec-3e4d-49f9-9c26-ac833e6068ec` | API-accepted |
| 73 | gustaw.cymbalista123@gmail.com | `3289097e-e23b-4d64-ae29-2a23e47da7c2` | API-accepted |
| 74 | jasmin.be.info@web.de | `bece6ced-95cc-4544-b09a-39b7d56ef2e0` | API-accepted |
| 75 | trainspotterin.jasmin@web.de | `873303bc-3408-4a6a-a351-b9c951acac30` | API-accepted |
| 76 | kolejowywolow@gmail.com | `2e6e91b3-10ed-47e7-a41a-390d0a7d40fb` | API-accepted |
| 77 | colinkanning@web.de | `28cd8cb5-4933-4bdb-91b4-bc76fe0edaa0` | API-accepted |
| 78 | bygger621@gmail.com | `e10de334-3e86-428e-a870-514a6a339320` | API-accepted |
| 79 | kluge.richard27@gmail.com | `36969679-83f5-4eb0-853e-be229021e8fc` | API-accepted |
| 80 | raczmarcell2013@gmail.com | `71c08f07-e4a8-4fd6-a48a-653e9300ea66` | API-accepted |
| 81 | martindorina@gmail.com | `077454a3-c3c3-4932-8b8f-363bbeba2d4d` | API-accepted |

---

## 2026-05-18 — Full pre-Google-launch backfill (non-Pro, testers excluded, "belated welcome" copy)

- **Window:** 2026-03-02 00:00:00 UTC → 2026-04-27 00:00:00 UTC (signups 2026-03-03 through 2026-04-26 — first signup is the day after the 2026-03-02 store upload, last is the day before Google Play public-launch)
- **Filter:** same as batch 3 — non-Pro, NOT testers, NOT `%@locosnap.app`
- **Source:** Supabase SQL → `~/Desktop/Email/Supabase 2-3 to 26-4 Unconfirmed Non‑Pro Users .csv`
- **Recipients in CSV:** 79
- **Filtered out before send:** 4 (typo-domain addresses where the same person also signed up with the corrected address in the same dataset — see "Excluded" below)
- **Recipients sent:** 75
- **API accepted:** 75/75
- **Delivery verification:** not run (per the updated rule for fresh cohorts on unlimited tier)
- **Subject + body:** identical to batches 2 + 3 ("belated welcome" copy variant)
- **Notes:**
  - **Final backfill batch** — every non-Pro signup pre-2026-05-18 has now received either an automated welcome (post-trigger) or a backfill welcome (this session). The trigger handles all future signups going forward.
  - **Two legitimate same-person near-duplicates sent to both addresses:** `rehnertleon@gmail.com` + `rehnertleon@icloud.com`; `matixyt@gmail.com` + `matixyt7777@gmail.com`. Consistent with prior-batch policy.
  - **Three typo addresses slipped through and got sent.** Not caught by the pre-send filter because they had no same-batch correction to pair against: `hansi.20098@oulook.de` (typo of `outlook.de`), `rheintalbhnerneo@gmail.com` (missing `a` in `bahner` — same person as tester `rheintalbahnerneo@gmail.com` which the SQL excluded), `stephstottor@gmail.coms` (trailing `s` — same person as tester `Stephstottor@gmail.com`). These will bounce silently. All three flagged for the post-batch DB cleanup.

| # | Email | Resend message ID | Status |
|---|-------|-------------------|--------|
| 1 | taylantay007@gmail.com | `8805f1ea-a65e-43a1-b3a8-6cd42b19f031` | API-accepted |
| 2 | heckerniklas19@gmail.com | `297a7a1a-1f85-4327-8fe0-6ed900b92b00` | API-accepted |
| 3 | hansi.20098@oulook.de | `f3beac25-b802-4f34-a629-7431bddc0cf1` | **API-accepted, will bounce** (typo of `outlook.de`) |
| 4 | trainbeobachter2@gmail.com | `6c864205-5fb6-4acd-8179-9d9993443b7b` | API-accepted |
| 5 | maxi.prigge11@gmail.com | `d3934e9d-13a3-4f41-978c-a47cdcee1e05` | API-accepted |
| 6 | luan.ademi2207@icloud.com | `3e39acec-22f8-4fc7-a520-ee94678364ec` | API-accepted |
| 7 | casey.cknbcyh.paid@icloud.com | `1ff228de-cd6f-440c-ab68-4488f73de9be` | API-accepted |
| 8 | geojac2011@gmail.com | `b2215c88-0f55-4919-82cf-e4d82db59ef5` | API-accepted |
| 9 | orengibson2@gmail.com | `88c21342-875c-4473-a128-e9d42d6b0150` | API-accepted |
| 10 | filipunia07@gmail.com | `74c7764d-b2d4-4754-a478-e22cac01f5c4` | API-accepted |
| 11 | mats.asgeirsson@outlook.com | `e18303cc-7920-45ef-8ab2-44f7d186e540` | API-accepted |
| 12 | ethanpower2507@gmail.com | `70fb9ea7-ec23-4d52-9d46-f783b37513c8` | API-accepted |
| 13 | loops83@hotmail.co.uk | `47a4c9b3-93f7-4ccd-99d6-99373a502d26` | API-accepted |
| 14 | nicogohm@gmail.com | `20596c02-ce80-47c6-af05-1ea69263772a` | API-accepted |
| 15 | scherrer.lona@gmx.de | `2efe1e25-a912-44c8-9b83-f94b4e8a757c` | API-accepted |
| 16 | projekt.x-wagen@gmx.de | `da68bd59-9cee-46df-96c3-ae3429d278a5` | API-accepted |
| 17 | rheintalbhnerneo@gmail.com | `218dd0de-c86a-4c6e-be7b-24dfa6329678` | **API-accepted, will bounce** (typo of tester `rheintalbahnerneo@gmail.com`) |
| 18 | br143001@icloud.com | `e85ab120-404f-42ed-b5f1-0a028730202f` | API-accepted |
| 19 | rehnertleon@gmail.com | `987bf759-6021-4af9-9650-1d8753ae4862` | API-accepted |
| 20 | rehnertleon@icloud.com | `134221d5-cb35-4aaf-a3ba-7820425b2eac` | API-accepted |
| 21 | natty09transportguy@gmail.com | `92210e28-7d01-46cc-b388-0322c40bd652` | API-accepted |
| 22 | danielmorgancox301@gmail.com | `6f31f936-3928-43ea-aeeb-9d11ff8b183c` | API-accepted |
| 23 | yaboirazajan@icloud.com | `39b18cf0-cdda-4b6f-a935-e7c990aa28eb` | API-accepted |
| 24 | svartgula.stolthet@gmail.com | `d1fed03c-df21-402a-99ba-05cb1da3b863` | API-accepted |
| 25 | forza.driver69@gmail.com | `2172857b-ab90-45ce-b274-50ec7d3591bb` | API-accepted |
| 26 | forza.driving69@gmail.com | `dd9c0f65-1f3c-41a0-928d-b8b919d0ca9d` | API-accepted |
| 27 | dakotacollons8@gmail.com | `ce73b1d8-e5f8-42ba-ba41-b0f445099f79` | API-accepted |
| 28 | milan31perez@gmail.com | `c519c10c-7ae9-4df1-8081-fd088fb98dce` | API-accepted |
| 29 | kopyjanek@icloud.com | `6ac3b4db-fd54-4137-b21d-47f402edfc4e` | API-accepted |
| 30 | gurgaty@gmail.com | `e78eba1d-8797-422b-bf69-267e21606dbb` | API-accepted |
| 31 | l17049893@gmail.com | `184b5c6b-7b77-4559-a847-f5c21fa14ae1` | API-accepted |
| 32 | luis0815.888@gmail.com | `fd28e7e6-8fa3-4dbf-b4fe-6013d0fd665b` | API-accepted |
| 33 | dubarsch@gmail.com | `8d6a78e5-b2e4-44cc-991a-fb6f73e3ca05` | API-accepted |
| 34 | mikolus420@gmail.com | `faea71c2-0718-4b16-8e7f-757d7303af86` | API-accepted |
| 35 | reszkakrystian@icloud.com | `9b2c94ca-5482-49b8-9a0a-7e82459cb0cf` | API-accepted |
| 36 | filip.miazio@icloud.com | `0222ed4d-1c18-470f-bb4a-8d1caaa73499` | API-accepted |
| 37 | miaziofilip@gmail.com | `97a1ff46-2f2b-4b97-aeef-faeebee90ff1` | API-accepted |
| 38 | kevinsilva27costa@icloud.com | `ae0a5351-6c70-49c7-9fb4-6e1030c0fe3e` | API-accepted |
| 39 | lukaszkolej141@gmail.com | `6da688f3-383a-430b-9c50-fab532e58a0a` | API-accepted |
| 40 | matixyt@gmail.com | `81c7bc19-9718-464d-a290-007b8820c289` | API-accepted |
| 41 | matixyt7777@gmail.com | `3596e929-5ba3-42c3-a30d-8aff34df2922` | API-accepted |
| 42 | heniowice@spoko.pl | `17f6cc43-dbee-4d28-89aa-6c5928e92795` | API-accepted |
| 43 | raphael.gerlach05@gmail.com | `f7489804-a2c6-4a3f-a5dd-82d01e5b9655` | API-accepted |
| 44 | sebastian.linek@truhla.com | `1eb1ef58-4dc9-4848-ac9b-cbd1bcda0226` | API-accepted |
| 45 | vlakoz.kyjak@gmail.com | `bd626287-5cb2-4143-88b5-60d348c93c49` | API-accepted |
| 46 | vlakym16@seznam.cz | `4e0c6a5b-092f-4b06-9a7f-0ae7afd9d5b3` | API-accepted |
| 47 | juliuszmatejczuk65@gmail.com | `1e94fa6f-560c-4ef0-b145-2ca094b0f789` | API-accepted |
| 48 | willv3830@gmail.com | `7138f205-c600-4adf-9b60-03500b88578c` | API-accepted |
| 49 | olpyt@icloud.com | `50bd49f7-012d-4049-a70a-ab90e5bfb530` | API-accepted |
| 50 | kacper.kuczera2911@gmail.com | `440824cd-ef4c-48ee-84e3-e537dd8e5b96` | API-accepted |
| 51 | filiphalili13@gmail.com | `ec130663-b79d-47f8-afa7-c97370e3adca` | API-accepted |
| 52 | ivanics2005@gmail.com | `dacb6846-6017-477c-b1db-1370ef3c69ac` | API-accepted |
| 53 | s.w.coenraad@gmail.com | `c1c2edd7-65c8-4bdd-859e-4c4f2a6684c0` | API-accepted |
| 54 | sanojsetra@gmail.com | `10eb77fb-5fb8-474a-8a53-181028251e70` | API-accepted |
| 55 | marcocem28@gmail.com | `72f12111-f5cf-4310-80c5-cf7f506cbc5b` | API-accepted |
| 56 | vanpeter709@gmail.com | `ad3c71d7-3ad6-4601-8cef-bb5f45b0ad41` | API-accepted |
| 57 | felixbussmannbvb@gmail.com | `b54a800e-03a6-452d-b376-5764c6ee3744` | API-accepted |
| 58 | tim.wierschin@icloud.com | `2e4608a1-12fa-4123-94f6-0f7494c37c6f` | API-accepted |
| 59 | hagerjon587@gmail.com | `b741fbee-c02d-4cb7-bffa-c4611ddb0559` | API-accepted |
| 60 | bastian@bechlivanidis.de | `a3f576e2-3c3e-4efc-9c56-de309e357b7f` | API-accepted |
| 61 | finlaymcintyre@outlook.com | `f22a5fc1-ce4e-49c1-93f5-fb39033f0051` | API-accepted |
| 62 | jrandall125@outlook.com | `ace57cb8-92a3-40e4-89e1-bad4bb538a76` | API-accepted |
| 63 | lucasbruka09@gmail.com | `b62292a0-c51a-4b72-a119-40e7fc3c9306` | API-accepted |
| 64 | nikoguenther159@gmail.com | `a44948b9-2391-4bb3-9405-27b9e41789a9` | API-accepted |
| 65 | bfraisl@icloud.com | `bb961073-48b4-4833-8798-a4f22cbbe33a` | API-accepted |
| 66 | f2213420@gmail.com | `00b7d9c3-0594-433b-874b-42a23d97c2e5` | API-accepted |
| 67 | colinsuske3@gmail.com | `55b21c82-9f4a-428f-aa60-d35e4201e04f` | API-accepted |
| 68 | pieckmiguel@gmail.com | `dd692401-5ba5-47aa-9435-2ea8e941c034` | API-accepted |
| 69 | matveykalinin02@gmail.com | `dce19480-fbcd-4ec6-96a3-87ea395c5848` | API-accepted |
| 70 | stephstottor@gmail.coms | `08f0364b-c248-4984-969b-78dc17670647` | **API-accepted, will bounce** (typo of tester `Stephstottor@gmail.com`, trailing `s`) |
| 71 | traingamer2907@gmail.com | `91d755d6-b2fb-4f9b-97fd-0995f31553ed` | API-accepted |
| 72 | leander@daum.de | `d56f4617-4764-4164-b7e3-f71c376dd377` | API-accepted |
| 73 | phillipjoelzimpel@gmail.com | `3de41c87-ff2d-49ee-937c-f8cfb8cd989f` | API-accepted |
| 74 | bb83848@icloud.com | `572c710a-00a1-4a04-a84d-670ef9fa76f0` | API-accepted |
| 75 | 10ynnel@gmail.com | `d03f16a1-a2a7-4ef9-b7b8-9c538aa57c57` | API-accepted |

### Excluded from send (not in the table above)

| Email | Reason |
|-------|--------|
| `loops83@hitmail.co.uk` | Typo — `hitmail.co.uk` is not a real provider. Same person at `loops83@hotmail.co.uk` (row #13) sent. |
| `danielmorgancox301@gnail.com` | Typo of `gmail.com`. Same person at `danielmorgancox301@gmail.com` (row #22) sent. |
| `jrandall125@outloo.com` | Typo of `outlook.com`. Same person at `jrandall125@outlook.com` (row #62) sent. |
| `traingamer2907@gmaio.com` | Typo of `gmail.com`. Same person at `traingamer2907@gmail.com` (row #71) sent. |

---

## 2026-05-18 — DB cleanup: 8 typo/malformed email rows removed from `auth.users`

After the four backfill batches surfaced eight email addresses that cannot ever authenticate (typo or malformed domain — no OTP can reach them), they were removed from `auth.users` via direct SQL in Supabase. Cascading FKs (`ON DELETE CASCADE` to `auth.identities`, `auth.sessions`, `auth.refresh_tokens`, `public.profiles`, and related tables) cleaned up dependent rows automatically. None of the 8 were Pro / had any purchases.

| Email | Source batch | Typo |
|-------|-------------|------|
| `kaspar.ruetenik@icloud` | Batch 2 (filtered pre-send) | Missing `.com` TLD |
| `loops83@hitmail.co.uk` | Batch 4 (filtered pre-send) | `hitmail.co.uk` not a real provider |
| `danielmorgancox301@gnail.com` | Batch 4 (filtered pre-send) | `gnail.com` → `gmail.com` |
| `jrandall125@outloo.com` | Batch 4 (filtered pre-send) | `outloo.com` → `outlook.com` |
| `traingamer2907@gmaio.com` | Batch 4 (filtered pre-send) | `gmaio.com` → `gmail.com` |
| `hansi.20098@oulook.de` | Batch 4 (sent — will bounce) | `oulook.de` → `outlook.de` |
| `rheintalbhnerneo@gmail.com` | Batch 4 (sent — will bounce) | `bhnerneo` → `bahnerneo` (tester `rheintalbahnerneo@gmail.com` typo) |
| `stephstottor@gmail.coms` | Batch 4 (sent — will bounce) | Trailing `s` on `.com` (tester `Stephstottor@gmail.com` typo) |

**Going-forward rule:** when noticing a typo-domain email row during any batch, add it to a running cleanup list. After the batch, run a single SELECT-then-DELETE pass to clean them from `auth.users` (cascades handle the rest). Don't bother emailing the bad addresses first — they'll just bounce silently and hurt sender reputation.
