document.addEventListener('DOMContentLoaded', () => {
    const accordions = document.querySelectorAll('.accordion-item');

    accordions.forEach(accordion => {
        const title = accordion.querySelector('.accordion-title');
        const content = accordion.querySelector('.accordion-content');
        const icon = accordion.querySelector('.accordion-icon');

        title.addEventListener('click', () => {
            const isOpen = accordion.classList.contains('active');

            // Close all accordions
            accordions.forEach(acc => {
                acc.classList.remove('active');
                acc.querySelector('.accordion-content').style.maxHeight = null;
                acc.querySelector('.accordion-icon').textContent = '+';
            });

            // Open the clicked one if it wasn't open
            if (!isOpen) {
                accordion.classList.add('active');
                content.style.maxHeight = content.scrollHeight + 'px';
                icon.textContent = '-';
            }
        });
    });
});
