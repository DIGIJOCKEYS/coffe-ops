'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Building2, ImageIcon, Loader2, Save, Upload } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/layout/role-context';
import { createClient } from '@/lib/supabase/client';

type BusinessSettings = {
  id: string;
  business_name: string;
  logo_url: string | null;
  background_url: string | null;
};

async function uploadFile(
  supabase: ReturnType<typeof createClient>,
  bucket: string,
  path: string,
  file: File,
): Promise<string> {
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export default function BusinessPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const supabase = createClient();

  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [bgPreview, setBgPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [bgFile, setBgFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('business_settings').select('*').limit(1).single();
      if (data) {
        setSettings(data);
        setBusinessName(data.business_name);
        setLogoPreview(data.logo_url);
        setBgPreview(data.background_url);
      }
    } catch {
      // belum ada data — gunakan default
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const handleImageChange = (type: 'logo' | 'bg') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Ukuran file maksimal 5MB', variant: 'destructive' });
      return;
    }
    const url = URL.createObjectURL(file);
    if (type === 'logo') { setLogoFile(file); setLogoPreview(url); }
    else { setBgFile(file); setBgPreview(url); }
  };

  const handleSave = async () => {
    if (!businessName.trim()) {
      toast({ title: 'Nama bisnis tidak boleh kosong', variant: 'destructive' });
      return;
    }
    if (!user?.id) return;
    setSaving(true);
    try {
      let logoUrl = settings?.logo_url ?? null;
      let bgUrl = settings?.background_url ?? null;

      if (logoFile) {
        logoUrl = await uploadFile(supabase, 'business', `logo-${user.id}`, logoFile);
      }
      if (bgFile) {
        bgUrl = await uploadFile(supabase, 'business', `background-${user.id}`, bgFile);
      }

      const payload = {
        business_name: businessName.trim(),
        logo_url: logoUrl,
        background_url: bgUrl,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      };

      if (settings?.id) {
        await supabase.from('business_settings').update(payload).eq('id', settings.id);
      } else {
        await supabase.from('business_settings').insert(payload);
      }

      setLogoFile(null);
      setBgFile(null);
      await loadSettings();
      toast({ title: 'Pengaturan bisnis berhasil disimpan' });
    } catch (err) {
      toast({
        title: 'Gagal menyimpan',
        description: err instanceof Error ? err.message : 'Coba lagi.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <>
        <PageHeader title="Pengaturan Bisnis" description="Kelola identitas visual bisnis Anda." />
        <div className="flex items-center gap-2 text-sm text-ink-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Memuat pengaturan…
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Pengaturan Bisnis" description="Kelola nama, logo, dan tampilan bisnis Nestation." />

      <div className="max-w-2xl space-y-6">

        {/* Identitas Bisnis */}
        <div className="rounded-xl border border-line bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-ink-muted" />
            <h2 className="font-semibold text-ink">Identitas Bisnis</h2>
          </div>
          <Separator className="mb-5" />
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="business-name">Nama Bisnis</Label>
              <Input
                id="business-name"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Contoh: Nestation Coffee"
              />
            </div>
          </div>
        </div>

        {/* Logo */}
        <div className="rounded-xl border border-line bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-ink-muted" />
            <h2 className="font-semibold text-ink">Logo Bisnis</h2>
          </div>
          <Separator className="mb-5" />
          <div className="flex items-start gap-4">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-line bg-surface">
              {logoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoPreview} alt="Logo" className="h-full w-full object-contain p-1" />
              ) : (
                <ImageIcon className="h-8 w-8 text-ink-muted/40" />
              )}
            </div>
            <div className="flex-1 space-y-2">
              <p className="text-sm text-ink-muted">
                Upload logo bisnis dalam format PNG atau JPG. Ukuran maksimal 5MB.
                Disarankan rasio 1:1 (persegi).
              </p>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleImageChange('logo')}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => logoInputRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5" />
                Pilih Logo
              </Button>
            </div>
          </div>
        </div>

        {/* Background */}
        <div className="rounded-xl border border-line bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-ink-muted" />
            <h2 className="font-semibold text-ink">Foto Background</h2>
          </div>
          <Separator className="mb-5" />
          <div className="space-y-3">
            <div className="h-36 w-full overflow-hidden rounded-xl border-2 border-dashed border-line bg-surface">
              {bgPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={bgPreview} alt="Background" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <ImageIcon className="h-10 w-10 text-ink-muted/40" />
                </div>
              )}
            </div>
            <p className="text-sm text-ink-muted">
              Foto ini tampil di halaman sign-in. Format PNG/JPG, maksimal 5MB, disarankan landscape (16:9).
            </p>
            <input
              ref={bgInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleImageChange('bg')}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => bgInputRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5" />
              Pilih Foto Background
            </Button>
          </div>
        </div>

        {/* Save */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Simpan Perubahan
          </Button>
        </div>

      </div>
    </>
  );
}
