#!/usr/bin/env python3
"""
Spineless meta-builder orchestrator.

ARCHITECTURAL ROLE
------------------
This script is the *builder* of Spineless, not part of Spineless. It runs on a
developer machine, talks to a local Ollama daemon, and writes generated
TypeScript into ``src/``. It must never be packaged, imported, or deployed with
the Next.js application.

WORKFLOW
--------
1. Load the canonical spec from ``docs/`` and inject as system prompt.
   Document precedence is enforced explicitly: docs 08-10 supersede 00-07,
   doc 10 supersedes 08-09.
2. Project Manager (``deepseek-v3.2:cloud``) emits a strict-JSON structural
   plan describing files to create / modify and their high-level intent.
3. Coder (``qwen3-coder:480b-cloud``) consumes the plan and emits TypeScript
   inside fenced code blocks tagged with ``path=...``.
4. File writer extracts each fenced block, validates the path stays inside
   ``src/``, and writes the file.

USAGE
-----
    python3 scripts/builder/orchestrator.py "describe the task in plain English"
    python3 scripts/builder/orchestrator.py --plan-only "..."
    python3 scripts/builder/orchestrator.py --dry-run "..."
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import requests

# ── Configuration ───────────────────────────────────────────────────────────

OLLAMA_URL = "http://localhost:11434/api/chat"
PROJECT_MANAGER_MODEL = "deepseek-v3.2:cloud"
CODER_MODEL = "qwen3-coder:480b-cloud"
REQUEST_TIMEOUT_SECONDS = 600  # cloud models can be slow on first call

REPO_ROOT = Path(__file__).resolve().parents[2]
DOCS_DIR = REPO_ROOT / "docs"
SRC_DIR = REPO_ROOT / "src"

# Only these document filenames are loaded as context, in this order.
# Higher-numbered docs are listed last so the model reads them last and they
# anchor its working memory — doc 10 is the final word.
DOC_FILE_PATTERN = re.compile(r"^spineless_(\d{2})_.*\.md$")

# A fenced TypeScript block tagged with an explicit target path:
#   ```typescript path=src/foo/bar.ts
#   ...code...
#   ```
# We accept ``ts`` as an alias and tolerate quoted paths.
CODE_BLOCK_PATTERN = re.compile(
    r"```(?:typescript|ts)\s+path=\"?(?P<path>[^\s\"`]+)\"?\s*\n"
    r"(?P<body>.*?)\n```",
    re.DOTALL,
)


# ── Document loader ─────────────────────────────────────────────────────────


def load_spec_documents(docs_dir: Path) -> str:
    """Concatenate all spineless_NN_*.md files in numeric order.

    Document precedence is reinforced in the header so the model resolves
    conflicts in favor of higher-numbered docs.
    """
    if not docs_dir.is_dir():
        raise FileNotFoundError(f"Spec directory not found: {docs_dir}")

    entries: list[tuple[int, Path]] = []
    for path in docs_dir.iterdir():
        match = DOC_FILE_PATTERN.match(path.name)
        if match:
            entries.append((int(match.group(1)), path))
    if not entries:
        raise FileNotFoundError(f"No spineless_NN_*.md files in {docs_dir}")
    entries.sort(key=lambda x: x[0])

    parts: list[str] = [
        "You are working from the Spineless product specification.",
        "Document precedence is load-bearing:",
        "  - Documents 08-10 are implementation canon and supersede 00-07.",
        "  - Document 10 supersedes 08 and 09 wherever they conflict.",
        "When sources conflict, the higher-numbered document controls.",
        "",
    ]
    for _, path in entries:
        parts.append(f"=== BEGIN {path.name} ===")
        parts.append(path.read_text(encoding="utf-8"))
        parts.append(f"=== END {path.name} ===")
        parts.append("")
    return "\n".join(parts)

# ── Preflight ─────────────────────────────────────────────────────────────────


def assert_ollama_models_available(models: list[str]) -> None:
    """Verify the Ollama daemon is reachable and all required models are present.

    Calls ``GET /api/tags`` and checks each model name against the returned list.
    Raises ``RuntimeError`` with an actionable message on any failure so the
    developer knows exactly what to fix before spending time loading the spec.
    """
    try:
        resp = requests.get(
            OLLAMA_URL.replace("/api/chat", "/api/tags"),
            timeout=10,
        )
    except requests.RequestException as exc:
        raise RuntimeError(
            f"Cannot reach Ollama daemon at {OLLAMA_URL}. "
            f"Start it with `ollama serve` and retry.\nError: {exc}"
        ) from exc

    if resp.status_code != 200:
        raise RuntimeError(
            f"Ollama /api/tags returned HTTP {resp.status_code}: {resp.text[:300]}"
        )

    available: set[str] = {
        m.get("name", "") for m in resp.json().get("models", [])
    }
    missing = [m for m in models if m not in available]
    if missing:
        pull_cmds = "\n".join(f"  ollama pull {m}" for m in missing)
        raise RuntimeError(
            f"Required model(s) not found in Ollama:\n"
            + "\n".join(f"  - {m}" for m in missing)
            + f"\n\nPull them with:\n{pull_cmds}"
        )

# ── Ollama client ───────────────────────────────────────────────────────────


@dataclass(frozen=True)
class ChatMessage:
    role: str  # "system" | "user" | "assistant"
    content: str

    def to_dict(self) -> dict[str, str]:
        return {"role": self.role, "content": self.content}


def call_ollama(
    *,
    model: str,
    messages: Iterable[ChatMessage],
    json_mode: bool,
    temperature: float = 0.0,
) -> str:
    """Invoke the local Ollama daemon and return the assistant message text.

    ``json_mode`` toggles Ollama's structured-output flag so the Project
    Manager step is forced to return parseable JSON.
    """
    payload: dict[str, object] = {
        "model": model,
        "messages": [m.to_dict() for m in messages],
        "stream": False,
        "options": {"temperature": temperature},
    }
    if json_mode:
        payload["format"] = "json"

    try:
        response = requests.post(
            OLLAMA_URL,
            json=payload,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
    except requests.RequestException as exc:
        raise RuntimeError(
            f"Ollama transport error calling {model}: {exc}"
        ) from exc

    if response.status_code != 200:
        raise RuntimeError(
            f"Ollama returned HTTP {response.status_code} for {model}: "
            f"{response.text[:500]}"
        )

    body = response.json()
    message = body.get("message") or {}
    content = message.get("content")
    if not isinstance(content, str) or not content:
        raise RuntimeError(
            f"Ollama response from {model} contained no message content: "
            f"{json.dumps(body)[:500]}"
        )
    return content


# ── Step 1: Project Manager ─────────────────────────────────────────────────

PROJECT_MANAGER_SYSTEM = """\
You are the Project Manager step of the Spineless meta-builder.

