<?php
/**
 * Plugin Name: OneCompany Brand Importer (Premium)
 * Description: Import 100+ premium automotive tuning brands with placeholder images and rich metadata.
 * Version: 2.1.0
 * Author: OneCompany
 */

if (!defined('ABSPATH')) exit;

class OneCompany_Brand_Importer {
    public function __construct() {
        add_action('admin_menu', [$this, 'add_importer_page']);
    }

    public function add_importer_page() {
        add_management_page(
            'OneCompany Brand Importer',
            'Import Brands',
            'manage_options',
            'onecompany-brand-importer',
            [$this, 'render_importer_page']
        );
    }

    public function render_importer_page() {
        ?>
        <div class="wrap">
            <h1>OneCompany Premium Brand Importer</h1>
            <p>Цей інструмент дозволяє імпортувати понад 100 преміальних автомобільних брендів з демо-даними, включаючи логотипи-заглушки та метадані.</p>

            <?php
            if (isset($_POST['import_brands_nonce']) && wp_verify_nonce($_POST['import_brands_nonce'], 'onecompany_import_brands_action')) {
                $this->execute_import();
            }
            ?>

            <form method="post" action="">
                <?php wp_nonce_field('onecompany_import_brands_action', 'import_brands_nonce'); ?>
                <p>
                    <button type="submit" class="button button-primary button-hero">🚀 Імпортувати 100+ Брендів</button>
                </p>
            </form>
            <hr>
            <h2>Бренди, що будуть імпортовані:</h2>
             <p>KW Suspension, Bilstein, Akrapovic, Fi Exhaust, Eventuri, Brembo, HRE Wheels, Brabus, Vorsteiner, APR, Recaro та багато інших.</p>
        </div>
        <?php
    }

    private function execute_import() {
        // Increase execution time limit for this script
        set_time_limit(600);

        require_once(ABSPATH . 'wp-admin/includes/image.php');
        require_once(ABSPATH . 'wp-admin/includes/file.php');
        require_once(ABSPATH . 'wp-admin/includes/media.php');

        $brands = $this->get_brands_data();
        $imported_count = 0;
        $skipped_count = 0;

        echo '<div class="notice notice-info"><p>🚀 Розпочато імпорт... Це може зайняти кілька хвилин.</p></div>';
        flush();

        foreach ($brands as $brand_data) {
            $existing_post = get_page_by_title($brand_data['name'], OBJECT, 'brand');

            if ($existing_post) {
                $skipped_count++;
                continue;
            }

            $post_data = [
                'post_title'   => $brand_data['name'],
                'post_content' => $brand_data['description'],
                'post_status'  => 'publish',
                'post_type'    => 'brand',
            ];

            $post_id = wp_insert_post($post_data);

            if (!is_wp_error($post_id)) {
                update_post_meta($post_id, '_brand_subtitle', $brand_data['subtitle']);
                update_post_meta($post_id, '_brand_color', $brand_data['color']);

                $logo_id = $this->generate_placeholder_image($brand_data['name'], 'logo');
                if ($logo_id) {
                    update_post_meta($post_id, '_brand_logo_id', $logo_id);
                }

                $thumbnail_id = $this->generate_placeholder_image($brand_data['name'], 'thumbnail');
                 if ($thumbnail_id) {
                    set_post_thumbnail($post_id, $thumbnail_id);
                }

                $imported_count++;
            }
        }

        echo '<div class="notice notice-success"><p><strong>🎉 Імпорт завершено!</strong></p><p>Імпортовано: ' . $imported_count . ', Пропущено (вже існують): ' . $skipped_count . '</p></div>';
    }

    private function generate_placeholder_image($text, $type = 'logo') {
        $width = ($type === 'logo') ? 250 : 1024;
        $height = ($type === 'logo') ? 250 : 768;
        $bg_color = '1a1a1a';
        $text_color = '777';

        $url = "https://via.placeholder.com/{$width}x{$height}/{$bg_color}/{$text_color}.png?text=" . urlencode($text);

        $tmp_file = download_url($url, 15); // 15 second timeout

        if (is_wp_error($tmp_file)) {
            error_log('Failed to download placeholder image for ' . $text . ': ' . $tmp_file->get_error_message());
            return false;
        }

        $file_name = sanitize_title($text) . '-' . $type . '.png';

        $file = ['name' => $file_name, 'tmp_name' => $tmp_file];

        $attachment_id = media_handle_sideload($file, 0);

        if (is_wp_error($attachment_id)) {
            @unlink($tmp_file);
            error_log('Failed to sideload placeholder image for ' . $text . ': ' . $attachment_id->get_error_message());
            return false;
        }

        return $attachment_id;
    }

