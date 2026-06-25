# Satuan Column - Case Sensitivity Issue

## Date: 2026-06-25

---

## ✅ SATUAN TIDAK JADI ANGKA/PERHITUNGAN!

### Confirmed:
- ✅ **0 rows** dengan satuan berupa angka
- ✅ Satuan masih berupa text/string (M2, Kg, Ls, etc.)
- ✅ Corrupt rows tetap punya satuan yang benar (M2, Kg)

**KESIMPULAN: Satuan column TIDAK ter-corrupt!**

---

## ⚠️ TAPI ADA MASALAH: Case Sensitivity

### Data Inconsistency:

| Satuan (Expected) | Count | Variations Found | Count |
|-------------------|-------|------------------|-------|
| **M2** (area) | 888 | `m2` (lowercase) | 29 |
| **Ttk** (point) | 71 | `ttk` (lowercase) | 254 |
| **Bh** (unit) | 411 | `bh` (lowercase) | 266 |
| **Unit** | 535 | `unit` (lowercase) | 31 |
| **Set** | 37 | `set` (lowercase) | 26 |
| **M1** (length) | 433 | `m`, `m1`, `m'` | 108, 2, 3 |
| **M3** (volume) | 440 | `m3` (lowercase) | 1 |

**Total inconsistent:** 728 rows (17.2%)

---

## 🔍 IMPACT ANALYSIS

### On Volume Validation:

**Current validation code:**
```typescript
const VOLUME_LIMITS: Record<string, number> = {
    M2: 1000,    // ← Case sensitive!
    M3: 500,
    M1: 500,
    Kg: 10000,
    // ...
};

const limit = VOLUME_LIMITS[satuan] || 10000;
```

**Problem:**
- `M2` → limit 1000 ✅
- `m2` → limit 10000 (default) ❌ Less strict!
- `Ttk` → limit 200 ✅
- `ttk` → limit 10000 (default) ❌ Less strict!

**Risk:** Lowercase variations won't get proper validation limits!

---

## 🚨 CORRUPT ROWS - SATUAN ANALYSIS

### All 9 Corrupt Rows:

| Row | ULOK | Satuan | Volume (Corrupt) | Satuan Status |
|-----|------|--------|------------------|---------------|
| 570 | 2JZ1-2601-0005 | **M2** | 117,074 | ✅ Uppercase (will be caught) |
| 572 | 2JZ1-2601-0005 | **M2** | 24,863 | ✅ Uppercase (will be caught) |
| 1183 | JZ01-2511-0006 | **M2** | 18,966 | ✅ Uppercase (will be caught) |
| 1187 | JZ01-2511-0006 | **M2** | 36,369 | ✅ Uppercase (will be caught) |
| 1194 | JZ01-2511-0006 | **Kg** | 36,267 | ✅ Uppercase (will be caught) |
| 1211 | JZ01-2511-0006 | **M2** | 12,425 | ✅ Uppercase (will be caught) |
| 1216 | JZ01-2511-0006 | **M2** | 40,615 | ✅ Uppercase (will be caught) |
| 1255 | TZ01-2512-0002-R | **M2** | 40,319,999 | ✅ Uppercase (will be caught) |
| 3398 | 2PZ1-2604-0006 | **Kg** | 558,884 | ✅ Uppercase (will be caught) |

**Good News:** All corrupt rows use uppercase satuan (M2, Kg) so validation will catch them!

**But:** If there were corrupt rows with lowercase `m2` or `ttk`, they might slip through!

---

## ✅ FIX: Make Validation Case-Insensitive

### Current Code (Case Sensitive):
```typescript
const VOLUME_LIMITS: Record<string, number> = {
    M2: 1000,
    M3: 500,
    // ...
};

const limit = VOLUME_LIMITS[satuan] || 10000;  // ← Case sensitive lookup!
```

