// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js"
import {
  getAuth,
  signInWithCustomToken,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  setPersistence,
  browserLocalPersistence,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js"
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  orderBy,
  setLogLevel,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js"

// ======================================================================
// YOUR FIREBASE CONFIGURATION HAS BEEN INSERTED HERE
// It is recommended to restrict your API key in the Google Cloud Console
// ======================================================================
const firebaseConfig = {
  apiKey: "AIzaSyDjeZHb1xsD9wKeey1I5EJDSR1SQHOUsMs",
  authDomain: "chaoyou-home-873d0.firebaseapp.com",
  projectId: "chaoyou-home-873d0",
  storageBucket: "chaoyou-home-873d0.appspot.com",
  messagingSenderId: "179401909066",
  appId: "1:179401909066:web:7416d3619906527a8d97b3",
}

// --- INITIALIZATION ---
const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const db = getFirestore(app)
setLogLevel("debug") // NEW: Added for more detailed error logs

const listingsCollection = collection(db, "listings")
const usersCollection = collection(db, "users")

// --- GLOBAL STATE ---
let currentUser = null
let isAuthReady = false // NEW: Flag to track if initial auth check is done
let thailandData = {}
let confirmCallback = null
let selectedFiles = []
let existingImageUrls = []
let currentAdminListings = []
let currentAdminUsers = []
const listingsPerPage = 8
const profileListingsPerPage = 5 // MODIFIED: Changed from 6 to 5
const adminListingsPerPage = 25 // NEW: Pagination for admin listings
let generalListingsCurrentPage = 1
let boostedListingsCurrentPage = 1
let profileCurrentPage = 1
let adminListingsCurrentPage = 1 // NEW: State for admin listings page
let currentGeneralListings = []
let currentBoostedListings = []
let currentHash = ""

// --- UI ELEMENTS ---
const homeView = document.getElementById("home-view")
const profileView = document.getElementById("profile-view")
const listingDetailView = document.getElementById("listing-detail-view")
const adminView = document.getElementById("admin-view")
const navLoggedOutView = document.getElementById("nav-logged-out-view")
const navLoggedInView = document.getElementById("nav-logged-in-view")
const profileDropdownButton = document.getElementById("profile-dropdown-button")
const dropdownUsername = document.getElementById("dropdown-username")
const dropdownEmail = document.getElementById("dropdown-email")
const listingsGrid = document.getElementById("listings-grid")
const generalListingsGrid = document.getElementById("general-listings-grid")
const boostedListingsContainer = document.getElementById("boosted-listings-container")
const generalListingsContainer = document.getElementById("general-listings-container")
const loadingSpinner = document.getElementById("loading-spinner")
const mobileMenu = document.getElementById("mobile-menu")
const mobileNavLoggedOutView = document.getElementById("mobile-nav-logged-out-view")
const mobileNavLoggedInView = document.getElementById("mobile-nav-logged-in-view")
const profilePictureUploadInput = document.getElementById("profile-picture-upload")

// --- MODAL & FORM ELEMENTS ---
const loginForm = document.getElementById("login-form")
const registerForm = document.getElementById("register-form")
const postForm = document.getElementById("post-form")
const editProfileForm = document.getElementById("edit-profile-form")
const imageUploadInput = document.getElementById("post-image-upload")
const imagePreviewContainer = document.getElementById("image-preview-container")
const postSubmitButton = document.getElementById("post-submit-button")

// --- HELPER FUNCTIONS ---

function createElement(tag, classNames = [], textContent = "", attributes = {}) {
  const el = document.createElement(tag)
  if (classNames.length > 0) el.classList.add(...classNames)
  if (textContent) el.textContent = textContent
  for (const key in attributes) {
    el.setAttribute(key, attributes[key])
  }
  return el
}

function translateFirebaseError(errorCode) {
  switch (errorCode) {
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
    case "auth/invalid-email":
      return "รูปแบบอีเมลไม่ถูกต้อง"
    case "auth/email-already-in-use":
      return "อีเมลนี้ถูกใช้งานแล้ว"
    case "auth/weak-password":
      return "รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร"
    case "auth/too-many-requests":
      return "ตรวจพบกิจกรรมที่น่าสงสัย บัญชีของคุณถูกระงับชั่วคราว"
    default:
      return "เกิดข้อผิดพลาดที่ไม่รู้จัก กรุณาลองใหม่อีกครั้ง"
  }
}

function formatTimestamp(timestamp, full = false) {
  if (!timestamp || !timestamp.seconds) {
    return ""
  }
  const postDate = new Date(timestamp.seconds * 1000)

  if (full) {
    return postDate.toLocaleDateString("th-TH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const now = new Date()
  const diffInSeconds = Math.floor((now - postDate) / 1000)
  const diffInDays = Math.floor(diffInSeconds / 86400)

  if (diffInDays < 7) {
    if (diffInSeconds < 60) return `${diffInSeconds} วินาทีที่แล้ว`
    const diffInMinutes = Math.floor(diffInSeconds / 60)
    if (diffInMinutes < 60) return `${diffInMinutes} นาทีที่แล้ว`
    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) return `${diffInHours} ชั่วโมงที่แล้ว`
    return `${diffInDays} วันที่แล้ว`
  } else {
    return postDate.toLocaleDateString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }
}

function formatTimeRemaining(expiryDate) {
  if (!expiryDate) return ""
  const now = new Date()
  const expiry = expiryDate.toDate()
  const diffInSeconds = Math.floor((expiry - now) / 1000)

  if (diffInSeconds <= 0) return "หมดอายุแล้ว"

  const days = Math.floor(diffInSeconds / 86400)
  const hours = Math.floor((diffInSeconds % 86400) / 3600)

  if (days === 0 && hours === 0) {
    return "เหลือน้อยกว่า 1 ชั่วโมง"
  }

  let result = "เหลือ "
  if (days > 0) result += `${days} วัน `
  if (hours > 0) result += `${hours} ชั่วโมง `

  return result.trim()
}

// --- LOCATION DATA HANDLING ---
async function fetchThailandData() {
  try {
    const response = await fetch(
      "https://raw.githubusercontent.com/kongvut/thai-province-data/master/api_province_with_amphure_tambon.json",
    )
    if (!response.ok) throw new Error("Network response was not ok")
    let data = await response.json()

    // --- NEW CODE START ---
    // กรองข้อมูลให้เหลือเฉพาะจังหวัดเชียงใหม่
    const chiangMaiData = data.filter(province => province.name_th === "เชียงใหม่");
    data = chiangMaiData; // ใช้ข้อมูลที่กรองแล้วมาทำงานต่อ
    // --- NEW CODE END ---

    thailandData = data.reduce((acc, province) => {
      acc[province.name_th] = province.amphure.reduce((amphureAcc, amphure) => {
        amphureAcc[amphure.name_th] = amphure.tambon.map((tambon) => tambon.name_th)
        return amphureAcc
      }, {})
      return acc
    }, {})

    populateProvinceDropdowns()
  } catch (error) {
    console.error("Failed to fetch Thailand location data:", error)
    // --- MODIFIED LINE ---
    // แก้ไขข้อมูลสำรองให้เป็นของเชียงใหม่ ในกรณีที่โหลดข้อมูลหลักไม่สำเร็จ
    thailandData = { "เชียงใหม่": { "เมืองเชียงใหม่": ["ศรีภูมิ"] } }
    populateProvinceDropdowns()
  }
}

function populateProvinceDropdowns() {
  const provinces = Object.keys(thailandData).sort()
  const provinceFilter = document.getElementById("province-filter")
  const postProvince = document.getElementById("post-province")
  provinceFilter.length = 1
  postProvince.length = 1
  provinces.forEach((prov) => {
    provinceFilter.add(new Option(prov, prov))
    postProvince.add(new Option(prov, prov))
  })

  // --- NEW CODE START ---
  // เพิ่ม "ตัวดักฟัง" ให้กับช่องฟิลเตอร์จังหวัด
  provinceFilter.addEventListener("change", () =>
    populateDistrictDropdowns(provinceFilter.value, "district-filter")
  );
  // --- NEW CODE END ---

  // --- MODIFIED LINE ---
  // อัปเดตการเรียกใช้ฟังก์ชันเดิมให้ส่ง ID ของช่องอำเภอไปด้วย
  postProvince.addEventListener("change", () =>
    populateDistrictDropdowns(postProvince.value, "post-district")
  );
}

function populateDistrictDropdowns(province, districtElementId) {
  const districtDropdown = document.getElementById(districtElementId);
  if (!districtDropdown) return; // เพิ่มการตรวจสอบเผื่อไม่เจอ element

  districtDropdown.length = 1; // ล้างค่าเก่าออก
  districtDropdown.value = ""; // ตั้งค่าให้เป็นค่าว่าง

  if (province && thailandData[province]) {
    const districts = Object.keys(thailandData[province]).sort();
    districts.forEach((dist) => {
      districtDropdown.add(new Option(dist, dist));
    });
  }
}

// --- UI UPDATE FUNCTIONS ---
function updateNavUI(user) {
  if (user) {
    navLoggedInView.classList.remove("hidden")
    navLoggedInView.classList.add("flex")
    navLoggedOutView.classList.add("hidden")

    const userInitial = user.username.charAt(0).toUpperCase()
    dropdownUsername.textContent = user.username
    dropdownEmail.textContent = user.email

    // Update header dropdown button
    profileDropdownButton.innerHTML = ""
    if (user.photoURL) {
      const img = createElement("img", ["w-full", "h-full", "object-cover"], "", { src: user.photoURL, alt: "Profile" })
      profileDropdownButton.appendChild(img)
    } else {
      profileDropdownButton.textContent = userInitial
    }

    // Update dropdown menu picture/initial
    const dropdownPicContainer = document.getElementById("dropdown-profile-pic-container")
    dropdownPicContainer.innerHTML = ""
    if (user.photoURL) {
      const img = createElement("img", ["w-full", "h-full", "object-cover"], "", { src: user.photoURL, alt: "Profile" })
      dropdownPicContainer.appendChild(img)
    } else {
      dropdownPicContainer.appendChild(createElement("span", [], userInitial))
    }
    dropdownPicContainer.onclick = () => openProfilePictureModal()

    document.getElementById("dropdown-profile-link").onclick = (e) => {
      e.preventDefault()
      navigateToProfile(user.uid)
      toggleProfileDropdown()
    }
    document.getElementById("dropdown-post-link").onclick = (e) => {
      e.preventDefault()
      openModal("postModal")
      toggleProfileDropdown()
    }
    document.getElementById("dropdown-logout-link").onclick = (e) => {
      e.preventDefault()
      handleLogout()
    }
    document.getElementById("header-boost-button").onclick = () => navigateToProfile(user.uid)

    const adminLink = document.getElementById("dropdown-admin-link")
    if (user.role === "admin") {
      adminLink.classList.remove("hidden")
      adminLink.classList.add("flex")
      adminLink.onclick = (e) => {
        e.preventDefault()
        navigateToAdmin()
        toggleProfileDropdown()
      }
    } else {
      adminLink.classList.add("hidden")
    }

    // --- Update Mobile Nav ---
    mobileNavLoggedInView.classList.remove("hidden")
    mobileNavLoggedOutView.classList.add("hidden")
    mobileNavLoggedInView.innerHTML = ""

    const infoContainer = createElement("div", ["p-4", "border-b", "border-slate-200"])
    const flexContainer = createElement("div", ["flex", "items-center", "gap-3"])

    const mobilePicContainer = createElement("div", [
      "w-12",
      "h-12",
      "bg-indigo-500",
      "rounded-full",
      "flex",
      "items-center",
      "justify-center",
      "text-white",
      "text-2xl",
      "font-bold",
      "overflow-hidden",
    ])
    if (user.photoURL) {
      mobilePicContainer.appendChild(
        createElement("img", ["w-full", "h-full", "object-cover"], "", { src: user.photoURL }),
      )
    } else {
      mobilePicContainer.appendChild(createElement("span", [], userInitial))
    }

    const textContainer = createElement("div")
    textContainer.appendChild(createElement("p", ["font-semibold", "text-slate-800"], user.username))
    textContainer.appendChild(createElement("p", ["text-sm", "text-slate-500"], user.email))
    flexContainer.append(mobilePicContainer, textContainer)
    infoContainer.appendChild(flexContainer)

    const linksContainer = createElement("div", ["p-2", "space-y-1"])
    const createMobileLink = (text, iconClass, handler) => {
      const link = createElement(
        "a",
        ["block", "text-left", "px-4", "py-3", "text-slate-700", "rounded-lg", "hover:bg-slate-100"],
        "",
        { href: "#" },
      )
      const icon = createElement("i", ["mr-2", "w-5", "text-center", ...iconClass.split(" ")])
      link.appendChild(icon)
      link.append(text)
      link.onclick = (e) => {
        e.preventDefault()
        handler()
        toggleMobileMenu()
      }
      return link
    }

    linksContainer.appendChild(createMobileLink("โปรไฟล์", "fas fa-user-circle", () => navigateToProfile(user.uid)))
    linksContainer.appendChild(createMobileLink("ลงประกาศ", "fas fa-plus", () => openModal("postModal")))
    linksContainer.appendChild(createMobileLink("ดันโพสต์", "fas fa-rocket", () => navigateToProfile(user.uid)))

    if (user.role === "admin") {
      linksContainer.appendChild(createMobileLink("Admin Panel", "fas fa-user-shield", navigateToAdmin))
    }

    linksContainer.appendChild(createElement("hr", ["my-1", "border-slate-200"]))
    const logoutLink = createMobileLink("ออกจากระบบ", "fas fa-sign-out-alt", handleLogout)
    logoutLink.classList.remove("text-slate-700", "hover:bg-slate-100")
    logoutLink.classList.add("text-rose-600", "hover:bg-rose-50")
    linksContainer.appendChild(logoutLink)
    mobileNavLoggedInView.append(infoContainer, linksContainer)
  } else {
    navLoggedInView.classList.add("hidden")
    navLoggedOutView.classList.remove("hidden")
    mobileNavLoggedInView.classList.add("hidden")
    mobileNavLoggedOutView.classList.remove("hidden")
  }
}

// --- AUTHENTICATION ---
async function initializeAuth() {
  await setPersistence(auth, browserLocalPersistence)

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        const userDocRef = doc(db, "users", user.uid)
        const userDocSnap = await getDoc(userDocRef)
        if (userDocSnap.exists()) {
          currentUser = { uid: user.uid, ...userDocSnap.data() }
        } else {
          const usernameFromEmail = user.email ? user.email.split("@")[0] : "user"
          currentUser = { uid: user.uid, email: user.email, username: usernameFromEmail }
          console.log(`User document for ${user.uid} not found. Using partial profile.`)
        }
      } catch (error) {
        console.error("Error fetching user profile:", error)
        const usernameFromEmail = user.email ? user.email.split("@")[0] : "user"
        currentUser = { uid: user.uid, email: user.email, username: usernameFromEmail }
      }
    } else {
      currentUser = null
    }
    isAuthReady = true
    updateNavUI(currentUser)
    router()
  })

  try {
    if (typeof __initial_auth_token !== "undefined" && __initial_auth_token) {
      console.log("Attempting to sign in with custom token...")
      await signInWithCustomToken(auth, __initial_auth_token)
      console.log("Signed in with custom token successfully.")
    } else {
      console.log("No custom token found, user needs to sign in manually or is anonymous.")
    }
  } catch (error) {
    console.error("Error during initial sign-in:", error)
  }
}

registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("register-username").value.trim();
  const usernameLower = username.toLowerCase();
  const email = document.getElementById("register-email").value;
  const password = document.getElementById("register-password").value;
  const confirmPassword = document.getElementById("register-confirm-password").value;
  const errorEl = document.getElementById("register-error");
  errorEl.textContent = "";

  const usernameRegex = /^[a-zA-Z0-9]+$/;
  if (!usernameRegex.test(username)) {
    errorEl.textContent = "Username ต้องเป็นภาษาอังกฤษหรือตัวเลขเท่านั้น";
    return;
  }

  if (!username) {
    errorEl.textContent = "กรุณาใส่ Username";
    return;
  }
  if (password !== confirmPassword) {
    errorEl.textContent = "รหัสผ่านไม่ตรงกัน";
    return;
  }

  try {
    // --- NEW: Check for duplicate username START ---
    // 1. สร้าง query เพื่อค้นหา username (ตัวพิมพ์เล็ก) ในฐานข้อมูล
    const q = query(usersCollection, where("username_lowercase", "==", usernameLower));

    // 2. สั่งให้ query ทำงาน
    const querySnapshot = await getDocs(q);

    // 3. ตรวจสอบว่าผลลัพธ์ที่ได้ว่างเปล่าหรือไม่
    if (!querySnapshot.empty) {
      // ถ้าไม่ว่างเปล่า แสดงว่ามีคนใช้ username นี้แล้ว
      errorEl.textContent = "Username นี้ถูกใช้งานแล้ว";
      return; // หยุดการทำงานทันที
    }
    // --- NEW: Check for duplicate username END ---


    // ถ้า username ไม่ซ้ำ ให้ดำเนินการสร้างบัญชีต่อไป
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    await setDoc(doc(db, "users", user.uid), {
      username: username,
      username_lowercase: usernameLower,
      email: user.email,
      createdAt: serverTimestamp(),
      phone: "",
      lineId: "",
      photoURL: "",
    });

    closeModal("registerModal");
    registerForm.reset();
  } catch (error) {
    console.error("Register error:", error);
    errorEl.textContent = translateFirebaseError(error.code);
  }
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault()
  const emailToLogin = document.getElementById("login-identifier").value.trim()
  const password = document.getElementById("login-password").value
  const errorEl = document.getElementById("login-error")
  errorEl.textContent = ""
  if (!emailToLogin || !password) {
    errorEl.textContent = "กรุณากรอกอีเมลและรหัสผ่าน"
    return
  }
  try {
    await signInWithEmailAndPassword(auth, emailToLogin, password)
    closeModal("loginModal")
    loginForm.reset()
  } catch (error) {
    console.error("Login error:", error)
    errorEl.textContent = translateFirebaseError(error.code)
  }
})

const handleLogout = async () => {
  try {
    await signOut(auth)
    navigateToHome()
  } catch (error) {
    console.error("Logout error:", error)
  }
}

// =================================================================
// --- IMAGE UPLOAD ---
// This function now sends images to our own serverless function
// which then calls the ImgBB API securely.
// =================================================================
async function uploadImages(files) {
  const uploadPromises = Array.from(files).map(file => {
    // We wrap the FileReader in a Promise to handle the async conversion
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      // This event fires when the file is successfully read
      reader.onload = async () => {
        // The result is a Base64 string like "data:image/jpeg;base64,..."
        // We need to strip the prefix, as the API wants only the raw data
        const base64String = reader.result.split(',')[1];

        try {
          // Call our own backend function, not the ImgBB API directly
          const response = await fetch("/.netlify/functions/upload", {
            method: "POST",
            body: JSON.stringify({ imageBase64: base64String }),
          });

          const result = await response.json();

          if (!response.ok || !result.success) {
            // If our function returned an error, we reject the promise
            reject(new Error(result.error || "Upload failed"));
          } else {
            // If successful, resolve the promise with the image URL
            resolve(result.data.url);
          }
        } catch (error) {
          console.error("Fetch to our backend failed:", error);
          reject(error);
        }
      };

      // This event fires if there's an error reading the file
      reader.onerror = (error) => reject(error);

      // Start reading the file. This will trigger either onload or onerror.
      reader.readAsDataURL(file);
    });
  });

  return Promise.all(uploadPromises);
}

imageUploadInput.addEventListener("change", () => {
  const newFiles = Array.from(imageUploadInput.files)
  const totalImages = existingImageUrls.length + selectedFiles.length + newFiles.length
  if (totalImages > 10) {
    showAlertModal("คุณสามารถอัปโหลดรูปภาพได้สูงสุด 10 รูป")
    return
  }
  selectedFiles = [...selectedFiles, ...newFiles]
  renderImagePreviews()
})

function renderImagePreviews() {
  imagePreviewContainer.innerHTML = ""
  const allItems = [
    ...existingImageUrls.map((url) => ({ type: "existing", data: url })),
    ...selectedFiles.map((file) => ({ type: "new", data: file })),
  ]
  allItems.forEach((item, index) => {
    const container = createElement("div", ["upload-preview-container"])
    const isCover = index === 0
    const img = createElement("img", ["upload-preview-img"])
    if (isCover) img.classList.add("is-cover")
    const removeBtn = createElement(
      "button",
      [
        "absolute",
        "top-1",
        "left-1",
        "bg-rose-600",
        "text-white",
        "rounded-full",
        "w-5",
        "h-5",
        "flex",
        "items-center",
        "justify-center",
        "text-xs",
        "font-bold",
      ],
      "×",
      { title: "ลบรูปนี้", type: "button" },
    )
    removeBtn.onclick = () => {
      if (item.type === "existing") {
        existingImageUrls.splice(index, 1)
      } else {
        selectedFiles.splice(index - existingImageUrls.length, 1)
      }
      renderImagePreviews()
    }
    if (!isCover) {
      const coverBtn = createElement("button", ["set-cover-btn"], "", { title: "ตั้งเป็นรูปปก", type: "button" })
      coverBtn.innerHTML = '<i class="fas fa-star"></i>'
      coverBtn.onclick = () => {
        if (item.type === "existing") {
          const [movedItem] = existingImageUrls.splice(index, 1)
          existingImageUrls.unshift(movedItem)
        } else {
          const [movedItem] = selectedFiles.splice(index - existingImageUrls.length, 1)
          selectedFiles.unshift(movedItem)
        }
        renderImagePreviews()
      }
      container.appendChild(coverBtn)
    }
    if (item.type === "existing") {
      img.src = item.data
    } else {
      const reader = new FileReader()
      reader.onload = (e) => {
        img.src = e.target.result
      }
      reader.readAsDataURL(item.data)
    }
    container.append(img, removeBtn)
    imagePreviewContainer.appendChild(container)
  })
}

