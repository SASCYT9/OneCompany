import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';

// Configuration
const LOGO_DIR = path.join(process.cwd(), 'public', 'logos');
const BRAND_LOGOS_PATH = path.join(process.cwd(), 'src', 'lib', 'brandLogos.ts');
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Manual Overrides for Broken Logos
const MANUAL_OVERRIDES: Record<string, { query: string, domain?: string }> = {
  'Vorsteiner': { query: 'Vorsteiner wheels logo', domain: 'vorsteiner.com' },
  'Renntech': { query: 'Renntech Mercedes logo', domain: 'renntechmercedes.com' },
  'CSF': { query: 'CSF Radiators logo', domain: 'csfrace.com' },
  'Manhart': { query: 'Manhart Performance logo', domain: 'manhart-performance.de' },
  'Armytrix': { query: 'Armytrix exhaust logo', domain: 'armytrix.com' },
  'Eventuri': { query: 'Eventuri carbon intake logo', domain: 'eventuri.net' },
  'Arrow': { query: 'Arrow Special Parts exhaust logo', domain: 'arrow.it' },
  'BMC': { query: 'BMC Air Filters logo', domain: 'bmcairfilters.com' },
  'DMC': { query: 'DMC luxury tuning logo', domain: 'dmc.ag' },
  'Weistec Engineering': { query: 'Weistec Engineering logo', domain: 'weistec.com' },
  'Akrapovic': { query: 'Akrapovic exhaust logo', domain: 'akrapovic.com' },
  'Brabus': { query: 'Brabus logo', domain: 'brabus.com' },
  'Mansory': { query: 'Mansory logo', domain: 'mansory.com' },
  'Novitec': { query: 'Novitec logo', domain: 'novitecgroup.com' },
  'Liberty Walk': { query: 'Liberty Walk logo', domain: 'libertywalk.co.jp' },
  'HRE wheels': { query: 'HRE Performance Wheels logo', domain: 'hrewheels.com' },
  'Brembo': { query: 'Brembo brakes logo', domain: 'brembo.com' },
  'Onyx Concept': { query: 'Onyx Concept cars logo', domain: 'onyxconcept.com' },
  'Urban Automotive': { query: 'Urban Automotive logo', domain: 'urban-automotive.co.uk' },
  'KAHN design': { query: 'Kahn Design logo', domain: 'kahndesign.com' },
  'ABT': { query: 'ABT Sportsline logo', domain: 'abt-sportsline.com' },
  'AC Schnitzer': { query: 'AC Schnitzer logo', domain: 'ac-schnitzer.de' },
  'TechArt': { query: 'TechArt logo', domain: 'techart.de' },
  'Hamann': { query: 'Hamann Motorsport logo', domain: 'hamann-motorsport.com' },
  'Lumma': { query: 'Lumma Design logo', domain: 'lumma-design.com' },
  'Prior Design': { query: 'Prior Design logo', domain: 'prior-design.de' },
  'Wald': { query: 'Wald International logo', domain: 'wald.co.jp' },
  'Vossen': { query: 'Vossen Wheels logo', domain: 'vossenwheels.com' },
  'Rotiform': { query: 'Rotiform wheels logo', domain: 'rotiform.com' },
  'Forgiato': { query: 'Forgiato wheels logo', domain: 'forgiato.com' },
  'ADV.1': { query: 'ADV.1 Wheels logo', domain: 'adv1wheels.com' },
  'Brixton Forged': { query: 'Brixton Forged logo', domain: 'brixtonforged.com' },
  'Anrky': { query: 'Anrky Wheels logo', domain: 'anrky.com' },
  '1016 Industries': { query: '1016 Industries logo', domain: '1016industries.com' },
  'Ryft': { query: 'Ryft Exhaust logo', domain: 'ryft.co' },
  'Gunther Werks': { query: 'Gunther Werks logo', domain: 'guntherwerks.com' },
  'Singer': { query: 'Singer Vehicle Design logo', domain: 'singervehicledesign.com' },
  'RWB': { query: 'Rauh Welt Begriff logo', domain: 'rwb.jp' },
  'Gemballa': { query: 'Gemballa logo', domain: 'gemballa.com' },
  'Ruf': { query: 'Ruf Automobile logo', domain: 'ruf-automobile.de' },
  '9ff': { query: '9ff logo', domain: '9ff.com' },
  'Alpina': { query: 'Alpina Automobiles logo', domain: 'alpina-automobiles.com' },
  'Dinan': { query: 'Dinan Cars logo', domain: 'dinancars.com' },
  'Mountune': { query: 'Mountune logo', domain: 'mountune.com' },
  'Revo': { query: 'Revo Technik logo', domain: 'revotechnik.com' },
  'APR': { query: 'APR Tuned logo', domain: 'goapr.com' },
  'Unitronic': { query: 'Unitronic logo', domain: 'getunitronic.com' },
  'Integrated Engineering': { query: 'Integrated Engineering logo', domain: 'performancebyie.com' },
  '034Motorsport': { query: '034Motorsport logo', domain: '034motorsport.com' },
  'ECS Tuning': { query: 'ECS Tuning logo', domain: 'ecstuning.com' },
  'FCP Euro': { query: 'FCP Euro logo', domain: 'fcpeuro.com' },
  'Turner Motorsport': { query: 'Turner Motorsport logo', domain: 'turnermotorsport.com' },
  'BimmerWorld': { query: 'BimmerWorld logo', domain: 'bimmerworld.com' },
  'Pelican Parts': { query: 'Pelican Parts logo', domain: 'pelicanparts.com' },
  'Mod Bargains': { query: 'ModBargains logo', domain: 'modbargains.com' },
  'Vivid Racing': { query: 'Vivid Racing logo', domain: 'vividracing.com' },
  'Thorney Motorsport': { query: 'Thorney Motorsport logo', domain: 'thorneymotorsport.co.uk' },
  'Litchfield': { query: 'Litchfield Motors logo', domain: 'litchfieldmotors.com' },
  'SVM': { query: 'Severn Valley Motorsport logo', domain: 'severnvalleymotorsport.co.uk' },
  'AMS Performance': { query: 'AMS Performance logo', domain: 'amsperformance.com' },
  'ETS': { query: 'Extreme Turbo Systems logo', domain: 'extremeturbosystems.com' },
  'Buschur Racing': { query: 'Buschur Racing logo', domain: 'buschurracing.com' },
  'STM Tuned': { query: 'STM Tuned logo', domain: 'stmtuned.com' },
  'Real Street Performance': { query: 'Real Street Performance logo', domain: 'realstreetperformance.com' },
  'Titan Motorsports': { query: 'Titan Motorsports logo', domain: 'titanmotorsports.com' },
  'Perrin': { query: 'Perrin Performance logo', domain: 'perrin.com' },
  'Cobb': { query: 'Cobb Tuning logo', domain: 'cobbtuning.com' },
  'GrimmSpeed': { query: 'GrimmSpeed logo', domain: 'grimmspeed.com' },
  'Mishimoto': { query: 'Mishimoto logo', domain: 'mishimoto.com' },
  'Invidia': { query: 'Invidia Exhaust logo', domain: 'invidia-usa.com' },
  'HKS': { query: 'HKS logo', domain: 'hks-power.co.jp' },
  'GReddy': { query: 'GReddy logo', domain: 'greddy.com' },
  'Blitz': { query: 'Blitz Co Ltd logo', domain: 'blitz.co.jp' },
  'Tomei': { query: 'Tomei Powered logo', domain: 'tomei-p.co.jp' },
  'Apexi': { query: 'Apexi logo', domain: 'apexi-usa.com' },
  'Tein': { query: 'Tein Suspension logo', domain: 'tein.com' },
  'KW Suspensions': { query: 'KW Suspensions logo', domain: 'kwsuspensions.com' },
  'Bilstein': { query: 'Bilstein logo', domain: 'bilstein.com' },
  'Ohlins': { query: 'Ohlins logo', domain: 'ohlins.com' },
  'Eibach': { query: 'Eibach logo', domain: 'eibach.com' },
  'H&R': { query: 'H&R Springs logo', domain: 'h-r.com' },
  'Vogtland': { query: 'Vogtland logo', domain: 'vogtland.com' },
  'ST Suspensions': { query: 'ST Suspensions logo', domain: 'stsuspensions.com' },
  'BC Racing': { query: 'BC Racing Coilovers logo', domain: 'bcracing-na.com' },
  'Fortune Auto': { query: 'Fortune Auto logo', domain: 'fortune-auto.com' },
  'Feal Suspension': { query: 'Feal Suspension logo', domain: 'fealsuspension.com' },
  'MCS': { query: 'Motion Control Suspension logo', domain: 'motioncontrolsuspension.com' },
  'JRZ': { query: 'JRZ Suspension logo', domain: 'jrzsuspension.com' },
  'Penske': { query: 'Penske Racing Shocks logo', domain: 'penskeshocks.com' },
  'Moton': { query: 'Moton Suspension logo', domain: 'motonsuspension.com' },
  'AST': { query: 'AST Suspension logo', domain: 'astsuspension.com' },
  'Nitron': { query: 'Nitron Racing Systems logo', domain: 'nitron.co.uk' },
  'Quantum': { query: 'Quantum Racing Suspension logo', domain: 'quantumracing.co.uk' },
  'TracTive': { query: 'TracTive Suspension logo', domain: 'tractivesuspension.com' },
  'Wilwood': { query: 'Wilwood Disc Brakes logo', domain: 'wilwood.com' },
  'AP Racing': { query: 'AP Racing logo', domain: 'apracing.com' },
  'Alcon': { query: 'Alcon Brakes logo', domain: 'alcon.co.uk' },
  'Endless': { query: 'Endless Brakes logo', domain: 'endless-sport.co.jp' },
  'Project Mu': { query: 'Project Mu logo', domain: 'project-mu.co.jp' },
  'Pagid': { query: 'Pagid Racing logo', domain: 'pagidracing.com' },
  'Ferodo': { query: 'Ferodo Racing logo', domain: 'ferodoracing.com' },
  'Hawk': { query: 'Hawk Performance logo', domain: 'hawkperformance.com' },
  'EBC': { query: 'EBC Brakes logo', domain: 'ebcbrakes.com' },
  'Carbotech': { query: 'Carbotech Performance Brakes logo', domain: 'ctbrakes.com' },
  'G-LOC': { query: 'G-LOC Brakes logo', domain: 'g-locbrakes.com' },
  'Cobalt Friction': { query: 'Cobalt Friction logo', domain: 'cobaltfriction.com' },
  'Performance Friction': { query: 'Performance Friction Brakes logo', domain: 'pfcbrakes.com' },
  'Sparta Evolution': { query: 'Sparta Evolution logo', domain: 'spartaevo.com' },
  'Ceika': { query: 'Ceika Performance logo', domain: 'ceika-store.com' },
  'Ksport': { query: 'Ksport logo', domain: 'ksportusa.com' },
  'D2 Racing': { query: 'D2 Racing logo', domain: 'd2racing.com' },
  'Yellow Speed': { query: 'Yellow Speed Racing logo', domain: 'yellowspeedracing.com' },
  'Megan Racing': { query: 'Megan Racing logo', domain: 'meganracing.com' },
  'Godspeed': { query: 'Godspeed Project logo', domain: 'godspeedproject.com' },
  'TruHart': { query: 'TruHart logo', domain: 'truhart.com' },
  'Hardrace': { query: 'Hardrace logo', domain: 'hardrace.com' },
  'Whiteline': { query: 'Whiteline logo', domain: 'whiteline.com.au' },
  'SuperPro': { query: 'SuperPro Suspension logo', domain: 'superpro.com.au' },
  'Powerflex': { query: 'Powerflex logo', domain: 'powerflex.co.uk' },
  'Energy Suspension': { query: 'Energy Suspension logo', domain: 'energysuspension.com' },
  'Prothane': { query: 'Prothane logo', domain: 'prothane.com' },
  'Recaro': { query: 'Recaro logo', domain: 'recaro-automotive.com' },
  'Sparco': { query: 'Sparco logo', domain: 'sparco-official.com' },
  'Bride': { query: 'Bride Seats logo', domain: 'bride-jp.com' },
  'Corbeau': { query: 'Corbeau Seats logo', domain: 'corbeau.com' },
  'Cobra': { query: 'Cobra Seats logo', domain: 'cobraseats.com' },
  'OMP': { query: 'OMP Racing logo', domain: 'ompracing.com' },
  'Sabelt': { query: 'Sabelt logo', domain: 'sabelt.com' },
  'Takata': { query: 'Takata Racing logo', domain: 'takataracing.com' },
  'Schroth': { query: 'Schroth Racing logo', domain: 'schrothracing.com' },
  'Willans': { query: 'Willans Harness logo', domain: 'willans.com' },
  'Stand 21': { query: 'Stand 21 logo', domain: 'stand21.com' },
  'Alpinestars': { query: 'Alpinestars logo', domain: 'alpinestars.com' },
  'Dainese': { query: 'Dainese logo', domain: 'dainese.com' },
  'Bell Helmets': { query: 'Bell Helmets logo', domain: 'bellracing.com' },
  'Arai': { query: 'Arai Helmets logo', domain: 'araiamericas.com' },
  'Shoei': { query: 'Shoei Helmets logo', domain: 'shoei-helmets.com' },
  'Stilo': { query: 'Stilo Helmets logo', domain: 'stilo.it' },
  'Simpson': { query: 'Simpson Racing logo', domain: 'simpsonraceproducts.com' },
  'HANS': { query: 'HANS Device logo', domain: 'hansdevice.com' },
  'Hybrid': { query: 'Simpson Hybrid logo', domain: 'simpsonraceproducts.com' },
  'NecksGen': { query: 'NecksGen logo', domain: 'necksgen.com' },
  'Zamp': { query: 'Zamp Helmets logo', domain: 'zamp-racing.com' },
  'RaceQuip': { query: 'RaceQuip logo', domain: 'racequip.com' },
  'G-Force': { query: 'G-Force Racing Gear logo', domain: 'gforce.com' },
  'Pyrotect': { query: 'Pyrotect logo', domain: 'pyrotect.com' },
  'Impact': { query: 'Impact Racing logo', domain: 'impactraceproducts.com' },
  'Leaf': { query: 'Leaf Racewear logo', domain: 'leafracewear.com' },
  'Puma': { query: 'Puma Motorsport logo', domain: 'puma.com' },
  'Adidas': { query: 'Adidas Motorsport logo', domain: 'adidas.com' },
  'Oakley': { query: 'Oakley Motorsports logo', domain: 'oakley.com' },
  'Piloti': { query: 'Piloti logo', domain: 'piloti.com' },
  'Hunab': { query: 'Hunab logo', domain: 'hunab.co' },
  'Minus 273': { query: 'Minus 273 logo', domain: 'minus273.biz' },
  'K1 RaceGear': { query: 'K1 RaceGear logo', domain: 'k1racegear.com' },
  'FreeM': { query: 'FreeM logo', domain: 'freemracing.it' },
  'Marina': { query: 'Marina Racewear logo', domain: 'marinaracewear.com' },
  'P1': { query: 'P1 Racewear logo', domain: 'p1racewear.com' },
  'HRX': { query: 'HRX logo', domain: 'hrx.eu' },
  'Walero': { query: 'Walero logo', domain: 'walero.uk' },
  'CoolShirt': { query: 'CoolShirt Systems logo', domain: 'coolshirt.com' },
  'FAST': { query: 'FAST Cooling logo', domain: 'fastcooling.com' },
  'Chillout': { query: 'Chillout Systems logo', domain: 'chilloutsystems.com' },
  'Fluidlogic': { query: 'Fluidlogic logo', domain: 'fluidlogic.com' },
  'Maglock': { query: 'Maglock logo', domain: 'maglock.com' },
  'Rugged Radios': { query: 'Rugged Radios logo', domain: 'ruggedradios.com' },
  'Racing Electronics': { query: 'Racing Electronics logo', domain: 'racingelectronics.com' },
  'Speedcom': { query: 'Speedcom Communications logo', domain: 'speedcomracing.com' },
  'MoTeC': { query: 'MoTeC logo', domain: 'motec.com.au' },
  'AiM': { query: 'AiM Sports logo', domain: 'aim-sportline.com' },
  'RacePak': { query: 'RacePak logo', domain: 'racepak.com' },
  'Stack': { query: 'Stack Instruments logo', domain: 'stackltd.com' },
  'VBOX': { query: 'Racelogic VBOX logo', domain: 'vboxmotorsport.co.uk' },
  'Garmin': { query: 'Garmin Catalyst logo', domain: 'garmin.com' },
  'Apex Pro': { query: 'Apex Pro logo', domain: 'apextrackcoach.com' },
  'Harry\'s LapTimer': { query: 'Harry\'s LapTimer logo', domain: 'gps-laptimer.de' },
  'RaceChrono': { query: 'RaceChrono logo', domain: 'racechrono.com' },
  'TrackAddict': { query: 'TrackAddict logo', domain: 'racerender.com' },
  'SoloStorm': { query: 'SoloStorm logo', domain: 'petreldata.com' },
  'MegaSquirt': { query: 'MegaSquirt logo', domain: 'megasquirt.info' },
  'Haltech': { query: 'Haltech logo', domain: 'haltech.com' },
  'AEM': { query: 'AEM Electronics logo', domain: 'aemelectronics.com' },
  'FuelTech': { query: 'FuelTech logo', domain: 'fueltech.net' },
  'Syvecs': { query: 'Syvecs logo', domain: 'syvecs.com' },
  'Life Racing': { query: 'Life Racing logo', domain: 'liferacing.com' },
  'Bosch': { query: 'Bosch Motorsport logo', domain: 'bosch-motorsport.com' },
  'Cosworth': { query: 'Cosworth Electronics logo', domain: 'cosworth.com' },
  'Magneti Marelli': { query: 'Magneti Marelli Motorsport logo', domain: 'magnetimarelli.com' },
  'McLaren Applied': { query: 'McLaren Applied logo', domain: 'mclaren.com' },
  'Zytek': { query: 'Zytek Automotive logo', domain: 'zytekautomotive.co.uk' },
  'Gibson': { query: 'Gibson Technology logo', domain: 'gibsontech.co.uk' },
  'Judd': { query: 'Judd Power logo', domain: 'juddpower.com' },
  'Mecachrome': { query: 'Mecachrome logo', domain: 'mecachrome.com' },
  'AER': { query: 'Advanced Engine Research logo', domain: 'aerltd.com' },
  'Ilmor': { query: 'Ilmor Engineering logo', domain: 'ilmor.com' },
  'Ricardo': { query: 'Ricardo logo', domain: 'ricardo.com' },
  'Xtrac': { query: 'Xtrac logo', domain: 'xtrac.com' },
  'Hewland': { query: 'Hewland logo', domain: 'hewland.com' },
  'Sadev': { query: 'Sadev logo', domain: 'sadev-tm.com' },
  'Quaife': { query: 'Quaife logo', domain: 'quaife.co.uk' },
  'Holinger': { query: 'Holinger logo', domain: 'holinger.com.au' },
  'Albins': { query: 'Albins logo', domain: 'albins.com.au' },
  'PPG': { query: 'Pfitzner Performance Gearbox logo', domain: 'ppgearbox.com' },
  'G-Force Transmissions': { query: 'G-Force Transmissions logo', domain: 'gforcetransmissions.com' },
  'Jerico': { query: 'Jerico Performance Products logo', domain: 'jericoperformance.com' },
  'Tex Racing': { query: 'Tex Racing logo', domain: 'texracing.com' },
  'Winters': { query: 'Winters Performance logo', domain: 'wintersperformance.com' },
  'Strange': { query: 'Strange Engineering logo', domain: 'strangeengineering.net' },
  'Currie': { query: 'Currie Enterprises logo', domain: 'currieenterprises.com' },
  'Mark Williams': { query: 'Mark Williams Enterprises logo', domain: 'markwilliams.com' },
  'Driveshaft Shop': { query: 'The Driveshaft Shop logo', domain: 'driveshaftshop.com' },
  'PST': { query: 'PST Driveshafts logo', domain: 'pstds.com' },
  'ACP': { query: 'ACP Composites logo', domain: 'acpcomposites.com' },
  'Crawford Composites': { query: 'Crawford Composites logo', domain: 'crawfordcomposites.com' },
  'Multimatic': { query: 'Multimatic logo', domain: 'multimatic.com' },
  'Dallara': { query: 'Dallara logo', domain: 'dallara.it' },
  'Ligier': { query: 'Ligier Automotive logo', domain: 'ligierautomotive.com' },
  'Oreca': { query: 'Oreca logo', domain: 'oreca.com' },
  'Ginetta': { query: 'Ginetta logo', domain: 'ginetta.com' },
  'Radical': { query: 'Radical Motorsport logo', domain: 'radicalmotorsport.com' },
  'Praga': { query: 'Praga Cars logo', domain: 'pragaglobal.com' },
  'KTM': { query: 'KTM X-Bow logo', domain: 'ktm.com' },
  'Ariel': { query: 'Ariel Motor Company logo', domain: 'arielmotor.co.uk' },
  'BAC': { query: 'BAC Mono logo', domain: 'bac-mono.com' },
  'Caterham': { query: 'Caterham Cars logo', domain: 'caterhamcars.com' },
  'Westfield': { query: 'Westfield Sportscars logo', domain: 'westfield-sportscars.co.uk' },
  'Ultima': { query: 'Ultima Sports logo', domain: 'ultimasports.co.uk' },
  'Factory Five': { query: 'Factory Five Racing logo', domain: 'factoryfive.com' },
  'Superformance': { query: 'Superformance logo', domain: 'superformance.com' },
  'Backdraft': { query: 'Backdraft Racing logo', domain: 'backdraftracing.com' },
  'Kirkham': { query: 'Kirkham Motorsports logo', domain: 'kirkhammotorsports.com' },
  'Shelby': { query: 'Shelby American logo', domain: 'shelby.com' },
  'Roush': { query: 'Roush Performance logo', domain: 'roushperformance.com' },
  'Saleen': { query: 'Saleen logo', domain: 'saleen.com' },
  'Steeda': { query: 'Steeda logo', domain: 'steeda.com' },
  'Hennessey': { query: 'Hennessey Performance logo', domain: 'hennesseyperformance.com' },
  'Callaway': { query: 'Callaway Cars logo', domain: 'callawaycars.com' },
  'Lingenfelter': { query: 'Lingenfelter Performance Engineering logo', domain: 'lingenfelter.com' },
  'Katech': { query: 'Katech logo', domain: 'katechengines.com' },
  'Pratt & Miller': { query: 'Pratt & Miller logo', domain: 'prattmiller.com' },
  'Riley': { query: 'Riley Technologies logo', domain: 'rileytech.com' },
  'Swift': { query: 'Swift Engineering logo', domain: 'swiftengineering.com' },
  'Reynard': { query: 'Reynard Motorsport logo', domain: 'reynardracing.com' },
  'Lola': { query: 'Lola Cars logo', domain: 'lola-cars.co.uk' },
  'March': { query: 'March Engineering logo', domain: 'marchives.com' },
  'Chevron': { query: 'Chevron Cars logo', domain: 'chevronracingcars.com' },
  'Lotus': { query: 'Lotus Cars logo', domain: 'lotuscars.com' },
  'Cosworth': { query: 'Cosworth logo', domain: 'cosworth.com' },
  'Ford': { query: 'Ford Performance logo', domain: 'performance.ford.com' },
  'GM': { query: 'GM Performance Parts logo', domain: 'chevrolet.com' },
  'Mopar': { query: 'Mopar logo', domain: 'mopar.com' },
  'Toyota': { query: 'Toyota Gazoo Racing logo', domain: 'toyotagazooracing.com' },
  'Honda': { query: 'Honda Performance Development logo', domain: 'hpd.honda.com' },
  'Nissan': { query: 'Nismo logo', domain: 'nismo.co.jp' },
  'Mazda': { query: 'Mazda Motorsports logo', domain: 'mazdamotorsports.com' },
  'Subaru': { query: 'Subaru Tecnica International logo', domain: 'sti.jp' },
  'Mitsubishi': { query: 'Ralliart logo', domain: 'ralliart.com' },
  'Hyundai': { query: 'Hyundai N logo', domain: 'hyundai-n.com' },
  'Volkswagen': { query: 'Volkswagen R logo', domain: 'volkswagen-r.com' },
  'Audi': { query: 'Audi Sport logo', domain: 'audi.com' },
  'BMW': { query: 'BMW M logo', domain: 'bmw-m.com' },
  'Mercedes-AMG': { query: 'Mercedes-AMG logo', domain: 'mercedes-amg.com' },
  'Porsche': { query: 'Porsche Motorsport logo', domain: 'porsche.com' },
  'Ferrari': { query: 'Scuderia Ferrari logo', domain: 'ferrari.com' },
  'Lamborghini': { query: 'Lamborghini Squadra Corse logo', domain: 'lamborghini.com' },
  'McLaren': { query: 'McLaren Racing logo', domain: 'mclaren.com' },
  'Aston Martin': { query: 'Aston Martin Racing logo', domain: 'astonmartin.com' },
  'Bentley': { query: 'Bentley Motorsport logo', domain: 'bentleymotors.com' },
  'Jaguar': { query: 'Jaguar Racing logo', domain: 'jaguar.com' },
  'Land Rover': { query: 'Bowler Motors logo', domain: 'bowlermotors.com' },
  'Mini': { query: 'Mini John Cooper Works logo', domain: 'mini.com' },
  'Renault': { query: 'Alpine Cars logo', domain: 'alpinecars.com' },
  'Peugeot': { query: 'Peugeot Sport logo', domain: 'peugeot-sport.com' },
  'Citroen': { query: 'Citroen Racing logo', domain: 'citroenracing.com' },
  'DS': { query: 'DS Performance logo', domain: 'dsautomobiles.com' },
  'Alfa Romeo': { query: 'Alfa Romeo Racing logo', domain: 'alfaromeo.com' },
  'Fiat': { query: 'Abarth logo', domain: 'abarth.com' },
  'Lancia': { query: 'Lancia logo', domain: 'lancia.com' },
  'Volvo': { query: 'Cyan Racing logo', domain: 'cyanracing.com' },
  'Polestar': { query: 'Polestar logo', domain: 'polestar.com' },
  'Saab': { query: 'Saab logo', domain: 'saabcars.com' },
  'Koenigsegg': { query: 'Koenigsegg logo', domain: 'koenigsegg.com' },
  'Pagani': { query: 'Pagani logo', domain: 'pagani.com' },
  'Bugatti': { query: 'Bugatti logo', domain: 'bugatti.com' },
  'Rimac': { query: 'Rimac Automobili logo', domain: 'rimac-automobili.com' },
  'Tesla': { query: 'Tesla logo', domain: 'tesla.com' },
  'Lucid': { query: 'Lucid Motors logo', domain: 'lucidmotors.com' },
  'Rivian': { query: 'Rivian logo', domain: 'rivian.com' },
  'Fisker': { query: 'Fisker logo', domain: 'fiskerinc.com' },
  'Karma': { query: 'Karma Automotive logo', domain: 'karmaautomotive.com' },
  'Faraday Future': { query: 'Faraday Future logo', domain: 'ff.com' },
  'Nio': { query: 'Nio logo', domain: 'nio.com' },
  'Xpeng': { query: 'Xpeng logo', domain: 'heyxpeng.com' },
  'BYD': { query: 'BYD logo', domain: 'byd.com' },
  'Geely': { query: 'Geely logo', domain: 'geely.com' },
  'Tata': { query: 'Tata Motors logo', domain: 'tatamotors.com' },
  'Mahindra': { query: 'Mahindra Racing logo', domain: 'mahindraracing.com' }
};

