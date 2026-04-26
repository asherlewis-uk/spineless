# Spineless Meta-Builder

This directory is the **meta-orchestrator** that builds Spineless. It is not part
of the Spineless product runtime and must never be imported, bundled, or
deployed alongside the Next.js application.

## Architectural boundary

| Layer                       | Lives in                    | Runs at                 |
| --------------------------- | --------------------------- | ----------------------- |
| Spineless product runtime   | `src/` (TypeScript)         | Vercel / Next.js server |
| **Meta-builder (this dir)** | `scripts/builder/` (Python) | Developer machine only  |

The meta-builder reads `docs/` (the product spec), drives a two-tier LLM
workflow against a local Ollama daemon, and writes generated TypeScript
into `src/`. Nothing in `src/` ever imports from this directory.

## Two-tier workflow

1. **Project Manager** — `deepseek-v3.2:cloud` reads the spec and the task,
   emits a strict JSON structural plan honoring document precedence
   (docs 08–10 supersede 00–07; doc 10 supersedes 08–09).
2. **Coder** — `qwen3-coder:480b-cloud` consumes the plan and emits
   Next.js / TypeScript code blocks tagged with target paths.
3. **File writer** — extracts ` ```typescript path=... ` fenced blocks
   from the Coder response and writes each to its declared path under `src/`.

## Prerequisites

- A local Ollama daemon running at `http://localhost:11434`.
- Both cloud models available to that daemon
  (`ollama pull deepseek-v3.2:cloud`, `ollama pull qwen3-coder:480b-cloud`).
- Python 3.10+. Only stdlib + `requests` is used.

```bash
python3 -m pip install --user requests
```

## Usage

```bash
python3 scripts/builder/orchestrator.py "Add an Input Card schema validator"
```

Add `--dry-run` to print the Coder output without writing files.
Add `--plan-only` to stop after the Project Manager step.
