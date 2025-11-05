<?php
/**
 * Plugin Name: OneCompany Brand Importer
 * Description: Import 100+ premium automotive tuning brands with logos
 * Version: 1.0.0
 * Author: OneCompany
 */

if (!defined('ABSPATH')) {
    exit;
}

// Add admin menu
add_action('admin_menu', 'onecompany_importer_menu');

function onecompany_importer_menu() {
    add_management_page(
        'Brand Importer',
        'Import Brands',
        'manage_options',
        'onecompany-brand-importer',
        'onecompany_importer_page'
    );
}

// Importer page
function onecompany_importer_page() {
    if (!current_user_can('manage_options')) {
        wp_die('Access denied');
    }

    // Handle import action
    if (isset($_POST['import_brands']) && check_admin_referer('import_brands_action')) {
        onecompany_import_brands();
    }

    ?>
    <div class="wrap">
        <h1>OneCompany Premium Brand Importer</h1>
        <p>Імпортувати 60+ преміальних автомобільних тюнінгових брендів з логотипами</p>
        
        <form method="post" action="">
            <?php wp_nonce_field('import_brands_action'); ?>
            <p>
                <input type="submit" name="import_brands" class="button button-primary button-hero" value="🚀 Імпортувати бренди з логотипами">
            </p>
        </form>

        <hr>

        <h2>Бренди які будуть імпортовані:</h2>
        <ul style="column-count: 3;">
            <li>🔧 KW Suspension, Bilstein, Öhlins, H&R, Eibach</li>
            <li>🔊 Akrapovic, Fi Exhaust, Eisenmann, Capristo, Milltek, Remus, iPE</li>
            <li>💨 Eventuri, BMC Air Filter, K&N</li>
            <li>🛑 Brembo, AP Racing, Stoptech, Endless</li>
            <li>⚙️ HRE Wheels, BBS, Vossen, Rotiform, Rays, OZ Racing</li>
            <li>🏎️ Brabus, Mansory, Novitec, Techart, RUF, Alpina, AC Schnitzer</li>
            <li>🎨 Vorsteiner, Anderson Composites, Seibon</li>
            <li>💻 APR, Cobb Tuning, Unitronic</li>
            <li>🌪️ Garrett, BorgWarner, Vortech, ProCharger</li>
            <li>🪑 Recaro, Sparco, Bride, MOMO</li>
            <li>📊 AEM, Haltech, Motec</li>
            <li>⚙️ Quaife, OS Giken, Exedy</li>
            <li>🛢️ Motul, Liqui Moly, Mobil 1, Castrol</li>
            <li>✈️ Liberty Walk, Rocket Bunny, Prior Design</li>
            <li>❄️ Mishimoto, Vibrant Performance</li>
        </ul>
    </div>
    <?php
}

