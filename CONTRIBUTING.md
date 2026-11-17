# Contributing

Oasis-Blueprints grows from real jobs: each one comes in as an anonymized example, and what it needed from the
kit moves into the kit once a second job needs it too. Work on a branch and open a pull request.

## Adding an example set

1. Make one folder, `examples/sheet-sets/<name>/`, holding:
   - `project.json`, the project file;
   - preview pictures, one per sheet (`preview-cover.png`, `preview-field.png`, ...), made with
     `scripts/print.py --png`;
   - its own drawing file only if the job needs one (see below).
2. Add a row to the examples table in `README.md`.
3. Run the tests (below). `tests/test_no_job_data.py` must pass.
4. Run `python scripts/check_examples.py`. Once merged, the folder is built, printed and audited by the documentation
   workflow and published in the gallery at `https://docs.oasisengineering.com/examples/<name>/`; a finding in the
   layout audit fails the pull request.

`examples/` holds the showcase sets. The two small samples in `skills/oasis-blueprints/assets/samples/` ship
inside the skill and are used by the tests; leave them as they are unless the project-file format changes.

## Anonymizing a real job

Replace every one of these before a real job becomes an example:

- the firm, and every person named;
- the owner;
- the address, city and zip;
- the parcel and lot numbers, the subdivision name and the street names;
- permit numbers and the project number;
- survey bearings and distances, and any lot dimension that would identify the lot;
- photos, aerials and tax maps: replace them with drawn figures, or leave them out.

Use these placeholders:

| For | Placeholder |
|---|---|
| Firm | `Your Company` |
| Address | `123 Example St` |
| City, state and zip | `Anytown, FL 00000` |
| Project number | `EX-001` |
| Permit number | `PERMIT-000000` |

Structural content stays as issued. **The engineer's values are never changed or invented while anonymizing**:
member sizes, connectors, anchors, loads, design criteria and notes go in exactly as the engineer of record
issued them. If a value has to be removed, it becomes an open item, not a guess.

**A library detail is the engineer's drawing and is not edited.** Details under `library/details/` are added
or replaced as whole files by the export tool; nothing inside one is changed by hand.

`tests/test_no_job_data.py` scans `examples/`, `library/` and `skills/` for street addresses, phone numbers,
emails, zip codes, permit-like numbers, local paths and DWG file names. If it fails, replace the text it names.
Add to its allow-list only what is certainly not job data, with the reason, and list the new entry in the pull
request.

## Job-specific drawing code

- A job keeps its own drawing file only for what is particular to that job.
- When the same change is needed on a second job, it moves into the kit view
  (`skills/oasis-blueprints/assets/views/`), with a project-file option if it is not always wanted, and both
  jobs drop their copy of it.
- A job-local file starts with a short comment listing what it changes from the kit view, so the next person
  can see what is a candidate to move.

How to write a view is in `skills/oasis-blueprints/references/writing-views.md`.

## Changing the kit

- The printed sheets of the existing examples must not change unless the change is the point. Compare the
  preview pictures before and after.
- Add a test for what you changed, and a line in `CHANGELOG.md`.
- The kit draws and checks layout. It never supplies a member size, anchor, footing, load or code edition:
  anything the engineer has not given stays an open item.

## Tests

```bash
python -m pip install playwright
python -m playwright install chromium
python -m unittest discover -s tests -v
claude plugin validate . --strict
```

`tests/test_no_job_data.py` needs no browser: `python -m unittest tests.test_no_job_data -v`.
The same tests run on every pull request (`.github/workflows/tests.yml`).

## Releases

The version is in `.claude-plugin/plugin.json` and at the top of `CHANGELOG.md`. Pushing a tag `v<version>`
builds `oasis-blueprints.zip` with `scripts/package_skill.py` and attaches it to a GitHub release
(`.github/workflows/release.yml`).

### Standalone skill package

Run `python scripts/package_skill.py /tmp/oasis-blueprints.zip` from the repository. The packager
includes tracked files from `skills/oasis-blueprints/` and overlays tracked `library/` resources at
`oasis-blueprints/assets/library/` in the ZIP. Keep `library/` as the single source; do not maintain
a second copy inside the skill. Stage new resources with Git before packaging. Local scan data,
hidden files, bytecode, and caches are excluded.

`tests/test_skill_package.py` extracts the ZIP into a temporary directory and builds from an unrelated
working directory, checking all detail collections, drawing-map resources, samples, and PDF export.
CI runs these tests with the full suite. Releases set `OASIS_SKILL_ZIP` to test the exact archive
that will be uploaded before creating the release. To check an existing artifact:

```bash
OASIS_SKILL_ZIP=/tmp/oasis-blueprints.zip python -m unittest discover -s tests -p 'test_skill_package.py' -v
```
