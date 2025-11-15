
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, Loader, Mail, Phone, MapPin } from 'lucide-react';

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
      setMessage('Не вдалося надіслати запит. Перевірте з’єднання з Інтернетом.');
    }
  };

  const modelLabel = type === 'auto' ? 'Марка та модель авто' : 'Марка та модель мотоцикла';
  const modelPlaceholder = type === 'auto' ? 'Наприклад, BMW M3 G80' : 'Наприклад, Ducati Panigale V4';

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      {/* Hero Section */}
      <section className="px-6 md:px-10 py-32 md:py-40">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-20"
          >
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-extralight tracking-tight text-zinc-900 dark:text-white mb-8 leading-tight">
              Get In Touch
            </h1>
            <div className="w-32 h-px bg-zinc-300 dark:bg-white/20 mx-auto mb-10" />
            <p className="text-xl md:text-2xl font-light text-zinc-600 dark:text-white/50 max-w-3xl mx-auto">
              Індивідуальний підбір деталей для вашого авто чи мотоцикла
            </p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24">
            {/* Contact Info */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="space-y-12"
            >
              <div>
                <h2 className="text-3xl md:text-4xl font-light text-zinc-900 dark:text-white mb-8 tracking-wide">
                  Contact Information
                </h2>
                <div className="w-16 h-px bg-zinc-300 dark:bg-white/20 mb-12" />
              </div>

              <div className="space-y-8">
                <div className="flex items-start gap-4 group">
                  <div className="p-3 bg-zinc-100 dark:bg-zinc-900/50 text-zinc-900 dark:text-white group-hover:scale-110 transition-transform duration-300">
                    <Mail className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm uppercase tracking-widest text-zinc-500 dark:text-white/40 mb-2 font-light">Email</h3>
                    <a href="mailto:info@onecompany.com" className="text-lg font-light text-zinc-900 dark:text-white hover:text-zinc-600 dark:hover:text-white/70 transition-colors">
                      info@onecompany.com
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4 group">
                  <div className="p-3 bg-zinc-100 dark:bg-zinc-900/50 text-zinc-900 dark:text-white group-hover:scale-110 transition-transform duration-300">
                    <Phone className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm uppercase tracking-widest text-zinc-500 dark:text-white/40 mb-2 font-light">Phone</h3>
                    <a href="tel:+380123456789" className="text-lg font-light text-zinc-900 dark:text-white hover:text-zinc-600 dark:hover:text-white/70 transition-colors">
                      +380 12 345 67 89
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4 group">
                  <div className="p-3 bg-zinc-100 dark:bg-zinc-900/50 text-zinc-900 dark:text-white group-hover:scale-110 transition-transform duration-300">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm uppercase tracking-widest text-zinc-500 dark:text-white/40 mb-2 font-light">Location</h3>
                    <p className="text-lg font-light text-zinc-900 dark:text-white">
                      Kyiv, Ukraine
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-8">
                <p className="text-base font-light text-zinc-600 dark:text-white/60 leading-relaxed">
                  Наші експерти готові допомогти вам знайти ідеальні деталі та компоненти для вашого автомобіля чи мотоцикла. 
                  Заповніть форму, і ми зв&rsquo;яжемося з вами найближчим часом.
                </p>
              </div>
            </motion.div>

            {/* Contact Form */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              <form onSubmit={handleSubmit} className="space-y-8">
                {/* Type Selection */}
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => handleTypeChange('auto')}
                    className={`flex-1 py-4 px-6 text-sm uppercase tracking-widest font-light transition-all duration-300 ${
                      type === 'auto'
                        ? 'bg-zinc-900 dark:bg-white text-white dark:text-black'
                        : 'bg-zinc-100 dark:bg-zinc-900/30 text-zinc-600 dark:text-white/60 hover:bg-zinc-200 dark:hover:bg-zinc-900/50'
                    }`}
                  >
                    Авто
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTypeChange('moto')}
                    className={`flex-1 py-4 px-6 text-sm uppercase tracking-widest font-light transition-all duration-300 ${
                      type === 'moto'
                        ? 'bg-zinc-900 dark:bg-white text-white dark:text-black'
                        : 'bg-zinc-100 dark:bg-zinc-900/30 text-zinc-600 dark:text-white/60 hover:bg-zinc-200 dark:hover:bg-zinc-900/50'
                    }`}
                  >
                    Мото
                  </button>
                </div>

                {/* Form Fields */}
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="model" className="block text-xs uppercase tracking-widest text-zinc-500 dark:text-white/40 mb-3 font-light">
                        {modelLabel}
                      </label>
                      <input
                        type="text"
                        id="model"
                        name="model"
                        value={formData.model}
                        onChange={handleChange}
                        className="w-full px-0 py-3 bg-transparent border-b border-zinc-300 dark:border-white/20 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-white/30 focus:outline-none focus:border-zinc-900 dark:focus:border-white transition-colors font-light"
                        placeholder={modelPlaceholder}
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="vin" className="block text-xs uppercase tracking-widest text-zinc-500 dark:text-white/40 mb-3 font-light">
                        VIN-код <span className="text-zinc-400 dark:text-white/30">(необов&rsquo;язково)</span>
                      </label>
                      <input
                        type="text"
                        id="vin"
                        name="vin"
                        value={formData.vin}
                        onChange={handleChange}
                        className="w-full px-0 py-3 bg-transparent border-b border-zinc-300 dark:border-white/20 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-white/30 focus:outline-none focus:border-zinc-900 dark:focus:border-white transition-colors font-light"
                        placeholder="17 символів"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="wishes" className="block text-xs uppercase tracking-widest text-zinc-500 dark:text-white/40 mb-3 font-light">
                      Побажання
                    </label>
                    <textarea
                      id="wishes"
                      name="wishes"
                      rows={4}
                      value={formData.wishes}
                      onChange={handleChange}
                      className="w-full px-0 py-3 bg-transparent border-b border-zinc-300 dark:border-white/20 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-white/30 focus:outline-none focus:border-zinc-900 dark:focus:border-white transition-colors resize-none font-light"
                      placeholder="Опишіть, що саме ви шукаєте..."
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="budget" className="block text-xs uppercase tracking-widest text-zinc-500 dark:text-white/40 mb-3 font-light">
                        Бюджет <span className="text-zinc-400 dark:text-white/30">(необов&rsquo;язково)</span>
                      </label>
                      <input
                        type="text"
                        id="budget"
                        name="budget"
                        value={formData.budget}
                        onChange={handleChange}
                        className="w-full px-0 py-3 bg-transparent border-b border-zinc-300 dark:border-white/20 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-white/30 focus:outline-none focus:border-zinc-900 dark:focus:border-white transition-colors font-light"
                        placeholder="1000-5000 USD"
                      />
                    </div>
                    <div>
                      <label htmlFor="email" className="block text-xs uppercase tracking-widest text-zinc-500 dark:text-white/40 mb-3 font-light">
                        Email
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        className="w-full px-0 py-3 bg-transparent border-b border-zinc-300 dark:border-white/20 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-white/30 focus:outline-none focus:border-zinc-900 dark:focus:border-white transition-colors font-light"
                        placeholder="example@mail.com"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="pt-6">
                  <motion.button
                    type="submit"
                    disabled={status === 'loading'}
                    whileHover={{ scale: status === 'loading' ? 1 : 1.02 }}
                    whileTap={{ scale: status === 'loading' ? 1 : 0.98 }}
                    className="w-full py-4 px-12 bg-zinc-900 dark:bg-white text-white dark:text-black text-sm uppercase tracking-widest font-light hover:bg-zinc-800 dark:hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-3"
                  >
                    {status === 'loading' && <Loader className="animate-spin" size={18} />}
                    {status === 'loading' ? 'Надсилання...' : 'Надіслати запит'}
                  </motion.button>
                </div>

                {/* Status Message */}
                <AnimatePresence>
                  {message && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className={`p-4 flex items-center justify-center gap-3 ${
                        status === 'success'
                          ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                          : 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300'
                      }`}
                    >
                      {status === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                      <span className="text-sm font-light">{message}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </form>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
}