### Fixed Code (Case Insensitive):
```typescript
const VOLUME_LIMITS: Record<string, number> = {
    M2: 1000,
    M3: 500,
    M1: 500,
    KG: 10000,    // Normalize to uppercase
    TTK: 200,
    BH: 500,
    LS: 20,
    BTG: 1000,
    UNIT: 500,
    SET: 100,
    MODUL: 50,
    MODULE: 50,
};

const validateVolume = (volume: number, satuan: string, jenisPekerjaan: string): string | null => {
    const normalizedSatuan = satuan.toUpperCase().trim();  // ← Normalize!
    const limit = VOLUME_LIMITS[normalizedSatuan] || 10000;
    
    if (volume > limit) {
        return `Volume ${volume.toLocaleString()} ${satuan} melebihi batas wajar (max ${limit.toLocaleString()}). Kemungkinan data corrupt: "${jenisPekerjaan}"`;
    }
    
    if (volume < -100 && normalizedSatuan !== "M3") {
        return `Volume negatif ekstrem (${volume}) tidak wajar untuk ${satuan}`;
    }
    
    return null;
};
```

---

## 📊 SATUAN NORMALIZATION NEEDED

### Standard Mapping:
```typescript
// Normalize common variations
const SATUAN_ALIASES: Record<string, string> = {
    'm': 'M1',
    'm1': 'M1',
    "m'": 'M1',
    'm2': 'M2',
    'm3': 'M3',
    'kg': 'KG',
    'ttk': 'TTK',
    'bh': 'BH',
    'ls': 'LS',
    'btg': 'BTG',
    'unit': 'UNIT',
    'set': 'SET',
    'modul': 'MODULE',
    'module': 'MODULE',
};

const normalizeSatuan = (satuan: string): string => {
    const cleaned = satuan.trim().toLowerCase();
    return SATUAN_ALIASES[cleaned] || satuan.toUpperCase();
};
```

---

## 🎯 RECOMMENDATION

### Priority 1: Fix Validation (DONE - will implement)
```typescript
// Use normalized satuan for validation
const normalizedSatuan = satuan.toUpperCase().trim();
const limit = VOLUME_LIMITS[normalizedSatuan] || 10000;
```

### Priority 2: Add Satuan Normalization Warning
```typescript
// Warn if satuan has inconsistent casing
const expectedSatuan = normalizeSatuan(item.satuan);
if (expectedSatuan !== item.satuan) {
    warnings.push(
        `Satuan "${item.satuan}" tidak konsisten, seharusnya "${expectedSatuan}"`
    );
}
```

### Priority 3: Data Cleanup (Optional)
Clean up source data to use consistent casing:
- `m2` → `M2`
- `ttk` → `Ttk`
- `bh` → `Bh`

---

## ✅ VALIDATION WILL STILL WORK

**Current State:**
- All 9 corrupt rows use uppercase satuan (M2, Kg)
- Current validation WILL catch them ✅

**After Fix:**
- Validation will be case-insensitive
- Will catch corrupt rows even with lowercase satuan ✅
- More robust for future data ✅

---

## 📋 SUMMARY

| Issue | Status | Impact | Fix Needed |
|-------|--------|--------|------------|
| **Satuan jadi angka?** | ❌ NO | None | ✅ No fix needed |
| **Satuan ter-corrupt?** | ❌ NO | None | ✅ No fix needed |
| **Case inconsistency** | ⚠️ YES | Low | ✅ Make validation case-insensitive |
| **Corrupt rows detectable?** | ✅ YES | None | ✅ Already working |

**Kesimpulan:**
- ✅ Satuan TIDAK jadi perhitungan/angka
- ✅ Satuan pada corrupt rows masih benar (M2, Kg)
- ⚠️ Ada case sensitivity issue (m2 vs M2)
- ✅ Will fix validation to be case-insensitive

---

**Documented by**: Kiro AI  
**Date**: 2026-06-25  
**Status**: ✅ Issue understood, fix ready to implement
