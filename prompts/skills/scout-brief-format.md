## SKILL: GENRE BRIEF FORMAT (genre-scout line; a station script checks it when the draft is written)

One genre brief = one Markdown file at `scout-drafts/<today>/<id>.md`. `id` = `YYYY-MM-DD--short-genre-slug` (lowercase a–z, 0–9 and hyphens, at most 60 characters, the date = today); the file name is `<id>.md`. A draft that breaks this format is NOT written: the write returns the problems, fix every one and write it again.

EVIDENCE (owner, 17/10/2026): evidence comes from WEB SEARCH RESULTS only: listing titles, prices and keywords exactly as the results show them, plus non-marketplace pages (articles, roundups, community posts) whose URLs a search returned. Never open an etsy.com page (Etsy's terms restrict automated reads; the station refuses it). Never type, build or guess a URL: cite and fetch only URLs your searches returned. The evidence level is `indicative` and the competitor count `not measured`. (This is the owner's rule for DATA HYGIENE's Etsy line: a web search may return etsy.com listings; you record what the search result shows and never open the page.) Where PRICE RULES speak of the top-5 prices, read: the prices of the results in your Demand evidence table. No placeholder anywhere (UNKNOWN, TBD, N/A, "needs owner check"): with no evidence, write no brief and call `report_blocked` with the reason.

```
---
id: 2026-10-17--cozy-farming-desk-props
date: 2026-10-17
status: candidate
product_type: <a key from products.json>
audience_segment: <who buys it, plain words>
origin: genre-scout
---
# Niche
One line.

## Buyer persona
Who buys it, for what use. No real people.

## Demand evidence
evidence level: indicative
checked: YYYY-MM-DD
search queries: <the web_search queries the rows come from, separated by ;>
competitor count: not measured
| # | listing title (as shown in the result) | price (as shown) | result URL |
|---|---|---|---|
| 1 | <title as the result shows it> | USD 4.99 | <the URL the result gave> |
(at least 3 rows; price = a currency code and a number exactly as the result showed it)

## Genre trend evidence
- <URL a search returned> — what it shows about the genre as a whole

## Keywords
- <phrase> — <URL of a result that shows the phrase in use>
(5–13 phrases; at least 3 different result URLs across them)

## Price range
USD <low>–<high> — <result URL>, <result URL>, <result URL>
(at least 3 different results that show those prices)

## Seasonality
When demand peaks, or "evergreen", with a source if one was returned.

## Design direction
What the files are and two or three ORIGINAL concept ideas in plain words. Never describe another seller's design.

## Risks
IP and Etsy-policy risks and how the concept avoids them.

## Sources
- <every URL cited above> — what it supports
```

Every URL anywhere in the brief must also be listed under `## Sources`, and must be one a web call of this job returned (the station checks the job transcript).
EVIDENCE-CHECKER adds `## Evidence check` and sets `status: verified` or `status: rejected` in the same file; a station script, never an agent, writes any `## Station ...` section.