INPUTS
- The full Spineless spec (above this section).
- A single task description from the developer.

OUTPUT
Return ONLY a JSON object with this exact shape:

{
  "intent": "<one sentence summarizing the change>",
  "respectsPrecedence": true,
  "files": [
    {
      "path": "src/<relative path under src/>",
      "operation": "create" | "modify",
      "purpose": "<what this file does>",
      "constraints": ["<spec rule the implementation must obey>", ...]
    }
  ],
  "notes": ["<any cross-cutting concerns the Coder must respect>", ...]
}

RULES
- Every path MUST start with "src/". Never propose paths outside src/.
- Resolve all spec conflicts in favor of higher-numbered documents (10 > 09 > 08 > 00-07).
- Do not include code, prose, or explanation outside the JSON object.
- If the task is impossible without violating the spec, return:
    {"intent": "<reason>", "respectsPrecedence": true, "files": [], "notes": ["BLOCKED: <reason>"]}
"""


def run_project_manager(
    spec: str,
    task: str,
) -> dict[str, object]:
    raw = call_ollama(
        model=PROJECT_MANAGER_MODEL,
        messages=[
            ChatMessage("system", PROJECT_MANAGER_SYSTEM + "\n\n" + spec),
            ChatMessage("user", f"TASK:\n{task}"),
        ],
        json_mode=True,
    )
    try:
        plan = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RuntimeError(
            f"Project Manager returned non-JSON output: {exc}\n"
            f"Raw response (truncated):\n{raw[:1000]}"
        ) from exc

    if not isinstance(plan, dict):
        raise RuntimeError(
            f"Project Manager output must be a JSON object, got: {type(plan).__name__}"
        )
    files = plan.get("files")
    if not isinstance(files, list):
        raise RuntimeError("Project Manager plan missing 'files' list.")
    for entry in files:
        if not isinstance(entry, dict) or "path" not in entry:
            raise RuntimeError(f"Malformed file entry in plan: {entry!r}")
        path = entry["path"]
        if not isinstance(path, str) or not path.startswith("src/"):
            raise RuntimeError(
                f"Plan proposes path outside src/: {path!r}. Refusing."
            )
    return plan


# ── Step 2: Coder ───────────────────────────────────────────────────────────

CODER_SYSTEM = """\
You are the Coder step of the Spineless meta-builder.

