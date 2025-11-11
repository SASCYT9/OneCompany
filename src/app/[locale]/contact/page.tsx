
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, Loader } from 'lucide-react';

type FormType = 'auto' | 'moto';

export default function ContactPage() {
  const [type, setType] = useState<FormType>('auto');
  const [formData, setFormData] = useState({
    model: '',
    vin: '',
    wishes: '',
    budget: '',
    email: '',
  });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleTypeChange = (newType: FormType) => {
    setType(newType);
    setFormData({ model: '', vin: '', wishes: '', budget: '', email: '' });
    setStatus('idle');
    setMessage('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setMessage('');

    const payload = {
      type,
      ...(type === 'auto' ? { carModel: formData.model } : { motoModel: formData.model }),
      vin: formData.vin,
      wishes: formData.wishes,
      budget: formData.budget,
      email: formData.email,
    };

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok) {
        setStatus('success');
        setMessage('Дякуємо! Ваш запит успішно надіслано.');
        setFormData({ model: '', vin: '', wishes: '', budget: '', email: '' });
      } else {
        setStatus('error');
        setMessage(result.error || 'Сталася помилка. Будь ласка, спробуйте ще раз.');
      }
    } catch (error) {
      setStatus('error');
      setMessage('Не вдалося надіслати запит. Перевірте з\'єднання з Інтернетом.');
    }
  };

  const modelLabel = type === 'auto' ? 'Марка та модель авто' : 'Марка та модель мотоцикла';
  const modelPlaceholder = type === 'auto' ? 'Наприклад, BMW M3 G80' : 'Наприклад, Ducati Panigale V4';

  return (
    <div className="bg-black min-h-screen text-gray-100 font-sans antialiased">
      <main className="container mx-auto px-4 py-16 sm:py-24">
        <div className="max-w-2xl mx-auto text-center mb-12">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-4xl sm:text-5xl font-bold text-white tracking-tight"
          >
            Індивідуальний підбір
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-4 text-lg text-gray-400"
          >
            Заповніть форму, і наші експерти знайдуть ідеальні деталі для вас.
          </motion.p>
        </div>
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="max-w-2xl mx-auto"
        >
          <div className="relative bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl shadow-black/20">
            <div className="p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                
                <div className="flex justify-center gap-4">
                  <button
                    type="button"
                    onClick={() => handleTypeChange('auto')}
                    className={`relative w-full py-3 px-6 rounded-lg font-bold text-lg transition-all duration-300 ease-in-out ${type === 'auto' ? 'bg-white text-black shadow-lg' : 'bg-white/10 text-white hover:bg-white/20'}`}
                  >
                    <span className="mr-2">🚗</span> Авто
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTypeChange('moto')}
                    className={`relative w-full py-3 px-6 rounded-lg font-bold text-lg transition-all duration-300 ease-in-out ${type === 'moto' ? 'bg-white text-black shadow-lg' : 'bg-white/10 text-white hover:bg-white/20'}`}
                  >
                    <span className="mr-2">🏍️</span> Мото
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="model" className="block text-sm font-medium text-gray-300 mb-2">{modelLabel}</label>
                    <input type="text" id="model" name="model" value={formData.model} onChange={handleChange} className="form-input" placeholder={modelPlaceholder} required />
                  </div>
                  <div>
                    <label htmlFor="vin" className="block text-sm font-medium text-gray-300 mb-2">VIN-код <span className="text-gray-500">(необов'язково)</span></label>
                    <input type="text" id="vin" name="vin" value={formData.vin} onChange={handleChange} className="form-input" placeholder="17 символів" />
                  </div>
                </div>

                <div>
                  <label htmlFor="wishes" className="block text-sm font-medium text-gray-300 mb-2">Побажання</label>
                  <textarea id="wishes" name="wishes" rows={4} value={formData.wishes} onChange={handleChange} className="form-input" placeholder="Опишіть, що саме ви шукаєте..." required />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="budget" className="block text-sm font-medium text-gray-300 mb-2">Бюджет <span className="text-gray-500">(необов'язково)</span></label>
                    <input type="text" id="budget" name="budget" value={formData.budget} onChange={handleChange} className="form-input" placeholder="Наприклад, 1000-5000 USD" />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">Ваш Email</label>
                    <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} className="form-input" placeholder="example@mail.com" required />
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={status === 'loading'}
                    className="w-full bg-white text-black font-bold text-lg py-3 px-12 rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-4 focus:ring-gray-300 focus:ring-opacity-50 transition-all duration-300 disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                  >
                    {status === 'loading' && <Loader className="animate-spin" size={20} />}
                    {status === 'loading' ? 'Надсилання...' : 'Надіслати запит'}
                  </button>
                </div>
                
                <AnimatePresence>
                  {message && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className={`mt-4 text-center p-3 rounded-lg flex items-center justify-center gap-2 ${status === 'success' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}
                    >
                      {status === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                      <span>{message}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </form>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
