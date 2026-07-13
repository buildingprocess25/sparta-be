# National Holidays 2026 - Backend Implementation

## 📦 Module Structure

```
sparta-be/
├── src/
│   ├── common/
│   │   └── national-holidays.ts           # Core module
│   ├── modules/
│   │   ├── denda/
│   │   │   ├── denda-keterlambatan.ts    # Updated with holidays
│   │   │   └── denda-keterlambatan-holidays.test.ts
│   │   └── gantt/
│   │       └── gantt-date-calculator.ts   # Schedule calculator
│   └── scripts/
│       └── backfill-st-dates-with-holidays-2026.ts
└── sql/
    └── 2026-07-13-create-st-date-backfill-audit.sql
```

## 🚀 Quick Commands

### Run Tests
```bash
npm test -- denda-keterlambatan-holidays.test.ts
```

### Build
```bash
npm run build
```

### Run Backfill (Dry Run)
```bash
npm run tsx src/scripts/backfill-st-dates-with-holidays-2026.ts
```

### Run Backfill (Production)
```bash
npm run tsx src/scripts/backfill-st-dates-with-holidays-2026.ts --production
```

## 📖 Usage

### Calculate Denda
```typescript
import { calculateDendaFromDates } from './modules/denda/denda-keterlambatan';

const result = calculateDendaFromDates(
    new Date("2026-05-29"), // SPK end: Jumat
    new Date("2026-06-02")  // ST date: Selasa (after Sabtu, Minggu, Senin Libur)
);

console.log(result.hari_denda);   // 0
console.log(result.nilai_denda);  // 0
```

### Calculate Gantt Schedule
```typescript
import { calculateGanttSchedule } from './modules/gantt/gantt-date-calculator';

const schedule = calculateGanttSchedule("2026-05-11", 20);

console.log(schedule.waktu_mulai);        // "2026-05-11"
console.log(schedule.waktu_selesai);      // "2026-05-29"
console.log(schedule.effective_st_date);  // "2026-06-02"
console.log(schedule.st_label);           // "SPK+3 (2 weekend, 1 libur nasional)"
console.log(schedule.skipped_days);       // 3
console.log(schedule.holidays_in_range);  // Array of holidays
```

## 🧪 Test Examples

### Test Weekend Logic
```typescript
test("SPK Jumat, ST Senin = 0 denda", () => {
    const result = calculateDendaFromDates(
        new Date("2026-01-02"), // Jumat
        new Date("2026-01-05")  // Senin
    );
    expect(result.hari_denda).toBe(0);
});
```

### Test National Holiday
```typescript
test("SPK Jumat 29 Mei, Libur Senin 1 Jun, ST Selasa 2 Jun = 0 denda", () => {
    const result = calculateDendaFromDates(
        new Date("2026-05-29"), // Jumat
        new Date("2026-06-02")  // Selasa
    );
    expect(result.hari_denda).toBe(0);
});
```

## 📊 Database Queries

### Check Audit Records
```sql
SELECT * FROM st_date_backfill_2026_audit 
ORDER BY backfilled_at DESC 
LIMIT 10;
```

### Count by Skip Pattern
```sql
SELECT 
    skipped_days,
    skipped_weekends,
    skipped_holidays,
    COUNT(*) as count
FROM st_date_backfill_2026_audit
GROUP BY skipped_days, skipped_weekends, skipped_holidays
ORDER BY count DESC;
```

## 🔧 Troubleshooting

### Test Failures
```bash
# Clear and rebuild
rm -rf dist
npm run build
npm test
```

### Import Errors
```bash
# Check TypeScript compilation
npm run build

# Check for circular dependencies
npm run check-deps
```

### Database Connection
```bash
# Test connection
psql -h maintenance-sparta.i.aivencloud.com \
     -U avnadmin \
     -d sparta-building \
     -c "SELECT 1"
```

## 📚 Related Docs

- [Main Implementation Doc](../docs/2026-07-13-national-holidays-implementation.md)
- [Quick Start Guide](../docs/QUICK-START-NATIONAL-HOLIDAYS.md)
- [Implementation Summary](../IMPLEMENTATION-SUMMARY-NATIONAL-HOLIDAYS-2026.md)

## 🎯 Key Functions

### `isNationalHoliday(date: Date): boolean`
Check if date is national holiday (affecting workday)

### `isNonWorkingDay(date: Date): boolean`
Check if date is weekend OR national holiday

### `nextBusinessDayAfter(date: Date): Date`
Get next working day (skip weekends + holidays)

### `calculateEffectiveStDate(spkEndDate: Date)`
Calculate ST ideal date with skip info

### `calculateGanttSchedule(waktuMulai, durasi)`
Generate complete Gantt schedule with labels

## 🌟 Features

✅ 17 National Holidays 2026  
✅ Weekend Detection (Sabtu-Minggu)  
✅ Grace Period Auto-Adjust  
✅ Gantt Chart Labels (H-1, H-2, SPK+1, etc)  
✅ Audit Trail for Data Changes  
✅ 25+ Unit Tests  
✅ TypeScript Type Safety  

---

**Version:** 1.0.0  
**Last Updated:** 2026-07-13