// --- FIRESTORE (LISTINGS) ---
postForm.addEventListener("submit", async (e) => {
  e.preventDefault()
  if (!currentUser) {
    showAlertModal("กรุณาเข้าสู่ระบบก่อนลงประกาศ")
    return
  }

  const title = document.getElementById("post-title").value.trim()
  const priceRent = document.getElementById("post-price-rent").value
  const province = document.getElementById("post-province").value
  const district = document.getElementById("post-district").value
  const description = document.getElementById("post-description").value.trim()
  const phone = document.getElementById("post-phone").value.trim()
  const lineId = document.getElementById("post-line-id").value.trim()
  const totalImages = existingImageUrls.length + selectedFiles.length

  if (!title) {
    showAlertModal('กรุณากรอก "หัวข้อประกาศ"')
    return
  }
  if (!priceRent || Number(priceRent) <= 0) {
    showAlertModal('กรุณากรอก "ราคาเช่า" ให้ถูกต้อง')
    return
  }
  if (!province) {
    showAlertModal('กรุณาเลือก "จังหวัด"')
    return
  }
  if (!district) {
    showAlertModal('กรุณาเลือก "อำเภอ/เขต"')
    return
  }
  if (!description) {
    showAlertModal('กรุณากรอก "รายละเอียดเพิ่มเติม"')
    return
  }
  if (totalImages === 0) {
    showAlertModal("กรุณาอัปโหลดรูปภาพอย่างน้อย 1 รูป")
    return
  }
  if (!phone) {
    showAlertModal('กรุณากรอก "เบอร์โทรศัพท์"')
    return
  }
  if (!lineId) {
    showAlertModal('กรุณากรอก "Line ID"')
    return
  }

  postSubmitButton.disabled = true
  postSubmitButton.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i>กำลังบันทึก...`

  try {
    let newImageUrls = []
    const postId = document.getElementById("post-id").value
    if (selectedFiles.length > 0) {
      newImageUrls = await uploadImages(selectedFiles)
    }
    const finalImageUrls = [...existingImageUrls, ...newImageUrls]

    if (finalImageUrls.length === 0) {
      throw new Error("กรุณาอัปโหลดรูปภาพอย่างน้อย 1 รูป")
    }

    const listingData = {
      title: title,
      type: document.getElementById("post-type").value,
      priceRent: Number(priceRent),
      priceInitial: Number(document.getElementById("post-price-initial").value) || 0,
      availableDate: document.getElementById("post-available-date").value || "",
      province: province,
      district: district,
      description: description,
      imageUrls: finalImageUrls,
      phone: phone,
      lineId: lineId,
      ownerUid: currentUser.uid,
      ownerEmail: currentUser.email,
      ownerUsername: currentUser.username,
      updatedAt: serverTimestamp(),
    }

    if (postId) {
      const docRef = doc(db, "listings", postId)
      await updateDoc(docRef, listingData)
    } else {
      listingData.createdAt = serverTimestamp()
      listingData.isBoosted = false
      listingData.boostStatus = "none"
      await addDoc(listingsCollection, listingData)
    }
    closeModal("postModal")
    postForm.reset()
    imagePreviewContainer.innerHTML = ""
    selectedFiles = []
    existingImageUrls = []
    fetchListings()
    showAlertModal("บันทึกประกาศสำเร็จ!")
  } catch (error) {
    console.error("Error saving listing:", error)
    document.getElementById("post-error").textContent = "เกิดข้อผิดพลาด: " + error.message
  } finally {
    postSubmitButton.disabled = false
    postSubmitButton.textContent = `บันทึกประกาศ`
  }
})

async function fetchListings(filters = {}, fromListing = false) {
  loadingSpinner.style.display = "block"
  listingsGrid.innerHTML = ""
  generalListingsGrid.innerHTML = ""
  try {
    const querySnapshot = await getDocs(query(listingsCollection))
    const allListings = []
    querySnapshot.forEach((doc) => {
      allListings.push({ id: doc.id, ...doc.data() })
    })

    const now = new Date()
    const filteredListings = allListings.filter((l) => {
      const provinceMatch = !filters.province || l.province === filters.province
      const districtMatch = !filters.district || l.district === filters.district
      const typeMatch = !filters.type || l.type === filters.type
      const priceMatch = !filters.maxPrice || (l.priceRent > 0 && l.priceRent <= filters.maxPrice)
      return provinceMatch && districtMatch && typeMatch && priceMatch
    })

    filteredListings.forEach((l) => {
      if (l.isBoosted && l.boostExpiryDate && l.boostExpiryDate.toDate() < now) {
        l.isBoosted = false
      }
    })

    // MODIFIED: Sort by boosted status first, then by original creation date.
    // This prevents edited posts from moving to the top.
    filteredListings.sort((a, b) => {
      if (a.isBoosted && !b.isBoosted) return -1
      if (!a.isBoosted && b.isBoosted) return 1
      const createdAtA = a.createdAt?.toMillis() || 0
      const createdAtB = b.createdAt?.toMillis() || 0
      return createdAtB - createdAtA
    })
    renderListings(filteredListings, Object.keys(filters).length > 0 && Object.values(filters).some((v) => v))
  } catch (error) {
    console.error("Error fetching listings: ", error)
    listingsGrid.innerHTML = `<p class="col-span-full text-center text-rose-600">เกิดข้อผิดพลาด: ${error.message}</p>`
  } finally {
    loadingSpinner.style.display = "none"
    if (fromListing) {
      setTimeout(() => {
        const targetElement = document.getElementById("general-listings-container")
        if (targetElement) {
          targetElement.scrollIntoView({ behavior: "smooth" })
        }
      }, 100)
    }
  }
}

function renderListings(listings, isSearchView = false) {
  if (isSearchView) {
    boostedListingsContainer.style.display = "none"
    generalListingsContainer.style.display = "block"
    document.getElementById("general-listings-title").textContent = "ผลการค้นหา"

    currentGeneralListings = listings
    renderPaginatedGeneralListings()
  } else {
    boostedListingsContainer.style.display = "block"
    generalListingsContainer.style.display = "block"
    document.getElementById("listings-title").innerHTML = 'ประกาศแนะนำ <i class="fas fa-star text-amber-400"></i>'
    document.getElementById("general-listings-title").textContent = "ประกาศทั่วไป"

    currentBoostedListings = listings.filter((l) => l.isBoosted)
    currentGeneralListings = listings.filter((l) => !l.isBoosted)

    renderPaginatedBoostedListings()
    renderPaginatedGeneralListings()
  }
}

function renderPaginatedBoostedListings() {
  const start = (boostedListingsCurrentPage - 1) * listingsPerPage
  const end = start + listingsPerPage
  const pageListings = currentBoostedListings.slice(start, end)

  populateGrid(listingsGrid, pageListings, "ยังไม่มีประกาศแนะนำในขณะนี้")
  renderBoostedPaginationControls()
}

function renderPaginatedGeneralListings() {
  const start = (generalListingsCurrentPage - 1) * listingsPerPage
  const end = start + listingsPerPage
  const pageListings = currentGeneralListings.slice(start, end)

  const isSearching = window.location.hash.startsWith("#search/")
  const emptyMessage = isSearching ? "ไม่พบประกาศที่ตรงกับเงื่อนไขการค้นหา" : "ไม่พบประกาศทั่วไป"

  populateGrid(generalListingsGrid, pageListings, emptyMessage)
  renderGeneralPaginationControls()
}

function renderBoostedPaginationControls() {
  const paginationContainer = document.getElementById("boosted-pagination-container")
  paginationContainer.innerHTML = ""
  const totalPages = Math.ceil(currentBoostedListings.length / listingsPerPage)

  if (totalPages <= 1) return

  for (let i = 1; i <= totalPages; i++) {
    const pageButton = createElement("button", ["px-4", "py-2", "border", "rounded-md", "transition-colors", "text-sm"])
    pageButton.textContent = i
    if (i === boostedListingsCurrentPage) {
      pageButton.classList.add("bg-indigo-600", "text-white", "border-indigo-600")
    } else {
      pageButton.classList.add("bg-white", "text-slate-700", "hover:bg-slate-100", "border-slate-300")
    }
    pageButton.onclick = () => {
      const params = new URLSearchParams(window.location.hash.substring(window.location.hash.indexOf("?")))
      params.set("boostedPage", i)
      window.location.hash = `home?${params.toString()}`

      // THIS IS THE NEW PART: Scroll to the boosted listings container
      setTimeout(() => {
        const targetElement = document.getElementById("boosted-listings-container");
        if (targetElement) {
          targetElement.scrollIntoView({ behavior: "smooth" });
        }
      }, 100);
    }
    paginationContainer.appendChild(pageButton)
  }
}

function renderGeneralPaginationControls() {
  const paginationContainer = document.getElementById("pagination-container")
  paginationContainer.innerHTML = ""
  const totalPages = Math.ceil(currentGeneralListings.length / listingsPerPage)

  if (totalPages <= 1) return

  for (let i = 1; i <= totalPages; i++) {
    const pageButton = createElement("button", ["px-4", "py-2", "border", "rounded-md", "transition-colors", "text-sm"])
    pageButton.textContent = i
    if (i === generalListingsCurrentPage) {
      pageButton.classList.add("bg-indigo-600", "text-white", "border-indigo-600")
    } else {
      pageButton.classList.add("bg-white", "text-slate-700", "hover:bg-slate-100", "border-slate-300")
    }
    pageButton.onclick = () => {
      const currentHash = window.location.hash
      if (currentHash.startsWith("#search/")) {
        const queryString = currentHash.substring("#search/".length)
        const params = new URLSearchParams(queryString)
        params.set("page", i)
        window.location.hash = `search/${params.toString()}`
      } else {
        // Home page
        const params = new URLSearchParams(currentHash.substring(currentHash.indexOf("?")))
        params.set("generalPage", i)
        window.location.hash = `home?${params.toString()}`
      }

      // THIS IS THE NEW PART: Scroll to the general listings container
      setTimeout(() => {
        const targetElement = document.getElementById("general-listings-container");
        if (targetElement) {
          targetElement.scrollIntoView({ behavior: "smooth" });
        }
      }, 100);
    }
    paginationContainer.appendChild(pageButton)
  }
}

function populateGrid(gridElement, listings, emptyMessage) {
  gridElement.innerHTML = ""
  if (listings.length === 0) {
    gridElement.appendChild(
      createElement("p", ["col-span-full", "text-center", "text-slate-500", "py-10"], emptyMessage),
    )
    return
  }
  listings.forEach((listing) => {
    const card = createElement("div", [
      "bg-white",
      "rounded-xl",
      "shadow-md",
      "overflow-hidden",
      "transform",
      "hover:-translate-y-1",
      "transition-all",
      "duration-300",
      "cursor-pointer",
      "relative",
      "flex",
      "flex-col",
      "border",
      "border-slate-200",
      "hover:shadow-lg",
    ])
    const imageUrl = listing.imageUrls?.[0] || "https://placehold.co/600x400/e2e8f0/64748b?text=ไม่มีรูปภาพ"
    const image = createElement("img", ["w-full", "h-48", "object-cover"], "", { src: imageUrl, alt: listing.title })
    image.onerror = () => {
      image.src = "https://placehold.co/600x400/e2e8f0/64748b?text=รูปภาพเสียหาย"
    }
    if (listing.isBoosted) {
      const badge = createElement("div", ["boosted-badge"], " ประกาศแนะนำ")
      badge.prepend(createElement("i", ["fas", "fa-rocket"]))
      card.appendChild(badge)
    }
    const contentDiv = createElement("div", ["p-4", "flex", "flex-col", "flex-grow"])
    contentDiv.appendChild(
      createElement("h4", ["font-bold", "text-lg", "break-words", "text-slate-800"], listing.title),
    )
    const locationP = createElement(
      "p",
      ["text-sm", "text-slate-500", "mb-2"],
      ` ${listing.district}, ${listing.province}`,
    )
    locationP.prepend(createElement("i", ["fas", "fa-map-marker-alt", "mr-1"]))
    contentDiv.appendChild(locationP)
    contentDiv.appendChild(
      createElement("p", ["text-indigo-600", "font-bold", "text-xl", "mb-3"], getPriceDisplay(listing.priceRent)),
    )
    const footerDiv = createElement("div", [
      "mt-auto",
      "flex",
      "justify-between",
      "items-center",
      "text-xs",
      "text-slate-500",
      "pt-2",
      "border-t",
      "border-slate-200",
    ])
    // MODIFIED: Removed the "edited" label. The card now only shows the original post time.
    const dateToFormat = listing.createdAt
    const dateSpan = createElement("span", ["font-semibold"], formatTimestamp(dateToFormat))
    footerDiv.appendChild(dateSpan)

    contentDiv.appendChild(footerDiv)
    card.append(image, contentDiv)
    card.addEventListener("click", () => navigateToListing(listing.id))
    gridElement.appendChild(card)
  })
}

function getPriceDisplay(rent) {
  return rent > 0 ? `฿${rent.toLocaleString()}/เดือน` : "ติดต่อผู้ให้เช่า"
}

async function renderListingDetailPage(listingId) {
  listingDetailView.innerHTML = `<div class="text-center p-10"><i class="fas fa-spinner fa-spin text-3xl"></i></div>`
  try {
    const docRef = doc(db, "listings", listingId)
    const docSnap = await getDoc(docRef)
    if (!docSnap.exists()) {
      listingDetailView.innerHTML = `<p class="text-center text-rose-600">ไม่พบประกาศนี้</p>`
      return
    }
    const listing = { id: docSnap.id, ...docSnap.data() }
    listingDetailView.innerHTML = "" // Clear spinner

    const mainGrid = createElement("div", ["grid", "grid-cols-1", "lg:grid-cols-2", "gap-8", "mt-4"])
    const imageCol = createElement("div")
    const detailsCol = createElement("div")
    const imageUrls =
      listing.imageUrls?.length > 0 ? listing.imageUrls : ["https://placehold.co/800x600/e2e8f0/64748b?text=ไม่มีรูปภาพ"]
    const mainImage = createElement(
      "img",
      [
        "w-full",
        "h-96",
        "object-cover",
        "rounded-lg",
        "shadow-md",
        "mb-4",
        "cursor-pointer",
        "border",
        "border-slate-200",
      ],
      "",
      { id: "main-detail-image", src: imageUrls[0] },
    )
    mainImage.onclick = () => openLightbox(mainImage.src)
    mainImage.onerror = () => {
      mainImage.src = "https://placehold.co/800x600/e2e8f0/64748b?text=รูปภาพเสียหาย"
    }
    const thumbnailGrid = createElement("div", ["grid", "grid-cols-4", "gap-2"])
    imageUrls.forEach((url) => {
      const thumb = createElement(
        "img",
        [
          "h-24",
          "w-full",
          "object-cover",
          "rounded-md",
          "cursor-pointer",
          "border-2",
          "border-transparent",
          "hover:border-indigo-500",
          "transition-colors",
        ],
        "",
        { src: url },
      )
      thumb.onclick = () => (mainImage.src = url)
      thumb.onerror = () => (thumb.style.display = "none")
      thumbnailGrid.appendChild(thumb)
    })
    imageCol.append(mainImage, thumbnailGrid)

    const detailsHeader = createElement("div", [
      "flex",
      "flex-col",
      "sm:flex-row",
      "sm:justify-between",
      "sm:items-center",
      "gap-2",
      "mb-2",
    ])
    detailsHeader.appendChild(
      createElement(
        "span",
        ["bg-indigo-100", "text-indigo-800", "text-xs", "font-medium", "px-2.5", "py-0.5", "rounded", "self-start"],
        listing.type,
      ),
    )

    const postedDateSpan = createElement(
      "span",
      ["text-sm", "text-slate-500", "self-start", "sm:self-center"],
      `โพสต์เมื่อ ${formatTimestamp(listing.createdAt, true)}`, // Show original post date
    );
    postedDateSpan.prepend(createElement("i", ["fas", "fa-calendar-alt", "mr-1"]));
    detailsHeader.appendChild(postedDateSpan);

    // MODIFIED: Removed the block that showed the "edited" timestamp.

    detailsCol.appendChild(detailsHeader)
    detailsCol.appendChild(
      createElement("h3", ["text-3xl", "font-bold", "mt-2", "mb-2", "break-words", "text-slate-800"], listing.title),
    )
    const locationP = createElement(
      "p",
      ["text-lg", "text-slate-600", "mb-4"],
      `${listing.district}, ${listing.province}`,
    )
    locationP.prepend(createElement("i", ["fas", "fa-map-marker-alt", "mr-2"]))
    detailsCol.appendChild(locationP)
    detailsCol.appendChild(
      createElement("p", ["text-3xl", "font-bold", "text-indigo-600", "mb-4"], getPriceDisplay(listing.priceRent)),
    )
    if (listing.priceInitial > 0) {
      const initialPriceDiv = createElement("div", [
        "mt-4",
        "p-3",
        "bg-slate-50",
        "rounded-lg",
        "border",
        "border-slate-200",
      ])
      const initialPriceP = createElement(
        "p",
        ["text-md", "text-slate-800"],
        `ราคาเข้าอยู่ครั้งแรก: ${listing.priceInitial.toLocaleString()} บาท`,
      )
      initialPriceP.prepend(
        createElement("i", ["fas", "fa-file-invoice-dollar", "mr-2", "text-emerald-500"]),
        createElement("strong", [], ""),
      )
      initialPriceDiv.appendChild(initialPriceP)
      detailsCol.appendChild(initialPriceDiv)
    }
    if (listing.availableDate) {
      const availableDateDiv = createElement("div", [
        "mt-2",
        "p-3",
        "bg-slate-50",
        "rounded-lg",
        "border",
        "border-slate-200",
      ])
      const availableDateP = createElement(
        "p",
        ["text-md", "text-slate-800"],
        `วันที่เข้าอยู่ได้: ${new Date(listing.availableDate).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric", calendar: "buddhist" })}`,
      )
      availableDateP.prepend(
        createElement("i", ["fas", "fa-calendar-check", "mr-2", "text-indigo-500"]),
        createElement("strong", [], ""),
      )
      availableDateDiv.appendChild(availableDateP)
      detailsCol.appendChild(availableDateDiv)
    }
    detailsCol.appendChild(createElement("h5", ["font-bold", "text-lg", "mt-6", "mb-2", "text-slate-800"], "รายละเอียด"))
    detailsCol.appendChild(
      createElement("p", ["text-slate-700", "whitespace-pre-wrap", "break-words", "mb-6"], listing.description),
    )
    const contactBox = createElement("div", ["bg-slate-100", "p-4", "rounded-lg", "border", "border-slate-200"])
    contactBox.appendChild(createElement("h5", ["font-bold", "text-lg", "mb-2", "text-slate-800"], "ข้อมูลติดต่อ"))
    const ownerP = createElement("p", ["text-slate-800"])
    ownerP.innerHTML = `<i class="fas fa-user mr-2"></i><a href="#" onclick="event.preventDefault(); navigateToProfile('${listing.ownerUid}')" class="text-indigo-600 hover:underline">${listing.ownerUsername || listing.ownerEmail}</a>`
    contactBox.appendChild(ownerP)
    const phoneP = createElement("p", ["text-slate-800"])
    phoneP.innerHTML = `<i class="fas fa-phone mr-2"></i><a href="tel:${listing.phone}" class="text-indigo-600 hover:underline">${listing.phone || "-"}</a>`
    contactBox.appendChild(phoneP)
    const lineP = createElement("p", ["text-slate-800"])
    lineP.innerHTML = `<i class="fab fa-line mr-2"></i><a href="https://line.me/ti/p/~${listing.lineId}" target="_blank" rel="noopener noreferrer" class="text-emerald-600 hover:underline">${listing.lineId || "-"}</a>`
    contactBox.appendChild(lineP)
    detailsCol.appendChild(contactBox)

    if (currentUser && (currentUser.uid === listing.ownerUid || currentUser.role === "admin")) {
      const actionsDiv = createElement("div", ["mt-6", "flex", "flex-wrap", "gap-4"])

      const editBtn = createElement(
        "button",
        [
          "flex-1",
          "py-3",
          "bg-amber-500",
          "text-white",
          "font-bold",
          "rounded-md",
          "hover:bg-amber-600",
          "transition-colors",
        ],
        "แก้ไข",
      )
      editBtn.prepend(createElement("i", ["fas", "fa-edit", "mr-2"]))
      editBtn.onclick = () => editListing(listing.id)

      const deleteBtn = createElement(
        "button",
        [
          "flex-1",
          "py-3",
          "bg-rose-600",
          "text-white",
          "font-bold",
          "rounded-md",
          "hover:bg-rose-700",
          "transition-colors",
        ],
        "ลบ",
      )
      deleteBtn.prepend(createElement("i", ["fas", "fa-trash", "mr-2"]))
      deleteBtn.onclick = () => deleteListing(listing.id)

      actionsDiv.append(editBtn, deleteBtn)

      const boostBtn = createElement("button", [
        "w-full",
        "py-3",
        "text-white",
        "font-bold",
        "rounded-md",
        "mt-2",
        "transition-colors",
      ])

      const now = new Date()
      const isBoostedAndActive =
        listing.isBoosted && (!listing.boostExpiryDate || listing.boostExpiryDate.toDate() > now)

      if (listing.boostStatus === "pending") {
        boostBtn.innerHTML = '<i class="fas fa-clock mr-2"></i>รอการอนุมัติ'
        boostBtn.classList.add("bg-amber-500", "cursor-not-allowed")
        boostBtn.disabled = true
      } else if (isBoostedAndActive) {
        boostBtn.innerHTML = '<i class="fas fa-check-circle mr-2"></i>ดันโพสต์แล้ว'
        boostBtn.classList.add("bg-slate-400", "cursor-not-allowed")
        boostBtn.disabled = true
      } else {
        boostBtn.innerHTML = '<i class="fas fa-rocket mr-2"></i>ดันโพสต์'
        boostBtn.classList.add("bg-purple-600", "hover:bg-purple-700")
        boostBtn.onclick = () => openBoostModal(listing.id)
      }
      actionsDiv.appendChild(boostBtn)
      detailsCol.appendChild(actionsDiv)
    }
    mainGrid.append(imageCol, detailsCol)
    listingDetailView.appendChild(mainGrid)
  } catch (error) {
    console.error("Error rendering listing page:", error)
    listingDetailView.innerHTML = `<p class="text-center text-rose-600">เกิดข้อผิดพลาดในการโหลดข้อมูลประกาศ</p>`
  }
}

