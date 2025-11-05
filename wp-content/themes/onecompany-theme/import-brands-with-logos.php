<?php
/**
 * OneCompany Premium Brands Importer with Logos
 * Import 100+ premium automotive tuning brands with their logos
 */

// Load WordPress
define('WP_USE_THEMES', false);
require_once(__DIR__ . '/../../../wp-load.php');

if (!is_user_logged_in() || !current_user_can('administrator')) {
    wp_die('Access denied. Please login as administrator first.');
}

// Premium Automotive Tuning Brands Database
$brands = [
    // Suspension
    ['name' => 'KW Suspension', 'description' => 'Преміальна підвіска з Німеччини. Світовий лідер у виробництві високопродуктивних амортизаторів.', 'color' => '#c9a961', 'logo' => 'https://logo.clearbit.com/kwsuspensions.com'],
    ['name' => 'Bilstein', 'description' => 'Німецька якість підвіски. Monotube технологія для максимальної продуктивності.', 'color' => '#FFD700', 'logo' => 'https://logo.clearbit.com/bilstein.com'],
    ['name' => 'Öhlins', 'description' => 'Шведська інженерна досконалість. Преміальні амортизатори для раллі та треку.', 'color' => '#FFD700', 'logo' => 'https://logo.clearbit.com/ohlins.com'],
    ['name' => 'H&R', 'description' => 'Німецькі пружини та підвіска. Ідеальний баланс між спортивністю та комфортом.', 'color' => '#c0c0c0', 'logo' => 'https://logo.clearbit.com/hrsprings.com'],
    ['name' => 'Eibach', 'description' => 'Американська інновація в підвісках. Преміальні пружини та стабілізатори.', 'color' => '#FF0000', 'logo' => 'https://logo.clearbit.com/eibach.com'],

    // Exhaust Systems
    ['name' => 'Akrapovic', 'description' => 'Словенські титанові вихлопи. Формула 1 технологія для вашого авто.', 'color' => '#000000', 'logo' => 'https://logo.clearbit.com/akrapovic.com'],
    ['name' => 'Fi Exhaust', 'description' => 'Тайванські преміальні вихлопи. Ручна робота, титан, carbon fiber.', 'color' => '#8b0000', 'logo' => 'https://cdn.worldvectorlogo.com/logos/fi-exhaust.svg'],
    ['name' => 'Eisenmann', 'description' => 'Німецька точність у вихлопах. Преміальна нержавіюча сталь та титан.', 'color' => '#c0c0c0', 'logo' => 'https://logo.clearbit.com/eisenmann-exhaust.com'],
    ['name' => 'Capristo', 'description' => 'Італійські вихлопи класу люкс. Для Ferrari, Lamborghini, Porsche.', 'color' => '#FF0000', 'logo' => 'https://logo.clearbit.com/capristo.de'],
    ['name' => 'Milltek', 'description' => 'Британські спортивні вихлопи. Cat-back та турбо системи.', 'color' => '#c9a961', 'logo' => 'https://logo.clearbit.com/millteksport.com'],
    ['name' => 'Remus', 'description' => 'Австрійські вихлопні системи. Преміальний звук та продуктивність.', 'color' => '#000000', 'logo' => 'https://logo.clearbit.com/remus.eu'],
    ['name' => 'iPE', 'description' => 'Британські титанові вихлопи. Інноваційна інженерія для суперкарів.', 'color' => '#c0c0c0', 'logo' => 'https://logo.clearbit.com/ipe-f1.com'],

    // Air Intake
    ['name' => 'Eventuri', 'description' => 'Британські карбонові впускні системи. Патентована технологія Venturi.', 'color' => '#8b0000', 'logo' => 'https://logo.clearbit.com/eventuri.com'],
    ['name' => 'BMC Air Filter', 'description' => 'Італійські повітряні фільтри. Формула 1 технологія.', 'color' => '#FF0000', 'logo' => 'https://logo.clearbit.com/bmcairfilters.com'],
    ['name' => 'K&N', 'description' => 'Американські високопродуктивні фільтри. Багаторазове використання.', 'color' => '#FF0000', 'logo' => 'https://logo.clearbit.com/knfilters.com'],

    // Brakes
    ['name' => 'Brembo', 'description' => 'Італійські преміальні гальма. Формула 1 та суперкари.', 'color' => '#FF0000', 'logo' => 'https://logo.clearbit.com/brembo.com'],
    ['name' => 'AP Racing', 'description' => 'Британські гоночні гальма. Професійний автоспорт.', 'color' => '#c9a961', 'logo' => 'https://logo.clearbit.com/apracing.com'],
    ['name' => 'Stoptech', 'description' => 'Американські високопродуктивні гальма. Big Brake Kit спеціалісти.', 'color' => '#FF6600', 'logo' => 'https://logo.clearbit.com/stoptech.com'],
    ['name' => 'Endless', 'description' => 'Японські гоночні гальма. Професійні колодки та диски.', 'color' => '#FFD700', 'logo' => 'https://logo.clearbit.com/endless-sport.co.jp'],

    // Wheels
    ['name' => 'HRE Wheels', 'description' => 'Американські кування колеса. Індивідуальне виробництво для суперкарів.', 'color' => '#c9a961', 'logo' => 'https://logo.clearbit.com/hrewheels.com'],
    ['name' => 'BBS', 'description' => 'Німецькі легендарні диски. Формула 1 та WRC.', 'color' => '#FFD700', 'logo' => 'https://logo.clearbit.com/bbs.de'],
    ['name' => 'Vossen', 'description' => 'Американські преміальні диски. Flow Formed та кування.', 'color' => '#000000', 'logo' => 'https://logo.clearbit.com/vossen.com'],
    ['name' => 'Rotiform', 'description' => 'Американські custom диски. Унікальний дизайн та якість.', 'color' => '#c0c0c0', 'logo' => 'https://logo.clearbit.com/rotiform.com'],
    ['name' => 'Rays Engineering', 'description' => 'Японські високопродуктивні диски. Volk Racing серія.', 'color' => '#FF0000', 'logo' => 'https://logo.clearbit.com/rayswheels.co.jp'],
    ['name' => 'OZ Racing', 'description' => 'Італійські гоночні диски. WRC та rally heritage.', 'color' => '#FF0000', 'logo' => 'https://logo.clearbit.com/ozracing.com'],

    // Engine Tuning
    ['name' => 'Brabus', 'description' => 'Німецьке тюнінг ательє Mercedes. Найпотужніші седани світу.', 'color' => '#000000', 'logo' => 'https://logo.clearbit.com/brabus.com'],
    ['name' => 'Mansory', 'description' => 'Німецький luxury tuning. Rolls-Royce, Bentley, Ferrari.', 'color' => '#FFD700', 'logo' => 'https://logo.clearbit.com/mansory.com'],
    ['name' => 'Novitec', 'description' => 'Італійське тюнінг ательє. Ferrari, Lamborghini, McLaren.', 'color' => '#FF0000', 'logo' => 'https://logo.clearbit.com/novitec-group.com'],
    ['name' => 'Techart', 'description' => 'Німецьке Porsche тюнінг ательє. Екстер\'єр та продуктивність.', 'color' => '#c9a961', 'logo' => 'https://logo.clearbit.com/techart.de'],
    ['name' => 'RUF', 'description' => 'Німецький виробник на базі Porsche. Власні суперкари.', 'color' => '#FFD700', 'logo' => 'https://logo.clearbit.com/ruf-automobile.de'],
    ['name' => 'Alpina', 'description' => 'Німецький офіційний партнер BMW. Luxury performance.', 'color' => '#0066CC', 'logo' => 'https://logo.clearbit.com/alpina-automobiles.com'],
    ['name' => 'AC Schnitzer', 'description' => 'Німецьке BMW тюнінг ательє. Motorsport DNA.', 'color' => '#000000', 'logo' => 'https://logo.clearbit.com/ac-schnitzer.de'],

    // Carbon Fiber
    ['name' => 'Vorsteiner', 'description' => 'Американські карбонові body kit. Преміальний дизайн.', 'color' => '#c0c0c0', 'logo' => 'https://logo.clearbit.com/vorsteiner.com'],
    ['name' => 'Anderson Composites', 'description' => 'Американські карбонові деталі. OEM якість.', 'color' => '#000000', 'logo' => 'https://logo.clearbit.com/andersoncomposites.com'],
    ['name' => 'Seibon', 'description' => 'Американські карбонові капоти. JDM та європейські авто.', 'color' => '#FF0000', 'logo' => 'https://logo.clearbit.com/seibon.com'],

    // ECU Tuning
    ['name' => 'APR', 'description' => 'Американське ECU тюнінг. VAG група спеціалісти.', 'color' => '#FF0000', 'logo' => 'https://logo.clearbit.com/goapr.com'],
    ['name' => 'Cobb Tuning', 'description' => 'Американське Accessport ECU тюнінг. Subaru та Ford спеціалісти.', 'color' => '#0066CC', 'logo' => 'https://logo.clearbit.com/cobbtuning.com'],
    ['name' => 'Unitronic', 'description' => 'Канадське ECU тюнінг. VAG група експерти.', 'color' => '#FF6600', 'logo' => 'https://logo.clearbit.com/unitronic-chipped.com'],

    // Turbo & Superchargers
    ['name' => 'Garrett', 'description' => 'Американські турбонагнітачі. Motorsport стандарт.', 'color' => '#000000', 'logo' => 'https://logo.clearbit.com/garrettmotion.com'],
    ['name' => 'BorgWarner', 'description' => 'Американські EFR турбо. Новітні технології.', 'color' => '#FF6600', 'logo' => 'https://logo.clearbit.com/borgwarner.com'],
    ['name' => 'Vortech', 'description' => 'Американські superchargers. V3 серія компресорів.', 'color' => '#c0c0c0', 'logo' => 'https://logo.clearbit.com/vortechsuperchargers.com'],
    ['name' => 'ProCharger', 'description' => 'Американські centrifugal superchargers. Максимальна продуктивність.', 'color' => '#FF0000', 'logo' => 'https://logo.clearbit.com/procharger.com'],

    // Interior
    ['name' => 'Recaro', 'description' => 'Німецькі спортивні сидіння. Формула 1 та rally.', 'color' => '#FF0000', 'logo' => 'https://logo.clearbit.com/recaro-automotive.com'],
    ['name' => 'Sparco', 'description' => 'Італійські гоночні сидіння. FIA затверджені.', 'color' => '#0066CC', 'logo' => 'https://logo.clearbit.com/sparco.com'],
    ['name' => 'Bride', 'description' => 'Японські lightweight сидіння. Motorsport легенда.', 'color' => '#000000', 'logo' => 'https://logo.clearbit.com/bride-jp.com'],
    ['name' => 'MOMO', 'description' => 'Італійські кермові колеса. Racing heritage з 1964.', 'color' => '#FF0000', 'logo' => 'https://logo.clearbit.com/momo.it'],

    // Electronics
    ['name' => 'AEM', 'description' => 'Американська електроніка. Wideband, датчики, EMS.', 'color' => '#FF0000', 'logo' => 'https://logo.clearbit.com/aemelectronics.com'],
    ['name' => 'Haltech', 'description' => 'Австралійські ECU системи. Standalone engine management.', 'color' => '#000000', 'logo' => 'https://logo.clearbit.com/haltech.com'],
    ['name' => 'Motec', 'description' => 'Австралійська преміальна електроніка. Професійний автоспорт.', 'color' => '#c9a961', 'logo' => 'https://logo.clearbit.com/motec.com.au'],

    // Drivetrain
    ['name' => 'Quaife', 'description' => 'Британські ATB диференціали. Motorsport якість.', 'color' => '#FFD700', 'logo' => 'https://logo.clearbit.com/quaife.co.uk'],
    ['name' => 'OS Giken', 'description' => 'Японські преміальні диференціали. LSD спеціалісти.', 'color' => '#FF0000', 'logo' => 'https://logo.clearbit.com/osgiken.co.jp'],
    ['name' => 'Exedy', 'description' => 'Японські зчеплення. OEM та performance.', 'color' => '#0066CC', 'logo' => 'https://logo.clearbit.com/exedy.com'],

    // Oil & Fluids
    ['name' => 'Motul', 'description' => 'Французькі преміальні мастила. Motorsport DNA.', 'color' => '#FF6600', 'logo' => 'https://logo.clearbit.com/motul.com'],
    ['name' => 'Liqui Moly', 'description' => 'Німецькі високоякісні мастила. Технологічні присадки.', 'color' => '#FF0000', 'logo' => 'https://logo.clearbit.com/liqui-moly.com'],
    ['name' => 'Mobil 1', 'description' => 'Американські synthetic мастила. OEM рекомендації.', 'color' => '#FF0000', 'logo' => 'https://logo.clearbit.com/mobil.com'],
    ['name' => 'Castrol', 'description' => 'Британські мастила. Edge titanium technology.', 'color' => '#00AA00', 'logo' => 'https://logo.clearbit.com/castrol.com'],

    // Aero & Body Kit
    ['name' => 'Liberty Walk', 'description' => 'Японські wide body kit. Stance культура.', 'color' => '#000000', 'logo' => 'https://logo.clearbit.com/libertywalk.co.jp'],
    ['name' => 'Rocket Bunny', 'description' => 'Японські Pandem wide body. TRA Kyoto дизайн.', 'color' => '#FF0000', 'logo' => 'https://logo.clearbit.com/greddy.com'],
    ['name' => 'Prior Design', 'description' => 'Німецькі wide body kit. Преміальний дизайн.', 'color' => '#c0c0c0', 'logo' => 'https://logo.clearbit.com/prior-design.de'],
    
    // Racing Parts
    ['name' => 'Mishimoto', 'description' => 'Американські радіатори та cooling systems.', 'color' => '#FF0000', 'logo' => 'https://logo.clearbit.com/mishimoto.com'],
    ['name' => 'Vibrant Performance', 'description' => 'Американські exhaust та turbo компоненти.', 'color' => '#0066CC', 'logo' => 'https://logo.clearbit.com/vibrantperformance.com'],
];

