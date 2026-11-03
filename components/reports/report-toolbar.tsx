'use client';

import { useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { exportReportToExcel } from '@/lib/export-report';

export function ReportToolbar() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      await exportReportToExcel();
      toast({ title: 'Laporan diunduh', description: 'File Excel siap dicetak.' });
    } catch {
      toast({ title: 'Gagal mengunduh', description: 'Terjadi kesalahan saat membuat file Excel.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button variant="outline" className="print:hidden" onClick={() => window.print()}>
        <Printer className="h-4 w-4" />
        Cetak
      </Button>
      <Button className="print:hidden" onClick={handleExport} disabled={loading}>
        <Download className="h-4 w-4" />
        {loading ? 'Menyiapkan...' : 'Export Excel'}
      </Button>
    </>
  );
}