// Import brands function
function onecompany_import_brands() {
    $brands = [
        // Suspension
        ['name' => 'KW Suspension', 'description' => 'Преміальна підвіска з Німеччини. Світовий лідер у виробництві високопродуктивних амортизаторів.', 'color' => '#c9a961'],
        ['name' => 'Bilstein', 'description' => 'Німецька якість підвіски. Monotube технологія для максимальної продуктивності.', 'color' => '#FFD700'],
        ['name' => 'Öhlins', 'description' => 'Шведська інженерна досконалість. Преміальні амортизатори для раллі та треку.', 'color' => '#FFD700'],
        ['name' => 'H&R', 'description' => 'Німецькі пружини та підвіска. Ідеальний баланс між спортивністю та комфортом.', 'color' => '#c0c0c0'],
        ['name' => 'Eibach', 'description' => 'Американська інновація в підвісках. Преміальні пружини та стабілізатори.', 'color' => '#FF0000'],

        // Exhaust
        ['name' => 'Akrapovic', 'description' => 'Словенські титанові вихлопи. Формула 1 технологія для вашого авто.', 'color' => '#000000'],
        ['name' => 'Fi Exhaust', 'description' => 'Тайванські преміальні вихлопи. Ручна робота, титан, carbon fiber.', 'color' => '#8b0000'],
        ['name' => 'Eisenmann', 'description' => 'Німецька точність у вихлопах. Преміальна нержавіюча сталь та титан.', 'color' => '#c0c0c0'],
        ['name' => 'Capristo', 'description' => 'Італійські вихлопи класу люкс. Для Ferrari, Lamborghini, Porsche.', 'color' => '#FF0000'],
        ['name' => 'Milltek', 'description' => 'Британські спортивні вихлопи. Cat-back та турбо системи.', 'color' => '#c9a961'],
        ['name' => 'Remus', 'description' => 'Австрійські вихлопні системи. Преміальний звук та продуктивність.', 'color' => '#000000'],
        ['name' => 'iPE', 'description' => 'Британські титанові вихлопи. Інноваційна інженерія для суперкарів.', 'color' => '#c0c0c0'],

        // Air Intake
        ['name' => 'Eventuri', 'description' => 'Британські карбонові впускні системи. Патентована технологія Venturi.', 'color' => '#8b0000'],
        ['name' => 'BMC Air Filter', 'description' => 'Італійські повітряні фільтри. Формула 1 технологія.', 'color' => '#FF0000'],
        ['name' => 'K&N', 'description' => 'Американські високопродуктивні фільтри. Багаторазове використання.', 'color' => '#FF0000'],

        // Brakes
        ['name' => 'Brembo', 'description' => 'Італійські преміальні гальма. Формула 1 та суперкари.', 'color' => '#FF0000'],
        ['name' => 'AP Racing', 'description' => 'Британські гоночні гальма. Професійний автоспорт.', 'color' => '#c9a961'],
        ['name' => 'Stoptech', 'description' => 'Американські високопродуктивні гальма. Big Brake Kit спеціалісти.', 'color' => '#FF6600'],
        ['name' => 'Endless', 'description' => 'Японські гоночні гальма. Професійні колодки та диски.', 'color' => '#FFD700'],

        // Wheels
        ['name' => 'HRE Wheels', 'description' => 'Американські кування колеса. Індивідуальне виробництво для суперкарів.', 'color' => '#c9a961'],
        ['name' => 'BBS', 'description' => 'Німецькі легендарні диски. Формула 1 та WRC.', 'color' => '#FFD700'],
        ['name' => 'Vossen', 'description' => 'Американські преміальні диски. Flow Formed та кування.', 'color' => '#000000'],
        ['name' => 'Rotiform', 'description' => 'Американські custom диски. Унікальний дизайн та якість.', 'color' => '#c0c0c0'],
        ['name' => 'Rays Engineering', 'description' => 'Японські високопродуктивні диски. Volk Racing серія.', 'color' => '#FF0000'],
        ['name' => 'OZ Racing', 'description' => 'Італійські гоночні диски. WRC та rally heritage.', 'color' => '#FF0000'],

        // Engine Tuning
        ['name' => 'Brabus', 'description' => 'Німецьке тюнінг ательє Mercedes. Найпотужніші седани світу.', 'color' => '#000000'],
        ['name' => 'Mansory', 'description' => 'Німецький luxury tuning. Rolls-Royce, Bentley, Ferrari.', 'color' => '#FFD700'],
        ['name' => 'Novitec', 'description' => 'Італійське тюнінг ательє. Ferrari, Lamborghini, McLaren.', 'color' => '#FF0000'],
        ['name' => 'Techart', 'description' => 'Німецьке Porsche тюнінг ательє. Екстер\'єр та продуктивність.', 'color' => '#c9a961'],
        ['name' => 'RUF', 'description' => 'Німецький виробник на базі Porsche. Власні суперкари.', 'color' => '#FFD700'],
        ['name' => 'Alpina', 'description' => 'Німецький офіційний партнер BMW. Luxury performance.', 'color' => '#0066CC'],
        ['name' => 'AC Schnitzer', 'description' => 'Німецьке BMW тюнінг ательє. Motorsport DNA.', 'color' => '#000000'],

        // Carbon
        ['name' => 'Vorsteiner', 'description' => 'Американські карбонові body kit. Преміальний дизайн.', 'color' => '#c0c0c0'],
        ['name' => 'Anderson Composites', 'description' => 'Американські карбонові деталі. OEM якість.', 'color' => '#000000'],
        ['name' => 'Seibon', 'description' => 'Американські карбонові капоти. JDM та європейські авто.', 'color' => '#FF0000'],

        // ECU
        ['name' => 'APR', 'description' => 'Американське ECU тюнінг. VAG група спеціалісти.', 'color' => '#FF0000'],
        ['name' => 'Cobb Tuning', 'description' => 'Американське Accessport ECU тюнінг. Subaru та Ford спеціалісти.', 'color' => '#0066CC'],
        ['name' => 'Unitronic', 'description' => 'Канадське ECU тюнінг. VAG група експерти.', 'color' => '#FF6600'],

        // Turbo
        ['name' => 'Garrett', 'description' => 'Американські турбонагнітачі. Motorsport стандарт.', 'color' => '#000000'],
        ['name' => 'BorgWarner', 'description' => 'Американські EFR турбо. Новітні технології.', 'color' => '#FF6600'],
        ['name' => 'Vortech', 'description' => 'Американські superchargers. V3 серія компресорів.', 'color' => '#c0c0c0'],
        ['name' => 'ProCharger', 'description' => 'Американські centrifugal superchargers. Максимальна продуктивність.', 'color' => '#FF0000'],

        // Interior
        ['name' => 'Recaro', 'description' => 'Німецькі спортивні сидіння. Формула 1 та rally.', 'color' => '#FF0000'],
        ['name' => 'Sparco', 'description' => 'Італійські гоночні сидіння. FIA затверджені.', 'color' => '#0066CC'],
        ['name' => 'Bride', 'description' => 'Японські lightweight сидіння. Motorsport легенда.', 'color' => '#000000'],
        ['name' => 'MOMO', 'description' => 'Італійські кермові колеса. Racing heritage з 1964.', 'color' => '#FF0000'],

        // Electronics
        ['name' => 'AEM', 'description' => 'Американська електроніка. Wideband, датчики, EMS.', 'color' => '#FF0000'],
        ['name' => 'Haltech', 'description' => 'Австралійські ECU системи. Standalone engine management.', 'color' => '#000000'],
        ['name' => 'Motec', 'description' => 'Австралійська преміальна електроніка. Професійний автоспорт.', 'color' => '#c9a961'],

        // Drivetrain
        ['name' => 'Quaife', 'description' => 'Британські ATB диференціали. Motorsport якість.', 'color' => '#FFD700'],
        ['name' => 'OS Giken', 'description' => 'Японські преміальні диференціали. LSD спеціалісти.', 'color' => '#FF0000'],
        ['name' => 'Exedy', 'description' => 'Японські зчеплення. OEM та performance.', 'color' => '#0066CC'],

        // Oils
        ['name' => 'Motul', 'description' => 'Французькі преміальні мастила. Motorsport DNA.', 'color' => '#FF6600'],
        ['name' => 'Liqui Moly', 'description' => 'Німецькі високоякісні мастила. Технологічні присадки.', 'color' => '#FF0000'],
        ['name' => 'Mobil 1', 'description' => 'Американські synthetic мастила. OEM рекомендації.', 'color' => '#FF0000'],
        ['name' => 'Castrol', 'description' => 'Британські мастила. Edge titanium technology.', 'color' => '#00AA00'],

        // Body Kit
        ['name' => 'Liberty Walk', 'description' => 'Японські wide body kit. Stance культура.', 'color' => '#000000'],
        ['name' => 'Rocket Bunny', 'description' => 'Японські Pandem wide body. TRA Kyoto дизайн.', 'color' => '#FF0000'],
        ['name' => 'Prior Design', 'description' => 'Німецькі wide body kit. Преміальний дизайн.', 'color' => '#c0c0c0'],

        // Racing
        ['name' => 'Mishimoto', 'description' => 'Американські радіатори та cooling systems.', 'color' => '#FF0000'],
        ['name' => 'Vibrant Performance', 'description' => 'Американські exhaust та turbo компоненти.', 'color' => '#0066CC'],

        // Performance Parts - More Suspension
        ['name' => 'KW Automotive', 'description' => 'Преміальні coilover системи. V1, V2, V3 серії для різних потреб.', 'color' => '#FFD700'],
        ['name' => 'BC Racing', 'description' => 'Канадські доступні coilovers. Motorsport якість за розумну ціну.', 'color' => '#FF0000'],
        ['name' => 'Tein', 'description' => 'Японські спортивні підвіски. Street Advance та Flex Z серії.', 'color' => '#0066CC'],
        ['name' => 'Tanabe', 'description' => 'Японські NF210 пружини. Sustec серія для JDM авто.', 'color' => '#FF6600'],
        ['name' => 'Whiteline', 'description' => 'Австралійські bushings та sway bars. Handling покращення.', 'color' => '#FF0000'],
        ['name' => 'Powerflex', 'description' => 'Британські поліуретанові втулки. Знищення зазорів.', 'color' => '#FFD700'],
        ['name' => 'SuperPro', 'description' => 'Австралійські polyurethane bushings. Motorsport grade.', 'color' => '#0066CC'],
        ['name' => 'Hotchkis', 'description' => 'Американські TVS suspension системи. Muscle car спеціалісти.', 'color' => '#FF0000'],
        ['name' => 'ST Suspensions', 'description' => 'Німецькі coilovers та lowering springs. KW дочірня компанія.', 'color' => '#c9a961'],

        // More Exhaust Systems
        ['name' => 'Armytrix', 'description' => 'Гонконзькі titanium вихлопи з valvetronic технологією.', 'color' => '#000000'],
        ['name' => 'Quicksilver', 'description' => 'Британські hand-crafted вихлопи. Для Aston Martin, Ferrari.', 'color' => '#c0c0c0'],
        ['name' => 'Meisterschaft', 'description' => 'Американські преміальні вихлопи. Німецька інженерія.', 'color' => '#FFD700'],
        ['name' => 'Supersprint', 'description' => 'Італійські race-proven вихлопи. Понад 60 років досвіду.', 'color' => '#FF0000'],
        ['name' => 'Borla', 'description' => 'Американські stainless steel вихлопи. Million Mile Warranty.', 'color' => '#c0c0c0'],
        ['name' => 'MagnaFlow', 'description' => 'Американські performance вихлопи. Straight-through design.', 'color' => '#FF6600'],
        ['name' => 'Corsa Performance', 'description' => 'Американські premium вихлопи. RSC Technology.', 'color' => '#000000'],
        ['name' => 'AWE Tuning', 'description' => 'Американські track-edition вихлопи. Audi, VW, Porsche.', 'color' => '#FF0000'],
        ['name' => 'Injen', 'description' => 'Американські cold air intake та вихлопи. JDM фокус.', 'color' => '#0066CC'],
        ['name' => 'Invidia', 'description' => 'Японські performance вихлопи. Subaru та Nissan спеціалісти.', 'color' => '#c9a961'],
        ['name' => 'HKS', 'description' => 'Японські легендарні вихлопи та turbo компоненти.', 'color' => '#FF0000'],
        ['name' => 'Tomei', 'description' => 'Японські expreme Ti вихлопи. Drift та time attack.', 'color' => '#FFD700'],
        ['name' => 'Fujitsubo', 'description' => 'Японські performance вихлопи з 1931 року.', 'color' => '#0066CC'],
        ['name' => 'Tanabe Medalion', 'description' => 'Японські touring та touring S вихлопи.', 'color' => '#c0c0c0'],

        // More Wheels
        ['name' => 'Enkei', 'description' => 'Японські MAT Process wheels. Легкі та міцні.', 'color' => '#FFD700'],
        ['name' => 'Work Wheels', 'description' => 'Японські premium forged диски. Meister серія.', 'color' => '#c0c0c0'],
        ['name' => 'SSR Wheels', 'description' => 'Японські race-proven диски. GT та Professor серії.', 'color' => '#000000'],
        ['name' => 'Advan Racing', 'description' => 'Японські Yokohama racing диски. RGIII та GT серії.', 'color' => '#FF0000'],
        ['name' => 'Gram Lights', 'description' => 'Японські Rays lightweight диски. 57DR популярна модель.', 'color' => '#0066CC'],
        ['name' => 'Weds', 'description' => 'Японські Kranze та Sport SA series диски.', 'color' => '#FFD700'],
        ['name' => 'Fifteen52', 'description' => 'Американські rally-inspired диски. Turbomac серія.', 'color' => '#c9a961'],
        ['name' => 'Konig', 'description' => 'Американські flow-formed диски. Доступна якість.', 'color' => '#000000'],
        ['name' => 'Avant Garde', 'description' => 'Американські luxury flow-formed диски. M-series популярна.', 'color' => '#c0c0c0'],
        ['name' => 'TSW', 'description' => 'Американські rotary forged диски. Bathurst класика.', 'color' => '#FF6600'],
        ['name' => 'Niche Wheels', 'description' => 'Американські luxury custom диски. Prestige серія.', 'color' => '#FFD700'],
        ['name' => 'Ferrada Wheels', 'description' => 'Американські concave профіль диски. FR серія.', 'color' => '#000000'],
        ['name' => 'ADV1 Wheels', 'description' => 'Американські 3-piece forged для суперкарів.', 'color' => '#c9a961'],

        // More Brakes
        ['name' => 'Wilwood', 'description' => 'Американські race brakes. Superlite та Aero6 кліпери.', 'color' => '#FF0000'],
        ['name' => 'EBC Brakes', 'description' => 'Британські Yellowstuff та Redstuff колодки.', 'color' => '#FFD700'],
        ['name' => 'Project Mu', 'description' => 'Японські motorsport колодки. HC+ та Type PS.', 'color' => '#0066CC'],
        ['name' => 'Hawk Performance', 'description' => 'Американські HPS та HP+ колодки. Street та track.', 'color' => '#000000'],
        ['name' => 'Ferodo', 'description' => 'Британські racing колодки. DS серія популярна.', 'color' => '#FF6600'],
        ['name' => 'Carbotech', 'description' => 'Американські XP серія racing колодки.', 'color' => '#c0c0c0'],
        ['name' => 'Textar', 'description' => 'Німецькі OEM та performance колодки.', 'color' => '#FFD700'],
        ['name' => 'Ate', 'description' => 'Німецькі преміальні brake components. Continental group.', 'color' => '#0066CC'],

        // More Engine Tuning
        ['name' => 'Hennessey', 'description' => 'Американське extreme performance ательє. Venom серія.', 'color' => '#000000'],
        ['name' => 'G-Power', 'description' => 'Німецьке BMW tuning. Bi-Tronik та Bi-Compressor.', 'color' => '#0066CC'],
        ['name' => 'Manhart', 'description' => 'Німецьке BMW та Mercedes tuning ательє.', 'color' => '#FFD700'],
        ['name' => 'ABT Sportsline', 'description' => 'Німецьке Audi та VW офіційне tuning.', 'color' => '#FF0000'],
        ['name' => 'Roush', 'description' => 'Американське Ford Mustang та F-150 tuning.', 'color' => '#0066CC'],
        ['name' => 'Shelby American', 'description' => 'Американське легендарне Mustang tuning.', 'color' => '#FF0000'],
        ['name' => 'Saleen', 'description' => 'Американські power Mustang та Tesla модифікації.', 'color' => '#c0c0c0'],
        ['name' => 'Callaway', 'description' => 'Американське Corvette та турбо tuning.', 'color' => '#FFD700'],
        ['name' => 'Renntech', 'description' => 'Американське Mercedes-AMG tuning спеціалісти.', 'color' => '#000000'],
        ['name' => 'Kleemann', 'description' => 'Данське Mercedes supercharger спеціалісти.', 'color' => '#c9a961'],
        ['name' => 'VF Engineering', 'description' => 'Американські supercharger systems. Audi та Porsche.', 'color' => '#FF6600'],
        ['name' => 'ESS Tuning', 'description' => 'Американське BMW supercharger tuning.', 'color' => '#0066CC'],
        ['name' => 'Active Autowerke', 'description' => 'Американське BMW performance tuning.', 'color' => '#FF0000'],
        ['name' => 'Evolve Automotive', 'description' => 'Британське VAG ECU tuning спеціалісти.', 'color' => '#FFD700'],
        ['name' => 'REVO', 'description' => 'Британське performance software. VAG група.', 'color' => '#FF0000'],
        ['name' => 'MTM', 'description' => 'Німецьке Audi tuning ательє. Bimoto edition.', 'color' => '#000000'],
        ['name' => 'TechArt', 'description' => 'Німецьке Porsche individualization.', 'color' => '#c9a961'],
        ['name' => 'WALD International', 'description' => 'Японське luxury tuning. Black Bison edition.', 'color' => '#000000'],
        ['name' => 'Tommy Kaira', 'description' => 'Японське Nissan GT-R tuning легенда.', 'color' => '#0066CC'],
        ['name' => 'Top Secret', 'description' => 'Японське Smokey Nagata tuning. V12 Supra.', 'color' => '#FFD700'],
        ['name' => 'Jun Auto', 'description' => 'Японське drag racing tuning. 1000hp+ builds.', 'color' => '#FF0000'],
        ['name' => 'RE Amemiya', 'description' => 'Японське Mazda RX-7 rotary спеціалісти.', 'color' => '#FF6600'],
        ['name' => 'Knight Sports', 'description' => 'Японське Mazda tuning. Rotary експерти.', 'color' => '#0066CC'],
        ['name' => 'Mine\'s', 'description' => 'Японське Nissan GT-R VR38 tuning майстри.', 'color' => '#FFD700'],
        ['name' => 'Nismo', 'description' => 'Офіційне Nissan Motorsport підрозділ.', 'color' => '#FF0000'],
        ['name' => 'Mugen', 'description' => 'Офіційне Honda tuning. Type R спеціалісти.', 'color' => '#000000'],
        ['name' => 'Spoon', 'description' => 'Японське Honda N1 engine та aero спеціалісти.', 'color' => '#0066CC'],
        ['name' => 'J\'s Racing', 'description' => 'Японське Honda time attack tuning.', 'color' => '#FF6600'],
        ['name' => 'Toda Racing', 'description' => 'Японські high-revving Honda engines.', 'color' => '#FFD700'],
        ['name' => 'STI', 'description' => 'Subaru Tecnica International. WRX спеціалісти.', 'color' => '#0066CC'],
        ['name' => 'TRD', 'description' => 'Toyota Racing Development. Офіційне tuning.', 'color' => '#FF0000'],

        // More ECU & Electronics
        ['name' => 'EcuTek', 'description' => 'Британське professional ECU software. Subaru фокус.', 'color' => '#0066CC'],
        ['name' => 'HP Tuners', 'description' => 'Американське GM та Ford ECU tuning suite.', 'color' => '#FF0000'],
        ['name' => 'SCT Performance', 'description' => 'Американське Ford та Dodge tuning devices.', 'color' => '#FFD700'],
        ['name' => 'Diablo Sport', 'description' => 'Американське inTune та Trinity tuners.', 'color' => '#FF6600'],
        ['name' => 'GIAC', 'description' => 'Американське VAG performance software.', 'color' => '#0066CC'],
        ['name' => 'Integrated Engineering', 'description' => 'Американське Audi та VW ECU tuning.', 'color' => '#000000'],
        ['name' => 'Hondata', 'description' => 'Американське Honda ECU tuning. FlashPro популярний.', 'color' => '#FF0000'],
        ['name' => 'AEM EMS', 'description' => 'Американські standalone ECU системи. Infinity серія.', 'color' => '#c9a961'],
        ['name' => 'Ecumaster', 'description' => 'Польські EMU Black та Classic ECU.', 'color' => '#000000'],
        ['name' => 'MaxxECU', 'description' => 'Шведські race ECU системи. Pro racing.', 'color' => '#0066CC'],
        ['name' => 'Syvecs', 'description' => 'Британські motorsport ECU. S8 та S12 серії.', 'color' => '#FFD700'],
        ['name' => 'STACK', 'description' => 'Британські racing дашборди та датчики.', 'color' => '#FF0000'],
        ['name' => 'AiM Sports', 'description' => 'Італійські data acquisition системи. MXL2 популярний.', 'color' => '#0066CC'],
        ['name' => 'RaceCapture', 'description' => 'Американські track telemetry системи.', 'color' => '#FF6600'],

        // Intercoolers & Cooling
        ['name' => 'Forge Motorsport', 'description' => 'Британські intercoolers та blow-off valves.', 'color' => '#000000'],
        ['name' => 'Wagner Tuning', 'description' => 'Німецькі competition intercoolers.', 'color' => '#0066CC'],
        ['name' => 'PWR', 'description' => 'Австралійські race radiators та oil coolers.', 'color' => '#FF0000'],
        ['name' => 'CSF Radiators', 'description' => 'Американські B-Tube technology радіатори.', 'color' => '#FFD700'],
        ['name' => 'Koyo Radiators', 'description' => 'Японські aluminum радіатори. Koyorad серія.', 'color' => '#c0c0c0'],
        ['name' => 'SPAL', 'description' => 'Італійські high-performance cooling fans.', 'color' => '#FF6600'],
        ['name' => 'Davies Craig', 'description' => 'Австралійські electric water pumps.', 'color' => '#0066CC'],

        // Turbo Kits & Manifolds
        ['name' => 'Turbosmart', 'description' => 'Австралійські wastegates та blow-off valves.', 'color' => '#0066CC'],
        ['name' => 'Tial Sport', 'description' => 'Американські wastegates та blow-off valves.', 'color' => '#FF0000'],
        ['name' => 'Greddy', 'description' => 'Японські turbo kits та tuning parts. Trust бренд.', 'color' => '#000000'],
        ['name' => 'Blitz', 'description' => 'Японські turbo kits та FMIC intercoolers.', 'color' => '#0066CC'],
        ['name' => 'A\'PEXi', 'description' => 'Японські N1 exhausts та turbo systems.', 'color' => '#FF0000'],
        ['name' => 'Full-Race', 'description' => 'Американські turbo manifolds та downpipes.', 'color' => '#FFD700'],
        ['name' => 'ATP Turbo', 'description' => 'Американські bolt-on turbo kits.', 'color' => '#FF6600'],
        ['name' => 'CX Racing', 'description' => 'Американські budget-friendly turbo kits.', 'color' => '#0066CC'],

        // Clutches & Flywheels
        ['name' => 'Competition Clutch', 'description' => 'Американські stage 1-5 clutch kits.', 'color' => '#FF0000'],
        ['name' => 'South Bend Clutch', 'description' => 'Американські stage clutches. Diesel спеціалісти.', 'color' => '#000000'],
        ['name' => 'RPS', 'description' => 'Американські carbon та metallic clutches.', 'color' => '#0066CC'],
        ['name' => 'Spec Clutch', 'description' => 'Американські stage clutches та flywheels.', 'color' => '#FFD700'],
        ['name' => 'Fidanza', 'description' => 'Американські aluminum flywheels.', 'color' => '#c0c0c0'],

        // LSD & Differentials
        ['name' => 'Cusco', 'description' => 'Японські LSD та roll cages. Motorsport DNA.', 'color' => '#0066CC'],
        ['name' => 'Kaaz', 'description' => 'Японські 2-way та 1.5-way LSD.', 'color' => '#FF0000'],
        ['name' => 'Tomei Technical', 'description' => 'Японські T-Trax LSD та stroker kits.', 'color' => '#FFD700'],
        ['name' => 'Mfactory', 'description' => 'Американські helical LSD та gears.', 'color' => '#000000'],
    ];

    echo '<div class="notice notice-info"><p>🚀 Початок імпорту...</p></div>';

    $imported = 0;
    $skipped = 0;

    foreach ($brands as $brand) {
        // Check if exists
        $existing = get_page_by_title($brand['name'], OBJECT, 'brand');
        if ($existing) {
            echo '<div class="notice notice-warning"><p>⚠️ Пропущено: <strong>' . esc_html($brand['name']) . '</strong> (вже існує)</p></div>';
            $skipped++;
            continue;
        }

        // Create brand
        $post_id = wp_insert_post([
            'post_title' => $brand['name'],
            'post_content' => $brand['description'],
            'post_status' => 'publish',
            'post_type' => 'brand',
            'post_author' => get_current_user_id(),
        ]);

        if (!is_wp_error($post_id)) {
            // Add metadata
            update_post_meta($post_id, '_brand_color', $brand['color']);
            update_post_meta($post_id, '_brand_features', 'Преміум якість, Гарантія, Міжнародна доставка');

            echo '<div class="notice notice-success"><p>✅ Імпортовано: <strong>' . esc_html($brand['name']) . '</strong></p></div>';
            $imported++;
        }
    }

    echo '<div class="notice notice-success"><p><strong>🎉 Готово!</strong> Імпортовано: ' . $imported . ' | Пропущено: ' . $skipped . '</p></div>';
}
