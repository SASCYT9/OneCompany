import AdminProductEditor from '../components/AdminProductEditor';

export default async function AdminShopEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <AdminProductEditor productId={id} />;
}
