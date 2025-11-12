'use client';
import React from 'react';
import { motion } from 'framer-motion';

interface InfoCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
}

const InfoCard: React.FC<InfoCardProps> = ({ title, description, icon }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="bg-gray-900 p-6 rounded-lg border border-gray-700"
    >
      <div className="flex items-center mb-4">
        <div className="text-3xl text-gray-400 mr-4">{icon}</div>
        <h2 className="text-2xl font-bold">{title}</h2>
      </div>
      <p className="text-gray-400">{description}</p>
    </motion.div>
  );
};

export default InfoCard;
