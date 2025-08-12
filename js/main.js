// js/main.js
import { loadComponent, createAndShowPrivateChatDialog, createUserInfoModal, updatePrivateButtonNotification, hideUserInfoModal, checkAndSendJoinMessage } from './chat-ui.js';
import { setupRealtimeMessagesListener, sendMessage, getPrivateChatContacts, getAllUsersAndVisitors, getUserData, setupPrivateMessageNotificationListener, sendJoinMessage, deleteChatRoomMessages, sendSystemMessage, getChatRooms } from './chat-firestore.js';
import { RANK_ORDER, RANK_IMAGE_MAP, RANK_PERMISSIONS } from './constants.js';
import { showLevelInfoModal } from './modals.js';
// في بداية ملف main.js
import { uploadFileToCloudinary } from './cloudinary-utils.js';

let privateChatModal = null;
let onlineUsersModal = null;
let searchModal = null;
let profileDropdownMenu = null;
let profileButton = null;

let currentRoomId;

// تم استبدال 'window.allUsersAndVisitorsData = [];'
// بهذا المتغير الجديد لتنظيم أفضل
export let allUsersAndVisitorsData = []; 

// دالة جلب البيانات التي تم إنشاؤها حديثاً

function hideOnlineUsersModal() {
    if (onlineUsersModal) {
        onlineUsersModal.remove();
        onlineUsersModal = null;
        document.removeEventListener('click', handleOnlineUsersModalOutsideClick);
    }
}

function handlePrivateChatModalOutsideClick(event) {
    const privateButton = document.querySelector('.top-bar .btn.private');
    const isClickInsidePrivateModal = privateChatModal && privateChatModal.contains(event.target);
    const isClickOnPrivateButton = privateButton && privateButton.contains(event.target);
    const isClickInsideUserInfoModal = window.userInfoModal && window.userInfoModal.contains(event.target); // إضافة هذا السطر

    // تعديل الشرط ليشمل مودال معلومات المستخدم
    if (privateChatModal && privateChatModal.classList.contains('show') && !isClickInsidePrivateModal && !isClickOnPrivateButton && !isClickInsideUserInfoModal) {
        hidePrivateChatModal();
    }
}

function hidePrivateChatModal() {
    if (privateChatModal) {
        privateChatModal.classList.remove('show');
        privateChatModal.addEventListener('transitionend', () => {
            if (privateChatModal) {
                privateChatModal.remove();
                privateChatModal = null;
            }
        }, { once: true });
        document.removeEventListener('click', handlePrivateChatModalOutsideClick);
    }
}

function hideSearchModal() {
    if (searchModal) {
        searchModal.remove();
        searchModal = null;
    }
}

function hideProfileDropdown() {
    if (profileDropdownMenu && profileDropdownMenu.classList.contains('show')) {
        profileDropdownMenu.classList.remove('show');
        document.removeEventListener('click', handleProfileDropdownOutsideClick);
    }
}

function hideAllOpenModals() {
    if (typeof hideUserInfoModal === 'function') {
        hideUserInfoModal();
    }
    if (typeof hideOnlineUsersModal === 'function') {
        hideOnlineUsersModal();
    }
    if (typeof hidePrivateChatModal === 'function') {
        hidePrivateChatModal();
    }
    if (typeof hideSearchModal === 'function') {
        hideSearchModal();
    }
    if (typeof window.hideEditProfileModal === 'function') {
        window.hideEditProfileModal();
    }
    if (typeof hideProfileDropdown === 'function') {
        hideProfileDropdown();
    }
}

// js/main.js

// دالة مساعدة لعمل التمرير التلقائي إلى أسفل
// دالة مساعدة لعمل التمرير التلقائي إلى أسفل
function scrollToBottom() {
    const chatBox = document.querySelector('.chat-box') || 
                    document.querySelector('.chat-messages') || 
                    document.querySelector('#chat-container'); // يمكنك إضافة المزيد من المحددات هنا
    if (chatBox) {
        chatBox.scrollTop = chatBox.scrollHeight;
    }
}


// ... (باقي الكود)

//js/main.js

// ... (داخل الدالة) ...

async function createPrivateChatModal(buttonElement) {
    hideAllOpenModals();

    if (privateChatModal) {
        privateChatModal.remove();
        privateChatModal = null;
    }
    
    // **أضف هذا السطر هنا**
    // هذا السطر يزيل أي إشعار سابق بمجرد النقر على زر "الخاص"
    

    privateChatModal = document.createElement('div');
    privateChatModal.classList.add('private-chat-modal-strip');
    privateChatModal.innerHTML = `
        <div class="modal-header">
            <h3>الرسائل الخاصة</h3>
            <button class="close-btn">&times;</button>
        </div>
        <ul class="private-chat-list"> <li style="text-align: center; padding: 10px; color: #888;">جاري تحميل جهات الاتصال...</li>
        </ul>
    `;
    document.body.appendChild(privateChatModal);

    const buttonRect = buttonElement.getBoundingClientRect();
    const modalWidth = 200;
    const topBarElement = document.querySelector('.top-bar');
    const topBarHeight = topBarElement ? topBarElement.offsetHeight : 0;
    const padding = 10;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let modalLeft = buttonRect.right - modalWidth;
    let modalTop = buttonRect.bottom + padding;

    if (modalLeft < padding) {
        modalLeft = padding;
    }
    if (modalLeft + modalWidth > viewportWidth - padding) {
        modalLeft = viewportWidth - modalWidth - padding;
    }
    if (modalTop + privateChatModal.clientHeight > viewportHeight - padding) {
        modalTop = viewportHeight - privateChatModal.clientHeight - padding;
        if (modalTop < topBarHeight + padding) {
            modalTop = topBarHeight + padding;
        }
    }

    privateChatModal.style.left = `${modalLeft}px`;
    privateChatModal.style.top = `${modalTop}px`;

    privateChatModal.classList.add('show');

    privateChatModal.querySelector('.close-btn').addEventListener('click', () => {
        hidePrivateChatModal();
    });

    document.addEventListener('click', handlePrivateChatModalOutsideClick);

    const currentUserId = localStorage.getItem('chatUserId');
    if (currentUserId) {
        try {
            const ulElement = privateChatModal.querySelector('.private-chat-list');
            const contacts = await getPrivateChatContacts(currentUserId);
            ulElement.innerHTML = '';

            if (contacts.length === 0) {
                ulElement.innerHTML = `<li style="text-align: center; padding: 10px; color: #888;">لا توجد محادثات خاصة بعد.</li>`;
            } else {
                // **الكود الجديد لفرز جهات الاتصال**
                contacts.sort((a, b) => {
                    // فرز بحيث تظهر التي لديها رسائل غير مقروءة في الأعلى
                    return b.unreadCount - a.unreadCount;
                });

                contacts.forEach(contact => {
                    const li = document.createElement('li');
                    li.setAttribute('data-user-id', contact.id);
                    const unreadBadge = contact.unreadCount > 0 ? `<span class="unread-count">${contact.unreadCount}</span>` : '';
                    li.innerHTML = `
                        <img src="${contact.avatar || 'images/default-user.png'}" alt="${contact.name}" class="user-avatar-small">
                        <span class="user-name">${contact.name}</span>
                        ${unreadBadge}
                    `;
                    li.addEventListener('click', () => {
                        hidePrivateChatModal();
                        createAndShowPrivateChatDialog(contact);
                    });
                    ulElement.appendChild(li);
                });
            }
        } catch (error) {
            console.error('خطأ في جلب جهات الاتصال الخاصة:', error);
            const ulElement = privateChatModal.querySelector('.private-chat-list');
            ulElement.innerHTML = `<li style="text-align: center; padding: 10px; color: red;">فشل تحميل جهات الاتصال.</li>`;
        }
    } else {
        const ulElement = privateChatModal.querySelector('.private-chat-list');
        ulElement.innerHTML = `<li style="text-align: center; padding: 10px; color: red;">الرجاء تسجيل الدخول لعرض المحادثات الخاصة.</li>`;
    }
}

