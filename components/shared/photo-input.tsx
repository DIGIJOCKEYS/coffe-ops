'use client';

import { useRef } from 'react';
import { Camera, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';

type PhotoInputProps = {
  onFile: (file: File) => void;
  label?: string;
  maxMB?: number;
  onError?: (msg: string) => void;
  disabled?: boolean;
};

/**
 * Dua tombol terpisah: kamera dan pilih file.
 * - Kamera: `capture="environment"` → langsung buka kamera di HP
 * - File: tanpa capture → buka galeri / file manager
 * Keduanya share handler yang sama.
 */
export function PhotoInput({
  onFile,
  label = 'foto',
  maxMB = 10,
  onError,
  disabled = false,
}: PhotoInputProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > maxMB * 1024 * 1024) {
      onError?.(`Ukuran ${label} maksimal ${maxMB}MB`);
      e.target.value = '';
      return;
    }
    onFile(file);
    e.target.value = '';
  };

  return (
    <div className="flex items-center gap-2">
      {/* Input kamera — capture="environment" paksa buka kamera belakang */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleChange}
        disabled={disabled}
      />
      {/* Input file — tanpa capture, buka galeri / file manager */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*,image/heic,image/heif"
        className="hidden"
        onChange={handleChange}
        disabled={disabled}
      />

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2"
        disabled={disabled}
        onClick={() => cameraRef.current?.click()}
      >
        <Camera className="h-3.5 w-3.5" />
        Kamera
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2"
        disabled={disabled}
        onClick={() => fileRef.current?.click()}
      >
        <FolderOpen className="h-3.5 w-3.5" />
        Pilih File
      </Button>
    </div>
  );
}
