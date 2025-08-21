document.addEventListener('DOMContentLoaded', () => {
    const userEmailDisplay = document.getElementById('user-email-display');
    const myListingsContainer = document.getElementById('my-listings-container');
    const loadingSpinner = document.getElementById('loading-spinner');

    // --- 1. Check user's authentication state ---
    auth.onAuthStateChanged(user => {
        if (user) {
            // User is signed in, display their info and fetch their listings
            userEmailDisplay.textContent = `บัญชีผู้ใช้: ${user.email}`;
            fetchUserListings(user.uid);
        } else {
            // User is not signed in, redirect them to the login page
            console.log("User not logged in. Redirecting...");
            alert("กรุณาเข้าสู่ระบบเพื่อดูโปรไฟล์ของคุณ");
            window.location.href = 'login.html';
        }
    });

    // --- 2. Function to fetch and display listings for a specific user ID ---
    async function fetchUserListings(userId) {
        if (!userId) {
            console.error("User ID is missing.");
            return;
        }

        try {
            // --- 3. Query Firestore for listings where ownerId matches the current user's ID ---
            const querySnapshot = await db.collection('listings')
                                          .where('ownerId', '==', userId)
                                          .orderBy('createdAt', 'desc')
                                          .get();
            
            // Hide the spinner once data is fetched
            loadingSpinner.style.display = 'none';

            if (querySnapshot.empty) {
                myListingsContainer.innerHTML = '<p class="text-center col-12">คุณยังไม่มีประกาศ</p>';
                return;
            }

            let listingsHtml = '';
            querySnapshot.forEach(doc => {
                const listing = doc.data();
                const imageUrl = listing.images && listing.images.length > 0 ? listing.images[0] : 'https://via.placeholder.com/400x300.png?text=No+Image';

                // --- 4. Render the data as cards ---
                listingsHtml += `
                    <div class="col-md-4 mb-4">
                        <div class="card h-100 shadow-sm">
                            <img src="${imageUrl}" class="card-img-top" alt="${listing.title}">
                            <div class="card-body">
                                <h5 class="card-title">${listing.title}</h5>
                                <p class="card-text text-secondary small">${listing.location}</p>
                                <h6 class="card-subtitle mb-2 text-primary fw-bold">${new Intl.NumberFormat().format(listing.rentPerMonth)} บาท/เดือน</h6>
                            </div>
                            <div class="card-footer bg-white border-0 pb-3">
                                <a href="listing-detail.html?id=${doc.id}" class="btn btn-outline-secondary w-100">ดูรายละเอียด</a>
                                <!-- In the future, you can add Edit/Delete buttons here -->
                            </div>
                        </div>
                    </div>
                `;
            });

            myListingsContainer.innerHTML = listingsHtml;

        } catch (error) {
            console.error("Error fetching user listings:", error);
            loadingSpinner.style.display = 'none';
            myListingsContainer.innerHTML = '<p class="text-center text-danger col-12">เกิดข้อผิดพลาดในการโหลดประกาศของคุณ</p>';
        }
    }
});