INPUT
- The full Spineless spec (above this section).
- A JSON structural plan produced by the Project Manager.

OUTPUT
For every file in the plan's "files" array, emit exactly one fenced code block
of this form (and nothing else for that file):

```typescript path=src/relative/path.ts
// full file contents, ready to write to disk
```

RULES
- Use the EXACT path given in the plan. Never invent new paths.
- Emit one fenced block per file. Do not split a file across blocks.
- Every file must be self-contained, complete, and free of placeholder TODOs.
- TypeScript must satisfy strict mode with exactOptionalPropertyTypes,
  noUncheckedIndexedAccess, verbatimModuleSyntax, ESM, and ".js" import
  suffixes for relative imports.
- Do not invent runtime dependencies beyond what the spec authorizes.
- Conform to all "constraints" listed for each file in the plan.
- Outside the fenced blocks, you may include short prose, but the file writer
  ignores everything outside ```typescript path=...``` blocks.
"""


def run_coder(spec: str, plan: dict[str, object]) -> str:
    plan_json = json.dumps(plan, indent=2)
    return call_ollama(
        model=CODER_MODEL,
        messages=[
            ChatMessage("system", CODER_SYSTEM + "\n\n" + spec),
            ChatMessage(
                "user",
                "Emit fenced TypeScript blocks for every file in this plan:\n\n"
                + plan_json,
            ),
        ],
        json_mode=False,
    )


# ── Step 3: File writer ─────────────────────────────────────────────────────


@dataclass(frozen=True)
class GeneratedFile:
    relative_path: str
    body: str


def extract_generated_files(coder_output: str) -> list[GeneratedFile]:
    """Pull every ```typescript path=...``` fenced block out of the response."""
    files: list[GeneratedFile] = []
    for match in CODE_BLOCK_PATTERN.finditer(coder_output):
        files.append(
            GeneratedFile(
                relative_path=match.group("path").strip(),
                body=match.group("body"),
            )
        )
    return files


def _resolve_safe_target(relative_path: str) -> Path:
    """Resolve a plan-declared path under src/, refusing escapes."""
    if not relative_path.startswith("src/"):
        raise ValueError(
            f"Refusing to write outside src/: {relative_path!r}"
        )
    candidate = (REPO_ROOT / relative_path).resolve()
    try:
        candidate.relative_to(SRC_DIR.resolve())
    except ValueError as exc:
        raise ValueError(
            f"Path traversal blocked: {relative_path!r}"
        ) from exc
    return candidate


def write_generated_files(files: list[GeneratedFile], *, dry_run: bool) -> None:
    if not files:
        print("[writer] No fenced TypeScript blocks found in Coder output.")
        return
    for f in files:
        target = _resolve_safe_target(f.relative_path)
        if dry_run:
            print(f"[writer] (dry-run) would write {target} ({len(f.body)} bytes)")
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(f.body.rstrip() + "\n", encoding="utf-8")
        print(f"[writer] wrote {target} ({len(f.body)} bytes)")


# ── Entry point ─────────────────────────────────────────────────────────────


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(
        description="Spineless meta-builder (DeepSeek + Qwen via Ollama).",
    )
    parser.add_argument("task", help="Plain-English description of the change.")
    parser.add_argument(
        "--plan-only",
        action="store_true",
        help="Stop after the Project Manager step and print the JSON plan.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run both steps but do not write any files.",
    )
    args = parser.parse_args(argv)

    print("[meta-builder] preflight: checking Ollama daemon and models")
    assert_ollama_models_available([PROJECT_MANAGER_MODEL, CODER_MODEL])

    print(f"[meta-builder] loading spec from {DOCS_DIR}")
    spec = load_spec_documents(DOCS_DIR)

    print(f"[meta-builder] step 1: Project Manager ({PROJECT_MANAGER_MODEL})")
    plan = run_project_manager(spec, args.task)
    print("[meta-builder] plan:")
    print(json.dumps(plan, indent=2))

    if args.plan_only:
        return 0

    print(f"[meta-builder] step 2: Coder ({CODER_MODEL})")
    coder_output = run_coder(spec, plan)

    files = extract_generated_files(coder_output)
    print(f"[meta-builder] step 3: writing {len(files)} file(s)")
    write_generated_files(files, dry_run=args.dry_run)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
