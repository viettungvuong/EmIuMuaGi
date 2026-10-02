"""Guess place names in free text: runs of 2+ capitalised words, e.g. "Phở Hương Bình"."""

import unicodedata

import regex

_SP = r"[^\S\n]"  # a space that is never a line break
_WORD = r"\p{Lu}\p{L}*\b"  # \b drops a word glued to digits, e.g. the Q of "Q1"

# Not part of a #hashtag or @mention. Single capitalised words are left out:
# every sentence starts with one.
NAME_RE = regex.compile(rf"(?<![#@\w]){_WORD}(?:{_SP}+{_WORD})+")


def extract_place_names(text: str | None, limit: int = 3) -> list[str]:
    """Up to `limit` candidate names, in the order they appear."""
    if not text:
        return []
    found = NAME_RE.findall(unicodedata.normalize("NFC", text))
    return list(dict.fromkeys(found))[:limit]  # drop repeats, keep order
