import AdminCategoryEditor from '@/app/admin/shop/categories/components/AdminCategoryEditor';

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminCategoryDetailPage({ params }: Props) {
  const { id } = await params;
  return <AdminCategoryEditor categoryId={id} />;
}
