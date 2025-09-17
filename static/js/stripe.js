document.addEventListener('DOMContentLoaded', function() {
    const stripe = Stripe(window.DjangoVars.stripePublicKey);
    const buyInkButton = document.getElementById('buyInkButton');
    const inkOptionsDropdown = document.getElementById('inkOptionsDropdown');

    buyInkButton.addEventListener('click', function() {
        inkOptionsDropdown.style.display = inkOptionsDropdown.style.display === 'block' ? 'none' : 'block';
    });

    inkOptionsDropdown.addEventListener('click', function(event) {
        if (event.target.tagName === 'A') {
            event.preventDefault();
            const selectedOption = event.target.getAttribute('data-option');

            fetch(window.DjangoVars.checkoutUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": window.DjangoVars.csrfToken
                },
                body: JSON.stringify({ option: selectedOption })
            })
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    alert(data.error);
                } else {
                    return stripe.redirectToCheckout({ sessionId: data.id });
                }
            })
            .catch(error => console.error('Error:', error));
        }
    });

    window.addEventListener('click', function(event) {
        if (!event.target.matches('#buyInkButton')) {
            inkOptionsDropdown.style.display = 'none';
        }
    });
});
