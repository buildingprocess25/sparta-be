# Opname Migration - Build Error Fixes

## Date: 2026-06-25

## Summary
Fixed 3 TypeScript build errors in the opname migration photo re-upload feature.

---

## Build Errors Fixed

### ❌ Error 1: `sel` is undefined (Line 677)
**Problem**: Variable `sel` was used in filter but not defined

**Root Cause**: 
```typescript
// BEFORE - Wrong order: map then filter
candidate.items.map(async (item, index) => {
  // ... async operations
}).filter(item => item.source_id && item.source_type)
```

The filter was trying to access items after the async map, but `sel` was referenced incorrectly.

**Solution**: Move filter BEFORE map to exclude invalid items first
```typescript
// AFTER - Correct order: filter then map
candidate.items
  .filter(item => item.source_id && item.source_type) // Filter out invalid items first
  .map(async (item, index) => {
    // ... async operations
  })
```

**File**: `sparta-be/src/modules/opname-final/opname-final-migration.service.ts`

---

### ❌ Error 2: Constructor of GoogleProvider is private (Line 669)
**Problem**: Tried to instantiate GoogleProvider with `new GoogleProvider()`

**Root Cause**: GoogleProvider is a singleton class with private constructor

**Solution**: Use singleton instance instead
```typescript
// BEFORE
const googleProvider = new GoogleProvider();

// AFTER
const googleProvider = GoogleProvider.instance;
```

**File**: `sparta-be/src/modules/opname-final/opname-final-migration.service.ts`

---

### ❌ Error 3: Return type mismatch in uploadImageToDrive (Line 181)
**Problem**: Function declared return type `string | null` but returned object

**Root Cause**: `GoogleProvider.uploadFile()` returns an object:
```typescript
{
  id?: string;
  webViewLink?: string;
  thumbnailLink?: string;
  name?: string;
  mimeType?: string;
}
```

But we only need the `id` field (which can be `undefined`).

**Solution**: Extract the `id` field and handle undefined case
```typescript
// BEFORE - Wrong: returned whole object
const fileId = await googleProvider.uploadFile(
    folderName,
    fileName,
    "image/jpeg",
    buffer
);
return fileId; // ❌ returns object, not string

// AFTER - Correct: extract id field
const result = await googleProvider.uploadFile(
    folderName,
    fileName,
    "image/jpeg",
    buffer
);

const fileId = result.id;
if (!fileId) {
    console.warn(`[MIGRATION] Upload returned no file ID`);
    return null;
}

return fileId; // ✅ returns string | null
```

**File**: `sparta-be/src/modules/opname-final/opname-final-migration.service.ts`

---

### ❌ Error 4 (Frontend): Missing photos_to_migrate in type definition

**Problem**: Frontend TypeScript type `OpnameFinalMigrationPreviewResult` was missing the `photos_to_migrate` field

**Solution**: Added field to type definition
```typescript
export type OpnameFinalMigrationPreviewResult = {
    total_candidates: number;
    partial_count: number;
    final_count: number;
    total_items: number;
    mapped_items: number;
    photos_to_migrate: number;  // ✅ Added this field
    ready_count: number;
    conflict_count: number;
    invalid_count: number;
    details: OpnameFinalMigrationPreviewDetail[];
};
```

**File**: `sparta-fe/lib/api.ts`

---

## Build Verification

### ✅ Backend Build
```bash
cd sparta-be
npm run build
```
**Result**: SUCCESS - No TypeScript errors

### ✅ Frontend Build
```bash
cd sparta-fe
npm run build
```
**Result**: SUCCESS - No TypeScript errors

---

## Files Modified

### Backend
1. `sparta-be/src/modules/opname-final/opname-final-migration.service.ts`
   - Fixed GoogleProvider instantiation (use singleton)
   - Fixed filter/map order in `insertItems()`
   - Fixed `uploadImageToDrive()` return type handling

### Frontend
2. `sparta-fe/lib/api.ts`
   - Added `photos_to_migrate: number` to `OpnameFinalMigrationPreviewResult` type

---

## Next Steps

1. ✅ Build passes successfully
2. ⏭️ Test migration with actual Excel file containing photos
3. ⏭️ Verify photos are uploaded to Google Drive
4. ⏭️ Verify photos display correctly in generated PDF
5. ⏭️ Monitor performance (estimated 2-5 seconds per photo)

---

## Related Documentation

- `OPNAME-MIGRATION-PHOTO-UPLOAD.md` - Complete photo migration flow documentation
- Context transfer summary - Full history of implementation