async function editListing(id) {
  const docRef = doc(db, "listings", id)
  const docSnap = await getDoc(docRef)
  if (docSnap.exists()) {
    const listing = { id: docSnap.id, ...docSnap.data() }
    closeAllModals()
    postForm.reset()
    document.getElementById("post-modal-title").textContent = "แก้ไขประกาศ"
    document.getElementById("post-id").value = listing.id
    document.getElementById("post-title").value = listing.title
    document.getElementById("post-type").value = listing.type
    document.getElementById("post-price-rent").value = listing.priceRent
    document.getElementById("post-price-initial").value = listing.priceInitial || ""
    document.getElementById("post-available-date").value = listing.availableDate || ""
    document.getElementById("post-description").value = listing.description
    document.getElementById("post-phone").value = listing.phone
    document.getElementById("post-line-id").value = listing.lineId
    imageUploadInput.value = ""
    selectedFiles = []
    existingImageUrls = listing.imageUrls || []
    renderImagePreviews()
    const postProvince = document.getElementById("post-province")
    postProvince.value = listing.province
    populateDistrictDropdowns(listing.province, "post-district")
    setTimeout(() => {
      const postDistrict = document.getElementById("post-district")
      postDistrict.value = listing.district
    }, 50)
    openModal("postModal")
  }
}

async function deleteListing(id) {
  openConfirmModal(
    "คุณแน่ใจหรือไม่ว่าต้องการลบประกาศนี้?",
    async () => {
      try {
        const currentHash = window.location.hash;
        await deleteDoc(doc(db, "listings", id));
        showAlertModal("ลบประกาศสำเร็จ!");

        if (currentHash === `#listing/${id}`) {
          // If deleting from the detail page, go home
          navigateToHome();
        } else {
          // Otherwise, just refresh the current list view (admin or profile)
          router();
        }
      } catch (error) {
        console.error("Error deleting document: ", error);
        showAlertModal("เกิดข้อผิดพลาดในการลบ");
      }
    },
    "bg-rose-600 hover:bg-rose-700",
  );
}

const boostPlans = [
  { id: "3_days", days: 3, price: 49, title: "3 วัน", description: "ราคาพิเศษช่วงเปิดตัว" },
  { id: "7_days", days: 7, price: 99, title: "7 วัน", description: "แพ็กเกจยอดนิยม" },
  { id: "30_days", days: 30, price: 249, title: "30 วัน", description: "คุ้มค่าที่สุด!" },
]
let selectedBoostPlan = null
let currentBoostingPostId = null

function openBoostModal(listingId) {
  currentBoostingPostId = listingId
  selectedBoostPlan = null

  document.getElementById("boost-selection-view").style.display = "block"
  document.getElementById("boost-thanks-view").style.display = "none"
  document.getElementById("payment-details-container").classList.add("hidden")

  const confirmBtn = document.getElementById("confirm-payment-button")
  confirmBtn.disabled = true
  confirmBtn.classList.add("opacity-50", "cursor-not-allowed")

  const slipInput = document.getElementById("payment-slip-upload")
  const slipFilename = document.getElementById("slip-filename")
  slipInput.value = ""
  slipFilename.textContent = ""

  const plansContainer = document.getElementById("boost-plans-container")
  plansContainer.innerHTML = ""

  boostPlans.forEach((plan) => {
    const card = createElement("div", [
      "boost-plan-card",
      "p-4",
      "rounded-lg",
      "cursor-pointer",
      "text-center",
      "bg-white",
    ])
    card.dataset.planId = plan.id
    card.appendChild(createElement("h5", ["font-bold", "text-xl", "text-slate-800"], plan.title))
    card.appendChild(createElement("p", ["text-2xl", "font-bold", "my-2", "text-indigo-600"], `฿${plan.price}`))
    card.appendChild(createElement("p", ["text-sm", "text-slate-500"], plan.description))
    card.onclick = () => {
      document.querySelectorAll(".boost-plan-card").forEach((c) => c.classList.remove("selected"))
      card.classList.add("selected")
      selectedBoostPlan = plan
      document.getElementById("payment-details-container").classList.remove("hidden")
      document.getElementById("payment-amount").textContent = plan.price
      if (slipInput.files.length > 0) {
        confirmBtn.disabled = false
        confirmBtn.classList.remove("opacity-50", "cursor-not-allowed")
      }
    }
    plansContainer.appendChild(card)
  })

  slipInput.addEventListener("change", () => {
    if (slipInput.files.length > 0) {
      slipFilename.textContent = `ไฟล์ที่เลือก: ${slipInput.files[0].name}`
      if (selectedBoostPlan) {
        confirmBtn.disabled = false
        confirmBtn.classList.remove("opacity-50", "cursor-not-allowed")
      }
    } else {
      slipFilename.textContent = ""
      confirmBtn.disabled = true
      confirmBtn.classList.add("opacity-50", "cursor-not-allowed")
    }
  })

  openModal("boostModal")
}

