# Fix 'cabang' TypeScript Error in Project Planning Service

## Problem
The build process fails on GitHub Actions due to a TypeScript error in `src/modules/project-planning/project-planning.service.ts`:

`Argument of type '{ id: number; cabang: string | undefined; ... }' is not assignable to parameter of type '{ id: number; cabang: string; ... }'.`

The function `sendPpNotificationEmail` expects `cabang` to be strictly a `string`, but it is being passed as `string | undefined` or `string | null` from the payload or database.

## Solution
Relax the signature of `sendPpNotificationEmail` to match the data being passed, rather than forcing dummy values at every call site.

1. **Update Function Signature:**
   Modify the parameter `projek` in `sendPpNotificationEmail` to accept `cabang?: string | null`:
   ```typescript
   projek: { id: number; cabang?: string | null; nomor_ulok: string; nama_toko: string; email_pembuat: string },
   ```

2. **Handle Nullable Value Internally:**
   When fetching users from `userCabangRepository.findAll`, gracefully fallback to `undefined` if `cabang` is not provided:
   ```typescript
   const users = await userCabangRepository.findAll({ cabang: projek.cabang ?? undefined, jabatan: targetRole });
   ```
   (The `templateData` object passed to the email service is already capable of handling a nullable/undefined `cabang`).

This approach provides a robust and type-safe fix without modifying the 14 individual call sites.
