"""Find a street address like "265/234 Trường Chinh, P.13" in free text (captions…)."""

import unicodedata

# `regex` rather than `re`: it has \p{Lu}, so capitals like Đ, Ư, Ố count
import regex

_SP = r"[^\S\n]"  # a space that is never a line break

# A capitalised word (Title Case or ALL CAPS) of 2+ letters, so abbreviations
# like the P of "P.13" or the Q of "Q1" aren't taken for part of a name.
# Ward/district keywords are skipped so they don't get swallowed into the name
# before them.
_WORD = r"(?!(?i:phường|quận|huyện|tp)\b)\p{Lu}\p{L}+\b"
_WORDS = rf"{_WORD}(?:{_SP}+{_WORD})*"

# 265, 265/234, 12/3/4 – not the tail of a longer number such as a phone number
_HOUSE_NUMBER = r"(?<![\w/])\d{1,4}(?:/\d{1,4})*"

# "Đường Số 7", "đường 3/2" (any case) – the number is the street's name
_NUMBERED_STREET = rf"(?i:đường(?:{_SP}+số)?){_SP}+\d{{1,3}}(?:/\d{{1,2}})?"

# "Phường 13", "P.13", "P13", "F.5", "P. Bến Nghé", "phường Đa Kao"
_WARD = rf"(?i:phường\b|[pf]\.|[pf](?=\d)|[pf]\b){_SP}*(?:\d{{1,2}}\b|{_WORDS})"

ADDRESS_RE = regex.compile(
    rf"{_HOUSE_NUMBER}{_SP}+"
    rf"(?:{_NUMBERED_STREET}|{_WORDS})"
    rf"(?:(?:{_SP}*,{_SP}*|{_SP}+){_WARD})?"  # ward is optional, after a comma or space
)


def extract_address(text: str | None) -> str | None:
    """Return the first address in `text`, or None."""
    if not text:
        return None
    # Composed form, so a letter and its accents are one character for \p{L}
    match = ADDRESS_RE.search(unicodedata.normalize("NFC", text))
    return match.group() if match else None
