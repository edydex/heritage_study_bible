# How Claude reviews word links

This folder holds the notes behind every chapter Claude reviews. Each chapter
has two notes, and the registry stores both their paths and sha256 hashes,
so anyone can read and check them:

- `bsb/matthew-18.md`: the **author** note. It records what was changed from
  the publisher's rows, the non-obvious decisions, and the doubts left open.
- `bsb/matthew-18.peer.md`: the **independent review** note. A separate
  reviewer, starting from scratch, checked every verse. It lists what it
  changed and why.

Both are Claude (Anthropic) agents, run separately. Codex then checks a
sample after the merge (see [../AGREEMENT.md](../AGREEMENT.md)). None of this
is human verification; that is still pending.

## Workflow

`scripts/original-languages/draft-review-from-links.py`:

1. `draft`: start from the publisher's BSB rows. They are kept when correct.
   Greek and English words with no owner are listed under TODO. Verses already
   reviewed by Codex are kept unchanged.
2. `totext`: write the chapter as one line per link (format below).
3. Edit the text, verse by verse.
4. `fromtext`: turn the text back into the review JSON and compile every verse
   with the real compiler. Repeat until there are 0 problems.
5. The peer runs `totext --all` on the finished file, checks every verse,
   corrects, and runs `fromtext` again.
6. `register`: record the file, its hash and both notes in the registry,
   then rebuild the published BSB files. After that,
   `verify-word-links.py` must pass.

## Text format

```
@ 18:3
GR:  Greek verse (Nestle 1904 as displayed)
TOK: 0:καὶ 1:εἶπεν 2:Ἀμὴν ...                  numbered Greek tokens
EN:  “Truly I tell you#0,” He said, ...        repeated words carry #n
g 5 6 = unless // Actual ἐὰν μή together supply unless.
g 15 = you#2 will + enter // Rendered as an English future under οὐ μή.
s 11 = The actual article has no distinct counterpart in this English wording.
t This is = English supplies a presentational frame with no Greek counterpart.
```

- `g`: Greek tokens → English phrase(s), with an optional `// note`.
- `s`: Greek tokens with no English counterpart, with the reason.
- `t`: English words with no Greek counterpart, with the reason.
- `h`: an optional study head for the group above it.
- `m`: Greek words rendered in another English verse.
- `x`: verse flags.

## Review rules

1. **Link meaning, not position.** A group is the Greek token(s) together
   with exactly the English words that render them. Every Greek token is
   linked or explained once. Every English word belongs to one group or is
   explained once. The compiler enforces the counting; the reviewer is
   responsible for the meaning.
2. **Don't over-claim.** English words that render one Greek word must not be
   folded into another Greek word's group. Examples:
   - οὐ μή → "never", and the verb gets "you will" + "enter";
   - "will he not leave": οὐχί → "not", and the verb gets "will he" + "leave".
3. **Join tokens that work as one unit:**
   - ἐὰν μή → "unless";
   - ἕως ἄν → "until"/"before";
   - ἐνενήκοντα ἐννέα → "ninety-nine";
   - an article plus participle → "the one who …";
   - fixed idioms.
4. **Subject pronouns built into the verb** may stay with the verb ("I tell"
   for λέγω). An explicit Greek pronoun (ἐγώ, αὐτός, ὑμεῖς) is linked on its
   own.
5. **Articles.** Link "the" to a Greek article that it renders. Otherwise
   write `s` with "The actual article has no distinct counterpart in this
   English wording." A lone article can never carry is/are/was/were.
6. **Connectives.** Link καί, δέ, γάρ, οὖν and ἀλλά when English renders them
   (and, but, for, then, so). Otherwise explain briefly with `s`.
7. **English-only words** get `t` with a reason. Examples: a supplied "is",
   "This is", a proper name the Greek gives only as a pronoun or verb ending,
   or an added "one" or "that".
8. **Names** are linked despite spelling differences (Ἰωάννης ↔ John).
   **Vocatives:** an English "You" or "O you" before a vocative is linked
   with that vocative word (ὑποκριταί → "You hypocrites"). Earlier
   reviewed chapters do this in 8 verses and use `t` in only 3.
9. **Different Greek reading.** When BSB follows a reading N1904 lacks, or
   leaves out N1904 words, say so in the `s` or `t` reason. Never invent a
   link for it.
10. **Change publisher rows only when they are wrong or over-claim**, not for
    style.
11. **Notes are one factual sentence**, only where the link isn't obvious.
    BSB notes never mention Russian (some earlier BSB files have this slip).
