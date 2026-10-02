import { expect,it } from 'vitest';
import { hongKongInput, parseHongKongInput, shiftDate, dateTimeInZone, editedInstant } from '../apps/mobile/src/study/dates.js';

it('converts a Hong Kong wall time to an instant independently of device timezone',()=>{
  expect(parseHongKongInput('2026-10-05 09:30')).toBe('2026-10-05T01:30:00.000Z');
  expect(hongKongInput('2026-10-05T01:30:00.000Z')).toBe('2026-10-05 09:30');
  expect(shiftDate('2026-12-31',1)).toBe('2027-01-01');
});
it('rejects normalized invalid dates and invalid clock times without guessing',()=>{
  expect(()=>parseHongKongInput('2026-02-30 09:00')).toThrow();
  expect(()=>parseHongKongInput('2026-10-05 24:00')).toThrow();
  expect(()=>parseHongKongInput('2026-10-05')).toThrow();
  expect(parseHongKongInput('')).toBeNull();
});
it('displays DST changes correctly and does not round unchanged imported timestamp precision',()=>{
  expect(dateTimeInZone('2026-03-08T06:30:00Z','America/New_York')).toBe('2026-03-08 01:30');
  expect(dateTimeInZone('2026-03-08T07:30:00Z','America/New_York')).toBe('2026-03-08 03:30');
  expect(editedInstant('2026-10-05 09:30','2026-10-05T01:30:15.500Z')).toBe('2026-10-05T01:30:15.500Z');
  expect(editedInstant('2026-10-05 09:45','2026-10-05T01:30:15.500Z')).toBe('2026-10-05T01:45:00.000Z');
});
