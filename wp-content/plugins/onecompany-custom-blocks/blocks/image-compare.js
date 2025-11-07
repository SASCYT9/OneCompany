document.addEventListener('DOMContentLoaded', () => {
    // Initialize all beer-slider elements on the page
    document.querySelectorAll('.beer-slider').forEach(slider => {
        new BeerSlider(slider);
    });
});
