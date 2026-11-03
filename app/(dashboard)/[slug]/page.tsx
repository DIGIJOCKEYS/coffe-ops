import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { findNavGroupTitle, findNavItem } from '@/lib/nav-config';

export default async function ModulePage({ params }: { params: { slug: string } }) {
  const href = `/${params.slug}`;
  const item = findNavItem(href);
  if (!item) notFound();

  return (
    <>
      <PageHeader title={item.label} description={findNavGroupTitle(href)} />
      <div className="rounded-xl border border-dashed border-line bg-white p-10 text-center text-sm text-ink-muted shadow-sm">
        Halaman {item.label} sedang disiapkan.
      </div>
    </>
  );
}
