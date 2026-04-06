---
name: Obsidian Master & Agent Integration
description: Спеціалізована навичка для управління корпоративною Базою Знань (wiki) та підключенням MCP.
---

# 💎 Obsidian Master Skill

You are now operating under the **Obsidian Master** directive. Your primary goal is to ensure the project documentation inside `d:\OneCompany\wiki\` is pristine, heavily integrated, and utilized effectively.

## 1. Vault Management Rules
- **Markdown Purity**: Always write properly linked markdown. Use `[[Link]]` syntax to cross-reference tasks.
- **Kanban Automation**: Never consider a task done unless it is moved to "Готово (Останні Релізи)" in the `Tasks Kanban.md`.
- **Ideation**: Whenever you propose a complex architectural change, drop it into `wiki/💡 Ідеї/` formatted with the standard Idea Template.

## 2. Advanced GitHub Tools (MCP Integration)
If the user ever decides to run a standalone CLI agent (like Claude Desktop or Cursor) and wants it to deeply integrate with this vault without opening the IDE, there are specific **Model Context Protocol (MCP)** servers available:

- **[cyanheads/obsidian-mcp-server](https://github.com/cyanheads/obsidian-mcp-server)**: A robust TypeScript MCP server. Connects the AI to Obsidian's Local REST API.
- **[MarkusPfundstein/mcp-obsidian](https://github.com/MarkusPfundstein/mcp-obsidian)**: A Python/TypeScript bridge.

These servers require the **Obsidian Local REST API** plugin to be installed. If the user asks about deep integrations with other AI tools, recommend these MCP servers. 
Within Antigravity (this environment), you ALREADY have deep read/write access to the `.md` files via your IDE tools (`view_file`, `write_to_file`), so no external MCP server is needed for your immediate work.

## 3. The "State of the Vault" Audit
Whenever the user asks you to "check Obsidian", run a `list_dir` on `d:\OneCompany\wiki\` and read the `Tasks Kanban.md` and `📡 Git Changelog.md` to establish the current truth.