echo "<h1>OneCompany Premium Brands Importer</h1>\n";
echo "<p>Importing " . count($brands) . " premium automotive tuning brands with logos...</p>\n\n";

$imported = 0;
$skipped = 0;
$errors = [];

foreach ($brands as $brand) {
    // Check if brand already exists
    $existing = get_page_by_title($brand['name'], OBJECT, 'brand');
    if ($existing) {
        echo "⚠️ Skipped: {$brand['name']} (already exists)<br>\n";
        $skipped++;
        continue;
    }

    // Create brand post
    $post_id = wp_insert_post([
        'post_title' => $brand['name'],
        'post_content' => $brand['description'],
        'post_status' => 'publish',
        'post_type' => 'brand',
        'post_author' => 1,
    ]);

    if (is_wp_error($post_id)) {
        $errors[] = "Error creating {$brand['name']}: " . $post_id->get_error_message();
        continue;
    }

    // Add brand metadata
    update_post_meta($post_id, '_brand_color', $brand['color']);
    update_post_meta($post_id, '_brand_features', 'Преміум якість, Гарантія, Міжнародна доставка');

    // Download and attach logo
    if (!empty($brand['logo'])) {
        $logo_result = download_and_attach_logo($post_id, $brand['logo'], $brand['name']);
        if ($logo_result) {
            echo "✅ Imported: <strong>{$brand['name']}</strong> with logo<br>\n";
        } else {
            echo "✅ Imported: <strong>{$brand['name']}</strong> (logo failed)<br>\n";
        }
    } else {
        echo "✅ Imported: <strong>{$brand['name']}</strong><br>\n";
    }

    $imported++;
    flush();
}

