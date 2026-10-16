import type { Severity } from '../types';

export const FACTORIES = ['Stuttgart', 'Pune', 'Monterrey', 'Gdańsk'] as const;
export const APPLICATIONS = [
  'MES Core', 'Operator Terminal', 'Quality Management', 'Machine Integration', 'Label Printing', 'Material Tracking',
] as const;
export const SEVERITIES: Severity[] = ['Critical', 'High', 'Medium', 'Low'];
export const SLA_HOURS: Record<Severity, number> = { Critical: 4, High: 8, Medium: 24, Low: 72 };
export const OWNERS = ['A. Weber', 'P. Deshmukh', 'L. Herrera', 'M. Kowalski', 'S. Iyer', 'J. Becker', 'Unassigned'];
export const KB_CATEGORIES = ['Connectivity', 'Data Integrity', 'Printing', 'Quality', 'Material', 'Performance', 'Authorization'];

export const WORK_CENTERS: Record<string, string[]> = {
  Stuttgart: ['STU-ASM-01', 'STU-ASM-02', 'STU-WLD-01', 'STU-PNT-01'],
  Pune: ['PUN-MCH-01', 'PUN-MCH-02', 'PUN-ASM-01', 'PUN-PKG-01'],
  Monterrey: ['MTY-STP-01', 'MTY-WLD-01', 'MTY-ASM-01', 'MTY-TST-01'],
  'Gdańsk': ['GDN-CST-01', 'GDN-MCH-01', 'GDN-ASM-01', 'GDN-PKG-01'],
};
