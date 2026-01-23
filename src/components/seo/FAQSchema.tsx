import Script from 'next/script';

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQSchemaProps {
  faqs: FAQItem[];
}

export default function FAQSchema({ faqs }: FAQSchemaProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };

  return (
    <Script
      id="faq-schema"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// Default FAQ items for the site
export const defaultFAQs = {
  en: [
    {
      question: 'What brands does OneCompany offer?',
      answer: 'OneCompany is an official distributor of 200+ premium tuning brands including Akrapovic, Brabus, Mansory, HRE Wheels, KW Suspension, Brembo, and many more.',
    },
    {
      question: 'Do you ship internationally?',
      answer: 'Yes, we offer worldwide shipping to USA, Europe, Middle East, Asia, and all other regions. We handle customs clearance and provide door-to-door delivery.',
    },
    {
      question: 'Are the products original?',
      answer: 'Yes, all products are 100% original and come with official manufacturer warranty. We are an authorized distributor for all our brands.',
    },
    {
      question: 'How long does shipping take?',
      answer: 'Shipping typically takes 3-7 business days for Europe, 5-10 days for USA, and 7-14 days for other regions. Express shipping options are available.',
    },
    {
      question: 'Do you offer installation services?',
      answer: 'We partner with professional installation centers worldwide. Contact us for recommendations in your area.',
    },
  ],
  ua: [
    {
      question: 'Які бренди пропонує OneCompany?',
      answer: 'OneCompany є офіційним дистриб\'ютором 200+ преміум брендів тюнінгу, включаючи Akrapovic, Brabus, Mansory, HRE Wheels, KW Suspension, Brembo та багато інших.',
    },
    {
      question: 'Чи здійснюєте ви міжнародну доставку?',
      answer: 'Так, ми пропонуємо доставку по всьому світу: США, Європа, Близький Схід, Азія та всі інші регіони. Ми займаємося митним оформленням та забезпечуємо доставку до дверей.',
    },
    {
      question: 'Чи продукція оригінальна?',
      answer: 'Так, вся продукція є 100% оригінальною та має офіційну гарантію виробника. Ми є авторизованим дистриб\'ютором усіх наших брендів.',
    },
    {
      question: 'Скільки часу займає доставка?',
      answer: 'Доставка по Україні займає 1-3 дні, по Європі 3-7 днів, до США 5-10 днів. Доступні варіанти експрес-доставки.',
    },
    {
      question: 'Чи надаєте ви послуги з встановлення?',
      answer: 'Ми співпрацюємо з професійними центрами встановлення по всій Україні та світу. Зв\'яжіться з нами для рекомендацій у вашому регіоні.',
    },
  ],
};
