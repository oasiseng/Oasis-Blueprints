---
title: Publish an example
description: Add an example to the gallery with a pull request that adds one folder.
---

Every folder in `examples/sheet-sets/` that holds a `project.json` becomes a page in the [gallery](/examples/). The site
builds it, prints it and audits it on every push to `main`. Publishing an example is a pull request that adds a folder.

## Worked example: adding `carport`

1. Make the folder `examples/sheet-sets/carport/` with:
   - `project.json`, the project file, with `"credit": true` like the other public examples;
   - its own `<jobType>.js` only if the job needs drawing code the kit does not ship;
   - preview pictures made with `print.py --png`, as the other examples have.
2. Replace every real name, address and number with the placeholders in
   [Contributing](/project/contributing/#anonymizing-a-real-job): `Your Company`, `123 Example St`,
   `Anytown, FL 00000`, `EX-001`, `PERMIT-000000`.
3. Run the checks:

   ```bash
   python scripts/check_examples.py
   python -m unittest discover -s tests
   python scripts/build_examples.py
   ```

4. Open a pull request. The pull request template has a short checklist.

The folder name is the address: `carport` is published at `/examples/carport/`, its live set at
`/examples/carport/set/`, its PDF at `/examples/carport/sheet-set.pdf`. The gallery lists examples in the order they
were added, newest last.

## What fails the pull request

The documentation workflow runs on every pull request and stops on:

- `check_examples.py`: a firm name other than `Your Company`, a `brand.json` or a logo file, an email address, a phone
  number, a street address other than the placeholders, a raster image embedded in `project.json`, or a match against
  the maintainers' private list of real job identifiers;
- a set that does not build, or a layout audit with any finding;
- a page that does not build.

Everything under `examples/` is public once merged. If the check names something, replace it; do not work around it.
