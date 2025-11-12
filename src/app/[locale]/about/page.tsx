'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import InfoCard from '@/components/ui/info-card';
import ContactForm from '@/components/ui/contact-form';
import { Globe, Wrench, Users, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';

const AboutPage: React.FC = () => {
  const t = useTranslations('aboutPage');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  const infoItems = [
    {
      icon: <Search />,
      title: t('info.selectionTitle'),
      description: t('info.selectionDesc'),
    },
    {
      icon: <Users />,
      title: t('info.expertHelpTitle'),
      description: t('info.expertHelpDesc'),
    },
    {
      icon: <Wrench />,
      title: t('info.partnerNetworkTitle'),
      description: t('info.partnerNetworkDesc'),
    },
    {
      icon: <Globe />,
      title: t('info.worldwideDeliveryTitle'),
      description: t('info.worldwideDeliveryDesc'),
    },
  ];

  return (
    <>
      <div className="min-h-screen bg-black text-white p-8">
        <motion.h1
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-5xl font-bold text-center mb-12"
        >
          {t('title')}
        </motion.h1>
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
          {infoItems.map((item, index) => (
            <InfoCard key={index} title={item.title} description={item.description} icon={item.icon} />
          ))}
        </div>
        <div className="text-center mt-16">
          <motion.button
            onClick={openModal}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="bg-gray-800 text-white font-bold py-4 px-8 rounded-full border border-gray-600 hover:bg-gray-700 transition-colors"
          >
            {t('contact')}
          </motion.button>
        </div>
      </div>
      <ContactForm isOpen={isModalOpen} onClose={closeModal} />
    </>
  );
};

export default AboutPage;
