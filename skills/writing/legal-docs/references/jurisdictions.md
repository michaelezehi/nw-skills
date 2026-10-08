# Jurisdiction obligations — dated

**Status as verified 2026-08-15.** These dates move. Several moved in 2026. `WebSearch` the
current position before putting any deadline in a report, and mark anything you could not
confirm `[UNVERIFIED]`.

---

## EU AI Act — recruitment AI is high-risk, and the deadline moved

**Classification.** AI for "recruitment or selection of natural persons, in particular to
place targeted job advertisements, to analyse and filter job applications, and to evaluate
candidates" is **high-risk** under Annex III(4)(a). Promotion, termination, task allocation
and monitoring fall under Annex III(4)(b). A ranking or matching engine is in scope as
written. — Regulation (EU) 2024/1689.

**The deferral.** The Digital Omnibus on AI, **Regulation (EU) 2026/1744**, was published
in the Official Journal on 24 July 2026 and entered into force 27 July 2026. It **defers
Annex III high-risk obligations from 2 Aug 2026 to 2 Dec 2027**.

**What applies regardless:**
- Art. 5 prohibitions, live since 2 Feb 2025 — including **emotion recognition in the
  workplace**, which is prohibited outright, not merely high-risk
- Art. 4 AI-literacy duties
- **Art. 50 transparency** from 2 Aug 2026, unaffected by the deferral

**Provider obligations due 2 Dec 2027:** risk-management documentation (Art. 9), training-
data governance (Art. 10), Annex IV technical file (Art. 11), logging design (Art. 12),
instructions for use (Art. 13), human-oversight design (Art. 14), accuracy and robustness
evidence (Art. 15), QMS (Art. 17), conformity assessment + declaration + CE marking
(Arts. 43, 47, 48), EU database registration (Art. 49), post-market monitoring and
serious-incident reporting (Arts. 72–73).

Treat the deferral as runway. The Annex IV file is months of work.

## GDPR Art. 22 — automated decision-making

A data subject has the right not to be subject to a decision based **solely** on automated
processing producing legal or similarly significant effects. Rejection or shortlisting
qualifies. Lawful only via explicit consent, contract necessity, or law — **and** with
safeguards: human intervention, the right to express a view, the right to contest.

**CJEU *SCHUFA* (C-634/21, Dec 2023)** read "decision" broadly: a score that a third party
relies on decisively is itself an Art. 22 decision. Directly on point for any ranking
engine whose customer "just follows the ranking". Arts. 13(2)(f) and 15(1)(h) additionally
require disclosing meaningful information about the logic involved.

The human-review pathway must be a documented, logged control — not a checkbox.

**UK divergence:** the Data (Use and Access) Act 2025 reworked UK Art. 22 to permit most
solely-automated decisions with safeguards, keeping the strict rule for special-category
data. Build to the EU standard.

## United States

| Law | Status Aug 2026 | Duties |
|---|---|---|
| **NYC Local Law 144** | In force since 5 Jul 2023 | Annual **independent** bias audit (≤1 year old); published summary with audit date, **data source** and results; candidate notice **≥10 business days** before use, covering qualifications assessed, data collected, retention policy, and how to request an alternative process. Binds employers — vendors must supply the audit and notice templates |
| **Illinois AIVIA** (820 ILCS 42) | In force since 2020 | Before AI analysis of a video interview: notify, explain how it works and what it evaluates, obtain consent; limit sharing; **delete within 30 days of request**; demographic reporting where AI screens for in-person interviews |
| **Illinois HB 3773** | **In force 1 Jan 2026.** IDHR implementing rules withdrawn, still pending | Prohibits AI with a discriminatory **effect**; **bans zip-code proxies**; requires **notice** whenever AI is used in recruitment, hiring, promotion, discipline or discharge |
| **Illinois BIPA** (740 ILCS 14) | In force. SB 2979 (2024) limits damages to a **single recovery per person per collection method**, held retroactive by the 7th Cir. | Written notice + **written release** before collecting a biometric identifier — face geometry from photos included; public retention/destruction schedule; no profit from biometrics; private right of action, $1k negligent / $5k intentional |
| **Maryland §3-717** | In force since 1 Oct 2020 | No facial-recognition **template creation** during an interview without a signed waiver naming the applicant, the date, and confirming they read it |
| **Colorado** | Original SB 24-205 enforcement **stayed** by federal court Apr 2026; replaced by **SB 26-189**, signed 14 May 2026, effective **1 Jan 2027**, narrowed to disclosure/transparency | Watch for final specifics before 1 Jan 2027 |
| **California CCPA ADMT** | Regs effective 1 Jan 2026; **hiring-decision compliance due 1 Jan 2027** | Pre-use notice, opt-out (with a qualifying human-appeal exception), access right to logic and output, documented risk assessments. **CCPA covers CA employees and applicants**, not only consumers |
| **Texas TRAIGA** (HB 149) | In force 1 Jan 2026 | Prohibits developing or deploying AI with **intent** to discriminate. Notably **no disclosure duty** for private employers; AG-only enforcement |
| **EEOC / Title VII** | Always | Disparate-impact liability for selection procedures; UGESP 29 CFR 1607, four-fifths rule as a screening heuristic. The EEOC's 2023 AI technical assistance was withdrawn, but Title VII is unchanged — adverse-impact analysis remains the core defensive artefact |

