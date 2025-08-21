// This event listener ensures that the script runs only after the entire HTML document has been loaded.
document.addEventListener('DOMContentLoaded', function() {

    // --- SECTION 1: FETCH AND DISPLAY LATEST LISTINGS ---
    // This part of the code is for the homepage (index.html) to show new properties.

    const latestListingsContainer = document.getElementById('latest-listings');

    // We check if the element exists to prevent errors on other pages that don't have this element.
    if (latestListingsContainer) {
        db.collection("listings").orderBy("createdAt", "desc").limit(6).get()
            .then((querySnapshot) => {
                let listingsHtml = '';
                if (querySnapshot.empty) {
                    latestListingsContainer.innerHTML = '<p class="text-center col-12">ยังไม่มีประกาศในขณะนี้</p>';
                    return;
                }

                querySnapshot.forEach((doc) => {
                    const listing = doc.data();
                    // Make sure listing.images exists and has at least one image.
                    const imageUrl = listing.images && listing.images.length > 0 ? listing.images[0] : 'https://via.placeholder.com/400x300.png?text=No+Image';

                    listingsHtml += `
                        <div class="col-md-4 mb-4">
                            <div class="card h-100 shadow-sm">
                                <img src="${imageUrl}" class="card-img-top" alt="${listing.title}">
                                <div class="card-body d-flex flex-column">
                                    <h5 class="card-title">${listing.title}</h5>
                                    <p class="card-text text-secondary small">${listing.location}</p>
                                    <h6 class="card-subtitle mt-auto mb-2 text-primary fw-bold">${new Intl.NumberFormat().format(listing.rentPerMonth)} บาท/เดือน</h6>
                                </div>
                                <div class="card-footer bg-white border-0 pb-3">
                                     <a href="listing-detail.html?id=${doc.id}" class="btn btn-outline-primary w-100">ดูรายละเอียด</a>
                                </div>
                            </div>
                        </div>
                    `;
                });
                latestListingsContainer.innerHTML = listingsHtml;
            })
            .catch(error => {
                console.error("Error fetching listings: ", error);
                latestListingsContainer.innerHTML = '<p class="text-center text-danger col-12">เกิดข้อผิดพลาดในการโหลดข้อมูล</p>';
            });
    }


    // --- SECTION 2: AUTHENTICATION STATE MANAGEMENT ---
    // This part of the code runs on every page to manage the navbar links (Login, Logout, Profile).

    const navbarNav = document.querySelector('.navbar-nav');

    // This is a Firebase listener that checks if the user's login state has changed.
    auth.onAuthStateChanged(user => {
        // Clear existing dynamic links first
        const dynamicLinks = navbarNav.querySelectorAll('.dynamic-link');
        dynamicLinks.forEach(link => link.remove());

        if (user) {
            // --- USER IS LOGGED IN ---
            console.log('User is logged in:', user.email);
            
            // Create links for logged-in users
            const profileLink = document.createElement('li');
            profileLink.className = 'nav-item dynamic-link';
            profileLink.innerHTML = `<a class="nav-link" href="profile.html">โปรไฟล์</a>`;

            const logoutLink = document.createElement('li');
            logoutLink.className = 'nav-item dynamic-link';
            logoutLink.innerHTML = `<a class="nav-link" href="#" id="logout-btn" style="cursor: pointer;">ออกจากระบบ</a>`;
            
            // Add the new links to the navbar
            navbarNav.appendChild(profileLink);
            navbarNav.appendChild(logoutLink);

            // Add event listener for the logout button
            const logoutBtn = document.getElementById('logout-btn');
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                auth.signOut().then(() => {
                    console.log('User signed out');
                    // Redirect to homepage after logout
                    window.location.href = 'index.html';
                });
            });

        } else {
            // --- USER IS LOGGED OUT ---
            console.log('User is logged out');

            // Create the login link
            const loginLink = document.createElement('li');
            loginLink.className = 'nav-item dynamic-link';
            loginLink.innerHTML = `<a class="nav-link" href="login.html">เข้าสู่ระบบ</a>`;

            // Add the login link to the navbar
            navbarNav.appendChild(loginLink);
        }
    });
});