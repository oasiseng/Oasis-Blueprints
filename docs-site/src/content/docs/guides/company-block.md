---
title: Add your company block and logo
description: Put your company name, details and logo in the title block with a brand.json file.
---

The title block carries the company that prepared the set. You supply it once, in a `brand.json` file, and every set
you build picks it up.

## The file

Start from `skills/oasis-blueprints/assets/brand.example.json`:

```json
{
  "firm": {
    "name": "Your Company, LLC",
    "wordmark": "Your Company",
    "logo": "logo.png",
    "accent": "#1f63d6",
    "lines": ["123 Main St, Suite 100", "City, ST 00000", "Firm license no. 00000", "P: 000-000-0000", "www.example.com"]
  }
}
```

- `logo` is a path, relative to the brand file or the project file, or a `data:` URI. `build.py` embeds it, so the
  built HTML needs nothing beside it.
- Without a logo, the first word of `wordmark` is set large and the rest small.
- `accent` colours the wordmark only. It does not change the blue that means new work.
- Leave a field blank when you do not have it. Do not invent a license number.

## Where build.py finds it

`--brand FILE`, else `brand.json` beside the project file, else `brand.json` in the current folder. Anything set under
`firm` in the project file wins over the brand file.

```bash
python skills/oasis-blueprints/scripts/build.py job/project.json job/sheet-set.html --brand my-brand.json
```

## In the browser

The **Edit** panel has a **Company** section and a **Logo image** field, with **Remove logo**. Changes there are saved
with **Download project file** or **Download this HTML with my edits**.

## Not in the public examples

The examples in this repository use the placeholder `Your Company` and no logo. The check that runs before the site is
published fails if an example has another firm name, a `brand.json` or a logo file. See
[Publish an example](/guides/publish-an-example/).
