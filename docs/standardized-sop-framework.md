# Standardized SOP Framework: Project Types, Deliverables, and Requirements

This document defines how to operationalize your project taxonomy in PCP and Airtable so projects can be launched with consistent defaults for humans and bots.

## 1) What was standardized

The canonical mapping is defined in:

- `library/taxonomy/project-delivery-matrix.json`

It includes:
- Project type catalog
- Deliverable catalog
- Documents required catalog
- Resource catalog
- Relationship matrix (`project_type_requirements`)
- Starter granular templates for scoped deliverables (`deliverable_breakdown_templates.container-plans`, `deliverable_breakdown_templates.structural-plans`)

## 2) Recommended Airtable structure (normalized)

Use linked tables instead of one giant multi-select field. Multi-select is useful only for UI convenience fields, not as source of truth.

### Core tables

1. **Project Types**
   - `project_type_id` (single line text; primary key)
   - `name`
   - link: `Default Deliverables`
   - link: `Required Documents`
   - link: `Recommended Resources`

2. **Deliverables**
   - `deliverable_id` (primary key)
   - `name`
   - `definition_of_done`
   - `acceptance_criteria`
   - link: `Sheet Package Template`

3. **Documents Required**
   - `document_id` (primary key)
   - `name`
   - `required_stage`
   - `requiredness` (required/conditional/optional)

4. **Resources**
   - `resource_id` (primary key)
   - `name`
   - `resource_type` (site/virtual/testing)

5. **Projects**
   - `project_id` (primary key)
   - link: `Project Type`
   - link: `Assigned Deliverables`
   - link: `Assigned Documents`
   - link: `Assigned Resources`

6. **Deliverable Sheets** (granular scope)
   - `sheet_key` (e.g., `structural-plans:S1.0`)
   - `deliverable_id`
   - `sheet_code`
   - `sheet_name`
   - `required` (checkbox)

## 3) Recommended automation flow

When `Project Type` is selected for a new project:
1. Load row in `Project Types`.
2. Copy linked `Default Deliverables` to project-level `Assigned Deliverables`.
3. Copy linked `Required Documents` to `Assigned Documents`.
4. Copy linked `Recommended Resources` to `Assigned Resources`.
5. For each assigned deliverable with template sheets, expand the deliverable into `Project Deliverable Sheets` records.

## 4) Resources vs documents (your open question)

Use this rule:
- **Documents Required** = artifacts you collect/store (plans, permits, reports, photos).
- **Resources** = services/capabilities consumed during execution (site visit, virtual consult, field testing).

This separation is useful because resources drive **scheduling and staffing**, while documents drive **compliance and QA readiness**.

## 5) Next step for granularity

You already identified the right next layer: define package content under each deliverable.

Suggested rollout order:
1. Structural Plans
2. Architectural Plans
3. MEP Plans
4. Engineer Letter/Report
5. Wind/Energy reports

For each deliverable define:
- Sheet/report section code
- Name
- Required vs conditional
- Trigger condition (e.g., wind zone, number of stories, remodel vs new)
- Review role
- QC checklist reference

## 6) Implementation note for bots

Treat the matrix JSON as the source-of-truth catalog and compile project-specific PCP payloads from it. Avoid hardcoding defaults in bot prompts.

## 7) WindCalculations subcategory model

The taxonomy now includes a dedicated wind subcategory layer for `wind-calculations` projects:

- `wind_calculations_subcategories`
- `wind_subcategory_deliverable_matrix`

Operational playbooks for each subcategory are in the `playbooks/` folder of the [`oasiseng/windcalculations.com`](https://github.com/oasiseng/windcalculations.com/tree/main/playbooks) repository.

### Suggested additional Airtable fields

In **Projects**:
- `project_subcategory` (single select, e.g., `WC-DOOR`)

In **Project Deliverables**:
- `source_matrix` (`project_type` or `subcategory`)

### Suggested automation extension

When `Project Type = wind-calculations` and `project_subcategory` is set:
1. Read `wind_subcategory_deliverable_matrix` for the selected code.
2. Add required package items (letter, wind calcs, NOA/FPA attachments, etc.).
3. Assign subcategory-specific input checklist from `wind_calculations_subcategories`.
4. Link the appropriate playbook directory for engineer/bot execution context.

## 8) Private Provider categories (Florida / FBC context)

The taxonomy includes two Florida private-provider categories aligned with F.S. §553.791 (Alternative plans review and inspection):

1. **Private Provider Inspections**
   - **Documents required:** Permit Docs, Approved Plans (provided by client)
   - **Deliverables:** NTBO Inspections, COI for AHJ, PP Inspector Resume, Worksman Comp Policy or Waiver, PP Inspection Reports, COC (Final Inspection Report)

2. **Private Provider Plan Review**
   - **Documents required:** Permit Docs, Stamped Plans (provided by client)
   - **Deliverables:** NTBO Plan Review, COI for AHJ, EOR PP Resume, Worksman Comp Policy or Waiver, PP Reviewed Drawings EOR

### Acronym definitions used in this workflow

- **COI**: Certificate of Insurance
- **AHJ**: Authority Having Jurisdiction
- **EOR**: Engineer of Record
- **PP**: Private Provider
- **COC**: Certificate of Compliance