document.getElementById("confirm-payment-button").addEventListener("click", async () => {
  if (!selectedBoostPlan || !currentBoostingPostId) return

  const slipInput = document.getElementById("payment-slip-upload")
  const slipFile = slipInput.files[0]

  if (!slipFile) {
    showAlertModal("กรุณาอัปโหลดสลิปการโอนเงิน")
    return
  }

  const confirmBtn = document.getElementById("confirm-payment-button")
  confirmBtn.disabled = true
  confirmBtn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i>กำลังอัปโหลด...`

  try {
    const imageUrls = await uploadImages([slipFile])
    const slipUrl = imageUrls[0]

    if (!slipUrl) {
      throw new Error("ไม่สามารถอัปโหลดสลิปได้")
    }

    const docRef = doc(db, "listings", currentBoostingPostId)
    await updateDoc(docRef, {
      boostStatus: "pending",
      boostTier: selectedBoostPlan.id,
      boostPrice: selectedBoostPlan.price,
      boostRequestedAt: serverTimestamp(),
      paymentSlipUrl: slipUrl,
    })

    document.getElementById("boost-selection-view").style.display = "none"
    document.getElementById("boost-thanks-view").style.display = "block"
    setTimeout(() => {
      closeModal("boostModal")
      router()
    }, 4000)
  } catch (error) {
    console.error("Error requesting boost:", error)
    showAlertModal("เกิดข้อผิดพลาด: " + error.message)
  } finally {
    confirmBtn.disabled = false
    confirmBtn.innerHTML = '<i class="fas fa-check-circle mr-2"></i>ยืนยันการชำระเงิน'
  }
})

async function renderAdminView(activeTab = "dashboard") {
  const adminMainContent = document.getElementById("admin-main-content")
  adminMainContent.innerHTML = `<div class="text-center p-10"><i class="fas fa-spinner fa-spin text-3xl text-indigo-500"></i></div>`
  document.querySelectorAll(".admin-sidebar-link").forEach((link) => link.classList.remove("active"))
  document.getElementById(`admin-${activeTab}-link`).classList.add("active")
  if (activeTab === "dashboard") {
    await renderAdminDashboard()
  } else if (activeTab === "listings") {
    await renderAdminListingsTable()
  } else if (activeTab === "users") {
    await renderAdminUsersTable()
  } else if (activeTab === "boosts") {
    await renderAdminBoostsTable()
  } else if (activeTab === "boosted") {
    await renderAdminBoostedTable()
  }
}
async function renderAdminDashboard() {
  const adminMainContent = document.getElementById("admin-main-content")
  try {
    const [listingsSnapshot, usersSnapshot] = await Promise.all([
      getDocs(query(listingsCollection)),
      getDocs(query(usersCollection)),
    ])
    const totalListings = listingsSnapshot.size
    const totalUsers = usersSnapshot.size
    let boostedListings = 0
    listingsSnapshot.forEach((doc) => {
      if (doc.data().isBoosted) {
        boostedListings++
      }
    })
    adminMainContent.innerHTML = ""
    const dashboardGrid = createElement("div", ["grid", "grid-cols-1", "sm:grid-cols-2", "lg:grid-cols-3", "gap-6"])
    const createStatCard = (title, value, iconClass, colorClass) => {
      const card = createElement("div", [
        "bg-white",
        "p-6",
        "rounded-lg",
        "shadow-md",
        "flex",
        "items-center",
        "gap-4",
        "border",
        "border-slate-200",
      ])
      const iconDiv = createElement("div", [
        `w-12`,
        `h-12`,
        "rounded-full",
        "flex",
        "items-center",
        "justify-center",
        colorClass,
      ])
      iconDiv.innerHTML = `<i class="fas ${iconClass} text-white text-xl"></i>`
      const textDiv = createElement("div")
      textDiv.appendChild(createElement("p", ["text-3xl", "font-bold", "text-slate-800"], value.toLocaleString()))
      textDiv.appendChild(createElement("p", ["text-slate-500"], title))
      card.append(iconDiv, textDiv)
      return card
    }
    dashboardGrid.appendChild(createStatCard("ประกาศทั้งหมด", totalListings, "fa-list-alt", "bg-indigo-500"))
    dashboardGrid.appendChild(createStatCard("ผู้ใช้ทั้งหมด", totalUsers, "fa-users", "bg-emerald-500"))
    dashboardGrid.appendChild(createStatCard("ประกาศแนะนำ", boostedListings, "fa-rocket", "bg-purple-500"))
    adminMainContent.appendChild(dashboardGrid)
  } catch (error) {
    console.error("Error loading admin dashboard:", error)
    adminMainContent.innerHTML = `<div class="bg-white p-6 rounded-lg shadow-md text-rose-600 border border-rose-200">เกิดข้อผิดพลาด: ${error.message}</div>`
  }
}
async function renderAdminListingsTable() {
  const adminMainContent = document.getElementById("admin-main-content")
  adminMainContent.innerHTML = ""
  const container = createElement("div", ["bg-white", "p-6", "rounded-lg", "shadow-md", "border", "border-slate-200"])
  const searchInput = createElement(
    "input",
    ["w-full", "p-2", "border", "border-slate-300", "rounded-md", "mb-4"],
    "",
    {
      id: "admin-listings-search",
      name: "admin-listings-search",
      type: "text",
      placeholder: "ค้นหาประกาศด้วยชื่อ, อีเมลผู้ใช้, หรือรหัสประกาศ...",
    },
  )
  const tableContainer = createElement("div", ["overflow-x-auto"])
  const paginationContainer = createElement("div", {}) // NEW: Container for pagination controls
  container.append(searchInput, tableContainer, paginationContainer) // MODIFIED: Added paginationContainer
  adminMainContent.appendChild(container)
  tableContainer.innerHTML = `<div class="text-center p-4"><i class="fas fa-spinner fa-spin text-2xl text-indigo-500"></i></div>`
  try {
    const querySnapshot = await getDocs(query(listingsCollection, orderBy("createdAt", "desc")))
    currentAdminListings = []
    querySnapshot.forEach((doc) => {
      currentAdminListings.push({ id: doc.id, ...doc.data() })
    })
    searchInput.addEventListener("input", (e) => {
      const searchTerm = e.target.value.toLowerCase()
      adminListingsCurrentPage = 1 // NEW: Reset to page 1 on search
      const filtered = currentAdminListings.filter(
        (l) =>
          l.title.toLowerCase().includes(searchTerm) ||
          l.ownerUsername.toLowerCase().includes(searchTerm) ||
          l.ownerEmail.toLowerCase().includes(searchTerm) ||
          l.id.toLowerCase().includes(searchTerm),
      )
      populateAdminListingsTable(tableContainer, paginationContainer, filtered)
    })
    populateAdminListingsTable(tableContainer, paginationContainer, currentAdminListings)
  } catch (error) {
    console.error("Error fetching for admin panel:", error)
    tableContainer.innerHTML = `<div class="text-center text-rose-600 p-4">เกิดข้อผิดพลาด (อาจไม่มีสิทธิ์เข้าถึง)</div>`
  }
}

function populateAdminListingsTable(tableContainer, paginationContainer, listings) {
  tableContainer.innerHTML = ""
  if (listings.length === 0) {
    tableContainer.innerHTML = `<p class="text-center text-slate-500 p-4">ไม่พบประกาศ</p>`
    paginationContainer.innerHTML = "" // NEW: Clear pagination if no results
    return
  }

  // NEW: Pagination logic
  const start = (adminListingsCurrentPage - 1) * adminListingsPerPage
  const end = start + adminListingsPerPage
  const pageListings = listings.slice(start, end)

  const table = createElement("table", ["w-full", "text-sm", "text-left", "text-slate-600"])
  table.innerHTML = `<thead class="bg-slate-50 text-slate-700"><tr><th class="p-3">รหัสประกาศ</th><th class="p-3">หัวข้อประกาศ</th><th class="p-3">ผู้ลงประกาศ</th><th class="p-3">ประเภท</th><th class="p-3">ราคา</th><th class="p-3">วันที่ลง</th><th class="p-3">จัดการ</th></tr></thead>`
  const tbody = createElement("tbody")
  pageListings.forEach((listing) => {
    const tr = createElement("tr", ["border-b", "border-slate-200"])
    tr.appendChild(createElement("td", ["p-3", "font-mono", "text-xs"], listing.id))
    tr.appendChild(createElement("td", ["p-3", "font-medium", "text-slate-800"], listing.title))
    tr.appendChild(createElement("td", ["p-3"], listing.ownerUsername || listing.ownerEmail))
    tr.appendChild(createElement("td", ["p-3"], listing.type))
    tr.appendChild(createElement("td", ["p-3"], getPriceDisplay(listing.priceRent)))
    tr.appendChild(createElement("td", ["p-3"], formatTimestamp(listing.createdAt)))
    const actionsCell = createElement("td", ["p-3", "flex", "gap-3", "items-center"])
    const viewBtn = createElement("button", ["text-indigo-600", "hover:text-indigo-800"], "", { title: "ดูประกาศ" })
    viewBtn.innerHTML = '<i class="fas fa-eye"></i>'
    viewBtn.onclick = () => navigateToListing(listing.id)
    const editBtn = createElement("button", ["text-amber-600", "hover:text-amber-800"], "", { title: "แก้ไข" })
    editBtn.innerHTML = '<i class="fas fa-edit"></i>'
    editBtn.onclick = () => editListing(listing.id)
    const deleteBtn = createElement("button", ["text-rose-600", "hover:text-rose-800"], "", { title: "ลบ" })
    deleteBtn.innerHTML = '<i class="fas fa-trash"></i>'
    deleteBtn.onclick = () => deleteListing(listing.id)

    const now = new Date()
    const isBoostedAndActive = listing.isBoosted && (!listing.boostExpiryDate || listing.boostExpiryDate.toDate() > now)
    if (isBoostedAndActive) {
      const removeBoostBtn = createElement("button", ["text-purple-600", "hover:text-purple-800"], "", {
        title: "เอาโพสต์ลงจากการดัน",
      })
      removeBoostBtn.innerHTML = '<i class="fas fa-arrow-down"></i>'
      removeBoostBtn.onclick = () => removeBoost(listing.id)
      actionsCell.appendChild(removeBoostBtn)
    }

    actionsCell.append(viewBtn, editBtn, deleteBtn)
    tr.appendChild(actionsCell)
    tbody.appendChild(tr)
  })
  table.appendChild(tbody)
  tableContainer.appendChild(table)
  renderAdminListingsPagination(paginationContainer, listings.length)
}
// NEW: Function to render pagination controls for the admin listings table
function renderAdminListingsPagination(paginationContainer, totalListings) {
  paginationContainer.innerHTML = ""
  const totalPages = Math.ceil(totalListings / adminListingsPerPage)

  if (totalPages <= 1) return

  const paginationWrapper = createElement("div", ["flex", "justify-center", "items-center", "mt-6", "gap-2"])

  for (let i = 1; i <= totalPages; i++) {
    const pageButton = createElement("button", ["px-4", "py-2", "border", "rounded-md", "transition-colors", "text-sm"])
    pageButton.textContent = i
    if (i === adminListingsCurrentPage) {
      pageButton.classList.add("bg-indigo-600", "text-white", "border-indigo-600")
    } else {
      pageButton.classList.add("bg-white", "text-slate-700", "hover:bg-slate-100", "border-slate-300")
    }
    pageButton.onclick = () => {
      window.location.hash = `#admin/listings?page=${i}`
    }
    paginationWrapper.appendChild(pageButton)
  }
  paginationContainer.appendChild(paginationWrapper)
}
async function renderAdminUsersTable() {
  const adminMainContent = document.getElementById("admin-main-content")
  adminMainContent.innerHTML = ""
  const container = createElement("div", ["bg-white", "p-6", "rounded-lg", "shadow-md", "border", "border-slate-200"])
  const searchInput = createElement(
    "input",
    ["w-full", "p-2", "border", "border-slate-300", "rounded-md", "mb-4"],
    "",
    {
      id: "admin-users-search",
      name: "admin-users-search",
      type: "text",
      placeholder: "ค้นหาผู้ใช้ด้วย Username หรืออีเมล...",
    },
  )
  const tableContainer = createElement("div", ["overflow-x-auto"])
  container.append(searchInput, tableContainer)
  adminMainContent.appendChild(container)
  tableContainer.innerHTML = `<div class="text-center p-4"><i class="fas fa-spinner fa-spin text-2xl text-indigo-500"></i></div>`
  try {
    const querySnapshot = await getDocs(query(usersCollection, orderBy("createdAt", "desc")))
    currentAdminUsers = []
    querySnapshot.forEach((doc) => {
      currentAdminUsers.push({ id: doc.id, ...doc.data() })
    })
    searchInput.addEventListener("input", (e) => {
      const searchTerm = e.target.value.toLowerCase()
      const filtered = currentAdminUsers.filter(
        (u) => u.username.toLowerCase().includes(searchTerm) || u.email.toLowerCase().includes(searchTerm),
      )
      populateAdminUsersTable(tableContainer, filtered)
    })
    populateAdminUsersTable(tableContainer, currentAdminUsers)
  } catch (error) {
    console.error("Error fetching users for admin panel:", error)
    tableContainer.innerHTML = `<div class="text-center text-rose-600 p-4">เกิดข้อผิดพลาด (อาจไม่มีสิทธิ์เข้าถึง)</div>`
  }
}
function populateAdminUsersTable(container, users) {
  container.innerHTML = ""
  if (users.length === 0) {
    container.innerHTML = `<p class="text-center text-slate-500 p-4">ไม่พบผู้ใช้</p>`
    return
  }
  const table = createElement("table", ["w-full", "text-sm", "text-left", "text-slate-600"])
  table.innerHTML = `<thead class="bg-slate-50 text-slate-700"><tr><th class="p-3">Username</th><th class="p-3">อีเมล</th><th class="p-3">วันที่สมัคร</th><th class="p-3">จัดการ</th></tr></thead>`
  const tbody = createElement("tbody")
  users.forEach((user) => {
    const tr = createElement("tr", ["border-b", "border-slate-200"])
    tr.appendChild(createElement("td", ["p-3", "font-medium", "text-slate-800"], user.username))
    tr.appendChild(createElement("td", ["p-3"], user.email))
    tr.appendChild(createElement("td", ["p-3"], formatTimestamp(user.createdAt, true)))
    const actionsCell = createElement("td", ["p-3"])
    const viewProfileBtn = createElement("button", ["text-indigo-600", "hover:text-indigo-800"], " ดูโปรไฟล์", {
      title: "ดูโปรไฟล์",
    })
    viewProfileBtn.prepend(createElement("i", ["fas", "fa-user-circle", "mr-1"]))
    viewProfileBtn.onclick = () => navigateToProfile(user.id)
    actionsCell.append(viewProfileBtn)
    tr.appendChild(actionsCell)
    tbody.appendChild(tr)
  })
  table.appendChild(tbody)
  container.appendChild(table)
}
async function renderAdminBoostsTable() {
  const adminMainContent = document.getElementById("admin-main-content")
  adminMainContent.innerHTML = ""
  const container = createElement("div", ["bg-white", "p-6", "rounded-lg", "shadow-md", "border", "border-slate-200"])
  container.appendChild(
    createElement("h4", ["text-xl", "font-bold", "mb-4", "text-slate-800"], "คำขอดันประกาศที่รอการอนุมัติ"),
  )
  const tableContainer = createElement("div", ["overflow-x-auto"])
  container.appendChild(tableContainer)
  adminMainContent.appendChild(container)
  tableContainer.innerHTML = `<div class="text-center p-4"><i class="fas fa-spinner fa-spin text-2xl text-indigo-500"></i></div>`
  try {
    const q = query(listingsCollection, where("boostStatus", "==", "pending"))
    const querySnapshot = await getDocs(q)
    const pendingBoosts = []
    querySnapshot.forEach((doc) => pendingBoosts.push({ id: doc.id, ...doc.data() }))
    pendingBoosts.sort((a, b) => (b.boostRequestedAt?.toMillis() || 0) - (a.boostRequestedAt?.toMillis() || 0))
    populateAdminBoostsTable(tableContainer, pendingBoosts)
  } catch (error) {
    console.error("Error fetching pending boosts:", error)
    tableContainer.innerHTML = `<div class="text-center text-rose-600 p-4">เกิดข้อผิดพลาดในการโหลดข้อมูล</div>`
  }
}

