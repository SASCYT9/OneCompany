import { __ } from '@wordpress/i18n';
import { useBlockProps, InspectorControls, RichText } from '@wordpress/block-editor';
import { PanelBody, TextControl } from '@wordpress/components';
import ServerSideRender from '@wordpress/server-side-render';

export default function Edit({ attributes, setAttributes }) {
    const { title, subtitle, emailTo } = attributes;

    return (
        <>
            <InspectorControls>
                <PanelBody title={__('Налаштування форми', 'onecompany-theme')}>
                    <TextControl
                        label={__('Email для відправки', 'onecompany-theme')}
                        value={emailTo}
                        onChange={(value) => setAttributes({ emailTo: value })}
                        placeholder="info@onecompany.com"
                        help={__('Вкажіть email, на який надсилатимуться повідомлення з форми', 'onecompany-theme')}
                    />
                </PanelBody>
            </InspectorControls>
            <div {...useBlockProps()}>
                <ServerSideRender
                    block="onecompany/contact-form-block"
                    attributes={attributes}
                />
            </div>
        </>
    );
}
