"""Is an extracted text layer real resume text, or garbage?

Some PDFs carry a broken text layer: fonts without a Unicode map extract as
"1 1 1 1 …", scans carry OCR noise, designers export text as outlines. Such
text passes a simple "has characters" check but is useless to parse.
"""

from __future__ import annotations

import re

MIN_WORDS = 40
MAX_DIGIT_RATIO = 0.40
MIN_ALPHA_RATIO = 0.55
MIN_REAL_WORD_RATIO = 0.35

# At least one of these appears in practically every resume.
RESUME_WORDS = re.compile(
    r"\b(experience|education|project|projects|skill|skills|university|college|institute|school|"
    r"intern|internship|work|employment|certification|certifications|achievement|achievements|award|"
    r"awards|publication|publications|summary|objective|profile|email|phone|linkedin|github|degree|"
    r"b\.?tech|m\.?tech|b\.?sc|m\.?sc|bachelor|master|phd|cgpa|gpa)\b",
    re.IGNORECASE,
)
REAL_WORD = re.compile(r"^[A-Za-z][A-Za-z'.\-]{1,}$")


def text_stats(text: str) -> dict:
    chars = [c for c in text if not c.isspace()]
    words = text.split()
    n = max(len(chars), 1)
    return {
        "words": len(words),
        "digit_ratio": sum(c.isdigit() for c in chars) / n,
        "alpha_ratio": sum(c.isalpha() for c in chars) / n,
        "real_word_ratio": sum(bool(REAL_WORD.match(w)) for w in words) / max(len(words), 1),
        "resume_words": len(RESUME_WORDS.findall(text)),
    }


def is_text_usable(text: str) -> bool:
    """False for empty, tiny, mostly-numeric, symbol-soup or non-resume text."""
    s = text_stats(text)
    return (
        s["words"] >= MIN_WORDS
        and s["digit_ratio"] <= MAX_DIGIT_RATIO
        and s["alpha_ratio"] >= MIN_ALPHA_RATIO
        and s["real_word_ratio"] >= MIN_REAL_WORD_RATIO
        and s["resume_words"] >= 1
    )


MAX_BLANK_BLOCK_RATIO = 0.2


def needs_whole_document(text_usable: bool, blank_ratio: float, candidates: list) -> str:
    """
    Why the resume needs a whole-document (vision when possible) pass, or ""
    when rules + per-section recovery are enough.
    """
    if not text_usable:
        return "text unusable"
    if not candidates:
        return "rules found nothing"
    if blank_ratio >= MAX_BLANK_BLOCK_RATIO:
        return f"{blank_ratio:.0%} of text blocks are unreadable (unmapped fonts)"
    if not any(c.group == "identity" and c.field == "full_name" for c in candidates) and not any(
        c.group == "contact" and c.field == "email" for c in candidates
    ):
        return "no name or email readable (header likely an image or unmapped font)"
    return ""
