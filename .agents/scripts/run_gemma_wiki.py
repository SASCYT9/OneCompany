import os
import requests
import json

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL = "gemma4:26b"
WIKI_DIR = r"d:\OneCompany\wiki"

def query_gemma(system_context, task_instruction):
    print(f"Querying Gemma 4: {task_instruction[:50]}...")
    prompt = f"""<system>
You are an expert technical writer and Obsidian Wiki architect for "One Company".
You output ONLY valid Markdown. ALWAYS include YAML frontmatter.
Use callouts like > [!info] and Mermaid diagrams where appropriate.
All pages must have a backlink: `← [[Home]]`.
</system>

<context>
{system_context}
</context>

<instruction>
{task_instruction}
Output the final markdown content ONLY. Do not include introductory text.
</instruction>"""
    
    payload = {
        "model": MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {
            "num_ctx": 4096,  # Use smaller context to ensure RAM fits
            "temperature": 0.3
        }
    }
    
    try:
        response = requests.post(OLLAMA_URL, json=payload, timeout=300)
        response.raise_for_status()
        output = response.json().get('response', '').strip()
        # Clean markdown code blocks if the model wrapped it
        if output.startswith("```markdown"):
            output = output[11:]
        if output.endswith("```"):
            output = output[:-3]
        return output.strip()
    except Exception as e:
        print(f"Error querying Gemma: {e}")
        return ""

def save_file(filename, content):
    if not content:
        print(f"Skipping {filename} due to empty content.")
        return
    path = os.path.join(WIKI_DIR, filename)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"✅ Created/Updated: {filename}")

context = """
One Company is a premium auto-tuning portal (B2B/B2C).
Stack: Next.js 14, Prisma, PostgreSQL, Vercel, Tailwind CSS.
Design: "Stealth Wealth" (black, bronze #c29d59, glassmorphism).
"""

tasks = {
    "About One Company.md": """Write a comprehensive company overview. 
Include: Business model (Turn14 import + EU import), Stack, Domain (onecompany.global), Languages (UA/EN), Currencies (UAH, EUR, USD), Design philosophy, Target audience.
Tags: [about, company, overview].
""",
    
    "Shopify Storefronts.md": """Create documentation for Shopify storefronts.
Eventuri (eventuri.onecompany.global - intakes, multi-lang) and KW Automotive (kw.onecompany.global - suspension).
Mention GitHub version control for themes and Python catalog converters.
Tags: [shopify, storefront, brand].
""",
    
    "Deployment & Infrastructure.md": """Document server infrastructure.
Includes Vercel (hosting/CDN), Supabase (PostgreSQL/Auth/Storage), GitHub (code), Shopify (storefronts), Cloudflare (DNS), Ollama + LiteLLM (local AI).
Include a Mermaid flowchart connecting them.
Tags: [infrastructure, devops, architecture].
""",
    
    "Revenue Model.md": """Describe the business revenue model.
Include B2C margin (RRP - Cost), B2B margin (volume based), Shopify standalone income, and potential Dropshipping (Phase G).
Tags: [business, revenue, model].
""",

    "Project Timeline.md": """Create a timeline of the project.
Phase A: Security (✅ Dec 2025)
Phase B: Catalog (✅ Jan 2026)
Phase C: Storefront (✅ Feb 2026)
Phase D: Orders (✅ Mar 2026)
Phase E: CSV Import (✅ Mar 2026)
Phase F: SEO (✅ Apr 2026)
Shopify Integration (✅ Apr 2026)
AI Agent Syndicate (✅ Apr 2026)
Use a bulleted list or markdown timeline.
Tags: [timeline, roadmap, management].
"""
}

def run():
    print("🚀 Starting Obsidian Wiki Improvement via Gemma 4 Agent...")
    for filename, instruction in tasks.items():
        content = query_gemma(context, instruction)
        save_file(filename, content)
    print("🎉 All tasks completed!")

if __name__ == "__main__":
    run()
