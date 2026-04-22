from __future__ import annotations

from pathlib import Path

import typer

from app.classifier import MarketSignalClassifier
from app.config import load_config
from app.dedupe import find_duplicates, remove_duplicates
from app.export import export_entries
from app.formatter import format_analysis_preview
from app.models import SourceCandidate, TargetFile
from app.review import build_review_summary, build_weekly_digest, render_review_summary, render_weekly_digest
from app.sources import fetch_url_metadata, load_candidates_from_file
from app.storage import MarketStorage
from app.utils import prompt_multiline, setup_logging, split_csv_like

app = typer.Typer(help="One Company local-first B2B automotive market intelligence CLI.")


def _bootstrap() -> tuple[MarketStorage, MarketSignalClassifier]:
    config = load_config()
    setup_logging(config.logs_dir / "app.log")
    storage = MarketStorage(config)
    storage.ensure_data_files()
    classifier = MarketSignalClassifier(config)
    return storage, classifier


def _save_or_preview(storage: MarketStorage, result, *, force: bool, save: bool | None = None) -> None:
    typer.echo(format_analysis_preview(result))
    should_save = result.should_auto_save or force or bool(save)
    if should_save:
        path = storage.append_entry(result.entry)
        typer.echo(f"\nSaved to {path}")
    else:
        typer.echo("\nPreview only. Use --force or a higher-signal source to save.")


@app.command("add-source")
def add_source(
    title: str = typer.Option(..., prompt=True),
    platform: str = typer.Option(..., prompt=True),
    url: str = typer.Option("", prompt="URL", show_default=False),
    brands: str = typer.Option("", help="Comma-separated brand names."),
    vehicles: str = typer.Option("", help="Comma-separated vehicle platforms."),
    force: bool = typer.Option(False, "--force", help="Save even when below score threshold."),
) -> None:
    storage, classifier = _bootstrap()
    raw_notes = prompt_multiline("Paste raw notes.")
    copied_comments = prompt_multiline("Paste copied comments or quick observations.")
    candidate = SourceCandidate(
        title=title,
        platform=platform,
        url=url,
        raw_notes=raw_notes,
        copied_comments=copied_comments,
        brand_names=split_csv_like(brands),
        vehicle_platforms=split_csv_like(vehicles),
    )
    result = classifier.analyze(candidate)
    _save_or_preview(storage, result, force=force)


@app.command("batch-import")
def batch_import(
    file_path: Path = typer.Argument(..., exists=True, readable=True),
    force: bool = typer.Option(False, "--force", help="Save all analyzed entries regardless of score."),
    dry_run: bool = typer.Option(False, "--dry-run", help="Analyze everything without saving."),
) -> None:
    storage, classifier = _bootstrap()
    candidates = load_candidates_from_file(file_path)
    saved = 0
    for index, candidate in enumerate(candidates, start=1):
        typer.echo(f"\n## {index}. {candidate.title}")
        result = classifier.analyze(candidate)
        typer.echo(format_analysis_preview(result))
        if not dry_run and (result.should_auto_save or force):
            storage.append_entry(result.entry)
            saved += 1
    typer.echo(f"\nProcessed: {len(candidates)} | Saved: {saved} | Dry-run: {'yes' if dry_run else 'no'}")


@app.command("analyze-text")
def analyze_text(
    title: str = typer.Option(..., prompt=True),
    platform: str = typer.Option("Other", prompt=True),
    url: str = typer.Option("", help="Optional source URL."),
    brands: str = typer.Option("", help="Comma-separated brand names."),
    vehicles: str = typer.Option("", help="Comma-separated vehicle platforms."),
    save: bool = typer.Option(False, "--save", help="Save the result if the analysis is useful."),
    force: bool = typer.Option(False, "--force", help="Save even when below threshold."),
) -> None:
    storage, classifier = _bootstrap()
    text = prompt_multiline("Paste the raw text you want to analyze.")
    candidate = SourceCandidate(
        title=title,
        platform=platform,
        url=url,
        raw_notes=text,
        copied_comments="",
        brand_names=split_csv_like(brands),
        vehicle_platforms=split_csv_like(vehicles),
    )
    result = classifier.analyze(candidate)
    _save_or_preview(storage, result, force=force, save=save)


@app.command("analyze-url")
def analyze_url(
    url: str = typer.Argument(...),
    title: str = typer.Option("", help="Optional manual title override."),
    platform: str = typer.Option("Brand Site", help="Platform hint."),
    brands: str = typer.Option("", help="Comma-separated brand names."),
    vehicles: str = typer.Option("", help="Comma-separated vehicle platforms."),
    save: bool = typer.Option(False, "--save", help="Save the analysis."),
    force: bool = typer.Option(False, "--force", help="Save even when below threshold."),
) -> None:
    storage, classifier = _bootstrap()
    metadata = fetch_url_metadata(url)
    manual_notes = prompt_multiline("Add manual notes for this URL placeholder analysis.")
    candidate = SourceCandidate(
        title=title or metadata.get("meta_title") or url,
        platform=platform,
        url=url,
        raw_notes=manual_notes,
        copied_comments=metadata.get("meta_description", ""),
        brand_names=split_csv_like(brands),
        vehicle_platforms=split_csv_like(vehicles),
        meta_title=metadata.get("meta_title"),
        meta_description=metadata.get("meta_description"),
    )
    result = classifier.analyze(candidate)
    _save_or_preview(storage, result, force=force, save=save)


@app.command("review-file")
def review_file(target_file: TargetFile = typer.Argument(...)) -> None:
    storage, _classifier = _bootstrap()
    parsed = storage.load_file(target_file)
    summary = build_review_summary(parsed.target_file.markdown_filename, parsed.entries)
    typer.echo(render_review_summary(summary))


@app.command("weekly-digest")
def weekly_digest() -> None:
    storage, _classifier = _bootstrap()
    parsed_files = storage.load_all()
    summary = build_weekly_digest(parsed_files)
    typer.echo(render_weekly_digest(summary))


@app.command("dedupe")
def dedupe(
    dry_run: bool = typer.Option(True, "--dry-run/--apply", help="Dry-run by default."),
    threshold: float = typer.Option(None, help="Override fuzzy similarity threshold."),
) -> None:
    storage, _classifier = _bootstrap()
    applied = 0
    total_matches = 0
    dedupe_threshold = threshold if threshold is not None else storage.config.fuzzy_dedupe_threshold
    for parsed in storage.load_all():
        duplicates = find_duplicates(parsed.target_file, parsed.entries, dedupe_threshold)
        if not duplicates:
            continue
        total_matches += len(duplicates)
        typer.echo(f"\n## {parsed.target_file.markdown_filename}")
        for item in duplicates:
            typer.echo(
                f"- {item.kept_entry.resource_name} <= duplicate {item.duplicate_entry.resource_name} "
                f"(similarity {item.similarity}, {item.reason})"
            )
        if not dry_run:
            updated_entries = remove_duplicates(parsed.entries, duplicates)
            storage.rewrite_file(parsed.target_file, updated_entries)
            applied += len(duplicates)
    typer.echo(f"\nPotential duplicates: {total_matches} | Applied removals: {applied if not dry_run else 0}")


@app.command("export-json")
def export_json(output: Path | None = typer.Option(None, "--output", help="Optional output file path.")) -> None:
    storage, _classifier = _bootstrap()
    entries = []
    for parsed in storage.load_all():
        entries.extend(parsed.entries)
    payload = export_entries(entries, output)
    if output:
        typer.echo(f"Exported to {output}")
    else:
        typer.echo(payload)


if __name__ == "__main__":
    app()

