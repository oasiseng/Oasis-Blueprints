# Changelog

Versions follow `.claude-plugin/plugin.json`. Each entry says what changed for someone using the skill.

## Unreleased

- The site plan example is now the finished set: the building sits in the corner of the lot at 6 ft and
  5 ft setbacks, with a full-width gravel driveway and cross slope, a swale between the wall and the fence
  that runs to the street, a relocated shed, and a picture seen from the south-west. Status is released for
  construction, like the sunroom example.

- Standalone skill releases now include the detail libraries, drawing map, and type map under
  `assets/library/`. Packaging tests build and export from the extracted ZIP without a repository
  checkout, and the release workflow validates the exact archive before publishing.

- Optional credit line: `"credit": true` in a project file prints "Drawn with Oasis-Blueprints ·
  oasisengineering.com/blueprints" in small grey text in the bottom margin of every sheet, outside the border.
  Off by default. The public example sets use it; the samples bundled with the skill do not.

## 0.3.0 - 2026-11-14

### Kit

- Cover: optional property column (`property`) and a general notes band (`generalNotes`); summary keys
  `notesTitle`, `notesSize`, `generalNotesTitle`, `generalNotesColumns`, `generalNotesSize`, `coverTop`.
- New sheet type `figures`, for reference details supplied as images.
- New sheet type `details` and job type `library`: sheets of standard details drawn from the detail library.
  A detail that is missing from the library shows in red and fails the layout audit.
- `field.extras`: a row of small extra views under the picture on the field sheet.
- A job file may add its own sheet types through `SHEET_TYPES`.
- Status `construction` shows a "Released for construction" band; an issued set with nothing open drops the
  open-items column.
- Fixed: the isometric picture was a mirror image of the job.
- Fixed: the sunroom views ignored `scales` in the project file. They now draw at the scale given.
- Every built HTML carries a source and license note in its head and in the Edit panel. It is never printed.

### Libraries

- Detail library (`library/details/`): the `typical` collection, 72 details converted from CAD.
- Detail library: the `site` collection, with a typical swale section and the site plan general notes.
- Drawing map (`library/drawing-map/`): what a standard set of each project type contains, counted from 30
  residential permit sets, with a page and a picture for each type.
- Type map (`library/type-map.json`): how job types, project types, sheet kinds and detail categories line up.

### Examples

- The sunroom repair example is now a finished three-sheet set: cover, site plan and framing sheet.
- New example: a 12-sheet set of the typical details.
- New example: a two-sheet site plan for a detached accessory building, drawn from a survey extract, with
  its own job type `siteplan` beside the project file (site plan, enlarged plan, side-yard section, swale
  section, stormwater check, building footprint).
- The samples bundled with the skill are now in `assets/samples/` (`deck`, `sunroom`). The folder was
  called `examples` before, the same word as the showcase sets.

### Repository

- The license names Oasis Engineering, LLC as the copyright holder.
- The Project Context Protocol material and the wind-calculation playbooks moved out of this repository.
- `CONTRIBUTING.md`: how to add an example and anonymize a real job. A test checks that no real job data is
  in the repository.
- Tests run on every pull request; a tagged version builds the skill zip and attaches it to a release.

## 0.2.0

First public version: the drawing kit, the `deck` and `sunroom` job types, the in-browser Edit panel, PDF
export with a layout audit, and the plugin manifest.
