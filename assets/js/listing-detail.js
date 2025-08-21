document.addEventListener('DOMContentLoaded', () => {
    // Get page elements
    const loadingSpinner = document.getElementById('page-loading-spinner');
    const listingContent = document.getElementById('listing-content');
    const notFoundMessage = document.getElementById('not-found-message');

    // --- 1. Get the listing ID from the URL query string ---
    const params = new URLSearchParams(window.location.search);
    const listingId = params.get('id');

    if (!listingId) {
        // If no ID is found in the URL, show the not found message
        showNotFound();
        return;
    }

    // --- 2. Fetch the specific document from Firestore ---
    db.collection('listings').doc(listingId).get()
        .then(doc => {
            if (doc.exists) {
                // --- 4. If document exists, populate the page ---
                const listing = doc.data();
                populateListingDetails(listing);
                showContent();
            } else {
                // --- 3. If document does not exist, show not found message ---
                console.warn("No such document!");
                showNotFound();
            }
        })
        .catch(error => {
            console.error("Error getting document:", error);
            showNotFound(); // Also show not found on error
        });

    function populateListingDetails(listing) {
        // Simple text fields
        document.getElementById('listing-title').textContent = listing.title;
        document.getElementById('listing-location').textContent = listing.location;
        document.getElementById('listing-property-type').textContent = listing.propertyType;

        // Format numbers with commas
        const rentPerMonth = new Intl.NumberFormat().format(listing.rentPerMonth);
        const deposit = new Intl.NumberFormat().format(listing.securityDeposit);
        const advance = new Intl.NumberFormat().format(listing.advanceRent);
        const totalMoveIn = new Intl.NumberFormat().format(listing.rentPerMonth + listing.securityDeposit + listing.advanceRent);
        
        document.getElementById('listing-price').textContent = `${rentPerMonth} บาท/เดือน`;
        document.getElementById('listing-deposit').textContent = `${deposit} บาท`;
        document.getElementById('listing-advance').textContent = `${advance} บาท`;
        document.getElementById('listing-total-move-in').textContent = `${totalMoveIn} บาท`;
        
        // Contact info
        const contactNumber = listing.contactNumber;
        document.getElementById('listing-contact-number').textContent = contactNumber;
        document.getElementById('listing-contact-link').href = `tel:${contactNumber}`;


        // --- Dynamically create the image carousel ---
        const carouselInnerContainer = document.getElementById('carousel-inner-container');
        const carouselIndicatorsContainer = document.getElementById('carousel-indicators-container');
        
        let carouselInnerHtml = '';
        let carouselIndicatorsHtml = '';

        listing.images.forEach((imageUrl, index) => {
            const isActive = index === 0 ? 'active' : '';
            
            // Create carousel item (the image itself)
            carouselInnerHtml += `
                <div class="carousel-item ${isActive}">
                    <img src="${imageUrl}" class="d-block w-100 rounded" alt="Property image ${index + 1}">
                </div>
            `;

            // Create carousel indicator (the small button at the bottom)
            carouselIndicatorsHtml += `
                <button type="button" data-bs-target="#listingImageCarousel" data-bs-slide-to="${index}" class="${isActive}" aria-current="true" aria-label="Slide ${index + 1}"></button>
            `;
        });

        carouselInnerContainer.innerHTML = carouselInnerHtml;
        carouselIndicatorsContainer.innerHTML = carouselIndicatorsHtml;
    }

    function showContent() {
        loadingSpinner.classList.add('d-none');
        notFoundMessage.classList.add('d-none');
        listingContent.classList.remove('d-none');
    }

    function showNotFound() {
        loadingSpinner.classList.add('d-none');
        listingContent.classList.add('d-none');
        notFoundMessage.classList.remove('d-none');
    }
});