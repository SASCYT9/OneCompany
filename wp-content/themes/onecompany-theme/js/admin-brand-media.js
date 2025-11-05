(function($) {
    'use strict';

    function previewTemplate(html) {
        return html ? html : '<span class="brand-media-placeholder">Немає зображення</span>';
    }

    function updatePreview(input, attachment) {
        var container = input.closest('.brand-media-field');
        var preview = container.find('.brand-media-preview');

        if (attachment) {
            input.val(attachment.id);
            preview.html('<img src="' + attachment.url + '" alt="brand media preview">');
            container.addClass('has-media');
        } else {
            input.val('');
            preview.html(previewTemplate(''));
            container.removeClass('has-media');
        }
    }

    function bindMediaControls(context) {
        context.on('click', '.brand-media-upload', function(event) {
            event.preventDefault();
            var button = $(this);
            var input = $('#' + button.data('target'));

            if (!input.length) {
                return;
            }

            var frame = wp.media({
                title: button.data('mediaTitle') || 'Вибір зображення',
                button: {
                    text: button.data('mediaButton') || 'Обрати'
                },
                library: {
                    type: ['image']
                },
                multiple: false
            });

            frame.on('select', function() {
                var attachment = frame.state().get('selection').first().toJSON();
                updatePreview(input, attachment);
            });

            frame.open();
        });

        context.on('click', '.brand-media-remove', function(event) {
            event.preventDefault();
            var button = $(this);
            var input = $('#' + button.data('target'));
            if (!input.length) {
                return;
            }

            updatePreview(input, null);
        });
    }

    $(function() {
        bindMediaControls($(document));
    });

})(jQuery);