function handleOnlineUsersModalOutsideClick(event) {
    const onlineUsersButton = document.querySelector('#online-users-btn');
    const isClickInsideOnlineUsersModal = window.onlineUsersModal && window.onlineUsersModal.contains(event.target);
    const isClickInsideUserInfoModal = window.userInfoModal && window.userInfoModal.contains(event.target);
    const isClickOnOnlineUsersButton = onlineUsersButton && onlineUsersButton.contains(event.target);

    if (window.onlineUsersModal && !isClickInsideOnlineUsersModal && !isClickOnOnlineUsersButton && !isClickInsideUserInfoModal) {
        hideOnlineUsersModal();
        document.removeEventListener('click', handleOnlineUsersModalOutsideClick);
    }
}

async function createOnlineUsersModal(buttonElement) {
    hideAllOpenModals();

    if (onlineUsersModal) {
        onlineUsersModal.remove();
        onlineUsersModal = null;
    }

    onlineUsersModal = document.createElement('div');
    onlineUsersModal.classList.add('online-users-modal');

    const currentUserName = localStorage.getItem('chatUserName') || 'زائر';

    onlineUsersModal.innerHTML = `
        <div class="modal-header new-header-buttons">
            <div class="header-buttons-container">
                <button class="header-btn" id="rooms-btn">
                    <i class="fa-solid fa-house"></i> الغرف
                </button>
                <button class="header-btn" id="friends-btn">
                    <i class="fa-solid fa-user-group"></i> الأصدقاء
                </button>
                <button class="header-btn" id="visitors-btn">
                    <i class="fa-solid fa-users"></i> الزوار
                </button>
                <button class="header-btn" id="search-btn">
                    <i class="fa-solid fa-magnifying-glass"></i> بحث
                </button>
            </div>
            <button class="close-btn">&times;</button>
        </div>
        <div class="modal-content-area">
        </div>
    `;
    document.body.appendChild(onlineUsersModal);

    // تعريف المتغيرات مرة واحدة فقط هنا
    const modalContentArea = onlineUsersModal.querySelector('.modal-content-area');
    const roomsBtn = onlineUsersModal.querySelector('#rooms-btn');
    const friendsBtn = onlineUsersModal.querySelector('#friends-btn');
    const visitorsBtn = onlineUsersModal.querySelector('#visitors-btn');
    const searchBtn = onlineUsersModal.querySelector('#search-btn');
    
    // دالة مساعدة لتحديث الزر النشط.
    const updateActiveButton = (activeButton) => {
        [roomsBtn, friendsBtn, visitorsBtn, searchBtn].forEach(btn => {
            btn.classList.remove('active');
        });
        activeButton.classList.add('active');
    };

    // عرض قائمة المستخدمين المتصلين بشكل افتراضي عند فتح النافذة
    if (modalContentArea) {
        await fetchAndDisplayOnlineUsers(modalContentArea, currentUserName);
        updateActiveButton(friendsBtn); // تفعيل زر "الأصدقاء" افتراضياً
    }

    onlineUsersModal.style.display = 'flex';

    // **ربط معالج حدث لكل زر بشكل منفصل**
    if (roomsBtn) {
        roomsBtn.addEventListener('click', async () => {
            updateActiveButton(roomsBtn);
            if (modalContentArea) {
                await fetchAndDisplayRooms(modalContentArea);
            }
        });
    }

    [friendsBtn, visitorsBtn].forEach(btn => {
        if (btn) {
            btn.addEventListener('click', () => {
                updateActiveButton(btn);
                if (modalContentArea) {
                    fetchAndDisplayOnlineUsers(modalContentArea, currentUserName);
                }
            });
        }
    });

    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            updateActiveButton(searchBtn);
            if (modalContentArea) {
                showSearchInterface(modalContentArea, currentUserName);
            }
        });
    }

    // معالجات حدث الإغلاق والنقر خارج النافذة
    onlineUsersModal.querySelector('.close-btn').addEventListener('click', () => {
        hideOnlineUsersModal();
    });
    document.addEventListener('click', handleOnlineUsersModalOutsideClick);
}