function populateAdminBoostsTable(container, listings) {
  container.innerHTML = ""
  if (listings.length === 0) {
    container.innerHTML = `<p class="text-center text-slate-500 p-4">ไม่มีคำขอที่รอการอนุมัติ</p>`
    return
  }
  const table = createElement("table", ["w-full", "text-sm", "text-left", "text-slate-600"])
  table.innerHTML = `<thead class="bg-slate-50 text-slate-700"><tr><th class="p-3">รหัสประกาศ</th><th class="p-3">หัวข้อ</th><th class="p-3">แพ็กเกจ</th><th class="p-3">สลิป</th><th class="p-3">วันที่ขอ</th><th class="p-3">จัดการ</th></tr></thead>`
  const tbody = createElement("tbody")
  listings.forEach((listing) => {
    const plan = boostPlans.find((p) => p.id === listing.boostTier)
    const tr = createElement("tr", ["border-b", "border-slate-200"])
    tr.appendChild(createElement("td", ["p-3", "font-mono", "text-xs"], listing.id))
    tr.appendChild(createElement("td", ["p-3", "font-medium", "text-slate-800"], listing.title))
    tr.appendChild(createElement("td", ["p-3"], plan ? plan.title : "N/A"))

    const slipCell = createElement("td", ["p-3"])
    if (listing.paymentSlipUrl) {
      const slipLink = createElement("a", ["text-blue-600", "hover:underline", "font-semibold"], "ดูสลิป", {
        href: listing.paymentSlipUrl,
        target: "_blank",
        rel: "noopener noreferrer",
      })
      slipCell.appendChild(slipLink)
    } else {
      slipCell.textContent = "ไม่มี"
    }
    tr.appendChild(slipCell)

    tr.appendChild(createElement("td", ["p-3"], formatTimestamp(listing.boostRequestedAt)))
    const actionsCell = createElement("td", ["p-3", "flex", "gap-2"])
    const approveBtn = createElement(
      "button",
      [
        "px-3",
        "py-1",
        "bg-emerald-600",
        "text-white",
        "rounded-md",
        "hover:bg-emerald-700",
        "text-xs",
        "transition-colors",
      ],
      "อนุมัติ",
    )
    approveBtn.onclick = () => openAdminApproveModal(listing.id, listing.title, listing.boostTier)
    const rejectBtn = createElement(
      "button",
      ["px-3", "py-1", "bg-rose-600", "text-white", "rounded-md", "hover:bg-rose-700", "text-xs", "transition-colors"],
      "ไม่อนุมัติ",
    )
    rejectBtn.onclick = () => rejectBoost(listing.id, listing.ownerUid)
    actionsCell.append(approveBtn, rejectBtn)
    tr.appendChild(actionsCell)
    tbody.appendChild(tr)
  })
  table.appendChild(tbody)
  container.appendChild(table)
}

async function rejectBoost(listingId, ownerUid) {
  openConfirmModal(
    `คุณแน่ใจหรือไม่ว่าต้องการปฏิเสธคำขอดันโพสต์นี้?`,
    async () => {
      try {
        const docRef = doc(db, "listings", listingId)
        await updateDoc(docRef, {
          boostStatus: "rejected",
          boostTier: null,
          boostPrice: null,
          boostRequestedAt: null,
        })
        showAlertModal("ปฏิเสธคำขอสำเร็จ")
        renderAdminView("boosts")
      } catch (error) {
        console.error("Error rejecting boost:", error)
        showAlertModal("เกิดข้อผิดพลาดในการปฏิเสธคำขอ")
      }
    },
    "bg-rose-600 hover:bg-rose-700",
  )
}
function openAdminApproveModal(listingId, listingTitle, requestedTierId) {
  document.getElementById("admin-boost-listing-id").textContent = listingId
  const form = document.getElementById("admin-approve-boost-form")
  const plansContainer = document.getElementById("admin-boost-plans-container")
  plansContainer.innerHTML = ""
  boostPlans.forEach((plan, index) => {
    const div = createElement("div", ["flex", "items-center"])
    const input = createElement(
      "input",
      ["mr-2", "h-4", "w-4", "text-indigo-600", "border-slate-300", "focus:ring-indigo-500"],
      "",
      { type: "radio", id: `admin_${plan.id}`, name: "boost_plan", value: plan.days },
    )
    if (plan.id === requestedTierId) {
      input.checked = true
    }
    const label = createElement("label", ["text-slate-700"], `${plan.title} (${plan.price} บาท)`, {
      for: `admin_${plan.id}`,
    })
    div.append(input, label)
    plansContainer.appendChild(div)
  })
  form.onsubmit = (e) => {
    e.preventDefault()
    const selectedDays = new FormData(form).get("boost_plan")
    if (selectedDays) {
      approveBoost(listingId, Number.parseInt(selectedDays))
    } else {
      showAlertModal("กรุณาเลือกแพ็กเกจ")
    }
  }
  openModal("adminApproveBoostModal")
}
async function approveBoost(listingId, days) {
  openConfirmModal(
    `คุณแน่ใจหรือไม่ว่าต้องการอนุมัติการดันโพสต์ "${listingId}" เป็นเวลา ${days} วัน?`,
    async () => {
      try {
        const docRef = doc(db, "listings", listingId)
        const expiryDate = new Date()
        expiryDate.setDate(expiryDate.getDate() + days)
        await updateDoc(docRef, {
          isBoosted: true,
          boostStatus: "active",
          boostExpiryDate: expiryDate,
          updatedAt: serverTimestamp(),
        })
        closeModal("adminApproveBoostModal")
        showAlertModal("อนุมัติการดันโพสต์สำเร็จ!")
        renderAdminView("boosts")
      } catch (error) {
        console.error("Error approving boost:", error)
        showAlertModal("เกิดข้อผิดพลาดในการอนุมัติ")
      }
    },
    "bg-emerald-600 hover:bg-emerald-700",
  )
}
async function removeBoost(listingId) {
  openConfirmModal(
    `คุณแน่ใจหรือไม่ว่าต้องการเอาโพสต์ "${listingId}" ลงจากการดัน?`,
    async () => {
      try {
        const docRef = doc(db, "listings", listingId)
        await updateDoc(docRef, {
          isBoosted: false,
          boostStatus: "expired",
        })
        showAlertModal("นำโพสต์ลงจากการดันสำเร็จ!")
        router()
      } catch (error) {
        console.error("Error removing boost:", error)
        showAlertModal("เกิดข้อผิดพลาด")
      }
    },
    "bg-rose-600 hover:bg-rose-700",
  )
}
async function renderAdminBoostedTable() {
  const adminMainContent = document.getElementById("admin-main-content")
  adminMainContent.innerHTML = ""
  const container = createElement("div", ["bg-white", "p-6", "rounded-lg", "shadow-md", "border", "border-slate-200"])
  container.appendChild(createElement("h4", ["text-xl", "font-bold", "mb-4", "text-slate-800"], "ประกาศทั้งหมดที่กำลังดันอยู่"))
  const tableContainer = createElement("div", ["overflow-x-auto"])
  container.appendChild(tableContainer)
  adminMainContent.appendChild(container)
  tableContainer.innerHTML = `<div class="text-center p-4"><i class="fas fa-spinner fa-spin text-2xl text-indigo-500"></i></div>`
  try {
    const q = query(listingsCollection, where("isBoosted", "==", true))
    const querySnapshot = await getDocs(q)
    const boostedListings = []
    const now = new Date()
    querySnapshot.forEach((doc) => {
      const listing = { id: doc.id, ...doc.data() }
      if (listing.boostExpiryDate && listing.boostExpiryDate.toDate() > now) {
        boostedListings.push(listing)
      }
    })
    boostedListings.sort((a, b) => (a.boostExpiryDate?.toMillis() || 0) - (b.boostExpiryDate?.toMillis() || 0))
    populateAdminBoostedTable(tableContainer, boostedListings)
  } catch (error) {
    console.error("Error fetching boosted listings:", error)
    tableContainer.innerHTML = `<div class="text-center text-rose-600 p-4">เกิดข้อผิดพลาดในการโหลดข้อมูล</div>`
  }
}
function populateAdminBoostedTable(container, listings) {
  container.innerHTML = ""
  if (listings.length === 0) {
    container.innerHTML = `<p class="text-center text-slate-500 p-4">ไม่มีประกาศที่กำลังดันอยู่</p>`
    return
  }
  const table = createElement("table", ["w-full", "text-sm", "text-left", "text-slate-600"])
  table.innerHTML = `<thead class="bg-slate-50 text-slate-700"><tr><th class="p-3">หัวข้อ</th><th class="p-3">ผู้ลงประกาศ</th><th class="p-3">เวลาที่เหลือ</th><th class="p-3">วันหมดอายุ</th><th class="p-3">จัดการ</th></tr></thead>`
  const tbody = createElement("tbody")
  listings.forEach((listing) => {
    const tr = createElement("tr", ["border-b", "border-slate-200"])
    tr.appendChild(createElement("td", ["p-3", "font-medium", "text-slate-800"], listing.title))
    tr.appendChild(createElement("td", ["p-3"], listing.ownerUsername))
    tr.appendChild(
      createElement("td", ["p-3", "font-semibold", "text-emerald-600"], formatTimeRemaining(listing.boostExpiryDate)),
    )
    tr.appendChild(createElement("td", ["p-3"], formatTimestamp(listing.boostExpiryDate, true)))
    const actionsCell = createElement("td", ["p-3"])
    const removeBtn = createElement(
      "button",
      ["px-3", "py-1", "bg-rose-600", "text-white", "rounded-md", "hover:bg-rose-700", "text-xs", "transition-colors"],
      "เอาลง",
    )
    removeBtn.onclick = () => removeBoost(listing.id)
    actionsCell.appendChild(removeBtn)
    tr.appendChild(actionsCell)
    tbody.appendChild(tr)
  })
  table.appendChild(tbody)
  container.appendChild(table)
}