// Types
interface LogoResult {
  url: string;
  source: string;
  extension: string;
  score: number;
}

// Helpers
const slugify = (text: string): string => {
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
};

// --- Providers ---

// 1. WorldVectorLogo (Best for SVGs)
const searchWorldVectorLogo = async (brandName: string): Promise<LogoResult | null> => {
  try {
    const searchUrl = `https://worldvectorlogo.com/search/${encodeURIComponent(brandName)}`;
    const response = await axios.get(searchUrl, { headers: { 'User-Agent': USER_AGENT }, timeout: 5000 });
    const $ = cheerio.load(response.data);
    
    const firstLogoLink = $('.logo__img').first().attr('src');
    if (firstLogoLink) {
      return {
        url: firstLogoLink,
        source: 'WorldVectorLogo',
        extension: '.svg',
        score: 100
      };
    }
  } catch (e) {
    // Ignore errors
  }
  return null;
};

// 2. Website Scraper (Enhanced)
const scrapeWebsite = async (domain: string): Promise<LogoResult | null> => {
  try {
    const url = `https://${domain}`;
    const response = await axios.get(url, { headers: { 'User-Agent': USER_AGENT }, timeout: 8000 });
    const $ = cheerio.load(response.data);

    // Priority 1: SVG in img src
    let bestLogo: LogoResult | null = null;

    $('img').each((_, el) => {
      const src = $(el).attr('src');
      const alt = $(el).attr('alt')?.toLowerCase() || '';
      const className = $(el).attr('class')?.toLowerCase() || '';
      const id = $(el).attr('id')?.toLowerCase() || '';
      
      if (!src) return;

      const isLogo = alt.includes('logo') || className.includes('logo') || id.includes('logo');
      const isSvg = src.toLowerCase().endsWith('.svg');

      if (isLogo && isSvg) {
        bestLogo = { url: new URL(src, url).href, source: 'Website (SVG)', extension: '.svg', score: 90 };
        return false; // Break loop
      }
    });

    if (bestLogo) return bestLogo;

    // Priority 2: Open Graph Image (High Quality PNG/JPG)
    const ogImage = $('meta[property="og:image"]').attr('content');
    if (ogImage) {
      const ext = path.extname(new URL(ogImage, url).pathname).toLowerCase() || '.png';
      return { url: new URL(ogImage, url).href, source: 'Website (OG)', extension: ext, score: 60 };
    }

    // Priority 3: Icon
    const icon = $('link[rel="icon"]').attr('href') || $('link[rel="shortcut icon"]').attr('href');
    if (icon) {
       const ext = path.extname(new URL(icon, url).pathname).toLowerCase();
       if (ext === '.svg') {
         return { url: new URL(icon, url).href, source: 'Website (Favicon SVG)', extension: '.svg', score: 85 };
       }
    }

  } catch (e) {
    // Ignore
  }
  return null;
};

