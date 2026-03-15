import AdminCollectionEditor from '../components/AdminCollectionEditor';

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminShopCollectionEditPage({ params }: Props) {
  const { id } = await params;
  return <AdminCollectionEditor collectionId={id} />;
}
