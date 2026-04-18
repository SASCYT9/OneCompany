import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const INPUT_FILE = path.join(process.cwd(), 'do88-products-v4.json');
const WRITE = process.argv.includes('--write');
const SYNC_DB = process.argv.includes('--sync-db');
const prisma = SYNC_DB ? new PrismaClient() : null;

const EN_PART_MAP = new Map([
  ['Modellanpassat', 'Vehicle Specific'],
  ['Motor / Tuning', 'Engine / Tuning'],
  ['Silikonslang / slang', 'Hoses & Couplers'],
  ['Silikonslang Blå', 'Blue Silicone Hose'],
  ['Silikonslang Svart', 'Black Silicone Hose'],
  ['Silikonslang Röd', 'Red Silicone Hose'],
  ['Böjar', 'Elbows'],
  ['Böjd reducering', 'Reducer Elbows'],
  ['Böjda reduceringar', 'Reducer Elbows'],
  ['Rak reducering', 'Straight Reducers'],
  ['Raka kopplingar', 'Straight Couplers'],
  ['Flexibel slät', 'Smooth Flexible Hoses'],
  ['Flexibel', 'Flexible Hoses'],
  ['Aluminiumrör', 'Aluminum Pipes'],
  ['Luftfilter', 'Air Filters'],
  ['BMC Koniskt Luftfilter', 'BMC Conical Air Filters'],
  ['BMC Luftfilterbox', 'BMC Air Filter Boxes'],
  ['BMC Vevhusventilationsfilter', 'BMC Crankcase Ventilation Filters'],
  ['BMC Modellanpassat', 'BMC Vehicle Specific'],
  ['Dumpventiler / Laddtrycksstyrning', 'Dump Valves / Boost Control'],
  ['Avgasdelar', 'Exhaust Parts'],
  ['Avgasbandage', 'Exhaust Wrap'],
  ['Bränsleslang', 'Fuel Hose'],
  ['Bränsleslang metervara', 'Fuel Hose, Per Meter'],
  ['Bränslepåfyllningsslang', 'Fuel Filler Hose'],
  ['Slangtillbehör', 'Hose Accessories'],
  ['Slangklämmor och tillbehör', 'Hose Clamps and Accessories'],
  ['Slangklämmor', 'Hose Clamps'],
  ['Öronslangklämmor', 'Ear Clamps'],
  ['Clamp-kit', 'Clamp Kits'],
  ['FlexCoupler', 'Flex Couplers'],
  ['Intercooler universal', 'Universal Intercoolers'],
  ['Garrett Intercooler Cellpaket', 'Garrett Intercooler Cores'],
  ['Luft-Luft Intercooler Cellpaket, Garrett', 'Air-to-Air Intercooler Cores, Garrett'],
  ['Luft-Vatten Intercooler Cellpaket , Garrett', 'Air-to-Water Intercooler Cores, Garrett'],
  ['Luft-Vatten Intercooler Cellpaket, Garrett', 'Air-to-Water Intercooler Cores, Garrett'],
  ['Oljekylare', 'Oil Coolers'],
  ['Luftslang', 'Air Hoses'],
  ['Värmeskydd', 'Heat Protection'],
  ['Värmeisolerande tejp', 'Heat Insulation Tape'],
  ['Värmeisolerande matta', 'Heat Insulation Mat'],
  ['Värmeskyddsbandage', 'Heat Shield Wrap'],
  ['Aluminium värmesköld', 'Aluminum Heat Shield'],
  ['Aluminiumkon', 'Aluminum Cones'],
  ['Raka 500mm längd', 'Straight, 500 mm Length'],
  ['Raka 1000mm längd', 'Straight, 1000 mm Length'],
  ['2mm godstjocklek, Polerade', '2 mm Wall Thickness, Polished'],
  ['3mm väggtjocklek', '3 mm Wall Thickness'],
  ['90 grader, kort radie', '90°, Short Radius'],
  ['90 grader, lång radie', '90°, Long Radius'],
  ['45 grader, kort radie', '45°, Short Radius'],
  ['45 grader, lång radie', '45°, Long Radius'],
  ['180 grader', '180°'],
  ['135 grader', '135°'],
  ['90 grader', '90°'],
  ['45 grader', '45°'],
  ['Diesel motorer', 'Diesel Engines'],
  ['Montering', 'Mounting'],
  ['Laddtrycksstyrning', 'Boost Control'],
  ['Reklamartiklar', 'Merchandise'],
  ['Övriga avgasdelar', 'Other Exhaust Parts'],
  ['T-koppling', 'T Couplers'],
  ['Rak 10cm', 'Straight, 10 cm'],
  ['Slimline', 'Slimline'],
  ['Cobra head', 'Cobra Head'],
  ['GFB Dumpventiler', 'GFB Dump Valves'],
]);

const UA_PART_MAP = new Map([
  ['Modellanpassat', 'Для автомобілів'],
  ['Motor / Tuning', 'Двигун / Тюнінг'],
  ['Silikonslang / slang', 'Шланги та патрубки'],
  ['Silikonslang Blå', 'Сині силіконові патрубки'],
  ['Silikonslang Svart', 'Чорні силіконові патрубки'],
  ['Silikonslang Röd', 'Червоні силіконові патрубки'],
  ['Böjar', 'Коліна'],
  ['Böjd reducering', 'Редукційні коліна'],
  ['Böjda reduceringar', 'Редукційні коліна'],
  ['Rak reducering', 'Прямі редуктори'],
  ['Raka kopplingar', 'Прямі муфти'],
  ['Flexibel slät', 'Гладкі гнучкі шланги'],
  ['Flexibel', 'Гнучкі шланги'],
  ['Aluminiumrör', 'Алюмінієві труби'],
  ['Luftfilter', 'Повітряні фільтри'],
  ['BMC Koniskt Luftfilter', 'Конусні повітряні фільтри BMC'],
  ['BMC Luftfilterbox', 'Короби повітряних фільтрів BMC'],
  ['BMC Vevhusventilationsfilter', 'Фільтри вентиляції картера BMC'],
  ['BMC Modellanpassat', 'Модельні рішення BMC'],
  ['Dumpventiler / Laddtrycksstyrning', 'Дамп-клапани / керування бустом'],
  ['Avgasdelar', 'Вихлопні компоненти'],
  ['Avgasbandage', 'Термострічка для вихлопу'],
  ['Bränsleslang', 'Паливні шланги'],
  ['Bränsleslang metervara', 'Паливний шланг, на метраж'],
  ['Bränslepåfyllningsslang', 'Шланг заливної горловини'],
  ['Slangtillbehör', 'Аксесуари для шлангів'],
  ['Slangklämmor och tillbehör', 'Хомути та аксесуари'],
  ['Slangklämmor', 'Хомути'],
  ['Öronslangklämmor', 'Вушні хомути'],
  ['Clamp-kit', 'Комплекти хомутів'],
  ['FlexCoupler', 'Flex Coupler'],
  ['Intercooler universal', 'Універсальні інтеркулери'],
  ['Garrett Intercooler Cellpaket', 'Сердечники інтеркулерів Garrett'],
  ['Luft-Luft Intercooler Cellpaket, Garrett', 'Сердечники інтеркулерів повітря-повітря Garrett'],
  ['Luft-Vatten Intercooler Cellpaket , Garrett', 'Сердечники інтеркулерів повітря-вода Garrett'],
  ['Luft-Vatten Intercooler Cellpaket, Garrett', 'Сердечники інтеркулерів повітря-вода Garrett'],
  ['Oljekylare', 'Масляні радіатори'],
  ['Luftslang', 'Повітряні шланги'],
  ['Värmeskydd', 'Теплозахист'],
  ['Värmeisolerande tejp', 'Теплоізоляційна стрічка'],
  ['Värmeisolerande matta', 'Теплоізоляційний мат'],
  ['Värmeskyddsbandage', 'Теплозахисна стрічка'],
  ['Aluminium värmesköld', 'Алюмінієвий теплозахисний екран'],
  ['Aluminiumkon', 'Алюмінієві конуси'],
  ['Raka 500mm längd', 'Прямі, довжина 500 мм'],
  ['Raka 1000mm längd', 'Прямі, довжина 1000 мм'],
  ['2mm godstjocklek, Polerade', 'Товщина стінки 2 мм, поліровані'],
  ['3mm väggtjocklek', 'Товщина стінки 3 мм'],
  ['90 grader, kort radie', '90°, короткий радіус'],
  ['90 grader, lång radie', '90°, довгий радіус'],
  ['45 grader, kort radie', '45°, короткий радіус'],
  ['45 grader, lång radie', '45°, довгий радіус'],
  ['180 grader', '180°'],
  ['135 grader', '135°'],
  ['90 grader', '90°'],
  ['45 grader', '45°'],
  ['Diesel motorer', 'Дизельні двигуни'],
  ['Montering', 'Монтаж'],
  ['Laddtrycksstyrning', 'Керування бустом'],
  ['Reklamartiklar', 'Мерч'],
  ['Övriga avgasdelar', 'Інші вихлопні компоненти'],
  ['T-koppling', 'Т-подібні муфти'],
  ['Rak 10cm', 'Прямі, 10 см'],
  ['Slimline', 'Тонкий профіль'],
  ['Cobra head', 'Cobra Head'],
  ['GFB Dumpventiler', 'Дамп-клапани GFB'],
]);

