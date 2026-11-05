'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type DeleteConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  itemName?: string;
  onConfirm: (reason: string) => Promise<void>;
  loading?: boolean;
};

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  itemName,
  onConfirm,
  loading = false,
}: DeleteConfirmDialogProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setReason('');
      setError(null);
    }
    onOpenChange(newOpen);
  };

  const handleConfirm = async () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError('Alasan penghapusan wajib diisi.');
      return;
    }
    setError(null);
    try {
      await onConfirm(trimmed);
      handleOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus data.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-red-700">{title}</DialogTitle>
          <DialogDescription>
            {description}
            {itemName && (
              <span className="mt-1 block font-medium text-ink">
                Item: &ldquo;{itemName}&rdquo;
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="delete-reason" className="text-xs font-semibold text-ink">
            Alasan Penghapusan <span className="text-red-600">*</span>
          </Label>
          <Textarea
            id="delete-reason"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Contoh: Salah input jumlah kuantitas oleh staff saat shift..."
            rows={3}
            className="text-sm"
            autoFocus
          />
          {error && <p className="text-xs font-medium text-red-600">{error}</p>}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={loading}
          >
            Batal
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={loading || !reason.trim()}
          >
            {loading ? 'Menghapus...' : 'Hapus Data'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