async function fetchAndDisplayOnlineUsers(modalContentArea, currentUserName) {
    modalContentArea.innerHTML = `
        <div class="welcome-message-box">
            أهلاً وسهلاً بك معنا، ${currentUserName} يسعد مساءك بكل خير 🌙
        </div>
        <div class="online-users-list">
            <div style="text-align: center; padding: 20px; color: #888;">جاري تحميل المستخدمين...</div>
        </div>
    `;
    const onlineUsersList = modalContentArea.querySelector('.online-users-list');
    try {
        const users = await getAllUsersAndVisitors();
        onlineUsersList.innerHTML = '';

        if (users.length === 0) {
            onlineUsersList.innerHTML = `<div style="text-align: center; padding: 20px; color: #888;">لا يوجد مستخدمون متصلون حالياً.</div>`;
            return;
        }

        const groupedUsers = {};
        users.forEach(user => {
            const rank = user.rank || 'زائر';
            if (!groupedUsers[rank]) {
                groupedUsers[rank] = [];
            }
            groupedUsers[rank].push(user);
        });

        const sortedRanks = RANK_ORDER.filter(rank => groupedUsers[rank]);
        const otherRanks = Object.keys(groupedUsers).filter(rank => !RANK_ORDER.includes(rank));
        sortedRanks.push(...otherRanks.sort());

        sortedRanks.forEach(rank => {
            const usersInRank = groupedUsers[rank];
            if (usersInRank && usersInRank.length > 0) {
                const rankHeader = document.createElement('div');
                rankHeader.classList.add('rank-header');
                rankHeader.setAttribute('data-rank', rank);

                // **التعديل الجديد هنا: إضافة أيقونة لكل رتبة**
                let iconHtml = '';
                switch(rank) {
                    case 'المالك':
                        iconHtml = '<i class="fas fa-crown"></i>';
                        break;
                    case 'اونر اداري':
                        iconHtml = '<i class="fas fa-gavel"></i>';
                        break;
                    case 'اونر':
                        iconHtml = '<i class="fas fa-star"></i>';
                        break;
                    case 'سوبر اداري':
                        iconHtml = '<i class="fas fa-shield-alt"></i>';
                        break;
                    case 'مشرف':
                        iconHtml = '<i class="fas fa-user-tie"></i>'; // أيقونة المشرف
                        break;
                    case 'سوبر ادمن':
                        iconHtml = '<i class="fas fa-user-shield"></i>';
                        break;
                    case 'ادمن':
                        iconHtml = '<i class="fas fa-user-cog"></i>';
                        break;
                    case 'بريميوم':
                        iconHtml = '<i class="fas fa-gem"></i>'; // أيقونة بريميوم
                        break;
                    case 'بلاتينيوم':
                        iconHtml = '<i class="fas fa-medal"></i>'; // أيقونة بلاتينيوم
                        break;
                    case 'ملكي':
                        iconHtml = '<i class="fas fa-chess-king"></i>'; // أيقونة ملكي
                        break;
                    case 'ذهبي':
                        iconHtml = '<i class="fas fa-money-bill-wave"></i>'; // أيقونة ذهبي
                        break;
                    case 'برونزي':
                        iconHtml = '<i class="fas fa-medal"></i>'; // أيقونة برونزي
                        break;
                    case 'عضو':
                        iconHtml = '<i class="fas fa-user"></i>';
                        break;
                    case 'زائر':
                        iconHtml = '<i class="fas fa-ghost"></i>';
                        break;
                    default:
                        iconHtml = '<i class="fas fa-users"></i>';
                }

                rankHeader.innerHTML = `${iconHtml}<h3>${rank}</h3>`;
                onlineUsersList.appendChild(rankHeader);

                usersInRank.sort((a, b) => a.name.localeCompare(b.name));

                usersInRank.forEach(user => {
                    const userItemDiv = document.createElement('div');
                    userItemDiv.classList.add('user-item');
                    const rankImageSrc = RANK_IMAGE_MAP[user.rank] || RANK_IMAGE_MAP['default'];
                    // الكود المعدل في ملف main.js
// داخل دالة fetchAndDisplayOnlineUsers
userItemDiv.innerHTML = `
    <img src="${user.avatar || 'images/default-user.png'}" alt="${user.name}" class="user-avatar-small">
    <div class="user-info-text">
        <span class="user-name">${user.name}</span>
        <p class="user-status">${user.statusText || ''}</p>
    </div>
    <img src="${rankImageSrc}" alt="${user.rank}" class="user-rank-image" title="${user.rank}" />
`;

            const userAvatarElement = userItemDiv.querySelector('.user-avatar-small');
            if (userAvatarElement) {
                userAvatarElement.addEventListener('click', (event) => {
                    event.stopPropagation();
                    // **السطر المعدل:**
                    createUserInfoModal(userAvatarElement, user, window.allUsersAndVisitorsData);
                });
            }
            onlineUsersList.appendChild(userItemDiv);
        });
            }
        });
    } catch (error) {
        console.error("خطأ في جلب المستخدمين المتصلين:", error);
        onlineUsersList.innerHTML = `<div style="text-align: center; padding: 20px; color: red;">فشل تحميل قائمة المستخدمين.</div>`;
    }
}

// js/main.js
// ... (الكود الحالي) ...

// js/main.js

let cachedRooms = null; // متغير لتخزين الغرف بعد جلبها لأول مرة

// تم تصحيح كلمة 'async' هنا
// ... (بقية الكود) ...

async function fetchAndDisplayRooms(modalContentArea) {
    modalContentArea.innerHTML = `
        <div class="welcome-message-box">
            اختر غرفة للانضمام إليها.
        </div>
        <div class="rooms-list">
            <div style="text-align: center; padding: 20px; color: #888;">جاري تحميل الغرف...</div>
        </div>
    `;

    const roomsList = modalContentArea.querySelector('.rooms-list');
    
    // تأكد من أن العنصر موجود قبل المتابعة
    if (!roomsList) {
        console.error("خطأ: لم يتم العثور على عنصر قائمة الغرف.");
        return; 
    }

    try {
        // هذا هو السطر المهم الذي يجب أن يكون في الكود
        const rooms = await getChatRooms();
        
        roomsList.innerHTML = ''; // مسح رسالة التحميل

        if (rooms.length === 0) {
            roomsList.innerHTML = `<div style="text-align: center; padding: 20px; color: #888;">لا توجد غرف متاحة حالياً.</div>`;
        } else {
            rooms.forEach(room => {
              // في بداية حلقة forEach
console.log(room);
                const roomItemDiv = document.createElement('div');
                roomItemDiv.classList.add('room-item');
                roomItemDiv.setAttribute('data-room-id', room.id);
                // الكود المعدل الذي يستخدم 0 كقيمة افتراضية
roomItemDiv.innerHTML = `
    <div class="room-info">
        <span class="room-name">${room.name}</span>
        <span class="room-user-count"><i class="fas fa-users"></i> ${room.userCount || 0}</span>
    </div>
`;
                roomItemDiv.addEventListener('click', () => {
                    window.location.href = `chat.html?roomId=${room.id}`;
                });
                roomsList.appendChild(roomItemDiv);
            });
        }
    } catch (error) {
        console.error("خطأ في جلب الغرف:", error);
        roomsList.innerHTML = `<div style="text-align: center; padding: 20px; color: red;">فشل تحميل قائمة الغرف.</div>`;
    }
}