const EN_TEXT_RULES = [
  [/Silikonslang/gi, 'Silicone Hose'],
  [/Tryckrör/gi, 'Charge Pipe'],
  [/Spjällhusslang/gi, 'Throttle Body Hose'],
  [/Spjällhus/gi, 'Throttle Body'],
  [/Dumpventiler/gi, 'Dump Valves'],
  [/Dumpventil/gi, 'Dump Valve'],
  [/Värmepaketslangar/gi, 'Heater Core Hoses'],
  [/Värmepaket/gi, 'Heater Core'],
  [/Dräneringsslangar/gi, 'Drain Hoses'],
  [/Undre Intercoolerrör/gi, 'Lower Intercooler Pipe'],
  [/Intercoolerrör/gi, 'Intercooler Pipe'],
  [/Expansionskärlsslangar/gi, 'Expansion Tank Hoses'],
  [/Kylarslangar/gi, 'Coolant Hoses'],
  [/Magnetventil/gi, 'Solenoid Valve'],
  [/Vevvent/gi, 'Crankcase Ventilation'],
  [/Ersättningsfilter/gi, 'Replacement Filter'],
  [/Luftfilterflytt/gi, 'Air Filter Relocation'],
  [/Mittanslutning/gi, 'Center Connection'],
  [/Toppanslutning/gi, 'Top Connection'],
  [/Rörkit/gi, 'Pipe Kit'],
  [/Fastsättningskit/gi, 'Mounting Kit'],
  [/Oljekylare/gi, 'Oil Cooler'],
  [/Förvärmningsslangar/gi, 'Preheater Hoses'],
  [/Bandage/gi, 'Wrap'],
  [/Utlopp/gi, 'Outlet'],
  [/Inlopp/gi, 'Inlet'],
  [/Mellan/gi, 'Middle'],
  [/Resonatorhus/gi, 'Resonator Housing'],
  [/Batteri/gi, 'Battery'],
  [/Bilar/gi, 'Cars'],
  [/Vattenventil/gi, 'Water Valve'],
  [/Återcirkulerande Ventil/gi, 'Recirculating Valve'],
  [/Termokontakt/gi, 'Thermo Switch'],
  [/Kylarrör/gi, 'Coolant Pipe'],
  [/Flexibel Slät/gi, 'Smooth Flexible'],
  [/Flexibel/gi, 'Flexible'],
  [/Slät/gi, 'Smooth'],
  [/Koppling/gi, 'Coupler'],
  [/Bensin/gi, 'Petrol'],
  [/Inletsrör/gi, 'Inlet Pipe'],
  [/Y-Rör/gi, 'Y-Pipe'],
  [/T-Rör/gi, 'T-Pipe'],
  [/Flänsförband/gi, 'Flange Joint'],
  [/Bakaxelrör/gi, 'Rear Axle Pipe'],
  [/Avgasrör/gi, 'Exhaust Pipe'],
  [/AvgasWrap/gi, 'Exhaust Wrap'],
  [/Vattenkylare/gi, 'Radiator'],
  [/ECU-Kåpa/gi, 'ECU Cover'],
  [/Slangklämmepaket/gi, 'Hose Clamp Kit'],
  [/Plastkåpa/gi, 'Plastic Cover'],
  [/Vänster/gi, 'Left'],
  [/Höger/gi, 'Right'],
  [/Tryckslangar/gi, 'Boost Hoses'],
  [/Cellpaket/gi, 'Core'],
  [/Inletsslangar/gi, 'Inlet Hoses'],
  [/Inletsslang/gi, 'Inlet Hose'],
  [/Outletsslang/gi, 'Outlet Hose'],
  [/Luftslang/gi, 'Air Hose'],
  [/Slanguttag/gi, 'Hose Outlet'],
  [/Armerad/gi, 'Reinforced'],
  [/Servoslangar/gi, 'Power Steering Hoses'],
  [/Servoslang/gi, 'Power Steering Hose'],
  [/Vakuumslangar/gi, 'Vacuum Hoses'],
  [/Vakuumslang/gi, 'Vacuum Hose'],
  [/Vevhusventslangar/gi, 'Crankcase Vent Hoses'],
  [/Vevhusventslang/gi, 'Crankcase Vent Hose'],
  [/Oljeslangar/gi, 'Oil Hoses'],
  [/Transmissionskylare/gi, 'Transmission Cooler'],
  [/Luftrenarslangar/gi, 'Air Cleaner Hoses'],
  [/Symposerslang/gi, 'Symposer Hose'],
  [/Bromsvakuumslangar/gi, 'Brake Vacuum Hoses'],
  [/Cross-flowslangar/gi, 'Cross-Flow Hoses'],
  [/Dumpslang/gi, 'Dump Valve Hose'],
  [/Pysventil/gi, 'Bleed Valve'],
  [/Servokylare/gi, 'Power Steering Cooler'],
  [/Avgasreningsslangar/gi, 'Emissions Control Hoses'],
  [/Kolkanisterslangar/gi, 'Charcoal Canister Hoses'],
  [/Kolkanisterslang/gi, 'Charcoal Canister Hose'],
  [/Accessoriesspaket/gi, 'Accessories Package'],
  [/Passar/gi, 'Fits'],
  [/Sena/gi, 'Late-Model'],
  [/Modeller/gi, 'Models'],
  [/\bUtan\b/gi, 'Without'],
  [/\bMed\b/gi, 'With'],
  [/Värmeisolerande/gi, 'Heat Insulation'],
  [/Värmeisolerande tejp/gi, 'Heat Insulation Tape'],
  [/Värmeisolerande matta/gi, 'Heat Insulation Mat'],
  [/Värmeskyddsbandage/gi, 'Heat Shield Wrap'],
  [/Bränsleslang/gi, 'Fuel Hose'],
  [/Bränslepåfyllningsslang/gi, 'Fuel Filler Hose'],
  [/Tomgångsmotorslangar/gi, 'Idle Control Hoses'],
  [/Motorkåpa/gi, 'Engine Cover'],
  [/insugskåpa/gi, 'intake cover'],
  [/Insugskåpa/gi, 'Intake Cover'],
  [/Inloppsrör/gi, 'Inlet Pipe'],
  [/Inloppsslang/gi, 'Inlet Hose'],
  [/Utloppsslang/gi, 'Outlet Hose'],
  [/Insugssystem/gi, 'Intake System'],
  [/Insugsslang/gi, 'Intake Hose'],
  [/Insug\b/gi, 'Intake'],
  [/Kolfiberkåpa/gi, 'Carbon Fiber Cover'],
  [/Kolfiber/gi, 'Carbon Fiber'],
  [/Värmesköld/gi, 'Heat Shield'],
  [/Värmeskydd/gi, 'Heat Protection'],
  [/Luftfilterbox/gi, 'Air Filter Box'],
  [/Luftfilter/gi, 'Air Filter'],
  [/Vevhusventilationsfilter/gi, 'Crankcase Ventilation Filter'],
  [/Avgasdelar/gi, 'Exhaust Parts'],
  [/Tång/gi, 'Pliers'],
  [/Tillbehör/gi, 'Accessories'],
  [/tillbehör/gi, 'Accessories'],
  [/tejp/gi, 'Tape'],
  [/matta/gi, 'Mat'],
  [/guld/gi, 'Gold'],
  [/svart/gi, 'Black'],
  [/röd/gi, 'Red'],
  [/blå/gi, 'Blue'],
  [/stål/gi, 'Steel'],
  [/Titan\b/gi, 'Titanium'],
  [/Dämpare/gi, 'Muffler'],
  [/Ändrör/gi, 'Exhaust Tip'],
  [/Ellips\b/gi, 'Ellipse'],
  [/öronklämma/gi, 'ear clamp'],
  [/Öronslangklämmor/gi, 'Ear Clamps'],
  [/Slangklämma/gi, 'Hose Clamp'],
  [/Slangklämmor/gi, 'Hose Clamps'],
  [/Tång för/gi, 'Pliers for'],
  [/\bSlangar\b/gi, 'Hoses'],
  [/\bSlang\b/gi, 'Hose'],
  [/\bför\b/gi, 'for'],
  [/\bkat\b/gi, 'catalytic converter'],
  [/med kat/gi, 'with catalytic converter'],
  [/utan kat/gi, 'without catalytic converter'],
  [/\bmed\b/gi, 'with'],
  [/\boch\b/gi, 'and'],
  [/\bTill\b/gi, 'To'],
  [/lång radie/gi, 'Long Radius'],
  [/Långt Ben/gi, 'Long Leg'],
  [/kort radie/gi, 'Short Radius'],
  [/väggtjocklek/gi, 'Wall Thickness'],
  [/godstjocklek/gi, 'Wall Thickness'],
  [/Polerade/gi, 'Polished'],
  [/Längd/gi, 'Length'],
  [/längd/gi, 'length'],
  [/Anslutning/gi, 'Connection'],
  [/anslutning/gi, 'connection'],
  [/Bredd/gi, 'Width'],
  [/bredd/gi, 'width'],
  [/Rostfritt stål/gi, 'Stainless Steel'],
  [/Rostfritt/gi, 'Stainless'],
  [/Rostfri/gi, 'Stainless'],
  [/Aluminiumrör/gi, 'Aluminum Pipe'],
  [/Aluminiumkon/gi, 'Aluminum Cone'],
  [/Airsystem/gi, 'Air System'],
  [/Aluminium/gi, 'Aluminum'],
  [/Koniskt/gi, 'Conical'],
  [/Kompensator/gi, 'Flex Section'],
  [/Mqbevo/gi, 'MQB Evo'],
  [/BigPack/gi, 'Big Pack'],
  [/grader/gi, '°'],
  [/rulle/gi, 'Roll'],
  [/metervara/gi, 'Per Meter'],
  [/övriga/gi, 'Other'],
  [/Övriga/gi, 'Other'],
  [/G-Chassi/gi, 'G-Chassis'],
  [/F & G-Chassi/gi, 'F & G Chassis'],
  [/(\d+)\s*Rad\b/gi, '$1 Row'],
];

const UA_TEXT_RULES = [
  [/Silikonslang/gi, 'Силіконовий патрубок'],
  [/Tryckrör/gi, 'пайп наддуву'],
  [/Spjällhusslang/gi, 'патрубок дросельної заслінки'],
  [/Spjällhus/gi, 'дросельна заслінка'],
  [/Dumpventiler/gi, 'дамп-клапани'],
  [/Dumpventil/gi, 'дамп-клапан'],
  [/Värmepaketslangar/gi, 'шланги радіатора опалювача'],
  [/Värmepaket/gi, 'радіатор опалювача'],
  [/Dräneringsslangar/gi, 'дренажні шланги'],
  [/Undre Intercoolerrör/gi, 'нижня труба інтеркулера'],
  [/Intercoolerrör/gi, 'труба інтеркулера'],
  [/Expansionskärlsslangar/gi, 'шланги розширювального бачка'],
  [/Kylarslangar/gi, 'шланги охолодження'],
  [/Magnetventil/gi, 'соленоїдний клапан'],
  [/Vevvent/gi, 'вентиляція картера'],
  [/Ersättningsfilter/gi, 'змінний фільтр'],
  [/Luftfilterflytt/gi, 'перенесення фільтра'],
  [/Mittanslutning/gi, "центральне під'єднання"],
  [/Toppanslutning/gi, "верхнє під'єднання"],
  [/Rörkit/gi, 'комплект труб'],
  [/Fastsättningskit/gi, 'монтажний комплект'],
  [/Oljekylare/gi, 'масляний радіатор'],
  [/Förvärmningsslangar/gi, 'шланги підігріву'],
  [/Bandage/gi, 'стрічка'],
  [/Utlopp/gi, 'вихід'],
  [/Inlopp/gi, 'вхід'],
  [/Mellan/gi, 'проміжний'],
  [/Resonatorhus/gi, 'корпус резонатора'],
  [/Batteri/gi, 'акумулятор'],
  [/Bilar/gi, 'автомобілі'],
  [/Vattenventil/gi, 'водяний клапан'],
  [/Återcirkulerande Ventil/gi, 'перепускний клапан'],
  [/Termokontakt/gi, 'термоконтакт'],
  [/Kylarrör/gi, 'труба охолодження'],
  [/Flexibel Slät/gi, 'гладкий гнучкий'],
  [/Flexibel/gi, 'гнучкий'],
  [/Slät/gi, 'гладкий'],
  [/Koppling/gi, 'муфта'],
  [/Bensin/gi, 'бензин'],
  [/Inletsrör/gi, 'Впускна труба'],
  [/Y-Rör/gi, 'Y-труба'],
  [/T-Rör/gi, 'T-труба'],
  [/Flänsförband/gi, 'Фланцеве з’єднання'],
  [/Bakaxelrör/gi, 'Задня вихлопна труба'],
  [/Avgasrör/gi, 'Вихлопна труба'],
  [/AvgasWrap/gi, 'Вихлопна термострічка'],
  [/Vattenkylare/gi, 'Радіатор охолодження'],
  [/ECU-Kåpa/gi, 'Кришка ECU'],
  [/Slangklämmepaket/gi, 'Комплект хомутів'],
  [/Plastkåpa/gi, 'Пластикова кришка'],
  [/Vänster/gi, 'Лівий'],
  [/Höger/gi, 'Правий'],
  [/Tryckslangar/gi, 'патрубки наддуву'],
  [/Cellpaket/gi, 'сердечник'],
  [/Inletsslangar/gi, 'вхідні шланги'],
  [/Inletsslang/gi, 'вхідний шланг'],
  [/Outletsslang/gi, 'вихідний шланг'],
  [/Luftslang/gi, 'повітряний шланг'],
  [/Slanguttag/gi, 'вихід під шланг'],
  [/Armerad/gi, 'армований'],
  [/Servoslangar/gi, 'шланги гідропідсилювача'],
  [/Servoslang/gi, 'шланг гідропідсилювача'],
  [/Vakuumslangar/gi, 'вакуумні шланги'],
  [/Vakuumslang/gi, 'вакуумний шланг'],
  [/Vevhusventslangar/gi, 'шланги вентиляції картера'],
  [/Vevhusventslang/gi, 'шланг вентиляції картера'],
  [/Oljeslangar/gi, 'масляні шланги'],
  [/Transmissionskylare/gi, 'радіатор трансмісії'],
  [/Luftrenarslangar/gi, 'шланги повітроочисника'],
  [/Symposerslang/gi, 'шланг symposer'],
  [/Bromsvakuumslangar/gi, 'шланги вакууму гальм'],
  [/Cross-flowslangar/gi, 'cross-flow шланги'],
  [/Dumpslang/gi, 'шланг дамп-клапана'],
  [/Pysventil/gi, 'клапан стравлювання'],
  [/Servokylare/gi, 'радіатор гідропідсилювача'],
  [/Avgasreningsslangar/gi, 'шланги системи очищення вихлопу'],
  [/Kolkanisterslangar/gi, 'шланги адсорбера'],
  [/Kolkanisterslang/gi, 'шланг адсорбера'],
  [/Accessoriesspaket/gi, 'пакет аксесуарів'],
  [/Passar/gi, 'підходить для'],
  [/Sena/gi, 'пізні'],
  [/Modeller/gi, 'моделі'],
  [/\bUtan\b/gi, 'Без'],
  [/\bMed\b/gi, 'З'],
  [/Värmeisolerande/gi, 'Теплоізоляційний'],
  [/Värmeisolerande tejp/gi, 'Теплоізоляційна стрічка'],
  [/Värmeisolerande matta/gi, 'Теплоізоляційний мат'],
  [/Värmeskyddsbandage/gi, 'Теплозахисна стрічка'],
  [/Bränsleslang/gi, 'Паливний шланг'],
  [/Bränslepåfyllningsslang/gi, 'Шланг заливної горловини'],
  [/Tomgångsmotorslangar/gi, 'Шланги холостого ходу'],
  [/Motorkåpa/gi, 'Кришка двигуна'],
  [/insugskåpa/gi, 'кришка впуску'],
  [/Insugskåpa/gi, 'Кришка впуску'],
  [/Inloppsrör/gi, 'Впускна труба'],
  [/Inloppsslang/gi, 'Впускний шланг'],
  [/Utloppsslang/gi, 'Вихідний шланг'],
  [/Insugssystem/gi, 'Впускна система'],
  [/Insugsslang/gi, 'Впускний шланг'],
  [/Insug\b/gi, 'Впуск'],
  [/Kolfiberkåpa/gi, 'Карбонова кришка'],
  [/Kolfiber/gi, 'Карбон'],
  [/Värmesköld/gi, 'Теплозахисний екран'],
  [/Värmeskydd/gi, 'Теплозахист'],
  [/Luftfilterbox/gi, 'Короб повітряного фільтра'],
  [/Luftfilter/gi, 'Повітряний фільтр'],
  [/Vevhusventilationsfilter/gi, 'Фільтр вентиляції картера'],
  [/Avgasdelar/gi, 'Вихлопні компоненти'],
  [/Tång/gi, 'Кліщі'],
  [/Tillbehör/gi, 'Аксесуари'],
  [/tillbehör/gi, 'аксесуари'],
  [/tejp/gi, 'стрічка'],
  [/matta/gi, 'мат'],
  [/guld/gi, 'золота'],
  [/svart/gi, 'чорний'],
  [/röd/gi, 'червоний'],
  [/blå/gi, 'синій'],
  [/stål/gi, 'сталь'],
  [/Titan\b/gi, 'титан'],
  [/Dämpare/gi, 'Глушник'],
  [/Ändrör/gi, 'Насадка на вихлоп'],
  [/Ellips\b/gi, 'Ellipse'],
  [/öronklämma/gi, 'вушний хомут'],
  [/Öronslangklämmor/gi, 'Вушні хомути'],
  [/Slangklämma/gi, 'Хомут'],
  [/Slangklämmor/gi, 'Хомути'],
  [/Tång för/gi, 'Кліщі для'],
  [/\bSlangar\b/gi, 'Шланги'],
  [/\bSlang\b/gi, 'Шланг'],
  [/\bför\b/gi, 'для'],
  [/\bkat\b/gi, 'каталізатор'],
  [/med kat/gi, 'з каталізатором'],
  [/utan kat/gi, 'без каталізатора'],
  [/\bmed\b/gi, 'з'],
  [/\boch\b/gi, 'та'],
  [/\bTill\b/gi, 'До'],
  [/lång radie/gi, 'довгий радіус'],
  [/Långt Ben/gi, 'довга гілка'],
  [/kort radie/gi, 'короткий радіус'],
  [/väggtjocklek/gi, 'товщина стінки'],
  [/godstjocklek/gi, 'товщина стінки'],
  [/Polerade/gi, 'поліровані'],
  [/Längd/gi, 'Довжина'],
  [/längd/gi, 'довжина'],
  [/Anslutning/gi, "Під'єднання"],
  [/anslutning/gi, "під'єднання"],
  [/Bredd/gi, 'Ширина'],
  [/bredd/gi, 'ширина'],
  [/Rostfritt stål/gi, 'нержавіюча сталь'],
  [/Rostfritt/gi, 'нержавіючий'],
  [/Rostfri/gi, 'нержавіючий'],
  [/Aluminiumrör/gi, 'Алюмінієва труба'],
  [/Aluminiumkon/gi, 'Алюмінієвий конус'],
  [/Aluminium/gi, 'Алюміній'],
  [/Koniskt/gi, 'Конусний'],
  [/Kompensator/gi, 'Гнучка секція'],
  [/grader/gi, '°'],
  [/rulle/gi, 'рулон'],
  [/metervara/gi, 'на метраж'],
  [/övriga/gi, 'інші'],
  [/Övriga/gi, 'Інші'],
  [/G-Chassi/gi, 'G-шасі'],
  [/F & G-Chassi/gi, 'F та G шасі'],
  [/(\d+)\s*Rad\b/gi, '$1 ряд'],
];

