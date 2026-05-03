
import ContactPageClient from '@/components/contact/ContactPageClient';
import { readSiteContent } from '@/lib/siteContentServer';
import { readSiteMedia } from '@/lib/siteMediaServer';
import { absoluteUrl, buildLocalizedPath, resolveLocale } from '@/lib/seo';

type ContactPageProps = {
  params: {
    locale?: string;
  };
};

export default async function ContactPage({ params }: ContactPageProps) {
  const locale = resolveLocale(params?.locale);
  const [siteContent, siteMedia] = await Promise.all([readSiteContent(), readSiteMedia()]);
  const pageUrl = absoluteUrl(buildLocalizedPath(locale, 'contact'));
  const heroPoster = siteMedia.heroPosters.auto || siteMedia.heroPosters.moto;

  return (
    <ContactPageClient
      locale={locale}
      pageUrl={pageUrl}
      heroPoster={heroPoster}
      contactContent={siteContent.contactPage}
    />
  );
}
