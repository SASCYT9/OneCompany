<?php
/**
 * Contact Form Block - Render Callback (Premium Update).
 *
 * @param   array    $attributes The block attributes.
 * @param   string   $content    The block content.
 * @param   WP_Block $block      The block object.
 *
 * @package OneCompany
 */

$eyebrow = $attributes['eyebrow'] ?? '';
$title = $attributes['title'] ?? '';
$subtitle = $attributes['subtitle'] ?? '';
$recipient_email = $attributes['recipientEmail'] ?? get_option('admin_email');
$submit_button_text = $attributes['submitButtonText'] ?? __('Надіслати', 'onecompany-theme');
$success_message = $attributes['successMessage'] ?? '';
$error_message = $attributes['errorMessage'] ?? '';
$theme = $attributes['theme'] ?? 'dark';

$wrapper_attributes = get_block_wrapper_attributes([
    'class' => 'contact-section theme-' . esc_attr($theme),
]);
?>

<div <?php echo $wrapper_attributes; ?>>
    <div class="contact-section__header">
        <?php if ($eyebrow) : ?>
            <p class="section-heading__eyebrow"><?php echo esc_html($eyebrow); ?></p>
        <?php endif; ?>
        <?php if ($title) : ?>
            <h2 class="section-heading__title"><?php echo esc_html($title); ?></h2>
        <?php endif; ?>
        <?php if ($subtitle) : ?>
            <p class="section-heading__subtitle"><?php echo esc_html($subtitle); ?></p>
        <?php endif; ?>
    </div>

    <form class="contact-form" method="POST" novalidate>
        <input type="hidden" name="action" value="send_onecompany_contact_form">
        <input type="hidden" name="recipient_email" value="<?php echo esc_attr($recipient_email); ?>">
        <?php wp_nonce_field('onecompany_contact_form_nonce', 'nonce'); ?>

        <div class="contact-form__group">
            <input type="text" id="contact-name" name="contact_name" class="contact-form__input" placeholder=" " required>
            <label for="contact-name" class="contact-form__label"><?php _e('Ваше ім\'я', 'onecompany-theme'); ?></label>
            <span class="contact-form__error" aria-live="polite"></span>
        </div>

        <div class="contact-form__group">
            <input type="email" id="contact-email" name="contact_email" class="contact-form__input" placeholder=" " required>
            <label for="contact-email" class="contact-form__label"><?php _e('Ваш Email', 'onecompany-theme'); ?></label>
            <span class="contact-form__error" aria-live="polite"></span>
        </div>

        <div class="contact-form__group">
            <input type="tel" id="contact-phone" name="contact_phone" class="contact-form__input" placeholder=" ">
            <label for="contact-phone" class="contact-form__label"><?php _e('Номер телефону (опціонально)', 'onecompany-theme'); ?></label>
            <span class="contact-form__error" aria-live="polite"></span>
        </div>

        <div class="contact-form__group">
            <textarea id="contact-message" name="contact_message" class="contact-form__textarea" placeholder=" " rows="5" required></textarea>
            <label for="contact-message" class="contact-form__label"><?php _e('Повідомлення', 'onecompany-theme'); ?></label>
             <span class="contact-form__error" aria-live="polite"></span>
        </div>

        <div class="contact-form__footer">
            <button type="submit" class="contact-form__submit">
                <?php echo esc_html($submit_button_text); ?>
            </button>
            <div class="contact-form__response" aria-live="assertive" data-success-msg="<?php echo esc_attr($success_message); ?>" data-error-msg="<?php echo esc_attr($error_message); ?>"></div>
        </div>
    </form>
</div>
