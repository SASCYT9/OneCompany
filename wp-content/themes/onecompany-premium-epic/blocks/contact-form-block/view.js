import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

class PremiumContactForm {
    constructor(formElement) {
        this.form = formElement;
        this.submitButton = this.form.querySelector('.contact-form__submit');
        this.responseElement = this.form.querySelector('.contact-form__response');
        this.requiredFields = this.form.querySelectorAll('[required]');

        this.init();
    }

    init() {
        this.animateFormIn();
        this.form.addEventListener('submit', this.handleSubmit.bind(this));
        this.requiredFields.forEach(field => {
            field.addEventListener('input', () => this.validateField(field));
            field.addEventListener('blur', () => this.validateField(field));
        });
    }

    animateFormIn() {
        gsap.from(this.form.querySelectorAll('.contact-form__group, .contact-form__footer'), {
            autoAlpha: 0,
            y: 40,
            stagger: 0.1,
            duration: 0.8,
            ease: 'power3.out',
            scrollTrigger: {
                trigger: this.form,
                start: 'top 85%',
                toggleActions: 'play none none reverse',
            },
        });
    }

    validateField(field) {
        const errorElement = field.nextElementSibling.nextElementSibling;
        let isValid = true;
        let errorMessage = '';

        if (field.hasAttribute('required') && !field.value.trim()) {
            isValid = false;
            errorMessage = 'Це поле є обов\'язковим.';
        } else if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field.value)) {
            isValid = false;
            errorMessage = 'Будь ласка, введіть дійсну email-адресу.';
        }

        field.classList.toggle('is-invalid', !isValid);
        errorElement.textContent = errorMessage;

        return isValid;
    }

    validateAllFields() {
        let isFormValid = true;
        this.requiredFields.forEach(field => {
            if (!this.validateField(field)) {
                isFormValid = false;
            }
        });
        return isFormValid;
    }

    async handleSubmit(e) {
        e.preventDefault();

        if (!this.validateAllFields()) {
            return;
        }

        this.setLoadingState(true);

        try {
            const formData = new FormData(this.form);
            const response = await fetch('/wp-admin/admin-ajax.php', {
                method: 'POST',
                body: formData,
            });

            const result = await response.json();

            if (result.success) {
                this.displayResponse('success', this.responseElement.dataset.successMsg);
                this.form.reset();
            } else {
                throw new Error(result.data.message || 'Unknown error');
            }
        } catch (error) {
            this.displayResponse('error', this.responseElement.dataset.errorMsg);
            console.error('Form submission error:', error);
        } finally {
            this.setLoadingState(false);
        }
    }

    setLoadingState(isLoading) {
        this.submitButton.disabled = isLoading;
        this.submitButton.classList.toggle('is-loading', isLoading);
    }

    displayResponse(type, message) {
        this.responseElement.className = `contact-form__response is-${type}`;
        this.responseElement.textContent = message;

        gsap.fromTo(this.responseElement, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.5 });

        setTimeout(() => {
            gsap.to(this.responseElement, { autoAlpha: 0, y: -20, duration: 0.5, onComplete: () => {
                this.responseElement.textContent = '';
            }});
        }, 5000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const contactForms = document.querySelectorAll('.contact-form');
    contactForms.forEach(form => new PremiumContactForm(form));
});