// دالة منفصلة لعرض الغرف (يمكن استخدامها من أي مكان)


function showSearchInterface(modalContentArea) {
    modalContentArea.innerHTML = `
        <div class="search-input-container">
            <input type="text" id="user-search-input" placeholder="ابحث بالاسم..." />
            <button id="clear-search-btn">&times;</button>
        </div>
        <div class="search-results-list online-users-list">
            <div style="text-align: center; padding: 20px; color: #888;">ابدأ الكتابة للبحث عن المستخدمين...</div>
        </div>
    `;

    const searchInput = modalContentArea.querySelector('#user-search-input');
    const searchResultsList = modalContentArea.querySelector('.search-results-list');
    const clearSearchBtn = modalContentArea.querySelector('#clear-search-btn');

    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchResultsList.innerHTML = `<div style="text-align: center; padding: 20px; color: #888;">ابدأ الكتابة للبحث عن المستخدمين...</div>`;
        clearSearchBtn.style.display = 'none';
    });

    searchInput.addEventListener('input', async (event) => {
        const searchTerm = event.target.value.toLowerCase().trim();
        if (searchTerm.length > 0) {
            clearSearchBtn.style.display = 'block';
        } else {
            clearSearchBtn.style.display = 'none';
        }

        if (searchTerm.length < 2) {
            searchResultsList.innerHTML = `<div style="text-align: center; padding: 20px; color: #888;">الرجاء إدخال حرفين على الأقل للبحث.</div>`;
            return;
        }

        searchResultsList.innerHTML = `<div style="text-align: center; padding: 20px; color: #888;">جاري البحث عن "${searchTerm}"...</div>`;

        try {
            const allUsers = await getAllUsersAndVisitors();
            const filteredUsers = allUsers.filter(user =>
                user.name.toLowerCase().includes(searchTerm)
            );

            searchResultsList.innerHTML = '';

            if (filteredUsers.length === 0) {
                searchResultsList.innerHTML = `<div style="text-align: center; padding: 20px; color: #888;">لا يوجد مستخدمون يطابقون بحثك.</div>`;
            } else {
                filteredUsers.forEach(user => {
                    const userItemDiv = document.createElement('div');
                    userItemDiv.classList.add('user-item');
                    const rankImageSrc = RANK_IMAGE_MAP[user.rank] || RANK_IMAGE_MAP['default'];
                    userItemDiv.innerHTML = `
                        <img src="${user.avatar || 'images/default-user.png'}" alt="${user.name}" class="user-avatar-small">
                        <span class="user-name">${user.name}</span>
                        <img src="${rankImageSrc}" alt="${user.rank}" class="user-rank-image" title="${user.rank}" />
                    `;

                    const userAvatarElement = userItemDiv.querySelector('.user-avatar-small');
                    if (userAvatarElement) {
                        userAvatarElement.addEventListener('click', (event) => {
                            event.stopPropagation();
                            createUserInfoModal(userAvatarElement, user);
                        });
                    }
                    searchResultsList.appendChild(userItemDiv);
                });
            }
        } catch (error) {
            console.error("خطأ في البحث عن المستخدمين:", error);
            searchResultsList.innerHTML = `<div style="text-align: center; padding: 20px; color: red;">فشل البحث عن المستخدمين.</div>`;
        }
    });
}

