# Canonical document set

Filter by the product's real exposure before scoring. **REQ** = legally required ·
**EXP** = commercially expected (buyers ask) · **NTH** = nice-to-have · **COND** =
conditional on a trigger.

Researched and source-verified 2026-08-15. Re-verify any date before quoting it.

---

## Bucket 1 — Public-facing (linkable from the site footer)

| # | Document | Level | Driver | Where it lives |
|---|---|---|---|---|
| 1 | Terms of Service / Terms of Use | REQ | Contract formation; EU e-Commerce Dir. 2000/31/EC | Footer + signup |
| 2 | Privacy Policy (company as controller) | REQ | GDPR Arts. 12–14; CCPA §1798.130; Saudi PDPL Arts. 12–13 | Footer + in-product |
| 3 | Cookie Policy + working consent banner | REQ (EU/UK) | ePrivacy Dir. Art. 5(3); UK PECR; CCPA opt-out | Site + all web apps |
| 4 | Acceptable Use Policy | EXP | Contract; deployer-misuse risk shifting | Footer, referenced from ToS |
| 5 | Sub-processor list + change notification | REQ | GDPR Art. 28(2)/(4) | Public page + subscribe |
| 6 | Security overview / Trust page | EXP | SOC 2 / ISO market norm | Marketing site |
| 7 | Accessibility statement (+ VPAT) | REQ in EU | European Accessibility Act, Dir. 2019/882 (28 Jun 2025); ADA; UK Equality Act | Footer |
| 8 | End-user / candidate privacy notice — **separate document** | REQ | GDPR Arts. 13–14; ICO recruitment guidance | Point of collection + footer |
| 9 | Automated-processing disclosure | EXP→REQ | AI Act Art. 50; IL HB 3773; NYC LL144 | Site + in-product |
| 10 | Imprint / trading disclosure | REQ (DE, UK) | German DDG §5; **UK Companies Act 2006 s.82** — name, number, registered office | Footer |
| 11 | Refund / cancellation policy | EXP (REQ B2C in EU) | Consumer Rights Dir. 2011/83/EU | Site or inside ToS |

## Bucket 2 — Contractual

| # | Document | Level | Driver |
|---|---|---|---|
| 12 | MSA / Customer Agreement | REQ | Contract law |
| 13 | **DPA + annexes** (processing details, TOMs, sub-processor authorisation) | **REQ** | GDPR Art. 28(3) — its absence is itself a violation. The single most-requested doc in vendor review |
| 14 | EU SCCs, correct module (2 = C→P, 3 = P→P) | REQ for ex-EEA transfer | Commission Decision 2021/914 |
| 15 | UK IDTA or UK Addendum | REQ for ex-UK transfer | UK GDPR Art. 46 |
| 16 | EU-US Data Privacy Framework certification | NTH | Valid but unstable — CJEU appeal pending, EDPB reassessment requested Jul 2026. **Keep SCCs primary** |
| 17 | Saudi transfer safeguards + pre-transfer risk assessment | REQ for any ex-KSA flow | PDPL Art. 29; SDAIA Risk Assessment Guideline (Feb 2025) |
| 18 | Service Level Agreement | EXP | Market norm; mid-market deals stall without one |
| 19 | Order Form / SOW | REQ | Contract law |
| 20 | Business Associate Agreement | COND | HIPAA — but most HRIS employment records fall under the employment-records exclusion, 45 CFR §160.103 |
| 21 | Reseller / partner terms | NTH | Only once a channel exists |
| 22 | AI addendum — provider/deployer duty split, audit cooperation, no-sole-automated-decision covenant, training-data terms | EXP→REQ | AI Act Arts. 16–27; NYC LL144 |

## Bucket 3 — Internal / evidence

