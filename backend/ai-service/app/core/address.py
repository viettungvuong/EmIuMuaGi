"""Find a street address like "265/234 Trường Chinh" in free text (captions…)."""

import unicodedata

# `regex` rather than `re`: it has \p{Lu}, so capitals like Đ, Ư, Ố count
import regex

# <house number> <street>
#   house number: 1-4 digits, optionally with /sub-numbers   265, 265/234, 12/3/4
#   street:       either a numbered street, "đường (số) <n>" in any case
#                 ("Đường Số 7", "đường 3/2"), or one or more capitalised words
#                 (Title Case or ALL CAPS) on the same line
ADDRESS_RE = regex.compile(
    r"""
    (?<![\w/])                      # not the tail of a longer number (phone numbers…)
    \d{1,4}(?:/\d{1,4})*
    [^\S\n]+                        # spaces, but never across a line break
    (?:
        (?i:đường(?:[^\S\n]+số)?)
        [^\S\n]+\d{1,3}(?:/\d{1,2})?  # 7, 12, or a date-named street like 3/2
      |
        \p{Lu}\p{L}*\b              # \b drops a word glued to digits, e.g. the Q of "Q1"
        (?:[^\S\n]+\p{Lu}\p{L}*\b)*
    )
    """,
    regex.VERBOSE,
)


def extract_address(text: str | None) -> str | None:
    """Return the first address in `text`, or None."""
    if not text:
        return None
    # Composed form, so a letter and its accents are one character for \p{L}
    match = ADDRESS_RE.search(unicodedata.normalize("NFC", text))
    return match.group() if match else None
