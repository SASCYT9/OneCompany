<?php
/**
 * Contact Form Block - Render Callback.
 *
 * @param   array    $attributes The block attributes.
 * @param   string   $content    The block content.
 * @param   WP_Block $block      The block object.
 *
 * @package OneCompany
 */

$title = isset($attributes['title']) ? $attributes['title'] : "Зв'яжіться з нами";
$subtitle = isset($attributes['subtitle']) ? $attributes['subtitle'] : "Ми завжди раді відповісти на ваші запитання";
$email_to = isset($attributes['emailTo']) ? $attributes['emailTo'] : get_option('admin_email');

// Handle form submission
$form_message = '';
$form_success = false;

if (isset($_POST['onecompany_contact_submit'])) {
    $name = sanitize_text_field($_POST['contact_name']);
    $email = sanitize_email($_POST['contact_email']);
    $phone = sanitize_text_field($_POST['contact_phone']);
    $message = sanitize_textarea_field($_POST['contact_message']);
    
    if (!empty($name) && !empty($email) && !empty($message)) {
        $to = $email_to;
        $subject = 'Нове повідомлення з сайту OneCompany від ' . $name;
        $body = "Ім'я: $name\n";
        $body .= "Email: $email\n";
        $body .= "Телефон: $phone\n\n";
        $body .= "Повідомлення:\n$message";
        $headers = array('Content-Type: text/plain; charset=UTF-8', 'From: ' . get_bloginfo('name') . ' <' . get_option('admin_email') . '>');
        
        if (wp_mail($to, $subject, $body, $headers)) {
            $form_success = true;
            $form_message = 'Дякуємо! Ваше повідомлення успішно відправлено.';
        } else {
            $form_message = 'Помилка відправки. Спробуйте ще раз.';
        }
    } else {
        $form_message = 'Будь ласка, заповніть всі обов\'язкові поля.';
    }
}
?>

<div <?php echo get_block_wrapper_attributes(['class' => 'liquid-contact-section']); ?>>
    <div class="container" style="padding: 80px 20px;">
        
        <?php if ($form_message) : ?>
            <div class="form-message <?php echo $form_success ? 'success' : 'error'; ?>" style="
                text-align: center;
                padding: 20px;
                margin-bottom: 30px;
                border-radius: 15px;
                background: <?php echo $form_success ? 'rgba(0, 255, 0, 0.1)' : 'rgba(255, 0, 0, 0.1)'; ?>;
                border: 1px solid <?php echo $form_success ? 'rgba(0, 255, 0, 0.3)' : 'rgba(255, 0, 0, 0.3)'; ?>;
                color: #fff;
            ">
                <?php echo esc_html($form_message); ?>
            </div>
        <?php endif; ?>

        <form method="post" class="liquid-contact-form">
            <h2 class="liquid-contact-form__title"><?php echo esc_html($title); ?></h2>
            <p class="liquid-contact-form__subtitle"><?php echo esc_html($subtitle); ?></p>
            
            <div class="liquid-contact-form__group">
                <label class="liquid-contact-form__label" for="contact_name">Ім'я *</label>
                <input 
                    type="text" 
                    id="contact_name" 
                    name="contact_name" 
                    class="liquid-contact-form__input" 
                    placeholder="Ваше ім'я"
                    required
                >
            </div>
            
            <div class="liquid-contact-form__group">
                <label class="liquid-contact-form__label" for="contact_email">Email *</label>
                <input 
                    type="email" 
                    id="contact_email" 
                    name="contact_email" 
                    class="liquid-contact-form__input" 
                    placeholder="your@email.com"
                    required
                >
            </div>
            
            <div class="liquid-contact-form__group">
                <label class="liquid-contact-form__label" for="contact_phone">Телефон</label>
                <input 
                    type="tel" 
                    id="contact_phone" 
                    name="contact_phone" 
                    class="liquid-contact-form__input" 
                    placeholder="+38 (XXX) XXX-XX-XX"
                >
            </div>
            
            <div class="liquid-contact-form__group">
                <label class="liquid-contact-form__label" for="contact_message">Повідомлення *</label>
                <textarea 
                    id="contact_message" 
                    name="contact_message" 
                    class="liquid-contact-form__textarea" 
                    placeholder="Напишіть ваше повідомлення..."
                    required
                ></textarea>
            </div>
            
            <button type="submit" name="onecompany_contact_submit" class="liquid-contact-form__submit">
                Відправити повідомлення
            </button>
        </form>
    </div>
</div>