function renderProfilePagination(container, totalPages, userId) {
  container.innerHTML = ""
  if (totalPages <= 1) return
  for (let i = 1; i <= totalPages; i++) {
    const pageButton = createElement("button", ["px-4", "py-2", "border", "rounded-md", "transition-colors", "text-sm"])
    pageButton.textContent = i
    if (i === profileCurrentPage) {
      pageButton.classList.add("bg-indigo-600", "text-white", "border-indigo-600")
    } else {
      pageButton.classList.add("bg-white", "text-slate-700", "hover:bg-slate-100", "border-slate-300")
    }
    pageButton.onclick = () => {
      window.location.hash = `#profile/${userId}?page=${i}`
    }
    container.appendChild(pageButton)
  }
}
async function renderProfilePage(userId) {
  profileView.innerHTML = `<div class="text-center p-10"><i class="fas fa-spinner fa-spin text-3xl"></i></div>`
  try {
    const userDocRef = doc(db, "users", userId)
    const userDocSnap = await getDoc(userDocRef)
    if (!userDocSnap.exists()) {
      profileView.innerHTML = `<p class="text-center text-rose-600">ไม่พบข้อมูลผู้ใช้ หรือคุณไม่มีสิทธิ์เข้าถึง</p>`
      return
    }
    const userData = userDocSnap.data()
    const listingsQuery = query(listingsCollection, where("ownerUid", "==", userId), orderBy("createdAt", "desc"))
    const listingsSnapshot = await getDocs(listingsQuery)
    const userListings = []
    listingsSnapshot.forEach((doc) => {
      userListings.push({ id: doc.id, ...doc.data() })
    })
    const totalListings = userListings.length
    const totalPages = Math.ceil(totalListings / profileListingsPerPage)
    const start = (profileCurrentPage - 1) * profileListingsPerPage
    const end = start + profileListingsPerPage
    const pageListings = userListings.slice(start, end)
    profileView.innerHTML = ""
    const mainGrid = createElement("div", ["grid", "grid-cols-1", "lg:grid-cols-4", "gap-8"])
    const profileCol = createElement("div", [
      "lg:col-span-1",
      "bg-white",
      "p-6",
      "rounded-xl",
      "shadow-md",
      "text-center",
      "h-fit",
      "border",
      "border-slate-200",
    ])
    const listingsCol = createElement("div", ["lg:col-span-3"])
    const profilePicContainer = createElement("div", ["relative", "w-32", "h-32", "mx-auto"])
    const profilePicDisplay = createElement("div", [
      "w-32",
      "h-32",
      "bg-indigo-500",
      "rounded-full",
      "flex",
      "items-center",
      "justify-center",
      "text-white",
      "text-5xl",
      "font-bold",
      "mx-auto",
      "overflow-hidden",
      "border-4",
      "border-white",
      "shadow-md",
    ])
    if (userData.photoURL) {
      profilePicDisplay.appendChild(
        createElement("img", ["w-full", "h-full", "object-cover"], "", { src: userData.photoURL }),
      )
    } else {
      profilePicDisplay.textContent = userData.username.charAt(0).toUpperCase()
    }
    profilePicContainer.appendChild(profilePicDisplay)
    if (currentUser && currentUser.uid === userId) {
      profilePicDisplay.classList.add("cursor-pointer", "hover:opacity-80", "transition-opacity")
      profilePicDisplay.onclick = () => openProfilePictureModal()
      const cameraIcon = createElement("div", [
        "absolute",
        "bottom-0",
        "right-0",
        "bg-white",
        "rounded-full",
        "p-2",
        "shadow-md",
        "w-9",
        "h-9",
        "flex",
        "items-center",
        "justify-center",
      ])
      cameraIcon.innerHTML = `<i class="fas fa-camera text-slate-600"></i>`
      profilePicContainer.appendChild(cameraIcon)
    }
    profileCol.appendChild(profilePicContainer)
    profileCol.appendChild(createElement("h3", ["text-3xl", "font-bold", "mt-4", "text-slate-800"], userData.username))
    // MODIFIED: User email is now hidden from the profile page.
    // profileCol.appendChild(createElement("p", ["text-slate-500", "mt-1"], userData.email));
    const joinedDate = userData.createdAt ? formatTimestamp(userData.createdAt, true) : "ไม่ระบุ"
    const joinedP = createElement("p", ["text-sm", "text-slate-400", "mt-4"], `เข้าร่วมเมื่อ ${joinedDate}`)
    joinedP.prepend(createElement("i", ["fas", "fa-calendar-alt", "mr-2"]))
    profileCol.appendChild(joinedP)
    const contactDiv = createElement("div", ["text-left", "mt-6", "pt-4", "border-t", "border-slate-200"])
    contactDiv.appendChild(createElement("h4", ["font-semibold", "mb-2", "text-slate-700"], "ข้อมูลติดต่อสาธารณะ"))

    // MODIFIED: Made phone number a clickable "tel:" link.
    const phoneP = createElement("p", ["text-slate-800", "text-sm", "mb-1"])
    phoneP.prepend(createElement("i", ["fas", "fa-phone", "mr-2", "w-4", "text-center", "text-slate-400"]))
    if (userData.phone) {
      const phoneLink = createElement("a", ["text-indigo-600", "hover:underline"], userData.phone, {
        href: `tel:${userData.phone}`,
      })
      phoneP.appendChild(phoneLink)
    } else {
      phoneP.append("ยังไม่ได้ระบุ")
    }
    contactDiv.appendChild(phoneP)

    // MODIFIED: Made Line ID a clickable link to add the user on Line.
    const lineP = createElement("p", ["text-slate-800", "text-sm"])
    lineP.prepend(createElement("i", ["fab", "fa-line", "mr-2", "w-4", "text-center", "text-slate-400"]))
    if (userData.lineId) {
      const lineLink = createElement("a", ["text-emerald-600", "hover:underline"], userData.lineId, {
        href: `https://line.me/ti/p/~${userData.lineId}`,
        target: "_blank",
        rel: "noopener noreferrer",
      })
      lineP.appendChild(lineLink)
    } else {
      lineP.append("ยังไม่ได้ระบุ")
    }
    contactDiv.appendChild(lineP)

    profileCol.appendChild(contactDiv)
    if (currentUser && currentUser.uid === userId) {
      const editBtn = createElement(
        "button",
        [
          "mt-4",
          "w-full",
          "py-2",
          "bg-amber-500",
          "text-white",
          "font-bold",
          "rounded-md",
          "hover:bg-amber-600",
          "transition-colors",
        ],
        "แก้ไขโปรไฟล์",
      )
      editBtn.onclick = openEditProfileModal
      profileCol.appendChild(editBtn)
    }
    listingsCol.appendChild(
      createElement("h4", ["text-2xl", "font-bold", "mb-4", "text-slate-800"], `ประกาศทั้งหมด (${totalListings})`),
    )
    const listingsContainer = createElement("div", ["space-y-4"])
    const paginationContainer = createElement("div", ["flex", "justify-center", "items-center", "mt-8", "gap-2"])

    if (pageListings.length === 0) {
      listingsContainer.innerHTML =
        '<div class="text-center text-slate-500 mt-6 p-8 border border-dashed border-slate-300 rounded-lg bg-white">ผู้ใช้ยังไม่มีประกาศ</div>'
    } else {
      pageListings.forEach((listing) => {
        const listItem = createElement("div", [
          "bg-white",
          "rounded-xl",
          "shadow-md",
          "hover:shadow-lg",
          "transition-shadow",
          "border",
          "border-slate-200",
          "flex",
          "flex-col",
          "md:flex-row",
          "items-stretch",
          "overflow-hidden",
        ])

        // Image Section
        const imageLink = createElement("a", ["block", "md:w-48", "flex-shrink-0"], "", {
          href: `#listing/${listing.id}`,
        })
        const imageUrl = listing.imageUrls?.[0] || "https://placehold.co/400x300/e2e8f0/64748b?text=ไม่มีรูป"
        // MODIFIED: Changed image height class to 'h-32'
        const image = createElement("img", ["w-full", "h-24", "object-cover"], "", { src: imageUrl })
        image.onerror = () => {
          image.src = "https://placehold.co/400x300/e2e8f0/64748b?text=ไม่มีรูป"
        }
        imageLink.appendChild(image)

        // Content Section
        const contentDiv = createElement("div", ["p-4", "flex", "flex-col", "flex-grow"])
        const titleLink = createElement("a", [], "", { href: `#listing/${listing.id}` })
        titleLink.appendChild(
          createElement(
            "h5",
            ["font-bold", "text-lg", "text-slate-800", "hover:text-indigo-600", "transition-colors"],
            listing.title,
          ),
        )
        contentDiv.appendChild(titleLink)

        const detailsContainer = createElement("div", [
          "flex",
          "flex-wrap",
          "items-center",
          "gap-x-4",
          "gap-y-1",
          "text-sm",
          "text-slate-500",
          "mt-1",
        ])
        const priceSpan = createElement(
          "span",
          ["font-semibold", "text-indigo-600", "text-base"],
          getPriceDisplay(listing.priceRent),
        )
        const locationSpan = createElement("span")
        locationSpan.innerHTML = `<i class="fas fa-map-marker-alt mr-1"></i> ${listing.district}, ${listing.province}`
        const dateSpan = createElement("span")
        const dateText = formatTimestamp(listing.createdAt)
        const editedText =
          listing.updatedAt && listing.createdAt && listing.updatedAt.seconds > listing.createdAt.seconds + 10
            ? ` <span class="text-amber-600">(แก้ไข)</span>`
            : ""
        dateSpan.innerHTML = `<i class="fas fa-calendar-alt mr-1"></i> ${dateText}${editedText}`
        detailsContainer.append(priceSpan, locationSpan, dateSpan)
        contentDiv.appendChild(detailsContainer)

        contentDiv.appendChild(createElement("div", ["flex-grow"])) // Pushes the footer to the bottom

        // --- NEW: Footer for actions and ID ---
        const footerDiv = createElement("div", [
          "pt-3",
          "mt-3",
          "border-t",
          "border-slate-200",
          "flex",
          "justify-between",
          "items-center",
        ])

        // Action Buttons (Edit/Delete) are only shown to the owner
        if (currentUser && currentUser.uid === userId) {
          const actionButtons = createElement("div", ["flex", "gap-3"])

          const editBtn = createElement("button", ["text-sm", "text-amber-600", "hover:underline", "font-medium"])
          editBtn.innerHTML = '<i class="fas fa-edit mr-1"></i>แก้ไข'
          editBtn.onclick = (e) => {
            e.stopPropagation() // Prevent card click navigation
            editListing(listing.id)
          }

          const deleteBtn = createElement("button", ["text-sm", "text-rose-600", "hover:underline", "font-medium"])
          deleteBtn.innerHTML = '<i class="fas fa-trash mr-1"></i>ลบ'
          deleteBtn.onclick = (e) => {
            e.stopPropagation() // Prevent card click navigation
            deleteListing(listing.id)
          }

          actionButtons.append(editBtn, deleteBtn)
          footerDiv.appendChild(actionButtons)
        } else {
          // Add an empty div to maintain alignment if no buttons are shown
          footerDiv.appendChild(createElement("div"))
        }

        // Listing ID
        footerDiv.appendChild(createElement("p", ["text-xs", "text-slate-400"], `รหัสประกาศ: ${listing.id}`))
        contentDiv.appendChild(footerDiv)

        // Boost/Action Section
        const boostSection = createElement("div", [
          "p-4",
          "flex-shrink-0",
          "flex",
          "flex-col",
          "items-center",
          "justify-center",
          "bg-slate-50",
          "md:w-56",
          "border-t",
          "md:border-t-0",
          "md:border-l",
          "border-slate-200",
        ])
        const now = new Date()
        const isBoostedAndActive =
          listing.isBoosted && listing.boostExpiryDate && listing.boostExpiryDate.toDate() > now

        if (listing.boostStatus === "pending") {
          const status = createElement("p", ["text-sm", "font-semibold", "text-amber-600", "text-center"], "รออนุมัติ")
          status.prepend(createElement("i", ["fas", "fa-clock", "mr-2"]))
          boostSection.appendChild(status)
        } else if (isBoostedAndActive) {
          const timer = createElement(
            "p",
            ["text-sm", "font-semibold", "text-emerald-600", "text-center"],
            formatTimeRemaining(listing.boostExpiryDate),
          )
          timer.prepend(createElement("i", ["fas", "fa-check-circle", "mr-2"]))
          boostSection.appendChild(timer)
          if (currentUser && currentUser.role === "admin") {
            const removeBtn = createElement("button", ["text-xs", "text-rose-600", "hover:underline", "mt-2"], "เอาลง")
            removeBtn.onclick = (e) => {
              e.stopPropagation()
              removeBoost(listing.id)
            }
            boostSection.appendChild(removeBtn)
          }
        } else if (listing.boostStatus === "rejected") {
          const status = createElement(
            "p",
            ["text-sm", "font-semibold", "text-rose-600", "mb-2", "text-center"],
            "ไม่สำเร็จ",
          )
          status.prepend(createElement("i", ["fas", "fa-times-circle", "mr-2"]))
          const boostBtn = createElement("button", [
            "py-1",
            "px-3",
            "bg-purple-600",
            "text-white",
            "font-bold",
            "rounded-md",
            "hover:bg-purple-700",
            "text-xs",
            "transition-colors",
          ])
          boostBtn.innerHTML = '<i class="fas fa-rocket mr-1"></i>ลองใหม่'
          boostBtn.onclick = (e) => {
            e.stopPropagation()
            openBoostModal(listing.id)
          }
          boostSection.append(status, boostBtn)
        } else {
          const boostBtn = createElement("button", [
            "w-full",
            "py-2",
            "bg-purple-600",
            "text-white",
            "font-bold",
            "rounded-md",
            "hover:bg-purple-700",
            "text-sm",
            "transition-colors",
          ])
          boostBtn.innerHTML = '<i class="fas fa-rocket mr-2"></i>ดันโพสต์'
          boostBtn.onclick = (e) => {
            e.stopPropagation()
            openBoostModal(listing.id)
          }
          boostSection.appendChild(boostBtn)
        }

        listItem.append(imageLink, contentDiv, boostSection)
        listingsContainer.appendChild(listItem)
      })
    }

    listingsCol.append(listingsContainer, paginationContainer)
    renderProfilePagination(paginationContainer, totalPages, userId)
    mainGrid.append(profileCol, listingsCol)
    profileView.appendChild(mainGrid)
  } catch (error) {
    console.error("Error showing user profile:", error)
    profileView.innerHTML = `<p class="text-center text-rose-600">เกิดข้อผิดพลาดในการโหลดข้อมูลโปรไฟล์ หรือคุณไม่มีสิทธิ์เข้าถึง</p>`
  }
}

function applyFilters() {
  const province = document.getElementById("province-filter").value
  const district = document.getElementById("district-filter").value
  const type = document.getElementById("type-filter").value
  const maxPrice = document.getElementById("max-price-filter").value
  const params = new URLSearchParams()
  if (province) params.set("province", province)
  if (district) params.set("district", district)
  if (type) params.set("type", type)
  if (maxPrice) params.set("maxPrice", maxPrice)
  params.set("page", "1")
  window.location.hash = `search/${params.toString()}`
}

function hideAllViews() {
  homeView.classList.add("hidden")
  profileView.classList.add("hidden")
  listingDetailView.classList.add("hidden")
  adminView.classList.add("hidden")
}

function router() {
  if (!isAuthReady) return
  const newHash = window.location.hash
  const fromListing = currentHash.startsWith("#listing/")
  hideAllViews()
  closeAllModals()
  mobileMenu.classList.add("hidden")
  if (newHash.startsWith("#listing/")) {
    const listingId = newHash.substring("#listing/".length)
    listingDetailView.classList.remove("hidden")
    renderListingDetailPage(listingId)
  } else if (newHash.startsWith("#profile/")) {
    const userId = newHash.split("?")[0].substring("#profile/".length)
    const params = new URLSearchParams(newHash.split("?")[1])
    profileCurrentPage = Number.parseInt(params.get("page"), 10) || 1
    profileView.classList.remove("hidden")
    renderProfilePage(userId)
  } else if (newHash.startsWith("#search/")) {
    homeView.classList.remove("hidden")
    const queryString = newHash.substring("#search/".length)
    const params = new URLSearchParams(queryString)
    const filters = {}
    for (const [key, value] of params.entries()) {
      if (key !== "page") {
        filters[key] = decodeURIComponent(value)
      }
    }
    generalListingsCurrentPage = Number.parseInt(params.get("page"), 10) || 1
    updateFilterUIFromParams(params)
    fetchListings(filters, fromListing)
  } else if (newHash.startsWith("#admin")) {
    if (currentUser && currentUser.role === "admin") {
      const hashParts = newHash.split("?")
      const routePart = hashParts[0]
      const queryPart = hashParts[1]
      const routeSegments = routePart.split("/")
      const activeTab = routeSegments[1] || "dashboard"

      adminView.classList.remove("hidden")

      if (activeTab === "listings") {
        const params = new URLSearchParams(queryPart)
        adminListingsCurrentPage = Number.parseInt(params.get("page"), 10) || 1
      }
      renderAdminView(activeTab)
    } else {
      navigateToHome()
      if (currentUser) {
        showAlertModal("คุณไม่มีสิทธิ์เข้าถึงหน้านี้")
      }
    }
  } else {
    homeView.classList.remove("hidden")
    const params = new URLSearchParams(newHash.substring(newHash.indexOf("?")))
    boostedListingsCurrentPage = Number.parseInt(params.get("boostedPage"), 10) || 1
    generalListingsCurrentPage = Number.parseInt(params.get("generalPage"), 10) || 1
    resetFilterUI()
    fetchListings({}, fromListing)
  }
  currentHash = newHash
  if (!newHash.startsWith("#listing/")) {
    window.scrollTo(0, 0)
  }
}

