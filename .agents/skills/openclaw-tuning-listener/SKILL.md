---
name: Tuning Social Listener
description: Автономний Social Listening агент для відстеження трендів та аналізу конкурентів у преміум-сегменті автомобільного тюнінгу.
keywords: [social, marketing, tuning, monitoring, competitors]
version: "1.1.0"
---

# 🕵️‍♂️ Tuning Social Listener (OpenClaw Skill)

This skill configures the OpenClaw autonomous agent to act as a dedicated **Social Listening and Alert System**, tracking hashtags and directly monitoring competitors using `mariokarras/social-listening`, `opsun/deep-scraper`, and `gemini CLI`. ***ALL OUTPUTS MUST BE DELIVERED DIRECTLY TO TELEGRAM.***

## 🎯 Primary Directives

1. **Competitor & Trend Scraping**
   - **Trigger**: Run autonomously every 5 minutes.
   - **Action 1 (Trends)**: Monitor TikTok/Instagram for hashtags: `#tuning`, `#carbonfiber`, `#akrapovic`, `#brabus`, `#techart`, `#urbanautomotive`.
   - **Action 2 (Competitors)**: Scrape the latest posts from global and local competitors: `Atomic Shop`, `NoLimi`, `ECS Tuning`, `FCP Euro`, `TuningBlog`, `AutoID`.

2. **Scoring Engine**
   - Calculate a `Trend Score` for each post using:
     `ES = (Likes * 1.0) + (Comments * 2.5) + (Shares * 3.0) + (Views * 0.05)`
     `Trend Score = ES / ((Age_in_Hours + 2) ^ 1.5)`
   - Filter out posts older than 48 hours. Keep posts with a `Trend Score > 100`.

3. **Double-Engine Analysis Workflow**
   For every high-scoring post, perform a two-step analysis:
   - **Step 1 (Raw NER with Local Gemma4:26b)**: Use the local `ollama/gemma4:26b` model to quickly extract exact aftermarket brand names (e.g., "Eventuri", "RaceChip", "DO88"). Ignore OEM brands (BMW/Audi).
   - **Step 2 (Deep Marketing Synthesis with Gemini CLI)**: Call the system `gemini` CLI tool with the scraped post text/metadata:
     > "Аналізуй цей пост конкурента або тренду. One Company - це Stealth Wealth (тиха розкіш), має потужний B2B портал, 100% сумісність. Що конкурент робить погано (застарілий UI, немає емоції) і як One Company може подати цей товар краще? Згенеруй готову структуру нашого Reels/Посту з урахуванням нашого Cinematic Lifestyle USP."

4. **Direct Telegram Reporting**
   - You MUST send the final compiled report DIRECTLY to the Telegram Chat IDs `478891619` and `640155319` using HTML markup.
   - **Alert Format (Telegram HTML):**
     🔥 <b>Trending / Competitor Alert! (Score: {{trend_score}})</b>
     👤 <b>Автор/Конкурент:</b> {{source_author}}
     🔗 <a href="{{post_url}}">Дивитись оригінал</a>
     👀 <b>Views:</b> {{views}} | 💬 <b>Залученість:</b> {{engagement_stats}}
     
     💡 <b>Деталі знайдені (Gemma4:26b):</b> {{extracted_brands}}
     
     🤖 <b>Gemini Аналіз Конкурента & Action Plan для One Company:</b>
     {{gemini_analysis_text}}

## 🧠 Behavior & Constraints
- DO NOT formulate reports locally in the terminal output, ALWAYS push the payload to the Telegram integration.
- Execute `gemini` commands on the host OS to offload heavy creative synthesis and competitor strategy.
- Use local `ollama/gemma4:26b` for quick tagging to save Gemini API costs.
- Maintain memory in `~/.openclaw/memory/` and never notify about the exact same post ID twice.
