document.addEventListener('DOMContentLoaded', () => {
    const tabContainers = document.querySelectorAll('.tabs-container');

    tabContainers.forEach(container => {
        const titles = container.querySelectorAll('.tab-title');
        const contents = container.querySelectorAll('.tab-contents > *');

        titles.forEach((title, index) => {
            title.addEventListener('click', () => {
                // Deactivate all titles and contents
                titles.forEach(t => t.classList.remove('active'));
                contents.forEach(c => c.classList.remove('active'));

                // Activate the clicked title and corresponding content
                title.classList.add('active');
                if (contents[index]) {
                    contents[index].classList.add('active');
                }
            });
        });

        // Show the first tab by default
        if (contents.length > 0) {
            contents[0].classList.add('active');
        }
    });
});