// 3. Clearbit (Fallback)
const checkClearbit = async (domain: string): Promise<LogoResult | null> => {
  try {
    const url = `https://logo.clearbit.com/${domain}`;
    await axios.head(url, { timeout: 3000 });
    return { url, source: 'Clearbit', extension: '.png', score: 40 };
  } catch {
    return null;
  }
};

// --- Main Logic ---

const downloadFile = async (url: string, destPath: string): Promise<boolean> => {
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer', headers: { 'User-Agent': USER_AGENT }, timeout: 10000 });
    await fs.writeFile(destPath, response.data);
    return true;
  } catch (e) {
    return false;
  }
};

const processBrand = async (name: string, override: { query: string, domain?: string }) => {
  const slug = slugify(name);
  console.log(`\n🔧 Fixing: ${name}`);

  let result: LogoResult | null = null;

  // 1. Try Domain first if provided (Most accurate)
  if (override.domain) {
    console.log(`  Trying domain: ${override.domain}`);
    result = await scrapeWebsite(override.domain);
    if (result) console.log(`  ✓ Found on Website`);
    
    if (!result) {
       result = await checkClearbit(override.domain);
       if (result) console.log(`  ✓ Found on Clearbit`);
    }
  }

  // 2. Try WorldVectorLogo with specific query
  if (!result || result.extension !== '.svg') {
    // Try searching WVL with the brand name (it's usually good)
    const wvlResult = await searchWorldVectorLogo(name);
    if (wvlResult && (!result || wvlResult.score > result.score)) {
      result = wvlResult;
      console.log(`  ✓ Found on WorldVectorLogo`);
    }
  }

  if (result) {
    const fileName = `${slug}${result.extension}`;
    const destPath = path.join(LOGO_DIR, fileName);
    const success = await downloadFile(result.url, destPath);
    if (success) {
      console.log(`  ✅ Fixed! Downloaded ${result.extension} from ${result.source}`);
      return fileName;
    } else {
      console.log(`  ❌ Failed to download from ${result.url}`);
    }
  } else {
    console.log(`  ⚠️ No logo found for ${name}`);
  }
  return null;
};

