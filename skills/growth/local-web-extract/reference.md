# local-web-extract — extra

## Why not ScrapeGraph cloud

ScrapeGraphAI OSS is Playwright + *your* LLM. Their MCP is Playwright-in-the-cloud + *their* credits. This skill keeps fetch on the laptop and uses the Cursor/Claude conversation as the LLM, which is what “use the subscription” means. The IDE model is not an Anthropic API key ScrapeGraph’s Python library can call.

## Banned vs warn

`scripts/banned.py`

- **Banned:** `linkedin.com`, `instagram.com`, `tiktok.com`, `youtube.com`, `youtu.be` (all hosts/subdomains).
- **Warn (need `--allow-warn` and an explicit user override):** `crunchbase.com`, `clutch.co`, `g2.com`.

## Crush handoff

`rows.csv` columns: `source_url,company_name,description,industry,website,email,phone,people,notes`

Crush import wants `first_name,last_name,job_title,company,email,...`. Map later in the UI or with `my-contact-research`. Do not call Convex from this skill.

## Optional: unattended OSS ScrapeGraphAI

Only if the user asks for a no-agent batch and accepts a **separate** LLM (Ollama or OpenAI/Anthropic API keys — not Cursor):

```bash
python3 -m venv ~/Documents/local-web-extract/.sgai-venv
# then pip install scrapegraphai && playwright install
export SCRAPEGRAPHAI_TELEMETRY_ENABLED=false
```

Ollama example (`ollama pull llama3.2` first):

```python
from scrapegraphai.graphs import SmartScraperGraph

graph = SmartScraperGraph(
    prompt="Extract company name, description, published emails only",
    source="https://example.com/about",
    config={
        "llm": {
            "model": "ollama/llama3.2",
            "base_url": "http://localhost:11434",
            "model_tokens": 8192,
            "format": "json",
            "temperature": 0,
        },
        "headless": True,
        "verbose": False,
    },
)
print(graph.run())
```

Still run URLs through `banned.py` first. Still drop emails that were not on the page. Still write outside crush-crm.

Do not add this stack to Crush `package.json` or Convex.