    private function get_brands_data() {
        return [
            // Suspension
            ['name' => 'KW Suspension', 'subtitle' => 'Підвіска', 'description' => 'Преміальна підвіска з Німеччини.', 'color' => '#c9a961'],
            ['name' => 'Bilstein', 'subtitle' => 'Підвіска', 'description' => 'Німецька якість підвіски.', 'color' => '#FFD700'],
            ['name' => 'Öhlins', 'subtitle' => 'Підвіска', 'description' => 'Шведська інженерна досконалість.', 'color' => '#FFD700'],
            ['name' => 'H&R', 'subtitle' => 'Підвіска', 'description' => 'Німецькі пружини та підвіска.', 'color' => '#c0c0c0'],
            ['name' => 'Eibach', 'subtitle' => 'Підвіска', 'description' => 'Американська інновація в підвісках.', 'color' => '#FF0000'],
            ['name' => 'BC Racing', 'subtitle' => 'Підвіска', 'description' => 'Доступні coilovers.', 'color' => '#FF0000'],
            ['name' => 'Tein', 'subtitle' => 'Підвіска', 'description' => 'Японські спортивні підвіски.', 'color' => '#0066CC'],

            // Exhaust
            ['name' => 'Akrapovic', 'subtitle' => 'Вихлопні системи', 'description' => 'Словенські титанові вихлопи.', 'color' => '#000000'],
            ['name' => 'Fi Exhaust', 'subtitle' => 'Вихлопні системи', 'description' => 'Тайванські преміальні вихлопи.', 'color' => '#8b0000'],
            ['name' => 'Eisenmann', 'subtitle' => 'Вихлопні системи', 'description' => 'Німецька точність у вихлопах.', 'color' => '#c0c0c0'],
            ['name' => 'Capristo', 'subtitle' => 'Вихлопні системи', 'description' => 'Італійські вихлопи класу люкс.', 'color' => '#FF0000'],
            ['name' => 'Milltek', 'subtitle' => 'Вихлопні системи', 'description' => 'Британські спортивні вихлопи.', 'color' => '#c9a961'],
            ['name' => 'Remus', 'subtitle' => 'Вихлопні системи', 'description' => 'Австрійські вихлопні системи.', 'color' => '#000000'],
            ['name' => 'iPE', 'subtitle' => 'Вихлопні системи', 'description' => 'Британські титанові вихлопи.', 'color' => '#c0c0c0'],
            ['name' => 'Armytrix', 'subtitle' => 'Вихлопні системи', 'description' => 'Вихлопи з valvetronic технологією.', 'color' => '#000000'],
            ['name' => 'HKS', 'subtitle' => 'Вихлопні системи', 'description' => 'Японські легендарні вихлопи.', 'color' => '#FF0000'],

            // Air Intake
            ['name' => 'Eventuri', 'subtitle' => 'Впускні системи', 'description' => 'Британські карбонові впускні системи.', 'color' => '#8b0000'],
            ['name' => 'BMC Air Filter', 'subtitle' => 'Впускні системи', 'description' => 'Італійські повітряні фільтри.', 'color' => '#FF0000'],
            ['name' => 'K&N', 'subtitle' => 'Впускні системи', 'description' => 'Американські високопродуктивні фільтри.', 'color' => '#FF0000'],

            // Brakes
            ['name' => 'Brembo', 'subtitle' => 'Гальмівні системи', 'description' => 'Італійські преміальні гальма.', 'color' => '#FF0000'],
            ['name' => 'AP Racing', 'subtitle' => 'Гальмівні системи', 'description' => 'Британські гоночні гальма.', 'color' => '#c9a961'],
            ['name' => 'Stoptech', 'subtitle' => 'Гальмівні системи', 'description' => 'Американські високопродуктивні гальма.', 'color' => '#FF6600'],
            ['name' => 'Endless', 'subtitle' => 'Гальмівні системи', 'description' => 'Японські гоночні гальма.', 'color' => '#FFD700'],

            // Wheels
            ['name' => 'HRE Wheels', 'subtitle' => 'Колісні диски', 'description' => 'Американські кування колеса.', 'color' => '#c9a961'],
            ['name' => 'BBS', 'subtitle' => 'Колісні диски', 'description' => 'Німецькі легендарні диски.', 'color' => '#FFD700'],
            ['name' => 'Vossen', 'subtitle' => 'Колісні диски', 'description' => 'Американські преміальні диски.', 'color' => '#000000'],
            ['name' => 'Rotiform', 'subtitle' => 'Колісні диски', 'description' => 'Американські custom диски.', 'color' => '#c0c0c0'],
            ['name' => 'Rays Engineering', 'subtitle' => 'Колісні диски', 'description' => 'Японські високопродуктивні диски.', 'color' => '#FF0000'],
            ['name' => 'OZ Racing', 'subtitle' => 'Колісні диски', 'description' => 'Італійські гоночні диски.', 'color' => '#FF0000'],
            ['name' => 'Enkei', 'subtitle' => 'Колісні диски', 'description' => 'Японські MAT Process wheels.', 'color' => '#FFD700'],
            ['name' => 'Work Wheels', 'subtitle' => 'Колісні диски', 'description' => 'Японські premium forged диски.', 'color' => '#c0c0c0'],

            // Engine Tuning
            ['name' => 'Brabus', 'subtitle' => 'Тюнінг ательє', 'description' => 'Німецьке тюнінг ательє Mercedes.', 'color' => '#000000'],
            ['name' => 'Mansory', 'subtitle' => 'Тюнінг ательє', 'description' => 'Німецький luxury tuning.', 'color' => '#FFD700'],
            ['name' => 'Novitec', 'subtitle' => 'Тюнінг ательє', 'description' => 'Італійське тюнінг ательє.', 'color' => '#FF0000'],
            ['name' => 'Techart', 'subtitle' => 'Тюнінг ательє', 'description' => 'Німецьке Porsche тюнінг ательє.', 'color' => '#c9a961'],
            ['name' => 'RUF', 'subtitle' => 'Тюнінг ательє', 'description' => 'Німецький виробник на базі Porsche.', 'color' => '#FFD700'],
            ['name' => 'Alpina', 'subtitle' => 'Тюнінг ательє', 'description' => 'Німецький офіційний партнер BMW.', 'color' => '#0066CC'],
            ['name' => 'AC Schnitzer', 'subtitle' => 'Тюнінг ательє', 'description' => 'Німецьке BMW тюнінг ательє.', 'color' => '#000000'],
            ['name' => 'Hennessey', 'subtitle' => 'Тюнінг ательє', 'description' => 'Американське extreme performance ательє.', 'color' => '#000000'],
            ['name' => 'ABT Sportsline', 'subtitle' => 'Тюнінг ательє', 'description' => 'Німецьке Audi та VW офіційне tuning.', 'color' => '#FF0000'],

            // Carbon
            ['name' => 'Vorsteiner', 'subtitle' => 'Карбон', 'description' => 'Американські карбонові body kit.', 'color' => '#c0c0c0'],
            ['name' => 'Anderson Composites', 'subtitle' => 'Карбон', 'description' => 'Американські карбонові деталі.', 'color' => '#000000'],
            ['name' => 'Seibon', 'subtitle' => 'Карбон', 'description' => 'Американські карбонові капоти.', 'color' => '#FF0000'],

            // ECU
            ['name' => 'APR', 'subtitle' => 'ECU Тюнінг', 'description' => 'Американське ECU тюнінг.', 'color' => '#FF0000'],
            ['name' => 'Cobb Tuning', 'subtitle' => 'ECU Тюнінг', 'description' => 'Американське Accessport ECU тюнінг.', 'color' => '#0066CC'],
            ['name' => 'Unitronic', 'subtitle' => 'ECU Тюнінг', 'description' => 'Канадське ECU тюнінг.', 'color' => '#FF6600'],
            ['name' => 'EcuTek', 'subtitle' => 'ECU Тюнінг', 'description' => 'Британське professional ECU software.', 'color' => '#0066CC'],
            ['name' => 'HP Tuners', 'subtitle' => 'ECU Тюнінг', 'description' => 'Американське GM та Ford ECU tuning suite.', 'color' => '#FF0000'],

            // Turbo
            ['name' => 'Garrett', 'subtitle' => 'Турбіни', 'description' => 'Американські турбонагнітачі.', 'color' => '#000000'],
            ['name' => 'BorgWarner', 'subtitle' => 'Турбіни', 'description' => 'Американські EFR турбо.', 'color' => '#FF6600'],
            ['name' => 'Vortech', 'subtitle' => 'Компресори', 'description' => 'Американські superchargers.', 'color' => '#c0c0c0'],
            ['name' => 'ProCharger', 'subtitle' => 'Компресори', 'description' => 'Американські centrifugal superchargers.', 'color' => '#FF0000'],

            // Interior
            ['name' => 'Recaro', 'subtitle' => 'Інтер\'єр', 'description' => 'Німецькі спортивні сидіння.', 'color' => '#FF0000'],
            ['name' => 'Sparco', 'subtitle' => 'Інтер\'єр', 'description' => 'Італійські гоночні сидіння.', 'color' => '#0066CC'],
            ['name' => 'Bride', 'subtitle' => 'Інтер\'єр', 'description' => 'Японські lightweight сидіння.', 'color' => '#000000'],
            ['name' => 'MOMO', 'subtitle' => 'Інтер\'єр', 'description' => 'Італійські кермові колеса.', 'color' => '#FF0000'],

            // Electronics
            ['name' => 'AEM', 'subtitle' => 'Електроніка', 'description' => 'Американська електроніка.', 'color' => '#FF0000'],
            ['name' => 'Haltech', 'subtitle' => 'Електроніка', 'description' => 'Австралійські ECU системи.', 'color' => '#000000'],
            ['name' => 'Motec', 'subtitle' => 'Електроніка', 'description' => 'Австралійська преміальна електроніка.', 'color' => '#c9a961'],

            // Drivetrain
            ['name' => 'Quaife', 'subtitle' => 'Трансмісія', 'description' => 'Британські ATB диференціали.', 'color' => '#FFD700'],
            ['name' => 'OS Giken', 'subtitle' => 'Трансмісія', 'description' => 'Японські преміальні диференціали.', 'color' => '#FF0000'],
            ['name' => 'Exedy', 'subtitle' => 'Трансмісія', 'description' => 'Японські зчеплення.', 'color' => '#0066CC'],

            // Oils
            ['name' => 'Motul', 'subtitle' => 'Мастила', 'description' => 'Французькі преміальні мастила.', 'color' => '#FF6600'],
            ['name' => 'Liqui Moly', 'subtitle' => 'Мастила', 'description' => 'Німецькі високоякісні мастила.', 'color' => '#FF0000'],
            ['name' => 'Mobil 1', 'subtitle' => 'Мастила', 'description' => 'Американські synthetic мастила.', 'color' => '#FF0000'],
            ['name' => 'Castrol', 'subtitle' => 'Мастила', 'description' => 'Британські мастила.', 'color' => '#00AA00'],

            // Body Kit
            ['name' => 'Liberty Walk', 'subtitle' => 'Обвіси', 'description' => 'Японські wide body kit.', 'color' => '#000000'],
            ['name' => 'Rocket Bunny', 'subtitle' => 'Обвіси', 'description' => 'Японські Pandem wide body.', 'color' => '#FF0000'],
            ['name' => 'Prior Design', 'subtitle' => 'Обвіси', 'description' => 'Німецькі wide body kit.', 'color' => '#c0c0c0'],
            ['name' => 'WALD International', 'subtitle' => 'Обвіси', 'description' => 'Японське luxury tuning.', 'color' => '#000000'],

            // Racing
            ['name' => 'Mishimoto', 'subtitle' => 'Охолодження', 'description' => 'Американські радіатори та cooling systems.', 'color' => '#FF0000'],
            ['name' => 'Vibrant Performance', 'subtitle' => 'Комплектуючі', 'description' => 'Американські exhaust та turbo компоненти.', 'color' => '#0066CC'],
            ['name' => 'Turbosmart', 'subtitle' => 'Турбо-компоненти', 'description' => 'Австралійські wastegates та blow-off valves.', 'color' => '#0066CC'],
            ['name' => 'Tial Sport', 'subtitle' => 'Турбо-компоненти', 'description' => 'Американські wastegates та blow-off valves.', 'color' => '#FF0000'],
            ['name' => 'Greddy', 'subtitle' => 'Тюнінг', 'description' => 'Японські turbo kits та tuning parts.', 'color' => '#000000'],
            ['name' => 'Nismo', 'subtitle' => 'Тюнінг', 'description' => 'Офіційне Nissan Motorsport підрозділ.', 'color' => '#FF0000'],
            ['name' => 'Mugen', 'subtitle' => 'Тюнінг', 'description' => 'Офіційне Honda tuning.', 'color' => '#000000'],
            ['name' => 'Spoon', 'subtitle' => 'Тюнінг', 'description' => 'Японське Honda N1 engine та aero спеціалісти.', 'color' => '#0066CC'],
            ['name' => 'TRD', 'subtitle' => 'Тюнінг', 'description' => 'Toyota Racing Development.', 'color' => '#FF0000'],
        ];
    }
}

new OneCompany_Brand_Importer();