function updateFilterUIFromParams(params) {
  // 1. ตั้งค่าช่อง "จังหวัด" จากค่าใน URL
  document.getElementById("province-filter").value = params.get("province") || "";
  const province = params.get("province");

  // 2. เรียกใช้ฟังก์ชันผู้ช่วยเพื่อสร้างรายการ "อำเภอ" ที่ถูกต้อง
  // โดยส่งชื่อจังหวัดและ ID ของช่องอำเภอในฟิลเตอร์ ("district-filter") ไปให้
  populateDistrictDropdowns(province, "district-filter");

  // 3. หน่วงเวลาเล็กน้อยเพื่อให้แน่ใจว่ารายการอำเภอถูกสร้างเสร็จ
  setTimeout(() => {
    // แล้วจึงตั้งค่าช่อง "อำเภอ" จากค่าใน URL
    const districtFilter = document.getElementById("district-filter");
    districtFilter.value = params.get("district") || "";
  }, 50); // รอ 50 มิลลิวินาที

  // 4. ตั้งค่าฟิลเตอร์ที่เหลือ (ประเภท และ ราคา) จากค่าใน URL
  document.getElementById("type-filter").value = params.get("type") || "";
  document.getElementById("max-price-filter").value = params.get("maxPrice") || "";
}

function resetFilterUI() {
  document.getElementById("province-filter").value = ""
  document.getElementById("district-filter").length = 1
  document.getElementById("district-filter").value = ""
  document.getElementById("type-filter").value = ""
  document.getElementById("max-price-filter").value = ""
}

function navigateToHome() {
  window.location.hash = ""
}
function navigateToListing(id) {
  window.location.hash = `#listing/${id}`
}
function navigateToProfile(id) {
  window.location.hash = `#profile/${id}`
}
function navigateToAdmin() {
  window.location.hash = "#admin/dashboard"
}

const backdrop = document.getElementById("modal-backdrop")
function openModal(modalId) {
  if (modalId === "postModal") {
    flatpickr("#post-available-date", { locale: "th", minDate: "today", dateFormat: "Y-m-d" })
    if (!document.getElementById("post-id").value) {
      postForm.reset()
      document.getElementById("post-modal-title").textContent = "ลงประกาศอสังหาริมทรัพย์"
      document.getElementById("post-id").value = ""
      populateDistrictDropdowns("", "post-district")
      imagePreviewContainer.innerHTML = ""
      selectedFiles = []
      existingImageUrls = []
    }
  }
  document.getElementById(modalId).style.display = "block"
  backdrop.style.display = "block"
}
function closeModal(modalId) {
  const modal = document.getElementById(modalId)
  if (modal) modal.style.display = "none"
  const anyModalOpen = document.querySelector('.modal[style*="display: block"]')
  if (!anyModalOpen) {
    backdrop.style.display = "none"
  }
  document.querySelectorAll("#login-error, #register-error, #post-error").forEach((el) => (el.textContent = ""))
}
function closeAllModals() {
  document.querySelectorAll(".modal, .modal-backdrop").forEach((el) => {
    el.style.display = "none"
  })
}

function showAlertModal(message, title = "แจ้งเตือน") {
  document.getElementById("alert-modal-title").textContent = title
  document.getElementById("alert-modal-text").textContent = message
  openModal("alertModal")
}
function openConfirmModal(message, onConfirm, confirmButtonClass = "bg-rose-600 hover:bg-rose-700") {
  document.getElementById("confirm-modal-text").textContent = message
  const confirmBtn = document.getElementById("confirm-modal-confirm-btn")
  confirmBtn.className = `px-6 py-2 text-white font-bold rounded-md transition-colors ${confirmButtonClass}`
  confirmCallback = onConfirm
  openModal("confirmModal")
}
function openLightbox(src) {
  document.getElementById("lightboxImage").src = src
  document.getElementById("lightboxModal").style.display = "flex"
}

let currentSlide = 0
let slideInterval
const slides = document.querySelectorAll("#banner-slideshow .slide")
const dotsContainer = document.getElementById("slide-dots")
function showSlide(n) {
  slides.forEach((slide, index) => {
    slide.style.opacity = index === n ? "1" : "0"
  })
  document.querySelectorAll("#slide-dots .dot").forEach((dot, index) => {
    dot.classList.toggle("bg-white", index === n)
    dot.classList.toggle("bg-white/50", index !== n)
  })
  currentSlide = n
}
function nextSlide() {
  showSlide((currentSlide + 1) % slides.length)
}
function prevSlide() {
  showSlide((currentSlide - 1 + slides.length) % slides.length)
}
function startSlideshow() {
  stopSlideshow()
  slideInterval = setInterval(nextSlide, 5000)
}
function stopSlideshow() {
  clearInterval(slideInterval)
}

const profileDropdownMenu = document.getElementById("profile-dropdown-menu")
function toggleProfileDropdown() {
  profileDropdownMenu.classList.toggle("hidden")
}
function toggleMobileMenu() {
  mobileMenu.classList.toggle("hidden")
}

function openEditProfileModal() {
  document.getElementById("edit-profile-phone").value = currentUser.phone || ""
  document.getElementById("edit-profile-line").value = currentUser.lineId || ""
  openModal("editProfileModal")
}
editProfileForm.addEventListener("submit", async (e) => {
  e.preventDefault()
  const phone = document.getElementById("edit-profile-phone").value
  const lineId = document.getElementById("edit-profile-line").value
  try {
    const userDocRef = doc(db, "users", currentUser.uid)
    await updateDoc(userDocRef, { phone, lineId })
    currentUser.phone = phone
    currentUser.lineId = lineId
    closeModal("editProfileModal")
    router()
  } catch (error) {
    console.error("Error updating profile:", error)
    showAlertModal("เกิดข้อผิดพลาดในการบันทึกข้อมูล")
  }
})

function openProfilePictureModal() {
  const previewContainer = document.getElementById("profile-pic-modal-preview-container")
  previewContainer.innerHTML = ""

  if (currentUser.photoURL) {
    previewContainer.appendChild(
      createElement("img", ["w-full", "h-full", "object-cover", "rounded-full"], "", { src: currentUser.photoURL }),
    )
    document.getElementById("view-profile-pic-btn").style.display = "flex"
    document.getElementById("remove-profile-pic-btn").style.display = "flex"
  } else {
    previewContainer.appendChild(
      createElement("span", ["text-6xl", "font-bold", "text-slate-500"], currentUser.username.charAt(0).toUpperCase()),
    )
    document.getElementById("view-profile-pic-btn").style.display = "none"
    document.getElementById("remove-profile-pic-btn").style.display = "none"
  }
  openModal("profilePictureModal")
}
profilePictureUploadInput.addEventListener("change", async (e) => {
  const file = e.target.files[0]
  if (!file) return
  closeModal("profilePictureModal")
  showAlertModal("กำลังอัปโหลดรูปภาพใหม่...", "กรุณารอสักครู่")
  try {
    const imageUrls = await uploadImages([file])
    const newPhotoURL = imageUrls[0]
    if (newPhotoURL) {
      const userDocRef = doc(db, "users", currentUser.uid)
      await updateDoc(userDocRef, { photoURL: newPhotoURL })
      currentUser.photoURL = newPhotoURL
      updateNavUI(currentUser)
      if (window.location.hash.includes("#profile")) {
        renderProfilePage(currentUser.uid)
      }
      closeModal("alertModal")
      showAlertModal("เปลี่ยนรูปโปรไฟล์สำเร็จ!")
    } else {
      throw new Error("ไม่ได้รับ URL จากการอัปโหลด")
    }
  } catch (error) {
    console.error("Error uploading profile picture:", error)
    showAlertModal("เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ")
  } finally {
    profilePictureUploadInput.value = ""
  }
})

window.addEventListener("hashchange", router)
window.addEventListener("DOMContentLoaded", () => {
  initializeAuth()
  fetchThailandData()

  document.getElementById("header-title").addEventListener("click", navigateToHome)
  document.getElementById("nav-login-btn").addEventListener("click", () => openModal("loginModal"))
  document.getElementById("nav-register-btn").addEventListener("click", () => openModal("registerModal"))
  document.getElementById("nav-post-btn").addEventListener("click", () => openModal("postModal"))
  document.getElementById("profile-dropdown-button").addEventListener("click", toggleProfileDropdown)
  document.getElementById("mobile-menu-button").addEventListener("click", toggleMobileMenu)
  document.getElementById("mobile-login-btn").addEventListener("click", () => {
    openModal("loginModal")
    toggleMobileMenu()
  })
  document.getElementById("mobile-register-btn").addEventListener("click", () => {
    openModal("registerModal")
    toggleMobileMenu()
  })
  document.getElementById("apply-filters-btn").addEventListener("click", applyFilters)
  document.getElementById("modal-backdrop").addEventListener("click", closeAllModals)
  document.getElementById("lightboxModal").addEventListener("click", () => closeModal("lightboxModal"))
  document.getElementById("lightbox-close-btn").addEventListener("click", (e) => {
    e.stopPropagation()
    closeModal("lightboxModal")
  })

  document.querySelectorAll("[data-close-modal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      closeModal(btn.dataset.closeModal)
    })
  })

  document.getElementById("admin-dashboard-link").addEventListener("click", (e) => {
    e.preventDefault()
    window.location.hash = "#admin/dashboard"
  })
  document.getElementById("admin-listings-link").addEventListener("click", (e) => {
    e.preventDefault()
    window.location.hash = "#admin/listings"
  })
  document.getElementById("admin-users-link").addEventListener("click", (e) => {
    e.preventDefault()
    window.location.hash = "#admin/users"
  })
  document.getElementById("admin-boosts-link").addEventListener("click", (e) => {
    e.preventDefault()
    window.location.hash = "#admin/boosts"
  })
  document.getElementById("admin-boosted-link").addEventListener("click", (e) => {
    e.preventDefault()
    window.location.hash = "#admin/boosted"
  })

  document.getElementById("confirm-modal-cancel-btn").addEventListener("click", () => {
    closeModal("confirmModal")
    confirmCallback = null
  })
  document.getElementById("confirm-modal-confirm-btn").addEventListener("click", () => {
    if (typeof confirmCallback === "function") {
      confirmCallback()
    }
    closeModal("confirmModal")
    confirmCallback = null
  })
  document.getElementById("alert-modal-ok-btn").addEventListener("click", () => {
    closeModal("alertModal")
  })

  document.getElementById("view-profile-pic-btn").addEventListener("click", () => {
    if (currentUser && currentUser.photoURL) {
      openLightbox(currentUser.photoURL)
    }
  })
  document.getElementById("change-profile-pic-btn").addEventListener("click", () => profilePictureUploadInput.click())
  document.getElementById("remove-profile-pic-btn").addEventListener("click", () => {
    openConfirmModal(
      "คุณแน่ใจหรือไม่ว่าต้องการลบรูปโปรไฟล์?",
      async () => {
        try {
          const userDocRef = doc(db, "users", currentUser.uid)
          await updateDoc(userDocRef, { photoURL: "" })
          currentUser.photoURL = ""
          updateNavUI(currentUser)
          if (window.location.hash.includes("#profile")) {
            renderProfilePage(currentUser.uid)
          }
          closeModal("profilePictureModal")
          showAlertModal("ลบรูปโปรไฟล์สำเร็จ")
        } catch (error) {
          console.error("Error removing profile picture:", error)
          showAlertModal("เกิดข้อผิดพลาดในการลบรูปภาพ")
        }
      },
      "bg-rose-600 hover:bg-rose-700",
    )
  })

  if (slides.length > 0) {
    slides.forEach((_, i) => {
      const dot = createElement("button", ["dot", "w-3", "h-3", "rounded-full", "transition-colors"])
      dot.addEventListener("click", () => {
        showSlide(i)
        stopSlideshow()
        startSlideshow()
      })
      dotsContainer.appendChild(dot)
    })
    document.getElementById("prev-slide").addEventListener("click", () => {
      prevSlide()
      stopSlideshow()
      startSlideshow()
    })
    document.getElementById("next-slide").addEventListener("click", () => {
      nextSlide()
      stopSlideshow()
      startSlideshow()
    })
    showSlide(0)
    startSlideshow()
  }

  document.addEventListener("click", (event) => {
    const profileButton = document.getElementById("profile-dropdown-button")
    const mobileMenuButton = document.getElementById("mobile-menu-button")
    if (profileButton && !profileButton.contains(event.target) && !profileDropdownMenu.contains(event.target)) {
      profileDropdownMenu.classList.add("hidden")
    }
    if (
      mobileMenuButton &&
      !mobileMenuButton.contains(event.target) &&
      !mobileMenu.contains(event.target) &&
      !mobileMenu.classList.contains("hidden")
    ) {
      mobileMenu.classList.add("hidden")
    }
  })
})