const SWEDISH_FRAGMENT_REGEX =
  /[åäöÅÄÖ]|\b(?:silikonslang|slangar|slang|böjd|böjar|reducering|koppling|värmeisolerande|värmeskydd|värmesköld|tejp|rulle|lång|kort|ändrör|dämpare|kolfiber|motorkåpa|insugskåpa|inloppsrör|inloppsslang|utloppsslang|insugssystem|tomgångsmotorslangar|bränslepåfyllningsslang|väggtjocklek|godstjocklek|polerade|anslutning|längd|bredd|rostfritt|avgasdelar|luftfilterbox|vevhusventilationsfilter|laddtrycksstyrning)\b/iu;

function normalizeWhitespace(value) {
  return String(value ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
}

function capitalizeLead(value) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return normalized;
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function fixQuotes(value) {
  return value
    .replace(/\\'/g, "'")
    .replace(/´´|''/g, '"')
    .replace(/\u00b4\u00b4/g, '"');
}

function normalizeMeasurementSpacing(value, locale) {
  let next = value;
  next = next.replace(/(\d)\s*mm\b/gi, locale === 'ua' ? '$1 мм' : '$1 mm');
  next = next.replace(/(\d)\s*m\b/gi, locale === 'ua' ? '$1 м' : '$1 m');
  next = next.replace(/(\d)\s*cm\b/gi, locale === 'ua' ? '$1 см' : '$1 cm');
  next = next.replace(/(\d)\s*x\s*(\d)/gi, '$1x$2');
  next = next.replace(/(\d)-(\d)/g, '$1-$2');
  return next;
}

function normalizeDecimals(value, locale) {
  return locale === 'en' ? value.replace(/(\d),(\d)/g, '$1.$2') : value;
}

function titleCaseEnglish(value) {
  const forceUpper = new Set(['BMW', 'BMC', 'VW', 'RS', 'GTI', 'GT2', 'GT3', 'GT4', 'TT', 'RS3', 'RS4', 'RS6', 'RS7', 'EA888', 'EA113', 'EA839', 'MQB', 'MQB Evo', 'VAG', 'CDA', 'MERA', 'BOLD', 'XL', 'LH', 'TFSI', 'TDI', 'TSI', 'TTRS', 'DCT', 'DSG', 'OEM', 'P80', 'P1', 'P2', 'P3', 'SPA', 'B58', 'B48', 'B46', 'S58', 'S55', 'S54', 'S50', 'S38', 'S14', 'N55', 'N54', 'N52', 'N53', 'S65', 'ABY', 'ADU', 'TTiD', 'TiD', 'DV+']);
  const forceLower = new Set(['mm', 'cm', 'm', 'and', 'for', 'with', 'without', 'of', 'to', 'do88']);
  return value
    .split(/(\s+|\/|,|-|\(|\))/)
    .map((part) => {
      if (!part || /^[\s/,()\-]+$/.test(part)) return part;
      if (forceLower.has(part.toLowerCase())) return part.toLowerCase();
      if (forceUpper.has(part)) return part;
      if (/^(?:[A-Z][a-z]+[A-Z][A-Za-z]*|[A-Z]+[a-z]+[A-Z]+[A-Za-z]*)$/.test(part)) return part;
      if (/^[A-Z0-9.&"]+$/.test(part)) return part;
      if (/^\d/.test(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join('');
}

function sentenceCaseUkrainian(value) {
  const next = value
    .replace(/\s+/g, ' ')
    .replace(/\s([,.)])/g, '$1')
    .replace(/\(\s+/g, '(')
    .trim();

  if (!next) return next;
  return next.replace(/^[а-яіїєґ]/, (char) => char.toUpperCase());
}

function replaceExactPart(part, locale) {
  const map = locale === 'ua' ? UA_PART_MAP : EN_PART_MAP;
  return map.get(part) ?? part;
}

function applyTextRules(value, locale) {
  let next = value;
  const rules = locale === 'ua' ? UA_TEXT_RULES : EN_TEXT_RULES;
  for (const [pattern, replacement] of rules) {
    next = next.replace(pattern, replacement);
  }

  next = next.replace(/(\d+)\s*°/g, '$1°');
  next = next.replace(/\s+°/g, '°');

  if (locale === 'en') {
    next = next
      .replace(/\bBlue Silicone Hose\b/gi, 'Blue Silicone Hose')
      .replace(/\bBlack Silicone Hose\b/gi, 'Black Silicone Hose')
      .replace(/\bRed Silicone Hose\b/gi, 'Red Silicone Hose')
      .replace(/\bHose Clamp,?\s+/gi, 'Hose Clamp, ')
      .replace(/\bMikalor Hose Clamp\s+/gi, 'Mikalor Hose Clamp, ')
      .replace(/\bSteel Muffler\s+/gi, 'Steel Muffler ')
      .replace(/\bExhaust Tip\s+/gi, 'Exhaust Tip ')
      .replace(/\bBigPack\b/gi, 'Big Pack')
      .replace(/\bMqbevo\b/gi, 'MQB Evo')
      .replace(/\bTSFI\b/g, 'TFSI')
      .replace(/\bFlexCoupler\b/gi, 'Flex Coupler')
      .replace(/\b(\d)-Steg\b/gi, '$1-Step')
      .replace(/\bPlast\b/gi, 'Plastic')
      .replace(/\bManuell\b/gi, 'Manual')
      .replace(/\bAutomat\b/gi, 'Automatic')
      .replace(/\bHeater Coresslangar\b/gi, 'Heater Core Hoses')
      .replace(/\bBromsVacuum\b/gi, 'Brake Vacuum')
      .replace(/\bKomplement\b/gi, 'Supplement')
      .replace(/\bModellanpassat\b/gi, 'Vehicle Specific')
      .replace(/\bCobra head\b/gi, 'Cobra Head')
      .replace(/\bUttag Bosch Senso\b/gi, 'Bosch Sensor Port')
      .replace(/Kalluft Kit/gi, 'Cold Air Kit')
      .replace(/Luftburk/gi, 'Airbox')
      .replace(/\bCenter Connection Pipe Kit\b/gi, 'Center-Connection Pipe Kit')
      .replace(/\bTop Connection Pipe Kit\b/gi, 'Top-Connection Pipe Kit')
      .replace(/\bInletsrör\b/gi, 'Inlet Pipe')
      .replace(/\bInletsslang\b/gi, 'Inlet Hose')
      .replace(/\bBromsVacuum\b/gi, 'Brake Vacuum')
      .replace(/\bHeater Core\s*sslangar\b/gi, 'Heater Core Hoses');
  } else {
    next = next
      .replace(/\bBigPack\b/gi, 'Big Pack')
      .replace(/\bMqbevo\b/gi, 'MQB Evo')
      .replace(/\bTSFI\b/g, 'TFSI')
      .replace(/\bFlexCoupler\b/gi, 'гнучка муфта')
      .replace(/\b(\d)-Steg\b/gi, '$1-ступеневий')
      .replace(/\bPlast\b/gi, 'Пластик')
      .replace(/\bManuell\b/gi, 'з МКПП')
      .replace(/\bAutomat\b/gi, 'з АКПП')
      .replace(/\bHeater Coresslangar\b/gi, 'шланги радіатора опалювача')
      .replace(/\bBromsVacuum\b/gi, 'гальмівний вакуум')
      .replace(/\bKomplement\b/gi, 'додатковий комплект')
      .replace(/\bIntercooler\b/gi, 'інтеркулер')
      .replace(/\bRadiator\b/gi, 'радіатор охолодження')
      .replace(/\bBoost Hoses\b/gi, 'патрубки наддуву')
      .replace(/\bThrottle Body Hose\b/gi, 'патрубок дросельної заслінки')
      .replace(/\bCharge Pipe\b/gi, 'пайп наддуву')
      .replace(/\bCoolant Hoses\b/gi, 'шланги охолодження')
      .replace(/\bIntake Hose\b/gi, 'впускний шланг')
      .replace(/\bInlet Hose\b/gi, 'впускний шланг')
      .replace(/\bInlet Pipe\b/gi, 'впускна труба')
      .replace(/\bIntake System\b/gi, 'впускна система')
      .replace(/\bPower Steering Hose\b/gi, 'шланг гідропідсилювача')
      .replace(/\bHeater Core\b/gi, 'радіатор опалювача')
      .replace(/\bOil Cooler\b/gi, 'масляний радіатор')
      .replace(/\bModellanpassat\b/gi, 'модельний')
      .replace(/\bCobra head\b/gi, 'Cobra Head')
      .replace(/\bUttag Bosch Senso\b/gi, 'порт під датчик Bosch')
      .replace(/\bCenter Connection Pipe Kit\b/gi, "комплект труб із центральним під'єднанням")
      .replace(/\bTop Connection Pipe Kit\b/gi, "комплект труб із верхнім під'єднанням")
      .replace(/Airsystem/gi, 'повітряна система')
      .replace(/Air System/gi, 'повітряна система')
      .replace(/Direct Intake Airsystem/gi, 'пряма впускна система')
      .replace(/Direct Intake Air System/gi, 'пряма впускна система')
      .replace(/Direct Intake повітряна система/gi, 'система прямого впуску')
      .replace(/4 Meter/gi, '4 м')
      .replace(/Meter/gi, 'м')
      .replace(/вхідsslangar/gi, 'впускні шланги')
      .replace(/вхідsrör/gi, 'впускна труба')
      .replace(/вхідsslang/gi, 'впускний шланг')
      .replace(/вихідsslang/gi, 'вихідний шланг')
      .replace(/шлангar/gi, 'шланги')
      .replace(/Flexмуфта/gi, 'гнучка муфта')
      .replace(/Чорний силіконовий патрубок гнучка муфта/gi, 'Чорна силіконова гнучка муфта')
      .replace(/гнучка муфта (\d)-ступеневий/gi, 'гнучка муфта $1-ступенева')
      .replace(/Avgasстрічка/gi, 'термострічка для вихлопу')
      .replace(/Tomg\.m\.Шланги/gi, 'шланги холостого ходу')
      .replace(/kalluft kit/gi, 'комплект холодного впуску')
      .replace(/luftburk/gi, 'короб повітряного фільтра')
      .replace(/Resonator delete/gi, 'видалення резонатора')
      .replace(/До turbon/gi, 'до турбіни')
      .replace(/До turbo/gi, 'до турбіни')
      .replace(/\bEj Turbo\b/gi, 'без турбо')
      .replace(/intercooler kit/gi, 'комплект інтеркулера')
      .replace(/kit MERA/gi, 'комплект MERA')
      .replace(/\bTurbo\b/gi, 'турбо')
      .replace(/\bBig Pack\b/gi, 'Big Pack')
      .replace(/\bkit\b/gi, 'комплект')
      .replace(/\breplica\b/gi, 'репліка')
      .replace(/\bRacing\b/gi, 'Racing')
      .replace(/\bPlenum\b/gi, 'пленум')
      .replace(/\bFront IC\b/gi, 'фронтальний інтеркулер')
      .replace(/\bG-Chassi\b/gi, 'G-шасі')
      .replace(/\bF-Serie\b/gi, 'F-серія')
      .replace(/\bF-series\b/gi, 'F-серія')
      .replace(/\bG-Serie\b/gi, 'G-серія')
      .replace(/Впуск З інтеркулер/gi, 'впуск та інтеркулер')
      .replace(/Впуск з інтеркулер/gi, 'впуск та інтеркулер')
      .replace(/впускний шланг До turbo/gi, 'впускний шланг до турбіни')
      .replace(/впускні шланги турбо/gi, 'впускні шланги турбіни')
      .replace(/впускний шланг турбо/gi, 'впускний шланг турбіни')
      .replace(/впускна труба турбо/gi, 'впускна труба турбіни')
      .replace(/Performance інтеркулер/gi, 'інтеркулер Performance')
      .replace(/масляний радіатор двигуна Racing/gi, 'гоночний масляний радіатор двигуна')
      .replace(/масляний радіатор DCT Racing/gi, 'гоночний масляний радіатор DCT')
      .replace(/радіатор гідропідсилювача Racing/gi, 'гоночний радіатор гідропідсилювача')
      .replace(/патрубки наддуву синій/gi, 'сині патрубки наддуву')
      .replace(/патрубки наддуву чорний/gi, 'чорні патрубки наддуву')
      .replace(/F-Шланг/gi, 'F-подібний шланг')
      .replace(/Аксесуариspaket/gi, 'пакет аксесуарів')
      .replace(/Motorмасляний радіатор/gi, 'масляний радіатор двигуна')
      .replace(/DCT-масляний радіатор/gi, 'масляний радіатор DCT')
      .replace(/Turbo-Інтеркулер/gi, 'турбіна - інтеркулер')
      .replace(/чорнийa/gi, 'чорний')
      .replace(/радіатор опалювачаsslangar/gi, 'шланги радіатора опалювача')
      .replace(/Bromsвакуумні/gi, 'гальмівні вакуумні')
      .replace(/Впускна система/g, 'впускна система')
      .replace(/Впускна труба/g, 'впускна труба')
      .replace(/Впускний шланг/g, 'впускний шланг')
      .replace(/Вихідний шланг/g, 'вихідний шланг')
      .replace(/Пластикова кришка/g, 'пластикова кришка')
      .replace(/, Пластик,/g, ', пластик,')
      .replace(/Під'єднання/g, "під'єднання")
      .replace(/Довжина/g, 'довжина')
      .replace(/Ширина/g, 'ширина')
      .replace(/Кришка ECU/g, 'кришка ECU')
      .replace(/Радіатор охолодження/g, 'радіатор охолодження')
      .replace(/Шланги/g, 'шланги')
      .replace(/Хомути/g, 'хомути')
      .replace(/Кліщі/g, 'кліщі')
      .replace(/Насадка на вихлоп/g, 'насадка на вихлоп')
      .replace(/Термострічка для вихлопу/g, 'термострічка для вихлопу')
      .replace(/Конусний Повітряний фільтр/g, 'конусний повітряний фільтр');
  }

  next = normalizeDecimals(fixQuotes(next), locale);
  next = normalizeMeasurementSpacing(next, locale);
  next = next
    .replace(/\s+,/g, ',')
    .replace(/,\s*,/g, ', ')
    .replace(/Resonator-\/\s*/g, 'Resonator / ')
    .replace(/\bTtid\b/g, 'TTiD')
    .replace(/\bTid\b/g, 'TiD')
    .replace(/\bDv\+\b/g, 'DV+')
    .replace(/\bSVC70\b/g, 'S/V/C70')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return locale === 'en' ? titleCaseEnglish(next) : sentenceCaseUkrainian(next);
}

function translateCategoryPath(pathValue, locale) {
  const parts = String(pathValue ?? '')
    .split(' > ')
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean);

  const translated = parts.map((part) => applyTextRules(replaceExactPart(part, locale), locale));
  return translated.join(' > ');
}

function translateTitleFromSwedish(title, locale) {
  let next = normalizeWhitespace(title);

  if (locale === 'en') {
    next = next
      .replace(/^Silikonslang Blå/i, 'Blue Silicone Hose')
      .replace(/^Silikonslang Svart/i, 'Black Silicone Hose')
      .replace(/^Silikonslang Röd/i, 'Red Silicone Hose')
      .replace(/^Aluminiumrör/i, 'Aluminum Pipe')
      .replace(/^Bränslepåfyllningsslang/i, 'Fuel Filler Hose')
      .replace(/^Dämpare stål/i, 'Steel Muffler')
      .replace(/^Ändrör/i, 'Exhaust Tip')
      .replace(/^Motorkåpa Kolfiber,?\s*/i, 'Carbon Fiber Engine Cover, ')
      .replace(/^(.+?) Motorkåpa Kolfiber$/i, '$1 Carbon Fiber Engine Cover')
      .replace(/^(.+?) Motorkåpa och insugskåpa Kolfiber$/i, '$1 Carbon Fiber Engine and Intake Covers')
      .replace(/^(.+?) Inloppsrör, Kolfiberkåpa$/i, '$1 Inlet Pipe, Carbon Fiber Cover')
      .replace(/^do88 V2 Insugssystem Kolfiber (.+)$/i, 'do88 V2 Carbon Fiber Intake System for $1')
      .replace(/^Mikalor Tång för öronklämma$/i, 'Mikalor Pliers for Ear Clamps');
  } else {
    next = next
      .replace(/^Silikonslang Blå/i, 'Синій силіконовий патрубок')
      .replace(/^Silikonslang Svart/i, 'Чорний силіконовий патрубок')
      .replace(/^Silikonslang Röd/i, 'Червоний силіконовий патрубок')
      .replace(/^Aluminiumrör/i, 'Алюмінієва труба')
      .replace(/^Bränslepåfyllningsslang/i, 'Шланг заливної горловини')
      .replace(/^Dämpare stål/i, 'Сталевий глушник')
      .replace(/^Ändrör/i, 'Насадка на вихлоп')
      .replace(/^Motorkåpa Kolfiber,?\s*/i, 'Карбонова кришка двигуна, ')
      .replace(/^(.+?) Motorkåpa Kolfiber$/i, '$1 карбонова кришка двигуна')
      .replace(/^(.+?) Motorkåpa och insugskåpa Kolfiber$/i, '$1 карбонові кришки двигуна та впуску')
      .replace(/^(.+?) Inloppsrör, Kolfiberkåpa$/i, '$1 впускна труба та карбонова кришка')
      .replace(/^do88 V2 Insugssystem Kolfiber (.+)$/i, 'do88 V2 карбонова впускна система для $1')
      .replace(/^Mikalor Tång för öronklämma$/i, 'Кліщі Mikalor для вушних хомутів');
  }

  return applyTextRules(next, locale);
}

function parseFitment(category) {
  const parts = String(category ?? '')
    .split(' > ')
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean);

  if (!parts.length || parts[0] !== 'Modellanpassat') return null;
  if (parts.length < 3) return null;

  return {
    brand: parts[1],
    platform: parts.slice(2).join(' / '),
  };
}

function deriveCollection(product) {
  const title = `${product.titleEn} ${product.titleUa}`.toLowerCase();
  const category = `${product.categoryEn} ${product.categoryUa}`.toLowerCase();
  if (title.includes('intercooler') || category.includes('intercooler')) {
    return { en: 'Intercoolers', ua: 'Інтеркулери' };
  }
  if (title.includes('radiator') || title.includes('coolant') || category.includes('radiator')) {
    return { en: 'Radiators', ua: 'Радіатори' };
  }
  if (title.includes('oil cooler') || category.includes('oil cooler')) {
    return { en: 'Oil Coolers', ua: 'Масляні радіатори' };
  }
  if (title.includes('heat') || category.includes('heat protection') || category.includes('heat')) {
    return { en: 'Heat Protection', ua: 'Теплозахист' };
  }
  if (title.includes('intake') || category.includes('intake') || title.includes('airbox') || title.includes('air filter') || title.includes('engine cover') || title.includes('intake cover')) {
    return { en: 'Intake Systems', ua: 'Впускні системи' };
  }
  if (title.includes('hose clamp kit')) {
    return { en: 'Performance Hoses', ua: 'Патрубки та шланги' };
  }
  if (title.includes('charge pipe') || title.includes('throttle body') || title.includes('inlet pipe') || title.includes('intercooler pipe') || title.includes('outlet hose') || title.includes('coolant hoses') || title.includes('heater core hoses') || title.includes('expansion tank hoses') || title.includes('air cleaner hose') || title.includes('vacuum hose') || title.includes('resonator') || title.includes('symposer') || title.includes('hose')) {
    return { en: 'Performance Hoses', ua: 'Патрубки та шланги' };
  }
  if (title.includes('silicone hose') || title.includes('hose clamp') || title.includes('fuel filler hose') || category.includes('шланги') || category.includes('hose')) {
    return { en: 'Performance Hoses', ua: 'Патрубки та шланги' };
  }
  if (title.includes('muffler') || title.includes('exhaust tip') || title.includes('exhaust') || category.includes('exhaust')) {
    return { en: 'Exhaust Parts', ua: 'Вихлопні компоненти' };
  }
  if (title.includes('aluminum pipe') || category.includes('aluminum pipes')) {
    return { en: 'Aluminum Pipes', ua: 'Алюмінієві труби' };
  }
  if (parseFitment(product.category)) {
    return { en: 'Vehicle Specific', ua: 'Для автомобілів' };
  }
  return {
    en: product.collectionEn || 'Performance Parts',
    ua: product.collectionUa || 'Деталі',
  };
}

function getCategoryLeaf(category) {
  const parts = String(category ?? '')
    .split(' > ')
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean);
  return parts.at(-1) || '';
}

function extractKeySpec(title) {
  const value = normalizeWhitespace(title);
  const patterns = [
    /Connection [^,]+, Length [^,]+(?:, \d+°)?/i,
    /\d+\s*x\s*\d+\s*(?:mm|cm)/i,
    /\d+\s*mm,\s*\d+\s*m Roll/i,
    /\d+\s*x\s*\d+\s*cm/i,
    /\d+(?:\.\d+)?\s*-\s*\d+(?:\.\d+)?["']\s*\([^)]+\)/,
    /\d+(?:\.\d+)?["']\s*\([^)]+\)/,
    /\([^)]+\)/,
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match) {
      return normalizeWhitespace(match[0].replace(/[()]/g, ''));
    }
  }
  return '';
}

function getDescriptor(product) {
  const title = String(product.titleEn ?? '').toLowerCase();
  if (title.includes('blue silicone')) return { en: 'Blue silicone', ua: 'Синій силіконовий' };
  if (title.includes('black silicone')) return { en: 'Black silicone', ua: 'Чорний силіконовий' };
  if (title.includes('red silicone')) return { en: 'Red silicone', ua: 'Червоний силіконовий' };
  if (title.includes('black, titanium') || (title.includes('black') && title.includes('titanium'))) {
    return { en: 'Black titanium', ua: 'Чорний титановий' };
  }
  if (title.includes('carbon fiber')) return { en: 'Carbon fiber', ua: 'Карбоновий' };
  if (title.includes('stainless steel')) return { en: 'Stainless steel', ua: 'Нержавіючий сталевий' };
  if (title.includes('steel')) return { en: 'Steel', ua: 'Сталевий' };
  if (title.includes('aluminum')) return { en: 'Aluminum', ua: 'Алюмінієвий' };
  if (title.includes('gold')) return { en: 'Gold', ua: 'Золотий' };
  if (title.includes('silicone')) return { en: 'Silicone', ua: 'Силіконовий' };
  return null;
}

function getMaterialFinish(product) {
  const title = String(product.titleEn ?? '').toLowerCase();
  const labelsEn = [];
  const labelsUa = [];

  const add = (en, ua) => {
    if (!labelsEn.includes(en)) labelsEn.push(en);
    if (!labelsUa.includes(ua)) labelsUa.push(ua);
  };

  if (title.includes('carbon fiber')) add('Carbon fiber', 'Карбон');
  if (title.includes('aluminum')) add('Aluminum', 'Алюміній');
  if (title.includes('stainless steel')) add('Stainless steel', 'Нержавіюча сталь');
  else if (title.includes('steel')) add('Steel', 'Сталь');
  if (title.includes('silicone')) add('Silicone', 'Силікон');
  if (title.includes('titanium')) add('Titanium finish', 'Титанове покриття');
  if (title.includes('black')) add('Black finish', 'Чорне виконання');
  if (title.includes('blue')) add('Blue finish', 'Синє виконання');
  if (title.includes('red')) add('Red finish', 'Червоне виконання');
  if (title.includes('gold')) add('Gold finish', 'Золоте виконання');

  if (!labelsEn.length) return null;

  return {
    en: labelsEn.join(', '),
    ua: labelsUa.join(', '),
  };
}

function inferFitmentFromTitle(titleEn) {
  const looksLikeFitment = (value) =>
    /(?:BMW|Audi|VW|VAG|Porsche|Skoda|Volvo|Mercedes|Toyota|Honda|Subaru|Nissan|Mazda|Renault|Saab|Opel|Ford|Mini|Seat|Alpine|Suzuki|Borg Warner|EA888|TFSI|TSI|TiD|TTiD|B58|B48|B46|N54|N55|S58|G-Chassi|F-Serie|G-Serie|MQB|Mk|Gen ?\d)/i.test(
      value,
    );

  const value = normalizeWhitespace(titleEn);
  const bigPackMatch = value.match(/^Big Pack\s+(.+)$/i);
  if (bigPackMatch && looksLikeFitment(bigPackMatch[1])) return bigPackMatch[1];

  const turboMatch = value.match(/^(.*?)\s+Garrett PowerMax Turbo\b/i);
  if (turboMatch && looksLikeFitment(turboMatch[1])) return turboMatch[1];

  const directMatch = value.match(/^(.*?)\s+(?:Boost Hoses?|Intake Hose|Inlet Hose|Air Cleaner Hoses?|Resonator \/ Symposer Hose|Vacuum Hoses?|Crankcase Vent Hose|Charge Pipe(?:s)?|Inlet Pipe|Coolant Hoses?|Intercooler|Radiator|Oil Cooler|Carbon Fiber Engine and Intake Covers|Carbon Fiber Engine Cover|Engine and Intake Covers|Engine Cover)\b/i);
  if (directMatch && looksLikeFitment(directMatch[1])) return directMatch[1];

  const bracketMatch = value.match(/\((?:Fits|Suits|Various)\s(.+)\)$/i);
  if (bracketMatch && looksLikeFitment(bracketMatch[1])) return bracketMatch[1];

  return null;
}

function detectProductKind(product, collection, fitment) {
  const title = String(product.titleEn ?? '').toLowerCase();
  const category = String(product.categoryEn ?? '').toLowerCase();
  const categoryLeaf = getCategoryLeaf(product.categoryEn).toLowerCase();

  if (title.includes('hoodie')) return 'merch-hoodie';
  if (title.includes('pliers for ear clamps')) return 'ear-clamp-pliers';
  if (category.includes('heat protection')) {
    if (title.includes('mat')) return 'heat-mat';
    if (title.includes('tape')) return 'heat-tape';
    if (title.includes('wrap') || categoryLeaf.includes('wrap')) return 'heat-wrap';
    if (title.includes('shield') || categoryLeaf.includes('shield')) return 'heat-shield';
    return 'heat-protection';
  }
  if (title.includes('clamp kit') || categoryLeaf.includes('clamp kits')) return 'clamp-kit';
  if (title.includes('hose clamp')) return 'hose-clamp';
  if (title.includes('bleed valve')) return 'bleed-valve';
  if (title.includes('dump valve') || title.includes('dv+') || title.includes('dvx') || title.includes('respons') || title.includes('vta')) return 'dump-valve';
  if (title.includes('conical air filter') || (category.includes('air filters') && title.includes('air filter'))) return 'conical-air-filter';
  if (title.includes('crankcase ventilation filter')) return 'breather-filter';
  if (categoryLeaf.includes('bmc air filter boxes') || title.includes('air system') || title.includes('direct intake')) return 'airbox';
  if (title.includes('air filter box') || title.includes('airbox')) return 'airbox';
  if (title.includes('engine cover') || title.includes('intake cover') || title.includes('carbon fiber cover')) return 'cover-kit';
  if (title.includes('intake system')) return 'intake-system';
  if (title.includes('air cleaner hose')) return 'air-cleaner-hose';
  if (title.includes('boost hose')) return fitment ? 'vehicle-hose' : 'silicone-hose';
  if (title.includes('intake hose')) return fitment ? 'vehicle-intake' : 'silicone-hose';
  if (title.includes('inlet hose')) return fitment ? 'vehicle-hose' : 'silicone-hose';
  if (title.includes('resonator') || title.includes('symposer')) return 'resonator-hose';
  if (title.includes('vacuum hose')) return 'vacuum-hose';
  if (title.includes('fuel filler hose')) return 'fuel-filler-hose';
  if (title.includes('fuel hose')) return 'fuel-hose';
  if (title.includes('throttle body hose')) return 'throttle-body-hose';
  if (title.includes('charge pipe')) return 'charge-pipe';
  if (title.includes('inlet pipe')) return 'inlet-pipe';
  if (title.includes('intercooler pipe')) return 'intercooler-pipe';
  if (title.includes('coolant hose')) return 'coolant-hose';
  if (title.includes('heater core hose')) return 'heater-core-hose';
  if (title.includes('expansion tank hose')) return 'expansion-tank-hose';
  if (title.includes('power steering hose') || title.includes('power steering cooler')) return 'power-steering';
  if (title.includes('crankcase vent hose')) return 'crankcase-vent-hose';
  if (title.includes('air hose')) return 'air-hose';
  if (title.includes('flexcoupler')) return 'flex-coupler';
  if (title.includes('cobra head')) return 'silicone-hose';
  if (categoryLeaf.includes('straight reducers')) return 'straight-reducer-hose';
  if (categoryLeaf.includes('reducer elbows')) return 'reducer-elbow-hose';
  if (categoryLeaf.includes('elbows') && title.includes('silicone hose')) return 'elbow-hose';
  if (categoryLeaf.includes('smooth flexible hoses')) return 'smooth-flexible-hose';
  if (categoryLeaf.includes('flexible hoses')) return 'flexible-hose';
  if (categoryLeaf.includes('hose outlet')) return 'hose-outlet';
  if (categoryLeaf.includes('aluminum cones') || title.includes('aluminumkon')) return 'aluminum-pipe';
  if (title.includes('silicone hose')) return 'silicone-hose';
  if (title.includes('aluminum pipe')) return 'aluminum-pipe';
  if (title.includes('muffler')) return 'muffler';
  if (title.includes('exhaust tip')) return 'exhaust-tip';
  if (title.includes('y-pipe')) return 'y-pipe';
  if (title.includes('t-pipe')) return 't-pipe';
  if (title.includes('flex section')) return 'exhaust-generic';
  if (title.includes('big pack')) return 'performance-package';
  if (title.includes('flange joint') || title.includes('rear axle pipe') || title.includes('exhaust pipe') || title.includes('kompensator')) return 'exhaust-generic';
  if (title.includes('intercooler')) {
    if (title.includes('core')) return 'intercooler-core';
    return fitment ? 'vehicle-intercooler' : 'universal-intercooler';
  }
  if (title.includes('radiator')) return fitment ? 'vehicle-radiator' : 'radiator';
  if (title.includes('oil cooler')) return fitment ? 'vehicle-oil-cooler' : 'oil-cooler';
  if (title.includes('garrett powermax turbo')) return 'turbo-upgrade';
  if (fitment && collection.en === 'Performance Hoses') return 'vehicle-hose';
  if (fitment && collection.en === 'Intake Systems') return 'vehicle-intake';
  if (fitment && collection.en === 'Exhaust Parts') return 'vehicle-exhaust';
  if (fitment) return 'vehicle-specific';
  return 'generic-performance';
}

function getKindLabel(kind) {
  const labels = {
    'straight-reducer-hose': { en: 'Straight reducer silicone hose', ua: 'Прямий редукційний силіконовий патрубок' },
    'elbow-hose': { en: 'Formed silicone elbow', ua: 'Формований силіконовий кутовий патрубок' },
    'reducer-elbow-hose': { en: 'Reducer elbow silicone hose', ua: 'Редукційний кутовий силіконовий патрубок' },
    'smooth-flexible-hose': { en: 'Smooth flexible hose', ua: 'Гладкий гнучкий шланг' },
    'flexible-hose': { en: 'Flexible hose', ua: 'Гнучкий шланг' },
    'flex-coupler': { en: 'Step-style flexible coupler', ua: 'Багатоступеневий гнучкий перехідник' },
    'silicone-hose': { en: 'Silicone hose', ua: 'Силіконовий патрубок' },
    'fuel-hose': { en: 'Fuel hose', ua: 'Паливний шланг' },
    'air-hose': { en: 'Air hose', ua: 'Повітряний шланг' },
    'vacuum-hose': { en: 'Vacuum hose', ua: 'Вакуумний шланг' },
    'fuel-filler-hose': { en: 'Fuel filler hose', ua: 'Шланг заливної горловини' },
    'hose-outlet': { en: 'Hose outlet / branch piece', ua: 'Вихід / відвід під шланг' },
    'charge-pipe': { en: 'Charge pipe', ua: 'Пайп наддуву' },
    'inlet-pipe': { en: 'Inlet pipe', ua: 'Впускна труба' },
    'intercooler-pipe': { en: 'Intercooler pipe', ua: 'Труба інтеркулера' },
    'throttle-body-hose': { en: 'Throttle body hose', ua: 'Патрубок дросельної заслінки' },
    'coolant-hose': { en: 'Coolant hose set', ua: 'Комплект шлангів охолодження' },
    'heater-core-hose': { en: 'Heater core hose set', ua: 'Комплект шлангів радіатора опалювача' },
    'expansion-tank-hose': { en: 'Expansion tank hose set', ua: 'Комплект шлангів розширювального бачка' },
    'power-steering': { en: 'Power steering hose / cooler component', ua: 'Шланг або радіатор гідропідсилювача' },
    'crankcase-vent-hose': { en: 'Crankcase ventilation hose', ua: 'Шланг вентиляції картера' },
    'air-cleaner-hose': { en: 'Air cleaner hose set', ua: 'Комплект шлангів повітроочисника' },
    'resonator-hose': { en: 'Resonator / symposer hose', ua: 'Шланг резонатора / symposer' },
    'clamp-kit': { en: 'Clamp kit', ua: 'Комплект хомутів' },
    'hose-clamp': { en: 'Hose clamp', ua: 'Хомут' },
    'ear-clamp-pliers': { en: 'Ear clamp pliers', ua: 'Кліщі для вушних хомутів' },
    'aluminum-pipe': { en: 'Aluminum fabrication pipe', ua: 'Алюмінієва труба для виготовлення' },
    'muffler': { en: 'Universal muffler', ua: 'Універсальний глушник' },
    'exhaust-tip': { en: 'Exhaust tip', ua: 'Насадка на вихлоп' },
    'y-pipe': { en: 'Y-pipe', ua: 'Y-подібна труба' },
    't-pipe': { en: 'T-pipe', ua: 'T-подібна труба' },
    'exhaust-generic': { en: 'Exhaust fabrication part', ua: 'Деталь для виготовлення вихлопу' },
    'heat-mat': { en: 'Heat insulation mat', ua: 'Теплоізоляційний мат' },
    'heat-tape': { en: 'Heat insulation tape', ua: 'Теплоізоляційна стрічка' },
    'heat-wrap': { en: 'Heat wrap', ua: 'Теплозахисна стрічка' },
    'heat-shield': { en: 'Heat shield panel', ua: 'Теплозахисний екран' },
    'heat-protection': { en: 'Heat protection component', ua: 'Компонент теплозахисту' },
    'conical-air-filter': { en: 'Conical air filter', ua: 'Конусний повітряний фільтр' },
    'breather-filter': { en: 'Breather filter', ua: 'Фільтр вентиляції' },
    'airbox': { en: 'Air filter box', ua: 'Короб повітряного фільтра' },
    'intake-system': { en: 'Intake system', ua: 'Впускна система' },
    'cover-kit': { en: 'Engine-bay cover set', ua: 'Комплект декоративних кришок' },
    'dump-valve': { en: 'Boost / diverter valve upgrade', ua: 'Апгрейд клапана скидання / керування бустом' },
    'bleed-valve': { en: 'Manual bleed valve', ua: 'Ручний клапан стравлювання' },
    'performance-package': { en: 'Vehicle-specific performance package', ua: 'Модельний апгрейд-пакет' },
    'turbo-upgrade': { en: 'Turbo upgrade', ua: 'Апгрейд турбіни' },
    'vehicle-intercooler': { en: 'Vehicle-specific intercooler', ua: 'Модельний інтеркулер' },
    'universal-intercooler': { en: 'Universal intercooler', ua: 'Універсальний інтеркулер' },
    'intercooler-core': { en: 'Intercooler core', ua: 'Сердечник інтеркулера' },
    'vehicle-radiator': { en: 'Vehicle-specific radiator', ua: 'Модельний радіатор' },
    'radiator': { en: 'Radiator component', ua: 'Компонент радіатора' },
    'vehicle-oil-cooler': { en: 'Vehicle-specific oil cooler', ua: 'Модельний масляний радіатор' },
    'oil-cooler': { en: 'Oil cooling component', ua: 'Компонент охолодження мастила' },
    'vehicle-hose': { en: 'Vehicle-specific hose solution', ua: 'Модельне шлангове рішення' },
    'vehicle-intake': { en: 'Vehicle-specific intake component', ua: 'Модельний впускний компонент' },
    'vehicle-exhaust': { en: 'Vehicle-specific exhaust component', ua: 'Модельний вихлопний компонент' },
    'vehicle-specific': { en: 'Vehicle-specific performance component', ua: 'Модельний компонент' },
    'merch-hoodie': { en: 'Branded apparel', ua: 'Брендовий одяг' },
    'generic-performance': { en: 'Performance component', ua: 'Компонент для підвищення продуктивності' },
  };

  return labels[kind] || labels['generic-performance'];
}

function buildSummaryByKind(kind, descriptor, fitmentEn, fitmentUa) {
  const prefixEn = descriptor?.en ? `${descriptor.en} ` : '';
  const prefixUa = descriptor?.ua ? `${descriptor.ua} ` : '';

  switch (kind) {
    case 'straight-reducer-hose':
      return {
        en: `${prefixEn}straight reducer hose for joining two different pipe diameters in custom cooling, intake or charge-air systems with a reinforced, workshop-ready connection.`,
        ua: `${prefixUa.toLowerCase()}прямий редукційний патрубок для з'єднання двох різних діаметрів у кастомних системах охолодження, впуску або наддуву з посиленою, надійною конструкцією.`,
      };
    case 'elbow-hose':
      return {
        en: `${prefixEn}formed silicone elbow for routing cooling, intake or boost plumbing through tighter bends without relying on welded hard-pipe sections.`,
        ua: `${prefixUa.toLowerCase()}формований кутовий патрубок для прокладання охолоджувальних, впускних або наддувних трас у місцях, де потрібен поворот без жорсткої зварної труби.`,
      };
    case 'reducer-elbow-hose':
      return {
        en: `${prefixEn}reducer elbow hose for combining a directional bend and a diameter step in one reinforced connection for custom boost, intake or cooling layouts.`,
        ua: `${prefixUa.toLowerCase()}редукційний кутовий патрубок, який поєднує зміну напряму та перехід між діаметрами в одному посиленому з'єднанні для кастомних трас наддуву, впуску або охолодження.`,
      };
    case 'smooth-flexible-hose':
      return {
        en: `${prefixEn}smooth flexible hose for custom routing where movement, offset or packaging space makes a rigid pipe unsuitable.`,
        ua: `${prefixUa.toLowerCase()}гладкий гнучкий шланг для кастомного прокладання там, де жорстка труба незручна через рух, зміщення або обмежений простір.`,
      };
    case 'flexible-hose':
      return {
        en: `${prefixEn}flexible hose for custom routing in cooling, intake or auxiliary systems where installation freedom is more important than rigid pipework.`,
        ua: `${prefixUa.toLowerCase()}гнучкий шланг для кастомного прокладання в системах охолодження, впуску або допоміжних контурах там, де важлива свобода монтажу.`,
      };
    case 'flex-coupler':
      return {
        en: `${prefixEn}step-style flexible coupler for joining slightly mismatched pipe sizes while adding installation compliance in custom hose routing.`,
        ua: `${prefixUa.toLowerCase()}багатоступеневий гнучкий перехідник для з'єднання труб із близькими діаметрами та додавання монтажної гнучкості в кастомних трасах.`,
      };
    case 'silicone-hose':
      return {
        en: `${prefixEn || 'Silicone '}hose for custom cooling, intake or boost plumbing with reinforced construction for a stable seal and long service life.`,
        ua: `${prefixUa ? `${prefixUa.toLowerCase()}патрубок` : 'силіконовий патрубок'} для кастомних систем охолодження, впуску або наддуву з посиленою конструкцією для стабільної герметизації та довгого ресурсу.`,
      };
    case 'fuel-hose':
      return {
        en: `${prefixEn}fuel hose for feed, return or auxiliary fuel-system plumbing where dependable material quality and clear sizing matter.`,
        ua: `${prefixUa.toLowerCase()}паливний шланг для подачі, зворотної магістралі або допоміжних паливних контурів, де важливі надійний матеріал і точний розмір.`,
      };
    case 'air-hose':
      return {
        en: 'Air hose for intake ducting or airflow routing where lightweight flexible packaging is preferred over rigid pipework.',
        ua: 'Повітряний шланг для впускних каналів або прокладання повітряного потоку там, де легка гнучка конфігурація краща за жорстку трубу.',
      };
    case 'vacuum-hose':
      return {
        en: `${fitmentEn ? `Vehicle-specific vacuum hose for ${fitmentEn}. ` : ''}Designed for pressure reference, control circuits or auxiliary vacuum plumbing with dependable do88 hose construction.`,
        ua: `${fitmentUa ? `Модельний вакуумний шланг для ${fitmentUa}. ` : ''}Розрахований на контури керування, референс тиску та допоміжні вакуумні лінії з надійною конструкцією do88.`,
      };
    case 'fuel-filler-hose':
      return {
        en: 'Fuel filler hose for securely connecting filler-neck hardware in custom or replacement fuel-system service work.',
        ua: 'Шланг заливної горловини для надійного з\'єднання вузлів паливної системи під час заміни або сервісних робіт.',
      };
    case 'hose-outlet':
      return {
        en: 'Silicone hose outlet / branch piece for adding an auxiliary take-off to a hose run while keeping a reinforced connection point.',
        ua: 'Силіконовий відвід під шланг для додавання допоміжної гілки в магістраль зі збереженням посиленого місця з\'єднання.',
      };
    case 'charge-pipe':
      return {
        en: `${fitmentEn ? `Vehicle-specific do88 charge-pipe solution for ${fitmentEn}. ` : ''}Designed for stable boost flow, secure hose retention and cleaner engine-bay packaging than aging factory pipework.`,
        ua: `${fitmentUa ? `Модельне рішення do88 з пайпом наддуву для ${fitmentUa}. ` : ''}Розроблене для стабільного потоку наддуву, надійної фіксації патрубків і охайнішого компонування моторного відсіку порівняно зі зношеними штатними магістралями.`,
      };
    case 'inlet-pipe':
      return {
        en: `${fitmentEn ? `Vehicle-specific inlet-pipe solution for ${fitmentEn}. ` : ''}Optimizes the route into the turbo / intake tract with direct-fit do88 hardware and cleaner packaging.`,
        ua: `${fitmentUa ? `Модельне рішення з впускною трубою для ${fitmentUa}. ` : ''}Оптимізує трасу до турбіни або впускного тракту завдяки точній посадці do88 без зайвих доопрацювань і більш охайному компонуванню.`,
      };
    case 'intercooler-pipe':
      return {
        en: `${fitmentEn ? `Vehicle-specific intercooler pipe for ${fitmentEn}. ` : ''}Connects the charge-air route with stable fitment and refreshed do88 pipework for repeated street or track use.`,
        ua: `${fitmentUa ? `Модельна труба інтеркулера для ${fitmentUa}. ` : ''}З'єднує трасу наддувного повітря зі стабільною посадкою та оновленою магістраллю do88 для вуличного або трекового режиму.`,
      };
    case 'throttle-body-hose':
      return {
        en: `${fitmentEn ? `Vehicle-specific throttle-body hose for ${fitmentEn}. ` : ''}Links the charge-air system to the throttle body with reinforced do88 hose construction and direct-fit geometry.`,
        ua: `${fitmentUa ? `Модельний патрубок дросельної заслінки для ${fitmentUa}. ` : ''}З'єднує систему наддуву з дросельною заслінкою завдяки посиленій конструкції do88 та геометрії точної посадки.`,
      };
    case 'coolant-hose':
      return {
        en: `${fitmentEn ? `Vehicle-specific coolant hose solution for ${fitmentEn}. ` : ''}Refreshes the cooling circuit with reinforced hose construction and a fitment matched to the listed platform.`,
        ua: `${fitmentUa ? `Модельне рішення зі шлангами охолодження для ${fitmentUa}. ` : ''}Оновлює контур охолодження завдяки посиленій конструкції шлангів та посадці, підібраній під зазначену платформу.`,
      };
    case 'heater-core-hose':
      return {
        en: `${fitmentEn ? `Vehicle-specific heater-core hose set for ${fitmentEn}. ` : ''}Built to refresh the cabin-heater circuit with more dependable hose construction and direct-fit routing.`,
        ua: `${fitmentUa ? `Модельний комплект шлангів радіатора опалювача для ${fitmentUa}. ` : ''}Створений для оновлення контуру обігрівача салону завдяки надійнішій конструкції шлангів і точному прокладанню без доробок.`,
      };
    case 'expansion-tank-hose':
      return {
        en: `${fitmentEn ? `Vehicle-specific expansion-tank hose set for ${fitmentEn}. ` : ''}Designed to refresh the reservoir circuit with stable fitment and longer-lasting hose material.`,
        ua: `${fitmentUa ? `Модельний комплект шлангів розширювального бачка для ${fitmentUa}. ` : ''}Розроблений для оновлення контуру бачка з надійною посадкою та довговічнішим матеріалом шлангів.`,
      };
    case 'power-steering':
      return {
        en: `${fitmentEn ? `Vehicle-specific power-steering hose / cooler solution for ${fitmentEn}. ` : ''}Built to restore dependable flow and fitment in the steering-assist circuit.`,
        ua: `${fitmentUa ? `Модельне рішення для гідропідсилювача ${fitmentUa}. ` : ''}Створене для відновлення надійного потоку та правильної посадки в контурі підсилювача керма.`,
      };
    case 'crankcase-vent-hose':
      return {
        en: `${fitmentEn ? `Vehicle-specific crankcase ventilation hose for ${fitmentEn}. ` : ''}Refreshes the breather circuit with a direct-fit do88 hose solution for the listed engine bay.`,
        ua: `${fitmentUa ? `Модельний шланг вентиляції картера для ${fitmentUa}. ` : ''}Оновлює контур вентиляції картера завдяки рішенню do88 з точною посадкою для зазначеного моторного відсіку.`,
      };
    case 'air-cleaner-hose':
      return {
        en: `${fitmentEn ? `Vehicle-specific air-cleaner hose set for ${fitmentEn}. ` : ''}Replaces aging intake ducting with a do88 hose solution designed for the listed platform.`,
        ua: `${fitmentUa ? `Модельний комплект шлангів повітроочисника для ${fitmentUa}. ` : ''}Замінює старі елементи впускного тракту на рішення do88, розраховане під зазначену платформу.`,
      };
    case 'resonator-hose':
      return {
        en: `${fitmentEn ? `Vehicle-specific resonator / symposer hose for ${fitmentEn}. ` : ''}A direct-fit do88 replacement for refreshing or simplifying the intake-side connection on the listed platform.`,
        ua: `${fitmentUa ? `Модельний шланг резонатора / symposer для ${fitmentUa}. ` : ''}Точна заміна від do88 для оновлення або спрощення впускного з'єднання на зазначеній платформі.`,
      };
    case 'clamp-kit':
      return {
        en: 'Selected clamp kit for do88 hose or pipe installations, intended to simplify assembly and secure the specified connection points.',
        ua: 'Підібраний комплект хомутів для монтажу шлангів або труб do88, який спрощує складання та фіксує потрібні точки з\'єднання.',
      };
    case 'hose-clamp':
      return {
        en: `${descriptor?.en ? `${descriptor.en} ` : ''}hose clamp for securing silicone hoses and hard-pipe connections under temperature, vibration and pressure load.`,
        ua: `${descriptor?.ua ? `${descriptor.ua.toLowerCase()} ` : ''}хомут для фіксації силіконових патрубків і жорстких трубних з'єднань під температурним, вібраційним і тисковим навантаженням.`,
      };
    case 'ear-clamp-pliers':
      return {
        en: 'Workshop pliers for ear clamps, providing repeatable clamp closure during service and assembly work.',
        ua: 'Майстерневі кліщі для вушних хомутів, які забезпечують повторюване закриття хомута під час монтажу та сервісу.',
      };
    case 'aluminum-pipe':
      return {
        en: `${descriptor?.en ? `${descriptor.en} ` : ''}fabrication pipe for building custom intake, charge-air or cooling layouts with consistent wall thickness and predictable fit-up.`,
        ua: `${descriptor?.ua ? `${descriptor.ua.toLowerCase()} ` : ''}труба для виготовлення кастомних впускних, наддувних або охолоджувальних трас зі стабільною товщиною стінки та передбачуваною стиковкою.`,
      };
    case 'muffler':
      return {
        en: `${descriptor?.en ? `${descriptor.en} ` : ''}universal muffler for custom exhaust fabrication where packaging, sound control and pipe diameter must match the build.`,
        ua: `${descriptor?.ua ? `${descriptor.ua.toLowerCase()} ` : ''}універсальний глушник для кастомного виготовлення вихлопу, де важливі компоновка, контроль звучання та відповідний діаметр траси.`,
      };
    case 'exhaust-tip':
      return {
        en: `${descriptor?.en ? `${descriptor.en} ` : ''}exhaust tip for finishing a custom exhaust outlet with the stated inlet size and a cleaner motorsport-style appearance.`,
        ua: `${descriptor?.ua ? `${descriptor.ua.toLowerCase()} ` : ''}насадка на вихлоп для завершення кастомного випускного отвору з указаним посадковим розміром і більш акуратним спортивним виглядом.`,
      };
    case 'y-pipe':
      return {
        en: 'Y-pipe for splitting or merging exhaust flow in custom fabrication work where two branches must meet one main pipe cleanly.',
        ua: 'Y-подібна труба для розгалуження або зведення вихлопного потоку в кастомному виготовленні, коли дві гілки потрібно акуратно з\'єднати з однією магістраллю.',
      };
    case 't-pipe':
      return {
        en: 'T-pipe for building custom fabrication junctions with the stated tube sizes in exhaust or auxiliary metal pipework.',
        ua: 'T-подібна труба для побудови кастомних вузлів із заданими діаметрами в металевих вихлопних або допоміжних магістралях.',
      };
    case 'exhaust-generic':
      return {
        en: `${descriptor?.en ? `${descriptor.en} ` : ''}exhaust fabrication part for adapting, extending or repairing custom performance exhaust pipework.`,
        ua: `${descriptor?.ua ? `${descriptor.ua.toLowerCase()} ` : ''}деталь для виготовлення вихлопу, яка використовується для адаптації, подовження або ремонту кастомної продуктивної траси.`,
      };
    case 'heat-mat':
      return {
        en: `${descriptor?.en ? `${descriptor.en} ` : ''}heat insulation mat for shielding panels, bulkheads or nearby components from radiant heat.`,
        ua: `${descriptor?.ua ? `${descriptor.ua.toLowerCase()} ` : ''}теплоізоляційний мат для захисту панелей, перегородок і сусідніх вузлів від променевого тепла.`,
      };
    case 'heat-tape':
      return {
        en: `${descriptor?.en ? `${descriptor.en} ` : ''}heat insulation tape for localized wrapping of lines, hoses or panels exposed to elevated temperatures.`,
        ua: `${descriptor?.ua ? `${descriptor.ua.toLowerCase()} ` : ''}теплоізоляційна стрічка для локального обмотування ліній, шлангів або панелей, що працюють біля джерел високої температури.`,
      };
    case 'heat-wrap':
      return {
        en: `${descriptor?.en ? `${descriptor.en} ` : ''}heat wrap for reducing radiant heat around exhaust routing and nearby engine-bay components.`,
        ua: `${descriptor?.ua ? `${descriptor.ua.toLowerCase()} ` : ''}теплозахисна стрічка для зменшення променевого тепла навколо вихлопних трас і сусідніх компонентів моторного відсіку.`,
      };
    case 'heat-shield':
      return {
        en: `${descriptor?.en ? `${descriptor.en} ` : ''}heat shield panel for fabricating a barrier between heat sources and surrounding components.`,
        ua: `${descriptor?.ua ? `${descriptor.ua.toLowerCase()} ` : ''}теплозахисний екран для виготовлення бар'єра між джерелом тепла та сусідніми компонентами.`,
      };
    case 'heat-protection':
      return {
        en: 'do88 thermal management component for shielding surrounding parts from radiant heat and elevated underhood temperatures.',
        ua: 'Теплозахисний компонент do88 для екранування сусідніх вузлів від променевого тепла та високих температур у моторному відсіку.',
      };
    case 'conical-air-filter':
      return {
        en: 'BMC conical air filter for custom intake fabrication, supplied with the stated connection size and compact filter body dimensions.',
        ua: 'Конусний повітряний фільтр BMC для кастомного впуску з указаним посадковим діаметром і компактними габаритами корпусу фільтра.',
      };
    case 'breather-filter':
      return {
        en: 'BMC breather filter for crankcase ventilation or auxiliary vent circuits where a compact serviceable filter is required.',
        ua: 'Фільтр вентиляції BMC для картера або допоміжних вентиляційних контурів там, де потрібен компактний сервісний фільтр.',
      };
    case 'airbox':
      return {
        en: 'BMC air filter box for custom intake packaging with cleaner airflow management and better isolation from direct engine-bay heat.',
        ua: 'Короб повітряного фільтра BMC для кастомного впуску з кращим керуванням потоком повітря та кращою ізоляцією від тепла моторного відсіку.',
      };
    case 'intake-system':
      return {
        en: `${fitmentEn ? `Vehicle-specific do88 intake system for ${fitmentEn}. ` : ''}Built for cleaner airflow, stable fitment and workshop-friendly installation.`,
        ua: `${fitmentUa ? `Модельна впускна система do88 для ${fitmentUa}. ` : ''}Розрахована на чистіший повітряний потік, стабільну посадку та зручний монтаж у майстерні.`,
      };
    case 'cover-kit':
      return {
        en: `${fitmentEn ? `Carbon fiber engine-bay cover set for ${fitmentEn}. ` : ''}Adds a cleaner finished appearance to the engine bay with do88 vehicle-specific fitment.`,
        ua: `${fitmentUa ? `Карбоновий комплект кришок моторного відсіку для ${fitmentUa}. ` : ''}Додає моторному відсіку більш завершений вигляд завдяки точній модельній посадці від do88.`,
      };
    case 'dump-valve':
      return {
        en: `${fitmentEn ? `GFB valve upgrade for ${fitmentEn}. ` : ''}Performance-focused boost-control hardware intended as an upgrade or replacement for factory valve equipment.`,
        ua: `${fitmentUa ? `Апгрейд клапана GFB для ${fitmentUa}. ` : ''}Компонент керування бустом, орієнтований на підвищення продуктивності та використання як апгрейд або заміна штатного клапанного вузла.`,
      };
    case 'bleed-valve':
      return {
        en: 'Manual bleed valve for boost-control tuning in turbo applications where a simple adjustable pressure-signal solution is needed.',
        ua: 'Ручний клапан стравлювання для налаштування керування бустом у турбо-системах, де потрібне просте регульоване рішення по сигналу тиску.',
      };
    case 'performance-package':
      return {
        en: `${fitmentEn ? `Vehicle-specific do88 performance package for ${fitmentEn}. ` : ''}Bundles key hardware into one direct-fit solution for a more coordinated upgrade path.`,
        ua: `${fitmentUa ? `Модельний апгрейд-пакет do88 для ${fitmentUa}. ` : ''}Об'єднує ключові компоненти в одне рішення точної посадки для більш цілісного апгрейду.`,
      };
    case 'turbo-upgrade':
      return {
        en: `${fitmentEn ? `Turbo upgrade package for ${fitmentEn}. ` : ''}Built around performance-focused forced-induction hardware for higher airflow potential and a more serious power ceiling.`,
        ua: `${fitmentUa ? `Пакет апгрейду турбіни для ${fitmentUa}. ` : ''}Побудований навколо турбообладнання, орієнтованого на підвищення продуктивності, для більшого потенціалу потоку повітря та вищої межі потужності.`,
      };
    case 'vehicle-intercooler':
      return {
        en: `Vehicle-specific do88 intercooler solution for ${fitmentEn}. Built to improve charge-air cooling under repeated street and track use.`,
        ua: `Модельний інтеркулер do88 для ${fitmentUa}. Розроблений для стабільного охолодження наддувного повітря у вуличному та трековому режимі.`,
      };
    case 'universal-intercooler':
      return {
        en: 'Universal do88 intercooler for custom charge-air setups where packaging, routing and mounting are defined by the fabricator.',
        ua: 'Універсальний інтеркулер do88 для кастомних систем наддуву, де компоновку, прокладання та монтаж визначає майстер або виробник проекту.',
      };
    case 'intercooler-core':
      return {
        en: 'Intercooler core for custom charge-air fabrication where size, end tanks and routing are chosen by the builder.',
        ua: 'Сердечник інтеркулера для кастомного виготовлення траси наддуву, де розмір, бачки та маршрут магістралі визначає збирач.',
      };
    case 'vehicle-radiator':
      return {
        en: `Vehicle-specific do88 cooling component for ${fitmentEn}. Built for dependable temperature control and OEM-style fitment.`,
        ua: `Модельний радіатор do88 для ${fitmentUa}. Розрахований на стабільний температурний режим та посадку рівня OEM.`,
      };
    case 'radiator':
      return {
        en: 'do88 cooling component for performance applications with a focus on stable temperatures and dependable fitment.',
        ua: 'Компонент do88 для системи охолодження форсованих авто зі ставкою на стабільні температури та надійну посадку.',
      };
    case 'vehicle-oil-cooler':
      return {
        en: `Vehicle-specific do88 oil-cooling component for ${fitmentEn}. Supports stable oil temperatures during demanding road or track driving.`,
        ua: `Модельний масляний радіатор do88 для ${fitmentUa}. Допомагає утримувати стабільну температуру масла при активній їзді.`,
      };
    case 'oil-cooler':
      return {
        en: 'do88 oil-cooling component designed to keep lubricant temperatures controlled during demanding use.',
        ua: 'Компонент do88 для системи охолодження мастила, який допомагає контролювати температуру в інтенсивному режимі.',
      };
    case 'vehicle-hose':
      return {
        en: `Vehicle-specific do88 hose solution for ${fitmentEn}. Built to refresh the listed platform with reinforced hose construction and direct-fit geometry.`,
        ua: `Модельне шлангове рішення do88 для ${fitmentUa}. Допомагає оновити зазначену платформу завдяки посиленій конструкції шлангів і геометрії точної посадки.`,
      };
    case 'vehicle-intake':
      return {
        en: `Vehicle-specific do88 intake component for ${fitmentEn}. Built for cleaner airflow, stable fitment and easy integration into the listed platform.`,
        ua: `Модельний впускний компонент do88 для ${fitmentUa}. Розрахований на чистіший повітряний потік, стабільну посадку та просту інтеграцію в зазначену платформу.`,
      };
    case 'vehicle-exhaust':
      return {
        en: `Vehicle-specific do88 exhaust component for ${fitmentEn}. Built for direct integration with the listed platform and performance-oriented replacement work.`,
        ua: `Модельний вихлопний компонент do88 для ${fitmentUa}. Розрахований на точну інтеграцію в зазначену платформу та продуктивну заміну штатних деталей.`,
      };
    case 'vehicle-specific':
      return {
        en: `Vehicle-specific do88 performance component for ${fitmentEn}. Developed for direct integration with the listed platform.`,
        ua: `Модельний компонент do88 для ${fitmentUa}. Розроблений для точної інтеграції в зазначену платформу.`,
      };
    case 'merch-hoodie':
      return {
        en: 'do88 branded hoodie for workshop, paddock or casual wear with a cleaner motorsport-inspired look.',
        ua: 'Брендове худі do88 для майстерні, паддоку або щоденного носіння з акуратним автоспортивним настроєм.',
      };
    default:
      return {
        en: 'Official do88 performance component manufactured in Sweden.',
        ua: 'Офіційний компонент do88, виготовлений у Швеції.',
      };
  }
}

function buildBodyCopy(product) {
  const fitment = parseFitment(product.category);
  const inferredFitment = fitment ? null : inferFitmentFromTitle(product.titleEn);
  const collection = deriveCollection(product);
  const fitmentEn = fitment
    ? `${fitment.brand} ${applyTextRules(fitment.platform, 'en')}`
    : inferredFitment;
  const fitmentUa = fitment
    ? `${fitment.brand} ${applyTextRules(fitment.platform, 'ua')}`
    : inferredFitment
      ? applyTextRules(inferredFitment, 'ua')
      : null;
  const kind = detectProductKind(product, collection, fitmentEn || fitment);
  const descriptor = getDescriptor(product);
  const kindLabel = getKindLabel(kind);
  const materialFinish = getMaterialFinish(product);
  const keySpecEn = extractKeySpec(product.titleEn);
  const keySpecUa = extractKeySpec(product.titleUa);
  const summaryPair = buildSummaryByKind(kind, descriptor, fitmentEn, fitmentUa);
  const summaryEn = capitalizeLead(summaryPair.en);
  const summaryUa = capitalizeLead(summaryPair.ua);

  const detailLinesEn = [
    `<li>SKU: ${product.sku}</li>`,
    `<li>Type: ${kindLabel.en}</li>`,
    keySpecEn ? `<li>Key spec: ${keySpecEn}</li>` : null,
    fitmentEn ? `<li>Fitment: ${fitmentEn}</li>` : null,
    materialFinish ? `<li>Material / finish: ${materialFinish.en}</li>` : null,
    `<li>Category: ${product.categoryEn}</li>`,
    '<li>Brand: do88</li>',
    '<li>Origin: Sweden</li>',
  ].filter(Boolean).join('');

  const detailLinesUa = [
    `<li>Артикул: ${product.sku}</li>`,
    `<li>Тип: ${kindLabel.ua}</li>`,
    keySpecUa ? `<li>Ключова специфікація: ${keySpecUa}</li>` : null,
    fitmentUa ? `<li>Сумісність: ${fitmentUa}</li>` : null,
    materialFinish ? `<li>Матеріал / виконання: ${materialFinish.ua}</li>` : null,
    `<li>Категорія: ${product.categoryUa}</li>`,
    '<li>Бренд: do88</li>',
    '<li>Походження: Швеція</li>',
  ].filter(Boolean).join('');

  return {
    shortDescEn: summaryEn,
    shortDescUa: summaryUa,
    bodyHtmlEn: `<p><strong>${product.titleEn}</strong></p><p>${summaryEn}</p><ul>${detailLinesEn}</ul>`,
    bodyHtmlUa: `<p><strong>${product.titleUa}</strong></p><p>${summaryUa}</p><ul>${detailLinesUa}</ul>`,
  };
}

function generateTags(product) {
  const tags = new Set(['DO88', 'Performance']);
  for (const part of String(product.categoryEn ?? '').split(' > ')) {
    const clean = normalizeWhitespace(part);
    if (clean) tags.add(clean);
  }

  const fitment = parseFitment(product.category);
  if (fitment) {
    tags.add(fitment.brand);
    tags.add(fitment.platform);
    tags.add(`${fitment.brand} ${fitment.platform}`);
  }

  const title = product.titleEn.toLowerCase();
  if (title.includes('intercooler')) tags.add('Intercooler');
  if (title.includes('radiator')) tags.add('Radiator');
  if (title.includes('oil cooler')) tags.add('Oil Cooler');
  if (title.includes('silicone hose') || title.includes('fuel filler hose') || title.includes('hose clamp')) tags.add('Hoses');
  if (title.includes('intake')) tags.add('Intake');
  if (title.includes('exhaust tip') || title.includes('muffler') || title.includes('exhaust')) tags.add('Exhaust');
  if (title.includes('heat')) tags.add('Heat Protection');
  if (title.includes('aluminum pipe')) tags.add('Aluminum Pipe');
  if (title.includes('air filter') || title.includes('airbox')) tags.add('Air Filter');
  if (title.includes('carbon fiber')) tags.add('Carbon Fiber');

  return [...tags].filter(Boolean);
}

function translateProduct(product) {
  const titleEn = translateTitleFromSwedish(product.title, 'en');
  const titleUa = translateTitleFromSwedish(product.title, 'ua');
  const categoryEn = translateCategoryPath(product.category, 'en');
  const categoryUa = translateCategoryPath(product.category, 'ua');

  const translated = {
    ...product,
    titleEn,
    titleUa,
    categoryEn,
    categoryUa,
  };

  const collection = deriveCollection(translated);
  const copy = buildBodyCopy({
    ...translated,
    category: product.category,
    collectionEn: collection.en,
    collectionUa: collection.ua,
  });

  return {
    ...translated,
    collectionEn: collection.en,
    collectionUa: collection.ua,
    shortDescEn: copy.shortDescEn,
    shortDescUa: copy.shortDescUa,
    bodyHtmlEn: copy.bodyHtmlEn,
    bodyHtmlUa: copy.bodyHtmlUa,
    tags: generateTags({
      ...translated,
      category: product.category,
    }),
  };
}

function countFragments(products) {
  let titleEnFragments = 0;
  let categoryEnFragments = 0;
  let bodyEnFragments = 0;

  for (const product of products) {
    if (SWEDISH_FRAGMENT_REGEX.test(product.titleEn)) titleEnFragments += 1;
    if (SWEDISH_FRAGMENT_REGEX.test(product.categoryEn)) categoryEnFragments += 1;
    if (SWEDISH_FRAGMENT_REGEX.test(product.bodyHtmlEn) || SWEDISH_FRAGMENT_REGEX.test(product.shortDescEn)) bodyEnFragments += 1;
  }

  return { titleEnFragments, categoryEnFragments, bodyEnFragments };
}

async function syncDatabase(products) {
  if (!prisma) return;
  let updated = 0;
  for (const product of products) {
    const data = {
      titleEn: product.titleEn,
      titleUa: product.titleUa,
      categoryEn: product.categoryEn,
      categoryUa: product.categoryUa,
      shortDescEn: product.shortDescEn,
      shortDescUa: product.shortDescUa,
      longDescEn: product.bodyHtmlEn,
      longDescUa: product.bodyHtmlUa,
      bodyHtmlEn: product.bodyHtmlEn,
      bodyHtmlUa: product.bodyHtmlUa,
      productCategory: product.categoryEn,
      collectionEn: product.collectionEn,
      collectionUa: product.collectionUa,
      tags: product.tags,
    };

    const record = await prisma.shopProduct.findFirst({
      where: {
        OR: [
          { sku: product.sku, vendor: 'DO88' },
          { sku: product.sku, brand: 'DO88' },
          { slug: product.slug },
        ],
      },
      select: { id: true },
    });

    if (!record) continue;

    await prisma.shopProduct.update({
      where: { id: record.id },
      data,
    });

    await prisma.shopProductMedia.updateMany({
      where: { productId: record.id },
      data: { altText: product.titleEn },
    });

    updated += 1;
  }

  console.log(`DB sync updated ${updated} DO88 products`);
}

function createBackup() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(process.cwd(), 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `do88-products-v4.pre-normalize-${stamp}.json`);
  fs.copyFileSync(INPUT_FILE, backupPath);
  return backupPath;
}

async function main() {
  if (!fs.existsSync(INPUT_FILE)) {
    throw new Error(`Input file not found: ${INPUT_FILE}`);
  }

  const products = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
  const before = countFragments(products);
  const translated = products.map(translateProduct);
  const after = countFragments(translated);

  console.log(JSON.stringify({
    total: translated.length,
    before,
    after,
    samples: translated.slice(0, 5).map((product) => ({
      sku: product.sku,
      titleEn: product.titleEn,
      titleUa: product.titleUa,
      categoryEn: product.categoryEn,
      categoryUa: product.categoryUa,
    })),
  }, null, 2));

  if (WRITE) {
    const backupPath = createBackup();
    fs.writeFileSync(INPUT_FILE, JSON.stringify(translated, null, 2) + '\n', 'utf8');
    console.log(`Wrote normalized translations to ${INPUT_FILE}`);
    console.log(`Backup created at ${backupPath}`);
  }

  if (SYNC_DB) {
    await syncDatabase(translated);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
  });
