"""Benchmark the resume pipeline on the Kaggle dataset hadikp/resume-data-pdf.

Samples PDFs across the dataset's category folders (or reads ./dataset/),
runs the same extract_facts() the worker uses, and writes a CSV report:
facts per field group, missing sections, tier used, latency and LLM tokens.
No training: this measures where the current prompts and rules fail.

  python benchmark_kaggle.py --sample 30                 # AI on (as with consent)
  python benchmark_kaggle.py --sample 30 --no-ai         # rules only (no consent)
  python benchmark_kaggle.py --dataset-dir dataset --out report.csv

Needs KAGGLE_KEYS (username:key) to download; LLM keys for the AI run.
Downloaded files are cached in ./dataset/ (gitignored).
"""

from __future__ import annotations

import argparse
import base64
import csv
import hashlib
import io
import json
import logging
import os
import random
import sys
import time
import urllib.parse
import urllib.request
import zipfile
from collections import Counter, defaultdict
from pathlib import Path
from typing import Dict, List

from dotenv import load_dotenv

HERE = Path(__file__).resolve().parent
load_dotenv(HERE / ".env")
load_dotenv(HERE.parent / ".env.local")
sys.path.insert(0, str(HERE))

import provider_router  # noqa: E402
from resume.extract import extract_facts  # noqa: E402
from resume.fields import FIELD_GROUPS  # noqa: E402

DATASET = "hadikp/resume-data-pdf"
API = "https://www.kaggle.com/api/v1"
CORE = ("experience", "projects", "certifications", "education", "skills")


def _auth() -> Dict[str, str]:
    user, key = os.environ["KAGGLE_KEYS"].split(",")[0].split(":")
    return {"Authorization": "Basic " + base64.b64encode(f"{user}:{key}".encode()).decode(), "User-Agent": "ait-benchmark"}


def list_files(limit_pages: int = 60) -> List[str]:
    names: List[str] = []
    token = ""
    for _ in range(limit_pages):
        url = f"{API}/datasets/list/{DATASET}?pageSize=200" + (f"&pageToken={urllib.parse.quote(token)}" if token else "")
        page = json.load(urllib.request.urlopen(urllib.request.Request(url, headers=_auth()), timeout=60))
        names += [f["name"] for f in page.get("datasetFiles") or [] if f["name"].lower().endswith(".pdf")]
        token = page.get("nextPageToken") or ""
        if not token:
            break
    return names


def download(name: str, cache: Path) -> Path:
    target = cache / name
    if target.exists():
        return target
    url = f"{API}/datasets/download/{DATASET}/{urllib.parse.quote(name, safe='')}"  # slashes encoded too
    data = urllib.request.urlopen(urllib.request.Request(url, headers=_auth()), timeout=120).read()
    if data[:2] == b"PK":  # Kaggle zips some single-file downloads
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            data = z.read(z.namelist()[0])
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    return target


def sample(names: List[str], n: int, seed: int) -> List[str]:
    """Round-robin across category folders so every resume type is represented."""
    by_cat: Dict[str, List[str]] = defaultdict(list)
    for name in names:
        by_cat[name.split("/")[-2] if "/" in name else "root"].append(name)
    rng = random.Random(seed)
    for files in by_cat.values():
        rng.shuffle(files)
    picked, cats = [], sorted(by_cat)
    while len(picked) < n and any(by_cat.values()):
        for c in cats:
            if by_cat[c] and len(picked) < n:
                picked.append(by_cat[c].pop())
    return picked


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--sample", type=int, default=20)
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--dataset-dir", default=str(HERE / "dataset"))
    ap.add_argument("--no-ai", action="store_true", help="rules only, as for users without external_ai consent")
    ap.add_argument("--local-only", action="store_true", help="don't download; use PDFs already in --dataset-dir")
    ap.add_argument("--out", default=str(HERE / "benchmark_report.csv"))
    args = ap.parse_args()
    logging.basicConfig(level=logging.WARNING, format="%(levelname)s %(name)s: %(message)s")

    cache = Path(args.dataset_dir)
    if args.local_only:
        files = sorted(cache.rglob("*.pdf"))[: args.sample]
    else:
        print(f"listing {DATASET} …", flush=True)
        files = [download(n, cache) for n in sample(list_files(), args.sample, args.seed)]
    print(f"running {len(files)} resumes, AI {'off' if args.no_ai else 'on'}\n", flush=True)

    rows = []
    for path in files:
        data = path.read_bytes()
        provider_router.USAGE.clear()
        started = time.monotonic()
        row = {"file": str(path.relative_to(cache)) if path.is_relative_to(cache) else path.name,
               "category": path.parent.name, "size_kb": len(data) // 1024}
        try:
            facts, _doc, diag = extract_facts(data, "application/pdf", hashlib.sha256(data).hexdigest(), consent=not args.no_ai)
            counts = Counter(f.group for f in facts)
            row.update({
                "tier": diag.get("tier"), "chars": diag["chars"], "text_usable": diag["usable"], "ocr": diag["ocr"],
                "blank_ratio": diag["blank_ratio"], "sections_detected": "|".join(diag.get("sections", [])),
                "retried": "|".join(diag.get("retried", [])), "omitted_by_model": "|".join(diag.get("omitted", [])), "rules_only": "|".join(diag.get("rules_only", [])),
                "total_facts": len(facts), **{g: counts.get(g, 0) for g in FIELD_GROUPS},
                "missing_core": "|".join(g for g in CORE if not counts.get(g)), "error": "",
            })
        except Exception as exc:  # noqa: BLE001 - a benchmark records failures, it doesn't stop
            row.update({"total_facts": 0, "missing_core": "|".join(CORE), "error": f"{type(exc).__name__}: {exc}"[:200]})
        usage = list(provider_router.USAGE)
        row.update({
            "latency_s": round(time.monotonic() - started, 2), "llm_calls": len(usage),
            "tokens_in": sum(u["tokens_in"] for u in usage), "tokens_out": sum(u["tokens_out"] for u in usage),
            "providers": "|".join(sorted({f"{u['provider']}/{u['model']}" for u in usage})),
        })
        rows.append(row)
        print(f"  {row['file'][:60]:60} facts={row['total_facts']:3} tier={row.get('tier','-'):10} "
              f"missing={row['missing_core'] or '-':35} {row['latency_s']:6.1f}s {row['error'][:60]}", flush=True)

    fields = sorted({k for r in rows for k in r}, key=lambda k: list(rows[0]).index(k) if k in rows[0] else 99)
    with open(args.out, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)

    n = len(rows) or 1
    print(f"\n== {len(rows)} resumes → {args.out}")
    for g in FIELD_GROUPS:
        missing = sum(1 for r in rows if not r.get(g))
        print(f"  {g:15} missing on {missing:3}/{len(rows)} ({missing / n:.0%})")
    print(f"  errors: {sum(1 for r in rows if r['error'])}  |  avg latency {sum(r['latency_s'] for r in rows) / n:.1f}s"
          f"  |  avg tokens in/out {sum(r['tokens_in'] for r in rows) // n}/{sum(r['tokens_out'] for r in rows) // n}"
          f"  |  tiers {dict(Counter(r.get('tier') for r in rows))}")


if __name__ == "__main__":
    main()
