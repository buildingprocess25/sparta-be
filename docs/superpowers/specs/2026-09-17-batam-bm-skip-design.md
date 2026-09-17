# Design Spec: Bypass BM Manager Approval for Batam Branch

## Context & Goal
Previously, the branch `BOGOR` had a special flow where the "Branch Building & Maintenance Manager" (BM Manager) approval step in the Project Planning feature was bypassed. 
We need to remove this behavior from `BOGOR` and apply it exclusively to the `BATAM` branch, as only Batam does not have a BM Manager. 
When bypassed, the approval flow should skip straight to `WAITING_PP_APPROVAL_1` after submission. The generated PDF report must also omit the BM Manager's signature box and evenly distribute the remaining 4 signature columns (25% width each). 
Additionally, we need to clean up legacy logic that previously allowed BATAM coordinators to approve on behalf of the BM Manager.

## Proposed Changes

### Backend (`sparta-be`)
1. **`src/modules/project-planning/project-planning.service.ts`**:
   - Update `shouldSkipBmApproval` to ONLY include `BATAM`: `["BATAM"].includes(normalizeCabang(cabang))` (removing `BOGOR`).
   - Remove `BATAM` from `BRANCHES_WITH_COORDINATOR_BM_APPROVAL` since it's no longer needed.

2. **`src/modules/project-planning/project-planning.controller.ts`**:
   - Remove `BATAM` from `BRANCHES_WITH_COORDINATOR_BM_APPROVAL` in this file as well.

3. **`src/modules/project-planning/project-planning.pdf.ts`**:
   - Inject a new `skip_bm_approval` boolean into the Nunjucks template context for both `buildProjekPlanningPdfBuffer` and `buildProjekPlanningPhotosPdfBuffer`. This boolean will be determined by checking if the project's branch is `["BATAM"]`.

4. **`src/templates/projek_planning_report.njk`**:
   - Wrap the BM Manager signature `<td>` inside a `{% if not skip_bm_approval %}` block.
   - Adjust the inline styling of all signature `<td>` elements to dynamically use `width: 25%` if `skip_bm_approval` is true, otherwise `20%`.

### Frontend (`sparta-fe`)
1. **`app/projek-planning/form/page.tsx`**:
   - Update the `skipBmApproval` constant inside the `handleSubmit` function to ONLY check `BATAM`: `["BATAM"].includes(finalCabang.toUpperCase())` (removing `BOGOR`). This ensures the success notification text accurately reflects that the BM Manager step is bypassed.

## Verification
- Create a project planning request as a Coordinator for BATAM.
- Ensure the success message states that the FPD is waiting for PP Specialist approval.
- Ensure the backend assigns the status `WAITING_PP_APPROVAL_1` automatically upon submission.
- Generate the PDF and verify that the BM Manager signature box is missing and the remaining 4 columns are evenly sized at 25% width.
- Verify that B&M Regional Manager approval is still present and functions correctly.
