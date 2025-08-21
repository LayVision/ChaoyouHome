document.addEventListener('DOMContentLoaded', () => {
    const listingForm = document.getElementById('listing-form');
    const submitBtn = document.getElementById('submit-btn');
    const spinner = submitBtn.querySelector('.spinner-border');
    const errorMessageDiv = document.getElementById('form-error-message');

    const imgbbApiKey = "229500d855ee4e02480b36c4a417c30a";

    // --- 1. Check if user is logged in ---
    auth.onAuthStateChanged(user => {
        if (!user) {
            // If not logged in, redirect to login page
            console.log("User is not logged in. Redirecting...");
            alert("กรุณาเข้าสู่ระบบก่อนลงประกาศ");
            window.location.href = 'login.html';
        }
    });

    // --- 2. Handle form submission ---
    listingForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Show loading state
        submitBtn.disabled = true;
        spinner.classList.remove('d-none');
        errorMessageDiv.classList.add('d-none');

        const currentUser = auth.currentUser;
        if (!currentUser) {
            showError("เกิดข้อผิดพลาด: ไม่พบข้อมูลผู้ใช้");
            return;
        }
        
        try {
            // --- 3. Upload images to ImgBB ---
            const imageFiles = document.getElementById('images').files;
            if (imageFiles.length === 0) {
                 showError("กรุณาเลือกรูปภาพอย่างน้อย 1 รูป");
                 return;
            }

            const uploadPromises = Array.from(imageFiles).map(file => {
                const formData = new FormData();
                formData.append('image', file);

                return fetch(`https://api.imgbb.com/1/upload?key=${imgbbApiKey}`, {
                    method: 'POST',
                    body: formData,
                }).then(response => response.json());
            });

            // --- 4. Wait for all uploads to complete ---
            const uploadResults = await Promise.all(uploadPromises);
            
            // Check for any upload errors
            const failedUploads = uploadResults.filter(result => !result.success);
            if (failedUploads.length > 0) {
                console.error('Failed uploads:', failedUploads);
                throw new Error('เกิดข้อผิดพลาดในการอัปโหลดรูปภาพบางส่วน');
            }

            const imageUrls = uploadResults.map(result => result.data.url);

            // --- 5. Save listing data to Firestore ---
            const listingData = {
                title: listingForm['title'].value,
                propertyType: listingForm['property-type'].value,
                location: listingForm['location'].value,
                rentPerMonth: Number(listingForm['rent-per-month'].value),
                securityDeposit: Number(listingForm['security-deposit'].value),
                advanceRent: Number(listingForm['advance-rent'].value),
                contactNumber: listingForm['contact-number'].value,
                images: imageUrls,
                ownerId: currentUser.uid, // Link the listing to the user
                ownerEmail: currentUser.email,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(), // Add timestamp
            };
            
            await db.collection('listings').add(listingData);
            
            // Success!
            alert('ลงประกาศของคุณสำเร็จแล้ว!');
            window.location.href = 'profile.html'; // Redirect to profile page to see the listing

        } catch (error) {
            console.error('Error creating listing:', error);
            showError(error.message);
        } finally {
            // Hide loading state
            submitBtn.disabled = false;
            spinner.classList.add('d-none');
        }
    });

    function showError(message) {
        errorMessageDiv.textContent = message;
        errorMessageDiv.classList.remove('d-none');
        submitBtn.disabled = false;
        spinner.classList.add('d-none');
    }
});