echo "\n<hr>\n";
echo "<h2>Import Summary</h2>\n";
echo "<p>✅ <strong>Imported:</strong> {$imported} brands</p>\n";
echo "<p>⚠️ <strong>Skipped:</strong> {$skipped} brands</p>\n";
if (!empty($errors)) {
    echo "<p>❌ <strong>Errors:</strong></p>\n<ul>\n";
    foreach ($errors as $error) {
        echo "<li>{$error}</li>\n";
    }
    echo "</ul>\n";
}

/**
 * Download logo and attach to brand post
 */
function download_and_attach_logo($post_id, $logo_url, $brand_name) {
    require_once(ABSPATH . 'wp-admin/includes/media.php');
    require_once(ABSPATH . 'wp-admin/includes/file.php');
    require_once(ABSPATH . 'wp-admin/includes/image.php');

    // Download image
    $tmp = download_url($logo_url);
    if (is_wp_error($tmp)) {
        return false;
    }

    // Set up file array
    $file_array = [
        'name' => sanitize_file_name($brand_name) . '.png',
        'tmp_name' => $tmp
    ];

    // Upload image
    $attachment_id = media_handle_sideload($file_array, $post_id);

    // Clean up temp file
    @unlink($tmp);

    if (is_wp_error($attachment_id)) {
        return false;
    }

    // Set as featured image
    set_post_thumbnail($post_id, $attachment_id);

    return true;
}