| # | Document | Level | Driver |
|---|---|---|---|
| 23 | ROPA (record of processing) | REQ | GDPR Art. 30. The ≤250-employee exemption does **not** apply to non-occasional or special-category processing |
| 24 | DPIA per high-risk processing | REQ | GDPR Art. 35(3)(a) — systematic evaluation/scoring is squarely in scope |
| 25 | Transfer Impact Assessment per route | REQ under SCCs | *Schrems II*; EDPB Rec. 01/2020 |
| 26 | Information Security Policy set (ISMS) | EXP | ISO 27001:2022 Annex A; SOC 2 TSC |
| 27 | Incident Response + Breach Notification plan | REQ-adjacent | GDPR Arts. 33–34 (72h); PDPL |
| 28 | Data Retention & Deletion schedule | REQ | GDPR Art. 5(1)(e) |
| 29 | Access Control Policy + RBAC matrix | EXP | ISO A.5.15–5.18; SOC 2 CC6 |
| 30 | BCP / DR plan + test evidence | EXP | ISO 22301; SOC 2 A1 |
| 31 | Vendor management policy + due-diligence records | REQ | GDPR Art. 28(4) |
| 32 | Employee confidentiality + AUP + training records | REQ | GDPR Art. 28(3)(b); ISO A.6 |
| 33 | SOC 2 Type II report, or ISO 27001 certificate + SoA | EXP (deal-blocking) | AICPA TSC; ISO 27001. Saudi buyers also recognise NCA ECC |
| 34 | DPO appointment + published contact | REQ-likely | GDPR Art. 37; SDAIA DPO Rules |
| 35 | EU / UK representative appointment | COND→REQ | GDPR Art. 27. **A UK-only company serving EU residents needs an EU representative** |
| 36 | Regulator registration | REQ | **UK: ICO registration + data protection fee** (DPA 2018 s.137). KSA: SDAIA National Register of Controllers |
| 37 | AI governance policy + model inventory | EXP | NIST AI RMF; ISO/IEC 42001 |

## Bucket 4 — Sector: hiring & HR technology

| # | Document | Level | Driver |
|---|---|---|---|
| 38 | EU AI Act technical file (Annex IV), QMS, conformity assessment, CE marking, EU-database registration, post-market monitoring | REQ by **2 Dec 2027** | Reg. 2024/1689 as amended by Reg. 2026/1744 |
| 39 | Instructions for use + human-oversight guidance for deployers | REQ by 2 Dec 2027 | AI Act Arts. 13–14, 26 |
| 40 | Art. 22 human-review procedure + logic-disclosure text | REQ | GDPR Art. 22, 13(2)(f); *SCHUFA* C-634/21 |
| 41 | Independent bias-audit report, annual and publishable | REQ for NYC customers | NYC LL144 |
| 42 | Candidate AEDT notice templates, per jurisdiction | REQ | LL144 (10 business days); IL HB 3773; CA ADMT pre-use notice |
| 43 | Adverse-impact testing methodology + results | EXP | Title VII; UGESP 29 CFR 1607 |
| 44 | Biometric consent + written release + public retention/destruction schedule | REQ if any face processing | BIPA; MD §3-717; GDPR Art. 9 |
| 45 | Video-interview consent + 30-day deletion SOP | REQ if video AI | Illinois AIVIA, 820 ILCS 42 |
| 46 | Photo-requirement risk notice (employer-facing) | NTH | Title VII evidence risk; Equality Act; data minimisation |
| 47 | CA ADMT pack — pre-use notice, opt-out, access response, risk assessment | REQ by **1 Jan 2027** | CCPA ADMT regs. CCPA covers CA employees and applicants |
| 48 | Colorado disclosure readiness note | Watch — 1 Jan 2027 | SB 26-189 |
| 49 | DSAR handling procedure + subject data-export tooling | REQ | GDPR Arts. 12, 15 |

## Bucket 5 — Ops / commercial

| # | Document | Level |
|---|---|---|
| 50 | Pre-filled SIG Lite + CAIQ v4 responses | EXP |
| 51 | Annual penetration-test summary letter | EXP |
| 52 | Insurance certificates — cyber liability, tech E&O, general liability | EXP |
| 53 | Status / uptime page with incident history | EXP |
| 54 | Support policy — channels, hours, severity matrix | EXP |
| 55 | Data-residency architecture one-pager | EXP |
| 56 | Model card / algorithmic transparency summary | EXP, rising fast in ATS RFPs |
| 57 | Vulnerability disclosure policy + `security.txt` | NTH→EXP |

---

## Trust-centre inventory

What a customer-facing trust page normally contains, for projects building one:

1. Compliance badges, each with report-request gating (NDA click-through for SOC 2)
2. Gated document library — SOC 2, pen-test letter, ISO certificate, COIs, SIG/CAIQ, DPA template, bias audit
3. Public policy links — privacy, end-user notice, cookie, ToS, AUP, accessibility
4. Sub-processor list + subscribe-to-changes
5. Security-controls inventory — encryption, SSO/MFA, RBAC, backups, SDLC, vuln management, logging
6. Data-residency map
7. Automated-decision transparency — model card, human-oversight statement, bias audit, AI Act readiness with an honest date
8. Status link, vulnerability disclosure, security + DSAR contacts, questionnaire FAQ
