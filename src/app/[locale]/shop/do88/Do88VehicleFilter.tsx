"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

type Locale = string;

interface Do88VehicleFilterProps {
  locale: Locale;
  compact?: boolean;
  isSidebar?: boolean;
}

const CAR_DATA = {
  BMW: ['M2', 'M3', 'M4', 'M5', '135i', '335i', '435i', 'E30', 'E36', 'E46', 'E90', 'F80', 'F82', 'F87', 'G80', 'G87', 'N54', 'N55', 'B58', 'S55', 'S58'],
  Audi: ['RS3', 'RS6', 'RS7', 'S1', 'S2', 'RS2', 'S3', 'S4', 'A3', 'A4', 'TT', 'UrQuattro'],
  Porsche: ['911 (930)', '911 (964)', '911 (993)', '911 (996)', '911 (997)', '911 (991)', '911 (992)', '968'],
  Volkswagen: ['Golf GTI Mk5/6', 'Golf GTI Mk7', 'Golf R Mk8', 'Polo GTI'],
  Volvo: ['240', '740', '850', '940', 'S60', 'V60', 'V70', 'XC60', 'XC70', 'XC90', 'S80', 'C30', 'V40', 'S70'],
  Saab: ['900', '9-3', '9-5', '9000'],
  Toyota: ['GR Supra', 'GR Yaris'],
  Ford: ['Focus RS', 'Focus ST', 'Fiesta ST'],
  Opel: ['Astra', 'Corsa'],
  Seat: ['Ibiza Cupra', 'Leon'],
  CUPRA: ['Formentor', 'Leon'],
  Mazda: ['MX-5'],
} as const;

type Make = keyof typeof CAR_DATA;

