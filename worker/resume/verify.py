"""Stage 5 — evidence verification, in code (never by an LLM).

An LLM field survives only if (1) its evidence_span is found in the source
text, exactly or with fuzzy ratio >= 0.90 after whitespace/case/quote
normalization, (2) the value is actually supported by that span, and (3) the
value passes its type check. Anything else is rejected and logged.
"""

from __future__ import annotations

import re
import unicodedata
from difflib import SequenceMatcher
from typing import List, Optional, Tuple

FUZZY_THRESHOLD = 0.90
MAX_SPAN = 200

_TRANSLATE = str.maketrans({"‘": "'", "’": "'", "“": '"', "”": '"', "–": "-", "—": "-", "•": " ", " ": " "})


def _normalize_with_map(text: str) -> Tuple[str, List[int]]:
    """Normalized text plus, for each normalized char, its index in `text`."""
    out: List[str] = []
    index: List[int] = []
    prev_space = True
    for i, ch in enumerate(text):
        ch = unicodedata.normalize("NFKC", ch).translate(_TRANSLATE).casefold()
        for c in ch:
            if c.isspace():
                if prev_space:
                    continue
                c, prev_space = " ", True
            else:
                prev_space = False
            out.append(c)
            index.append(i)
    while out and out[-1] == " ":
        out.pop()
        index.pop()
    return "".join(out), index


def normalize(text: str) -> str:
    return _normalize_with_map(text)[0]


def find_evidence(source: str, span: str) -> Optional[Tuple[int, int, float]]:
    """(start, end, ratio) of `span` within `source` (original offsets), or None."""
    if not span or len(span) > MAX_SPAN * 1.5:
        return None
    norm_src, index = _normalize_with_map(source)
    norm_span = normalize(span)
    if len(norm_span) < 2:
        return None

    pos = norm_src.find(norm_span)
    if pos >= 0:
        return index[pos], index[pos + len(norm_span) - 1] + 1, 1.0

    # Fuzzy: anchor on the longest common block, then score same-length
    # windows around it (keeps this linear-ish instead of O(n*m) per window).
    matcher = SequenceMatcher(None, norm_src, norm_span, autojunk=False)
    anchor = matcher.find_longest_match(0, len(norm_src), 0, len(norm_span))
    if anchor.size < max(3, len(norm_span) // 4):
        return None
    best: Optional[Tuple[int, int, float]] = None
    guess = anchor.a - anchor.b
    for shift in range(-8, 9):
        for length in (len(norm_span) - 3, len(norm_span), len(norm_span) + 3):
            a = max(0, guess + shift)
            b = min(len(norm_src), a + max(length, 1))
            ratio = SequenceMatcher(None, norm_src[a:b], norm_span, autojunk=False).ratio()
            if best is None or ratio > best[2]:
                best = (a, b, ratio)
    if best and best[2] >= FUZZY_THRESHOLD and best[1] > best[0]:
        return index[best[0]], index[best[1] - 1] + 1, best[2]
    return None


_TOKEN = re.compile(r"[a-z0-9+#]+")


def value_supported(value: str, evidence: str) -> bool:
    """Most of the value's tokens must appear in the evidence it cites."""
    v, e = normalize(value), normalize(evidence)
    if not v:
        return False
    if v in e:
        return True
    tokens = _TOKEN.findall(v)
    if not tokens:
        return False
    present = sum(1 for t in tokens if t in e)
    return present / len(tokens) >= 0.8


EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[a-z]{2,}$", re.I)
YEAR = re.compile(r"(19[5-9]\d|20\d\d)")


def type_valid(field: str, value: str) -> bool:
    value = value.strip()
    if not value:
        return False
    if field == "email":
        return bool(EMAIL.match(value))
    if field == "phone":
        return 7 <= len(re.sub(r"\D", "", value)) <= 15
    if field.endswith("url") or field == "website":
        return bool(re.match(r"^(https?://)?[\w-]+(\.[\w-]+)+(/\S*)?$", value))
    if field in ("start_date", "end_date", "date"):
        return bool(YEAR.search(value)) or value.lower() in ("present", "current", "ongoing", "now")
    return len(value) <= 2000
