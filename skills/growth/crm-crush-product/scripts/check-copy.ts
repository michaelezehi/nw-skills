/**
 * Checks a product's new email rows before they are saved, from the crush-crm
 * repo root:
 *
 *   npx tsx ~/.claude/skills/crm-crush-product/scripts/check-copy.ts <product.json> <rows.json>
 *
 * product.json: the product as `npx convex data products --format jsonLines` prints one row.
 * rows.json: the full emailTemplates array you are about to save.
 *
 * Prints one line per audience row, then "ALL VALID <n> rows" or "FAILED <k> of <n>".
 * Checks: the app's email validator with the one email rule set
 * (convex/lib/emailRules.ts: 50 to 80 words, a 1 to 4 word subject with no
 * question mark, no tagline, banned words), em and en dashes, the word "AI",
 * a translation for every product language, and one render through the send
 * path.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const lib = (name: string) => join(root, "convex/lib", name);

type Row = {
  audienceCategory?: string;
  subject: string;
  body: string;
  translations?: Array<{ language: string; subject: string; body: string }>;
};

async function main() {
  const [productPath, rowsPath] = process.argv.slice(2);
  if (!productPath || !rowsPath) throw new Error("usage: check-copy.ts <product.json> <rows.json>");
  const { validateEmail } = await import(lib("emailValidator"));
  const { EMAIL_RULES } = await import(lib("emailRules"));
  const { resolveProductTemplateEmailForSend } = await import(lib("productTemplateEmail"));

  const product = JSON.parse(readFileSync(productPath, "utf8"));
  const rows = JSON.parse(readFileSync(rowsPath, "utf8")) as Row[];
  const languages: string[] = (product.languages ?? ["en"]).filter((l: string) => l !== "en");
  const terms = [product.name, product.externalName].filter(Boolean);
  let bad = 0;

  for (const r of rows) {
    const problems: string[] = [];
    // The writer passes maxBodyWords + 1 with the rule set; the rule set's caps win.
    const v = validateEmail(r.subject, r.body, EMAIL_RULES.maxBodyWords + 1, {
      rules: EMAIL_RULES,
      allowedProductTerms: terms,
    });
    const warnings: string[] = [];
    for (const x of v.violations as Array<{ rule: string; found: string; severity: string }>) {
      (x.severity === "block" ? problems : warnings).push(`${x.rule}: ${x.found}`);
    }
    if (/[—–]/.test(JSON.stringify(r))) problems.push("em or en dash");
    if (/\bAI\b/.test(r.subject + r.body)) problems.push('the word "AI"');
    for (const language of languages) {
      if (!(r.translations ?? []).some((t) => t.language === language)) problems.push(`no ${language} translation`);
    }
    const tag = `${(r.audienceCategory || "base").padEnd(28)} ${String(v.wordCount).padStart(3)} words | ${r.subject}`;
    const warned = warnings.length ? `\n     warn: ${warnings.join("; ")}` : "";
    if (problems.length) {
      bad++;
      console.log(`FAIL ${tag}\n     ${problems.join("; ")}${warned}`);
    } else console.log(`ok   ${tag}${warned}`);
  }

  try {
    resolveProductTemplateEmailForSend({
      product: { ...product, emailTemplates: rows },
      variantStrategyKey: undefined,
      variantName: "email",
      contact: { firstName: "Sam", lastName: "Lee", company: "Acme", title: "CEO" },
      sender: { name: "Michael Ezehi", role: "CTO" },
    });
    console.log("render ok");
  } catch (err) {
    bad++;
    console.log(`render FAIL: ${(err as Error).message}`);
  }
  console.log(bad ? `FAILED ${bad} of ${rows.length}` : `ALL VALID ${rows.length} rows`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