export default function Do88VehicleFilter({ locale, compact = false, isSidebar = false }: Do88VehicleFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  
  const initialBrand = (searchParams?.get('brand') as Make) || '';
  const initialKeyword = searchParams?.get('keyword') || '';

  const [selectedMake, setSelectedMake] = useState<Make | ''>(initialBrand);
  const [selectedModel, setSelectedModel] = useState<string>(initialKeyword);

  const isUa = locale === 'ua';

  // Sync state if URL changes externally
  useEffect(() => {
    setSelectedMake((searchParams?.get('brand') as Make) || '');
    setSelectedModel(searchParams?.get('keyword') || '');
  }, [searchParams]);

  const pushLiveUpdate = (make: string, model: string) => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    if (make) {
      params.set('brand', make);
    } else {
      params.delete('brand');
    }
    
    if (model) {
      params.set('keyword', model);
    } else {
      params.delete('keyword');
    }

    // If we're on the home page or the general collections grid, transport user to the unified catalog
    let targetPath = pathname;
    if (pathname === `/${locale}/shop/do88` || pathname === `/${locale}/shop/do88/collections`) {
      targetPath = `/${locale}/shop/do88/collections/all`;
    }

    const q = params.toString();
    router.push(`${targetPath}${q ? `?${q}` : ''}`);
  };

  const handleMakeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const make = e.target.value as Make;
    setSelectedMake(make);
    setSelectedModel(''); // Reset model when make changes
    pushLiveUpdate(make, '');
  };

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const model = e.target.value;
    setSelectedModel(model);
    pushLiveUpdate(selectedMake, model);
  };

  const wrapperClass = isSidebar
    ? "do88-glass-panel w-full p-6 rounded-2xl flex flex-col gap-4 border border-white/5 bg-white/5 backdrop-blur-md"
    : compact 
      ? "do88-glass-panel w-full max-w-5xl mx-auto px-4 py-4 md:px-8 rounded-2xl flex flex-col md:flex-row items-center gap-4 do88-animate-up border border-white/10"
      : "do88-glass-panel do88-filter-container w-full max-w-4xl mx-auto do88-animate-up";

  return (
    <div className={wrapperClass} style={{ animationDelay: '0.1s' }}>
      {(!compact && !isSidebar) && (
        <div className="flex flex-col items-center mb-6 text-center">
          <h2 className="text-2xl font-light tracking-[0.1em] text-white">
            {isUa ? 'ЗНАЙДІТЬ СВІЙ АВТОМОБІЛЬ' : 'FIND YOUR VEHICLE'}
          </h2>
          <p className="text-sm text-white/50 mt-2">
            {isUa 
              ? 'Виберіть марку та модель для підбору запчастин DO88' 
              : 'Select your make and model to find compatible DO88 performance parts'}
          </p>
        </div>
      )}

      {(compact && !isSidebar) && (
        <div className="flex-shrink-0 mb-2 md:mb-0 mr-2 text-center md:text-left">
          <p className="text-[10px] tracking-[0.2em] uppercase text-white/50 mb-1">{isUa ? 'Фільтр' : 'Filter'}</p>
          <div className="text-sm font-medium tracking-widest text-white whitespace-nowrap">
            {isUa ? 'ВАШЕ АВТО' : 'YOUR VEHICLE'}
          </div>
        </div>
      )}

      {isSidebar && (
        <div className="mb-1">
          <p className="text-[10px] tracking-[0.2em] uppercase text-white/40 mb-1">{isUa ? 'Фільтр' : 'Filter'}</p>
          <h2 className="text-sm font-semibold tracking-widest text-white uppercase">
            {isUa ? 'Ваше Авто' : 'Your Vehicle'}
          </h2>
        </div>
      )}

      <div className={`grid grid-cols-1 ${(!isSidebar && compact) ? 'md:flex md:w-full md:gap-4' : 'gap-4'}`}>
        <div className={`relative ${(!isSidebar && compact) ? 'md:flex-1' : ''}`}>
          {(!compact || isSidebar) && (
            <label className="block text-[9px] uppercase tracking-[0.2em] text-white/50 mb-2 ml-1">
              {isUa ? 'Марка' : 'Make'}
            </label>
          )}
          <select 
            value={selectedMake} 
            onChange={handleMakeChange}
            className={`w-full appearance-none rounded-xl px-4 py-3 text-white focus:outline-none transition shadow-inner text-sm tracking-wide ${isSidebar ? 'bg-black/40 border border-white/10 hover:border-white/20' : 'bg-white/5 border border-white/10 hover:border-white/20'}`}
          >
            <option value="" className="text-black bg-white">{isUa ? 'Оберіть марку' : 'Select Make'}</option>
            {Object.keys(CAR_DATA).map((make) => (
              <option key={make} value={make} className="text-black bg-white">{make}</option>
            ))}
          </select>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/50">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </div>
        </div>

        <div className={`relative ${(!isSidebar && compact) ? 'md:flex-1 mt-3 md:mt-0' : ''}`}>
          {(!compact || isSidebar) && (
            <label className="block text-[9px] uppercase tracking-[0.2em] text-white/50 mb-2 ml-1">
              {isUa ? 'Модель' : 'Model'}
            </label>
          )}
          <select 
            value={selectedModel} 
            onChange={handleModelChange}
            disabled={!selectedMake}
            className={`w-full appearance-none rounded-xl px-4 py-3 text-white focus:outline-none transition shadow-inner text-sm tracking-wide disabled:opacity-50 disabled:cursor-not-allowed ${isSidebar ? 'bg-black/40 border border-white/10 hover:border-white/20' : 'bg-white/5 border border-white/10 hover:border-white/20'}`}
          >
            <option value="" className="text-black bg-white">{isUa ? 'Оберіть модель' : 'Select Model'}</option>
            {selectedMake && CAR_DATA[selectedMake]?.map((model) => (
              <option key={model} value={model} className="text-black bg-white">{model}</option>
            ))}
          </select>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/50">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </div>
        </div>
      </div>
    </div>
  );
}
