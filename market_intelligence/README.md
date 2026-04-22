# One Company Market Intelligence

Local-first B2B automotive / moto market intelligence system for One Company.

This tool is built for One Company as a premium automotive and motorcycle tuning distributor. It is not a generic trend scraper and it is not aimed at low-ticket mass-market accessories. Its purpose is to help the team collect only commercially meaningful signals for:

- catalog expansion
- B2B sales
- partner outreach
- fitment support
- content production
- market monitoring

## What It Tracks

The project stores signals in exactly 5 markdown source-of-truth files inside `data/`:

- `data/trends_product_demand.md`
- `data/trends_b2b_partner_signals.md`
- `data/trends_fitment_and_pain_points.md`
- `data/creatives_marketing.md`
- `data/trends_market_watch.md`

Each saved record is written in Ukrainian and follows the same structured template so the files stay readable by humans and machine-parsable by the CLI.

## Local-First Model Setup

The default local model endpoint is:

- `http://localhost:11434/api/generate`

The default model is:

- `llama3.1:8b-instruct`

### Install Ollama

1. Install Ollama locally from [https://ollama.com](https://ollama.com)
2. Start the Ollama server:

```powershell
ollama serve
```

3. Pull a local Llama model:

```powershell
ollama pull llama3.1:8b-instruct
```

You can change the model or endpoint with environment variables:

```powershell
$env:ONECO_MI_OLLAMA_MODEL="llama3.1:8b-instruct"
$env:ONECO_MI_OLLAMA_ENDPOINT="http://localhost:11434/api/generate"
$env:ONECO_MI_OLLAMA_TEMPERATURE="0.2"
```

## Python Setup

This project expects Python 3.11+.

On this machine, `python` may point to 3.10, so prefer the launcher:

```powershell
py -3 -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Project Structure

```text
market_intelligence/
  app/
    cli.py
    config.py
    llm_client.py
    models.py
    classifier.py
    scoring.py
    formatter.py
    storage.py
    parser.py
    review.py
    dedupe.py
    export.py
    sources.py
    prompts.py
    utils.py
  data/
    trends_product_demand.md
    trends_b2b_partner_signals.md
    trends_fitment_and_pain_points.md
    creatives_marketing.md
    trends_market_watch.md
  logs/
    app.log
  tests/
    test_formatter.py
    test_storage.py
    test_dedupe.py
    test_classifier.py
    test_scoring.py
  requirements.txt
  README.md
```

## CLI Commands

Run commands from `D:\OneCompany\market_intelligence`.

### `add-source`

Interactive workflow for manual source capture. It asks for title, platform, URL, notes, comments, optional brands, and optional vehicle platforms. It then:

- calls the local Llama model
- classifies the source into exactly one target file
- estimates score
- renders a markdown preview
- auto-saves if score is at or above threshold

Example:

```powershell
py -3 -m app.cli add-source --title "Akrapovic G80 reel" --platform Instagram --url "https://instagram.com/example"
```

### `batch-import`

Process multiple candidate sources from CSV or JSON.

Example:

```powershell
py -3 -m app.cli batch-import .\imports\candidate_sources.csv --dry-run
py -3 -m app.cli batch-import .\imports\candidate_sources.json --force
```

Supported input columns / keys:

- `title`
- `platform`
- `url`
- `raw_notes`
- `copied_comments`
- `brand_names` or `brands`
- `vehicle_platforms` or `vehicles`

### `analyze-text`

Analyze pasted comments, notes, captions, forum text, or launch blurbs.

```powershell
py -3 -m app.cli analyze-text --title "Eventuri 992 fitment notes" --platform Forum
```

### `analyze-url`

V1 placeholder URL analyzer:

- fetches page title
- fetches meta description / OG description where possible
- lets you add manual notes
- analyzes the payload with the local model

```powershell
py -3 -m app.cli analyze-url "https://example.com/new-launch" --platform "Brand Site" --save
```

### `review-file`

Generate a practical summary for one target file.

```powershell
py -3 -m app.cli review-file trends_product_demand
py -3 -m app.cli review-file trends_fitment_and_pain_points
```

### `weekly-digest`

Read all five files and produce a weekly decision-oriented digest.

```powershell
py -3 -m app.cli weekly-digest
```

### `dedupe`

Detect likely duplicates using normalized URL, normalized title, and fuzzy similarity.

```powershell
py -3 -m app.cli dedupe --dry-run
py -3 -m app.cli dedupe --apply
```

### `export-json`

Convert all markdown entries into structured JSON.

```powershell
py -3 -m app.cli export-json
py -3 -m app.cli export-json --output .\exports\market_intelligence.json
```

## Scoring Model

The system scores each source from 0 to 100 using these weighted dimensions:

- Buying Intent: `0-30`
- B2B Relevance: `0-20`
- Fitment / Partner Utility: `0-15`
- Premium Product Fit: `0-15`
- Content Utility: `0-10`
- Market Significance: `0-5`
- Confidence: `0-5`

Default save threshold:

- `score >= 60` => auto-save
- `score < 60` => preview only unless `--force` is used

The markdown files do not print the score by default. Scores are kept in structured CLI/export output and can be rehydrated from saved entries during review and export.

## Internal Prompting

Prompt templates live in:

- `app/prompts.py`

Included prompt families:

- source classification
- entry generation
- score estimation
- weekly review
- weak-entry detection
- malformed JSON repair

The local model is instructed to:

- write in practical Ukrainian
- stay conservative
- avoid invented facts
- preserve original brand and platform naming
- return JSON only

## Demo Data

The project ships with realistic demo entries for:

- Akrapovic BMW G80 / G82 exhaust demand
- KW suspension installer-led B2B demand
- Eventuri Porsche 992 Turbo S fitment friction
- HRE Wheels premium creative reference
- Urban Automotive Defender OCTA market-watch signal

These are only demonstration examples for baseline testing and workflow validation.

## Tests

Run:

```powershell
py -3 -m pytest
```

Covered areas:

- formatter output
- storage and parsing
- duplicate detection
- classifier workflow with stubbed LLM
- scoring logic

## Extension Ideas

V1 intentionally avoids brittle or ToS-breaking scraping. It is structured so source adapters can be added later for:

- TikTok
- Instagram
- YouTube
- Telegram
- Reddit
- public forums
- manufacturer launch pages
- dealer pages
- marketplace pages

Likely next steps:

- richer URL adapters
- light source watchlists
- weekly scheduled automation
- richer platform-specific metadata extractors
- multi-source clustering around the same brand / platform / fitment opportunity