function handleProfileDropdownOutsideClick(event) {
    if (profileDropdownMenu && profileDropdownMenu.classList.contains('show') && !profileDropdownMenu.contains(event.target) && !profileButton.contains(event.target)) {
        hideProfileDropdown();
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // **الخطوة 1: جلب جميع بيانات المستخدمين أولاً**
    // هذا يحل مشكلة Cannot read properties of undefined (reading 'find')
    try {
        console.log("جاري جلب بيانات جميع المستخدمين والزوار...");
        window.allUsersAndVisitorsData = await getAllUsersAndVisitors();
        console.log("تم جلب بيانات المستخدمين والزوار بنجاح:", window.allUsersAndVisitorsData.length);
    } catch (error) {
        console.error("خطأ في جلب البيانات الأولية للمستخدمين والزوار:", error);
        document.body.innerHTML = '<div style="text-align: center; color: red; padding-top: 50px;">فشل في تحميل بيانات المستخدمين. يرجى التحقق من اتصالك وقواعد البيانات.</div>';
        return; // توقف عن تنفيذ باقي الكود إذا فشل الجلب
    }

    // **الخطوة 2: الآن، بعد جلب البيانات، يمكنك التحقق من تسجيل الدخول بأمان**
    let chatUserId = localStorage.getItem('chatUserId');
    let chatUserName = localStorage.getItem('chatUserName');
    let chatUserAvatar = localStorage.getItem('chatUserAvatar');

    if (chatUserId) {
        // البحث عن المستخدم في البيانات التي تم جلبها بالفعل
        const userData = window.allUsersAndVisitorsData.find(user => user.id === chatUserId);
        if (!userData) {
            console.log('بيانات المستخدم غير موجودة في قاعدة البيانات، جاري التوجيه إلى صفحة التسجيل...');
            localStorage.removeItem('chatUserId');
            localStorage.removeItem('chatUserName');
            localStorage.removeItem('chatUserAvatar');
            window.location.href = 'index.html';
            return;
        }
    } else {
        console.log('لا يوجد معرف مستخدم مخزن، جاري التوجيه إلى صفحة التسجيل/الدخول...');
        window.location.href = 'index.html';
        return;
    }

    // **الخطوة 3: التحقق من الغرفة**
    const urlParams = new URLSearchParams(window.location.search);
    const roomIdFromUrl = urlParams.get('roomId');
    const lastVisitedRoomId = localStorage.getItem('lastVisitedRoomId');
    const currentRoomId = roomIdFromUrl || lastVisitedRoomId;

    if (!currentRoomId) {
        console.log('لا توجد غرفة محددة أو محفوظة. جاري التوجيه إلى صفحة الغرف.');
        window.location.href = 'rooms.html';
        return;
    }
    
    localStorage.setItem('lastVisitedRoomId', currentRoomId);
    
    const chatContainer = document.querySelector('.chat-container');
    if (!chatContainer) {
        document.body.innerHTML = '<div style="text-align: center; color: red; padding-top: 50px;">خطأ: لم يتم العثور على عنصر "chat-container". تأكد من وجوده في ملف HTML (chat.html).</div>';
        console.error('CRITICAL ERROR: chat-container element not found!');
        return;
    }

    try {
        await loadComponent("top-bar", "components/top-bar.html");

        // **الآن يمكننا الوصول إلى البيانات بأمان لتحديد رتبة المستخدم**
        const currentUserId = localStorage.getItem('chatUserId');
        const currentUserData = window.allUsersAndVisitorsData.find(user => user.id === currentUserId);
        let currentUserRank = currentUserData ? currentUserData.rank : 'زائر';

        const topButtonsContainer = document.querySelector('.top-buttons');
        // ... (بقية الكود الخاص بإضافة الأزرار بناءً على الصلاحيات) ...
        if (topButtonsContainer) {
            if (RANK_PERMISSIONS[currentUserRank]?.canSeeReportButton) {
                const reportBtnDiv = document.createElement('div');
                reportBtnDiv.classList.add('btn', 'report');
                reportBtnDiv.id = 'reportButton';
                reportBtnDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i><br>بلاغ`;
                const profileButton = document.getElementById('profileButton');
                if (profileButton) {
                    topButtonsContainer.insertBefore(reportBtnDiv, profileButton.nextSibling);
                }
            }
            if (RANK_PERMISSIONS[currentUserRank]?.canSeePrivateChatButton) {
                const privateBtnDiv = document.createElement('div');
                privateBtnDiv.classList.add('btn', 'private');
                privateBtnDiv.id = 'privateButton';
                privateBtnDiv.innerHTML = `<i class="fas fa-envelope"></i><br>خاص`;
                const friendButton = topButtonsContainer.querySelector('.btn.friend');
                if (friendButton) {
                    topButtonsContainer.insertBefore(privateBtnDiv, friendButton.nextSibling);
                }
            }
        }
        await loadComponent("chat-box", "components/chat-box.html");
        await loadComponent("input-bar", "components/input-bar.html");


    const plusButtonToggle = document.querySelector('#input-bar .plus-btn-circle');
const imageUploadInput = document.getElementById('image-upload-input');

let optionsMenu = null;
let currentUploadTask = null; // متغير لتخزين عملية الرفع الحالية

function createAndAppendUploadProgressBar() {
    const uploadProgressContainer = document.createElement('div');
    uploadProgressContainer.id = 'upload-progress-container';
    uploadProgressContainer.className = 'upload-progress-container';
    uploadProgressContainer.style.display = 'none';

    uploadProgressContainer.innerHTML = `
        <div class="progress-bar">
            <div id="progress-fill" class="progress-fill"></div>
        </div>
        <button id="cancel-upload-btn" class="cancel-upload-btn">&times;</button>
    `;
    document.body.appendChild(uploadProgressContainer);
}

function createOptionsMenu() {
    optionsMenu = document.createElement('div');
    optionsMenu.classList.add('options-menu');
    optionsMenu.innerHTML = `
        <button class="btn option-btn" id="music-btn" title="مشاركة أغنية">
            <i class="fas fa-music"></i>
        </button>
        <button class="btn option-btn" id="upload-media-btn" title="رفع ملف">
            <i class="fas fa-cloud-upload-alt"></i>
        </button>
    `;
    const uploadMediaButton = optionsMenu.querySelector('#upload-media-btn');
    uploadMediaButton.addEventListener('click', () => {
        imageUploadInput.click();
        optionsMenu.classList.remove('show-menu');
    });
    const musicButton = optionsMenu.querySelector('#music-btn');
    musicButton.addEventListener('click', () => {
        alert('سيتم فتح نافذة مشاركة الأغاني قريباً!');
        optionsMenu.classList.remove('show-menu');
    });
    plusButtonToggle.parentElement.appendChild(optionsMenu);
}

function hideOptionsMenu() {
    if (optionsMenu) {
        optionsMenu.classList.remove('show-menu');
    }
}

createAndAppendUploadProgressBar();

if (plusButtonToggle && imageUploadInput) {
    plusButtonToggle.addEventListener('click', (event) => {
        event.stopPropagation();
        if (!optionsMenu) {
            createOptionsMenu();
        }
        optionsMenu.classList.toggle('show-menu');
    });

    document.addEventListener('click', (event) => {
        if (optionsMenu && !optionsMenu.contains(event.target) && !plusButtonToggle.contains(event.target)) {
            hideOptionsMenu();
        }
    });

    imageUploadInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) {
            return;
        }

        const uploadProgressContainer = document.getElementById('upload-progress-container');
        const progressFill = document.getElementById('progress-fill');
        const cancelUploadBtn = document.getElementById('cancel-upload-btn');

        if (!uploadProgressContainer || !progressFill || !cancelUploadBtn) {
            console.error('لم يتم العثور على عناصر شريط التقدم. حدث خطأ في إنشاء العنصر.');
            return;
        }

        uploadProgressContainer.style.display = 'flex';
        progressFill.style.width = '0%';
        
        const handleCancel = () => {
            if (currentUploadTask) {
                currentUploadTask.abort();
                console.log('تم إلغاء عملية الرفع.');
            }
            uploadProgressContainer.style.display = 'none';
            imageUploadInput.value = '';
            currentUploadTask = null;
            cancelUploadBtn.removeEventListener('click', handleCancel);
        };
        cancelUploadBtn.addEventListener('click', handleCancel);

        try {
            // هنا نقوم بتخزين مهمة الرفع في المتغير
            currentUploadTask = new XMLHttpRequest();
            const imageUrl = await new Promise((resolve, reject) => {
                uploadFileToCloudinary(file, (progress) => {
                    progressFill.style.width = `${progress}%`;
                }).then(resolve).catch(reject);
            });

            if (imageUrl) {
                const messageText = '';
                await sendMessage(messageText, currentRoomId, imageUrl);
                console.log('تم إرسال الصورة بنجاح!');
                scrollToBottom();
            }
        } catch (error) {
            console.error('فشل إرسال الصورة:', error);
            alert('فشل إرسال الصورة. يرجى المحاولة مرة أخرى.');
        } finally {
            uploadProgressContainer.style.display = 'none';
            imageUploadInput.value = '';
            currentUploadTask = null;
            cancelUploadBtn.removeEventListener('click', handleCancel);
        }
    });
}

    await loadComponent("bottom-bar", "components/bottom-bar.html"); // السطر الجديد

            if (chatUserId) {
    await checkAndSendJoinMessage(currentRoomId);
}
        
        setupRealtimeMessagesListener(currentRoomId);
        
        // **السطر الجديد الذي يجب إضافته هنا:**
        if (chatUserId) {
            setupPrivateMessageNotificationListener(chatUserId);
        }
        
        profileButton = document.getElementById('profileButton');

        async function createAndAppendProfileDropdown() {
            profileDropdownMenu = document.createElement('div');
            profileDropdownMenu.id = 'profileDropdownMenu';
            profileDropdownMenu.classList.add('profile-dropdown-menu');

            let currentUserRank = 'زائر';
            const currentUserId = localStorage.getItem('chatUserId');
            if (currentUserId) {
                try {
                    const allUsersAndVisitors = await getAllUsersAndVisitors();
                    const currentUserData = allUsersAndVisitors.find(user => user.id === currentUserId);
                    if (currentUserData && currentUserData.rank) {
                        currentUserRank = currentUserData.rank;
                    }
                } catch (error) {
                    console.error("خطأ في جلب رتبة المستخدم:", error);
                }
            }
            const rankImageSrc = RANK_IMAGE_MAP[currentUserRank] || RANK_IMAGE_MAP['default'];

            profileDropdownMenu.innerHTML = `
                <div class="profile-dropdown-content">
                    <div class="profile-header">
                        <img id="modal-profile-image" src="${localStorage.getItem('chatUserAvatar') || 'https://i.imgur.com/Uo9V2Yx.png'}" alt="صورة المستخدم">
                        <div class="profile-info">
                            <div class="profile-rank-display">
                                <span class="rank-text">${currentUserRank}</span>
                                <img src="${rankImageSrc}" alt="${currentUserRank}" class="rank-icon" title="${currentUserRank}" />
                            </div>
                            <p id="modal-username-display">${chatUserName || 'زائر'}</p>
                        </div>
                    </div>

         <div class="profile-buttons-section">
    <button class="modal-button level-info-btn">
        معلومات المستوى <i class="icon fa-solid fa-chart-column"></i>
    </button>
    <button class="modal-button wallet-btn">
        المحفظة <i class="icon fa-solid fa-wallet"></i>
    </button>
    <button class="modal-button edit-account-btn" id="editProfileButton">
        تعديل الحساب <i class="icon fa-solid fa-user-gear"></i>
    </button>
    <button class="modal-button leave-room-btn">
        الخروج من الغرفة <i class="icon fa-solid fa-arrow-right-from-bracket"></i>
    </button>
    <button class="modal-button logout">
        الخروج من الحساب <i class="icon fa-solid fa-right-from-bracket"></i>
    </button>
</div>
            `;
            document.body.appendChild(profileDropdownMenu);

            const levelInfoBtn = profileDropdownMenu.querySelector('.modal-button.level-info-btn');
if (levelInfoBtn) {
    levelInfoBtn.addEventListener('click', async () => {
        // 1. الحصول على هوية المستخدم الحالي من الذاكرة المحلية
        const currentUserId = localStorage.getItem('chatUserId');

        if (currentUserId) {
            try {
                // 2. جلب بيانات المستخدم الحقيقية من Firestore
                const userData = await getUserData(currentUserId);
                
                if (userData) {
                    // 3. حساب نقاط الخبرة المتبقية وتحديد النسبة المئوية
                    const expToNextLevel = userData.expToNextLevel || 1000;
                    const expProgress = Math.floor((userData.currentExp / expToNextLevel) * 100);

                    // 4. إعداد البيانات النهائية لإرسالها إلى المودال
                    const userLevelData = {
                        levelRank: userData.rank || 'مبتدئ',
                        level: userData.level || 1,
                        totalExp: userData.totalExp || 0,
                        expProgress: expProgress
                    };

                    // 5. عرض المودال بالبيانات الحقيقية
                    showLevelInfoModal(userLevelData);
                } else {
                    alert('لم يتم العثور على بيانات المستخدم.');
                }
            } catch (error) {
                console.error("خطأ في جلب بيانات المستخدم:", error);
                alert('حدث خطأ أثناء جلب معلومات المستوى.');
            }
        } else {
            alert('يجب تسجيل الدخول لعرض معلومات المستوى.');
        }

        hideProfileDropdown();
    });
}

            const walletButton = profileDropdownMenu.querySelector('.modal-button.wallet-btn');
            if (walletButton) {
                walletButton.addEventListener('click', () => {
                    alert('سيتم فتح صفحة المحفظة!');
                    hideProfileDropdown();
                });
            }

            const leaveRoomButton = profileDropdownMenu.querySelector('.modal-button.leave-room-btn');
if (leaveRoomButton) {
    leaveRoomButton.addEventListener('click', () => {
        // حذف آخر غرفة تمت زيارتها من التخزين المحلي
        localStorage.removeItem('lastVisitedRoomId');
        
        // توجيه المستخدم إلى صفحة الغرف
        window.location.href = 'rooms.html';
        hideProfileDropdown();
    });
}

            const logoutButton = profileDropdownMenu.querySelector('.modal-button.logout');
            if (logoutButton) {
                logoutButton.addEventListener('click', () => {
                    localStorage.removeItem('chatUserId');
                    localStorage.removeItem('chatUserName');
                    localStorage.removeItem('chatUserAvatar');
                    window.location.href = 'index.html';
                    hideProfileDropdown();
                });
            }
        }

        createAndAppendProfileDropdown();

        if (profileButton) {
            profileButton.addEventListener('click', (event) => {
                event.stopPropagation();
                hideAllOpenModals();

                if (profileDropdownMenu) {
                    profileDropdownMenu.classList.add('show');

                    const buttonRect = profileButton.getBoundingClientRect();
                    profileDropdownMenu.style.top = `${buttonRect.bottom + window.scrollY + 5}px`;
                    
                    const dropdownWidth = profileDropdownMenu.offsetWidth;
                    const windowWidth = window.innerWidth;
                    let desiredRight = windowWidth - buttonRect.right - window.scrollX;

                    if (desiredRight + dropdownWidth > windowWidth) {
                        desiredRight = windowWidth - dropdownWidth - 10;
                    }
                    profileDropdownMenu.style.right = `${desiredRight}px`;
                    profileDropdownMenu.style.left = 'auto';

                    document.addEventListener('click', handleProfileDropdownOutsideClick);
                } else {
                    console.warn("profileDropdownMenu لم يتم إنشاؤه بعد عند النقر على زر البروفايل.");
                }
            });
        } else {
            console.warn('زر البروفايل (#profileButton) لم يتم العثور عليه.');
        }

        if (currentUserId) {
            try {
                const allUsersAndVisitors = await getAllUsersAndVisitors();
                const currentUserData = allUsersAndVisitors.find(user => user.id === currentUserId);

                if (currentUserData) {
                    const currentUserRank = currentUserData.rank;

                    const privateBtn = document.querySelector('.top-bar .btn.private');
                    const reportBtn = document.querySelector('.top-bar .btn.report');

                    if (privateBtn) {
                        const canSeePrivateChat = RANK_PERMISSIONS[currentUserRank]?.canSeePrivateChatButton;
                        if (canSeePrivateChat === false) {
                            privateBtn.style.display = 'none';
                        } else {
                            privateBtn.style.display = 'flex';
                        }
                    }

                    if (reportBtn) {
                        const canSeeReport = RANK_PERMISSIONS[currentUserRank]?.canSeeReportButton;
                        if (canSeeReport === false) {
                            reportBtn.style.visibility = 'hidden';
                            reportBtn.style.pointerEvents = 'none';
                        } else {
                            reportBtn.style.visibility = 'visible';
                            reportBtn.style.pointerEvents = 'auto';
                        }
                    }
                }
            } catch (error) {
                console.error('خطأ في جلب بيانات المستخدم أو إدارة ظهور الأزرار:', error);
            }
        }
        
        const userProfileImage = document.getElementById('user-profile-image');
        if (userProfileImage) {
            userProfileImage.src = chatUserAvatar || 'https://i.imgur.com/Uo9V2Yx.png';
            userProfileImage.style.display = 'block';
        }

        setupRealtimeMessagesListener(currentRoomId);

        const refreshButton = document.querySelector('#top-bar .btn.refresh');
        if (refreshButton) {
            refreshButton.addEventListener('click', () => {
                window.location.reload();
            });
        }

        const privateButton = document.querySelector('#top-bar .btn.private');
        if (privateButton) {
            privateButton.addEventListener('click', (event) => {
                event.stopPropagation();
                createPrivateChatModal(privateButton);
            });
        } else {
            console.warn('زر الدردشة الخاصة غير موجود.');
        }

        const onlineUsersButton = document.querySelector('#online-users-btn');
        if (onlineUsersButton) {
            onlineUsersButton.addEventListener('click', (event) => {
                event.stopPropagation();
                createOnlineUsersModal(onlineUsersButton);
            });
        } else {
            console.warn('زر المستخدمين المتصلين غير موجود.');
        }

        const editProfileButton = document.getElementById('editProfileButton');
        if (editProfileButton) {
            editProfileButton.addEventListener('click', async (event) => {
                event.preventDefault(); 
                event.stopPropagation(); 

                if (typeof hideProfileDropdown === 'function') {
                    hideProfileDropdown();
                }
                hideAllOpenModals(); 

                const currentUserId = localStorage.getItem('chatUserId');
                let currentUserData = null;
                if (currentUserId) {
                    if (window.allUsersAndVisitorsData && Array.isArray(window.allUsersAndVisitorsData)) {
                        currentUserData = window.allUsersAndVisitorsData.find(user => user.id === currentUserId);
                    } else {
                        console.warn("window.allUsersAndVisitorsData غير متاح، جاري الجلب من Firestore كحل احتياطي.");
                        try {
                            const allUsers = await getAllUsersAndVisitors();
                            currentUserData = allUsers.find(user => user.id === currentUserId);
                        } catch (error) {
                            console.error("خطأ في جلب بيانات المستخدم لمودال التعديل:", error);
                        }
                    }
                }

                if (typeof window.hideEditProfileModal === 'function' && window.editProfileModal) {
                    window.editProfileModal.classList.add('show');
                    document.addEventListener('click', window.handleEditProfileModalOutsideClick);
                    
                    if (typeof window.updateEditProfileModalContent === 'function') {
                        window.updateEditProfileModalContent(currentUserData);
                    }
                } else {
                    console.error("مودال تعديل الملف أو دواله غير متاحة. تأكد من تحميل modals.js بشكل صحيح.");
                }
            });
        }

        //js/main.js
// ... (تأكد من أن هذا الكود موجود في ملف main.js)
// ... (تأكد من وجود هذا السطر في أعلى الملف)

// ... (باقي كود main.js)
    // ... (باقي الكود داخل دالة DOMContentLoaded)

    // هذا هو الكود الذي يجب أن تستبدله بالكود القديم
    const messageInput = document.querySelector('#input-bar input');
    const sendButton = document.querySelector('#input-bar .send-btn');
    

    if (messageInput && sendButton && currentUserId) {
        let currentUserRank = 'زائر';
        try {
            const currentUserData = window.allUsersAndVisitorsData.find(user => user.id === currentUserId);
            if (currentUserData && currentUserData.rank) {
                currentUserRank = currentUserData.rank;
            }
        } catch (error) {
            console.error("خطأ في جلب رتبة المستخدم:", error);
        }
        
        // دالة مساعدة لمعالجة الرسائل
        // ...
// ...
// ...
// js/main.js

// ... (تأكد من وجود هذا المتغير في بداية الملف، خارج أي دالة)
let messagesUnsubscriber = null;

// ... (بقية الكود) ...

// هذا هو الكود الجديد الذي يجب أن تستبدله بالكامل
const handleMessageSend = async () => {
    const messageText = messageInput.value.trim();
    if (!messageText) return;

    if (messageText.toLowerCase() === '/clear') {
        try {
            // إيقاف المستمع مؤقتاً
            if (messagesUnsubscriber) {
                messagesUnsubscriber();
            }

            // حاول حذف الرسائل. إذا لم يكن المستخدم يملك الصلاحية، ستفشل العملية تلقائيًا.
            await deleteChatRoomMessages(currentRoomId);
            
            // إنشاء رسالة تأكيد نظام جديدة وإرسالها
            const chatUserName = localStorage.getItem('chatUserName') || 'مستخدم مجهول';
            const confirmationMessage = `تم تنظيف الغرفة من قبل ${chatUserName}`;
            await sendSystemMessage(confirmationMessage, currentRoomId);
            
            // إعادة تشغيل المستمع ليتم جلب رسالة النظام فقط
            messagesUnsubscriber = setupRealtimeMessagesListener(currentRoomId);

            messageInput.value = '';
        } catch (error) {
            console.error('فشل تنظيف الدردشة أو إرسال رسالة التأكيد:', error);
            // إظهار رسالة خطأ للمستخدم
            alert('فشل تنظيف الدردشة. ليس لديك الصلاحية لفعل ذلك.');

            // تأكد من إعادة تشغيل المستمع حتى لو فشلت العملية
            messagesUnsubscriber = setupRealtimeMessagesListener(currentRoomId);
        }
        return;
    }
    // ... (بقية الكود الخاص بإرسال الرسائل العادية) ...
    messageInput.value = '';
    try {
        await sendMessage(messageText, currentRoomId, null);
        scrollToBottom();
    } catch (error) {
        console.error('فشل إرسال الرسالة:', error);
        alert('فشل إرسال الرسالة. يرجى المحاولة مرة أخرى.');
    }
};

sendButton.addEventListener('click', handleMessageSend);

        messageInput.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleMessageSend();
            }
        });
    } else if (messageInput && sendButton) {
        // إذا لم يكن المستخدم مسجلاً، لا تظهر منطق الصلاحيات
        sendButton.addEventListener('click', async () => {
            const messageText = messageInput.value.trim();
            if (messageText) {
                messageInput.value = '';
                try {
                    await sendMessage(messageText, currentRoomId, null);
                    scrollToBottom();
                } catch (error) {
                    console.error('فشل إرسال الرسالة:', error);
                    alert('فشل إرسال الرسالة. يرجى المحاولة مرة أخرى.');
                }
            }
        });

        messageInput.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const messageText = messageInput.value.trim();
                if (messageText) {
                    messageInput.value = '';
                    try {
                        await sendMessage(messageText, currentRoomId, null);
                        scrollToBottom();
                    } catch (error) {
                        console.error('فشل إرسال الرسالة:', error);
                        alert('فشل إرسال الرسالة. يرجى المحاولة مرة أخرى.');
                    }
                }
            }
        });
    }

    } catch (error) {
        console.error('فشل تحميل أحد مكونات HTML:', error);
        if (chatContainer) {
            chatContainer.innerHTML = `<div style="text-align: center; color: red; padding-top: 50px;">
                                           <p>عذرًا، حدث خطأ أثناء تحميل مكونات الدردشة الأساسية.</p>
                                           <p>الرجاء التأكد من وجود ملفات HTML في مساراتها الصحيحة (components/).</p>
                                           <p>تفاصيل الخطأ: ${error.message}</p>
                                         </div>`;
        } else {
            document.body.innerHTML = `<div style="text-align: center; color: red; padding-top: 50px;">
                                           <p>خطأ فادح: فشل تحميل مكونات التطبيق. يرجى مراجعة Console لمزيد من التفاصيل.</p>
                                         </div>`;
        }
    }

    document.addEventListener('click', (event) => {
        const target = event.target;
    });
});

window.sendMessage = sendMessage;

// دالة لإنشاء النافذة المنبثقة (Modal) وتجهيزها
function createAndAppendImageModal() {
    // التحقق أولاً إذا كانت النافذة المنبثقة موجودة بالفعل
    if (document.getElementById('image-modal')) {
        return;
    }

    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'image-modal';
    modalOverlay.className = 'image-modal-overlay';
    
    const modalContent = document.createElement('div');
    modalContent.className = 'image-modal-content';
    
    const closeBtn = document.createElement('button');
    closeBtn.id = 'close-image-modal';
    closeBtn.className = 'close-btn';
    closeBtn.innerHTML = '&times;';
    
    const downloadBtn = document.createElement('a'); // استخدام <a> بدلاً من <button>
    downloadBtn.id = 'download-image-btn';
    downloadBtn.className = 'download-btn';
    downloadBtn.innerHTML = '<i class="fas fa-download"></i>'; // تأكد من تضمين Font Awesome
    
    const imageElement = document.createElement('img');
    imageElement.id = 'modal-image';
    imageElement.src = '';
    imageElement.alt = 'صورة مكبرة';
    
    modalContent.appendChild(closeBtn);
    modalContent.appendChild(downloadBtn);
    modalContent.appendChild(imageElement);
    modalOverlay.appendChild(modalContent);
    
    document.body.appendChild(modalOverlay);

    // إضافة مُستمعي الأحداث بعد إنشاء العناصر
    closeBtn.addEventListener('click', closeImageModal);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            closeImageModal();
        }
    });
}

// دالة لفتح المودال وعرض الصورة
function openImageModal(imageSrc) {
    const modalOverlay = document.getElementById('image-modal');
    const modalImage = document.getElementById('modal-image');
    const downloadBtn = document.getElementById('download-image-btn');
    
    if (modalOverlay && modalImage && downloadBtn) {
        modalImage.src = imageSrc;
        downloadBtn.href = imageSrc;
        downloadBtn.download = imageSrc.split('/').pop(); // اسم الملف من الرابط
        modalOverlay.style.display = 'flex';
    }
}

// دالة لإغلاق المودال
function closeImageModal() {
    const modalOverlay = document.getElementById('image-modal');
    if (modalOverlay) {
        modalOverlay.style.display = 'none';
        document.getElementById('modal-image').src = '';
    }
}

// استدعاء الدالة عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', createAndAppendImageModal);

// **مستمع الحدث الجديد والمعدّل**
document.addEventListener('click', (e) => {
    // التحقق من أن العنصر الذي تم النقر عليه هو صورة
    if (e.target.tagName === 'IMG') {
        // التحقق من أن الصورة موجودة داخل عنصر رسالة
        const messageItem = e.target.closest('.message-item');
        if (messageItem) {
            const imageSrc = e.target.src;
            if (imageSrc) {
                openImageModal(imageSrc);
            }
        }
    }
});