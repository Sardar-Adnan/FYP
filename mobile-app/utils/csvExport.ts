

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Alert, Platform } from 'react-native';


export function toCSV(data: Record<string, any>[], columns?: { key: string; label: string }[]): string {
  if (data.length === 0) return '';

  // Use explicit columns or derive from first object
  const cols = columns || Object.keys(data[0]).map((k) => ({ key: k, label: k }));
  const headers = cols.map((c) => c.label).join(',');

  const rows = data.map((row) =>
    cols
      .map((c) => {
        const val = row[c.key];
        if (val === null || val === undefined) return '';
        const str = String(val);
        // Escape quotes and wrap in quotes if needed
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      })
      .join(',')
  );

  return [headers, ...rows].join('\n');
}

/**
 * Export data as a CSV file and open the system share sheet.
 */
export async function exportCSV(
  data: Record<string, any>[],
  filename: string,
  columns?: { key: string; label: string }[]
): Promise<void> {
  if (data.length === 0) {
    Alert.alert('No Data', 'There is no data to export.');
    return;
  }

  try {
    const csv = toCSV(data, columns);
    const fileUri = `${FileSystem.cacheDirectory}${filename}.csv`;

    await FileSystem.writeAsStringAsync(fileUri, csv, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: `Export ${filename}`,
        UTI: 'public.comma-separated-values-text',
      });
    } else {
      Alert.alert('Sharing Unavailable', 'Sharing is not available on this device.');
    }
  } catch (error) {
    console.error('[CSV Export] Error:', error);
    Alert.alert('Export Failed', 'Failed to export the data. Please try again.');
  }
}