## United Kingdom

- **ICO registration and data protection fee** is mandatory for a UK controller
  (DPA 2018 s.137). Cheap, legally required, and routinely missed by new entities.
- **ICO employment practices: recruitment and selection** guidance, plus the ICO's Nov 2024
  **AI-in-recruitment audit report** — roughly 300 recommendations to vendors. Key findings:
  over-collection, indefinite talent-pool retention, scraping, weak transparency. A UK
  buyer's DPO will test against exactly these.
- **Candidate DSARs** — including rejected candidates — must be answered within one calendar
  month, extendable by two for complexity. Ranking scores about a person are their personal
  data.
- **Companies Act 2006 s.82** — a UK company must display its registered name, company
  number and registered office on its website.

## Saudi Arabia and the GCC

- **PDPL** (Royal Decree M/19), in force 14 Sep 2023; enforcement grace ended 14 Sep 2024.
  Regulator **SDAIA**. Enforcement is real — 48 decisions issued 2025–26.
- Duties: legal basis (consent is the default, with narrower exceptions than GDPR), privacy
  notices, **National Register of Controllers** registration where triggered, DPO rules,
  processor contracts, breach notification to SDAIA, data-subject rights.
- **Transfers out of the Kingdom** need adequacy, or appropriate safeguards (Saudi SCCs,
  BCRs, importer certification) **plus a documented pre-transfer risk assessment** per
  SDAIA's Feb 2025 guideline. Sensitive-data transfers are tighter. In-Kingdom residency is
  itself the primary compliance artefact where it exists.
- Sector overlay: NCA **Essential Cybersecurity Controls (ECC)**, and CCC for cloud. Saudi
  enterprise buyers ask for ECC alignment the way US buyers ask for SOC 2.
- Rest of GCC, all with PDPL-style laws in force: UAE Federal Decree-Law 45/2021, DIFC DP
  Law 5/2020, ADGM DPR 2021; Qatar Law 13/2016; Bahrain Law 30/2018; Oman RD 6/2022;
  Kuwait CITRA DPPR. A single GCC annex to the DPA is the standard approach.

## Photographs and biometrics

A photograph is **not automatically** GDPR special-category data. Recital 51: images become
biometric only when processed "through a specific technical means allowing the unique
identification" of a person.

- Storing or displaying a profile photo — ordinary personal data
- Running face detection, recognition or matching on it — **Art. 9 biometric data**,
  requiring explicit consent and a DPIA

BIPA and Maryland trigger on **face-template extraction**, not on storage. Keep the product
on the display-only side of that line and state it in the DPIA and model card.

The live risk for photos in hiring is ordinary discrimination exposure: a facial image
reveals or implies race, ethnicity, approximate age, sex, and often disability or religion.
Pre-offer photo requests are disfavoured in the US and UK, while photo-on-CV remains
customary in parts of MENA and DACH. Sensible posture: default off, region-configurable,
an employer-facing risk notice, never any face processing, and photos excluded from
scoring — which is worth stating as a selling point.
