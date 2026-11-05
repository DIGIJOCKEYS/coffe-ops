/**
 * Utilitas kompresi gambar client-side otomatis sebelum upload.
 *
 * Mengurangi ukuran foto kamera HP (5MB - 12MB) menjadi ~100KB - 180KB (98% lebih hemat),
 * sehingga request upload ke Supabase menjadi instan (< 200ms) tanpa mengurangi kejelasan bukti nota/barang.
 */

export type CompressedImageResult = {
  photo: string;          // base64 jpeg max 1200px (~100-180KB)
  thumbnail: string;      // base64 jpeg max 240px (~10-20KB)
};

export async function processAndCompressImage(
  file: File,
  maxDimension = 1200,
  quality = 0.75,
): Promise<CompressedImageResult> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      try {
        URL.revokeObjectURL(objectUrl);
        const { naturalWidth: width, naturalHeight: height } = img;

        // 1. Buat Foto Utama (Max 1200px)
        const scale = Math.min(1, maxDimension / Math.max(width, height));
        const targetWidth = Math.max(1, Math.round(width * scale));
        const targetHeight = Math.max(1, Math.round(height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Gagal menginisialisasi canvas untuk kompresi gambar.');
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        const photo = canvas.toDataURL('image/jpeg', quality);

        // 2. Buat Thumbnail (Max 240px)
        const thumbScale = Math.min(1, 240 / Math.max(width, height));
        const thumbWidth = Math.max(1, Math.round(width * thumbScale));
        const thumbHeight = Math.max(1, Math.round(height * thumbScale));

        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.width = thumbWidth;
        thumbCanvas.height = thumbHeight;
        const thumbCtx = thumbCanvas.getContext('2d');
        if (!thumbCtx) {
          throw new Error('Gagal menginisialisasi canvas thumbnail.');
        }

        thumbCtx.imageSmoothingEnabled = true;
        thumbCtx.imageSmoothingQuality = 'medium';
        thumbCtx.drawImage(img, 0, 0, thumbWidth, thumbHeight);
        const thumbnail = thumbCanvas.toDataURL('image/jpeg', 0.65);

        resolve({ photo, thumbnail });
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Foto tidak dapat dibaca atau format tidak didukung.'));
    };

    img.src = objectUrl;
  });
}