const main = async () => {
  console.log('🚀 Starting Targeted Logo Fix...');
  
  // Read existing map
  let currentMapContent = '';
  try {
    currentMapContent = await fs.readFile(BRAND_LOGOS_PATH, 'utf-8');
  } catch (e) {
    console.error("Could not read brandLogos.ts");
    return;
  }

  // Parse the map (hacky regex parsing to avoid importing the file)
  const mapRegex = /export const BRAND_LOGO_MAP: Record<string, string> = {([\s\S]*?)};/;
  const match = currentMapContent.match(mapRegex);
  if (!match) {
      console.error("Could not parse BRAND_LOGO_MAP");
      return;
  }

  const mapBody = match[1];
  const currentMap: Record<string, string> = {};
  
  mapBody.split('\n').forEach(line => {
      const lineMatch = line.match(/'(.+)': '(.+)',/);
      if (lineMatch) {
          currentMap[lineMatch[1]] = lineMatch[2];
      }
  });

  // Process Overrides
  for (const [name, override] of Object.entries(MANUAL_OVERRIDES)) {
      const fileName = await processBrand(name, override);
      if (fileName) {
          currentMap[name] = `/logos/${fileName}`;
      }
  }

  // Reconstruct File
  let fileContent = `// Auto-generated by scripts/download-logos-advanced.ts\n\n`;
  fileContent += `export const BRAND_LOGO_MAP: Record<string, string> = {\n`;
  Object.entries(currentMap).sort((a, b) => a[0].localeCompare(b[0])).forEach(([name, path]) => {
    fileContent += `  '${name.replace(/'/g, "\\'")}': '${path}',\n`;
  });
  fileContent += `};\n\n`;
  fileContent += `const NORMALIZED_BRAND_LOGO_MAP: Record<string, string> = Object.fromEntries(\n`;
  fileContent += `  Object.entries(BRAND_LOGO_MAP).map(([key, value]) => [key.toLowerCase(), value])\n`;
  fileContent += `);\n\n`;
  fileContent += `export const getBrandLogo = (brandName: string): string => {\n`;
  fileContent += `  if (!brandName) return '/logos/placeholder.svg';\n`;
  fileContent += `  const normalizedName = brandName.trim().toLowerCase();\n`;
  fileContent += `  return BRAND_LOGO_MAP[brandName] || NORMALIZED_BRAND_LOGO_MAP[normalizedName] || '/logos/placeholder.svg';\n`;
  fileContent += `};\n`;

  await fs.writeFile(BRAND_LOGOS_PATH, fileContent);
  console.log(`\n✨ Done! Map updated at ${BRAND_LOGOS_PATH}`);
};

main();
