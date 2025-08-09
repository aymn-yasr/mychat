// js/chat-firestore.js
import { db, serverTimestamp, } from './firebase-config.js';
import { createMessageElement, createSystemMessageElement, addWelcomeMessageToChat, activeQuoteData, hideActiveQuoteBubble, updatePrivateButtonNotification, updatePrivateChatNotification } from './chat-ui.js';
import { RANK_ORDER } from './constants.js';

let isFirstSnapshot = true; 


let unsubscribeFromMessages = null;

export function setupRealtimeMessagesListener(roomId) {
  const chatBox = document.querySelector('#chat-box .chat-box');
  if (!chatBox) {
    console.error('لم يتم العثور على عنصر صندوق الدردشة!');
    return;
  }
  
  if (unsubscribeFromMessages) {
    unsubscribeFromMessages();
  }

  let isFirstSnapshot = true;

  unsubscribeFromMessages = db.collection('rooms').doc(roomId).collection('messages').orderBy('timestamp', 'asc').onSnapshot(async snapshot => {
    
    if (snapshot.empty && isFirstSnapshot) {
      chatBox.innerHTML = '<div style="text-align: center; padding: 20px; color: #888;">ابدأ المحادثة...</div>';
      isFirstSnapshot = false;
      return;
    }

    const userLookups = {}; 
    const senderIdsToLookup = new Set(); 
    snapshot.docChanges().forEach(change => {
      const messageData = change.doc.data();
      if (!messageData.isSystemMessage && messageData.senderId) {
        senderIdsToLookup.add(messageData.senderId);
      }
    });

    const lookupPromises = Array.from(senderIdsToLookup).map(async (senderId) => {
      const userDoc = await db.collection('users').doc(senderId).get();
      if (userDoc.exists) {
        userLookups[senderId] = {
          type: 'registered',
          rank: userDoc.data().rank || 'عضو',
          level: userDoc.data().level || 1
        };
      } else {
        const visitorDoc = await db.collection('visitors').doc(senderId).get();
        if (visitorDoc.exists) {
          userLookups[senderId] = {
            type: 'visitor',
            rank: visitorDoc.data().rank || 'زائر',
            level: null
          };
        } else {
          userLookups[senderId] = {
            type: 'unknown',
            rank: 'زائر',
            level: null
          };
        }
      }
    });
    await Promise.all(lookupPromises); 
    
    // هذا الشرط سيعمل لمرة واحدة فقط عند أول تحميل للبيانات
    if (isFirstSnapshot) {
      chatBox.innerHTML = '';
      isFirstSnapshot = false;
    }

    snapshot.docChanges().forEach(change => {
      const messageData = { id: change.doc.id, ...change.doc.data() };
      const existingMessageElement = chatBox.querySelector(`[data-id="${messageData.id}"]`);

      if (change.type === 'added') {
        if (!existingMessageElement) {
          let messageElement;
          if (messageData.isSystemMessage) {
            messageElement = createSystemMessageElement(messageData.text);
          } else {
            messageData.userType = userLookups[messageData.senderId] ? userLookups[messageData.senderId].type : 'unknown';
            messageData.senderRank = userLookups[messageData.senderId] ? userLookups[messageData.senderId].rank : 'زائر';
            messageData.level = userLookups[messageData.senderId] ? userLookups[messageData.senderId].level : null;
            messageElement = createMessageElement(messageData); 
          }
          chatBox.appendChild(messageElement);
        }
      } else if (change.type === 'modified') {
        if (existingMessageElement) {
          existingMessageElement.remove();
        }
        let messageElement;
        if (messageData.isSystemMessage) {
            messageElement = createSystemMessageElement(messageData.text);
        } else {
            messageData.userType = userLookups[messageData.senderId] ? userLookups[messageData.senderId].type : 'unknown';
            messageData.senderRank = userLookups[messageData.senderId] ? userLookups[messageData.senderId].rank : 'زائر';
            messageData.level = userLookups[messageData.senderId] ? userLookups[messageData.senderId].level : null;
            messageElement = createMessageElement(messageData);
        }
        chatBox.appendChild(messageElement);
      } else if (change.type === 'removed') {
        if (existingMessageElement) {
          existingMessageElement.remove();
        }
      }
    });

    setTimeout(() => {
      if (chatBox && chatBox.scrollHeight > chatBox.clientHeight) {
        chatBox.scrollTop = chatBox.scrollHeight;
      }
    }, 100);

  }, error => {
    console.error('حدث خطأ أثناء الاستماع للرسائل:', error);
    chatBox.innerHTML = '<div style="text-align: center; padding: 20px; color: red;">فشل تحميل الرسائل. يرجى التحقق من اتصالك بالإنترنت أو قواعد البيانات.</div>';
  });
  
  return unsubscribeFromMessages;
}


export async function updateUserExperience(userId) {
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (userDoc.exists) {
        const userData = userDoc.data();
        
        if (userData.userType === 'registered') {
            let { level, totalExp, currentExp, expToNextLevel } = userData;

            const expGain = 10;
            currentExp = (currentExp || 0) + expGain;
            totalExp = (totalExp || 0) + expGain;
            
            level = level || 1;
            expToNextLevel = expToNextLevel || 200;

            if (currentExp >= expToNextLevel) {
                level++;
                currentExp = currentExp - expToNextLevel;
                expToNextLevel = 200 + (level * 100);

                console.log(`تم رفع مستوى المستخدم ${userData.username} إلى المستوى ${level}!`);
            }

            await userRef.update({
                level: level,
                totalExp: totalExp,
                currentExp: currentExp,
                expToNextLevel: expToNextLevel,
            });

            return { level, totalExp, currentExp, expToNextLevel };
        }
    }
    return null;
}

export async function sendMessage(messageText, roomId, imageUrl = null) { // **تعديل: إضافة بارامتر imageUrl**
  if ((!messageText || messageText.trim() === '') && !imageUrl) { // **تعديل: التحقق من وجود نص أو صورة**
    if (!activeQuoteData) {
      return;
    }
  }

  const currentUserName = localStorage.getItem('chatUserName');
  const currentUserId = localStorage.getItem('chatUserId');
  const currentUserAvatar = localStorage.getItem('chatUserAvatar');

  if (!currentUserName || !currentUserId) {
    console.error('لا يوجد اسم مستخدم أو معرف مستخدم مخزن. يرجى تسجيل الدخول أولاً.');
    alert('الرجاء تسجيل الدخول لإرسال الرسائل.');
    return;
  }

  const userDoc = await db.collection('users').doc(currentUserId).get();
  const userData = userDoc.exists ? userDoc.data() : {};
  const currentUserRank = userData.rank || 'زائر';
  const currentUserLevel = userData.level || 1;
  
  await updateUserExperience(currentUserId);

  const newMessage = {
    user: currentUserName,
    senderId: currentUserId,
    avatar: currentUserAvatar,
    text: messageText ? messageText.trim() : '', // **تعديل: إضافة نص الرسالة فقط إذا كان موجودًا**
    type: 'chat',
    timestamp: serverTimestamp(),
    userNum: '100',
    senderRank: currentUserRank,
    level: currentUserLevel
  };

  if (imageUrl) {
    newMessage.imageUrl = imageUrl; // **تعديل: إضافة رابط الصورة**
  }

  if (activeQuoteData) {
    newMessage.quoted = {
      senderName: activeQuoteData.senderName,
      content: activeQuoteData.content
    };
  }

  // **الكود المحدث لميزة المنشن بدون حرف @**
  // ... (داخل دالة sendMessage)

// الكود المحدث لميزة المنشن بدون حرف @
try {
    if (messageText) {
        const allUsers = await getAllUsersAndVisitors();
        const mentionedUser = allUsers.find(user =>
            messageText.includes(user.name)
        );

        if (mentionedUser) {
            newMessage.mentionedUserId = mentionedUser.id;
            // **هذا هو السطر الجديد الذي يجب إضافته**
            newMessage.mentionedUserName = mentionedUser.name;
        }
    }
} catch (error) {
    console.error('خطأ في جلب بيانات المستخدمين للتحقق من المنشن:', error);
}

  try {
    await db.collection('rooms').doc(roomId).collection('messages').add(newMessage);
    console.log('تم إرسال الرسالة بنجاح!');
    hideActiveQuoteBubble();
  } catch (e) {
    console.error('خطأ في إرسال الرسالة: ', e);
    alert('فشل إرسال الرسالة. يرجى المحاولة مرة أخرى.');
  }
}

//js/chat-firestore.js

// ... (باقي الكود)

/**
 * دالة لإرسال رسائل النظام إلى الغرفة.
 * @param {string} text نص الرسالة.
 * @param {string} roomId معرف الغرفة.
 */
export async function sendSystemMessage(text, roomId) {
    if (!roomId || !text) return;

    const messagesCollectionRef = db.collection('rooms').doc(roomId).collection('messages');

    const newMessage = {
        text,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        // إضافة هذا الحقل لتمييزها كرسالة نظام
        isSystemMessage: true
    };

    try {
        await messagesCollectionRef.add(newMessage);
    } catch (error) {
        console.error("فشل إرسال رسالة النظام:", error);
        throw error;
    }
}

// js/chat-firestore.js

async function getAllUsersAndVisitors() {
    const onlineUsers = new Map();

    const usersSnapshot = await db.collection('users').get();
    usersSnapshot.forEach(doc => {
        const userData = doc.data();
        onlineUsers.set(doc.id, {
            id: doc.id,
            name: userData.username,
            avatar: userData.avatar || 'https://i.imgur.com/Uo9V2Yx.png',
            innerImage: userData.innerImage || 'images/Interior.png', 
            rank: userData.rank || 'عضو',
            level: userData.level || 1, 
            likes: userData.likes || [],
            gender: userData.gender || 'غير محدد',
            age: userData.age || '',
            statusText: userData.statusText || '',
            bio: userData.bio || '',
            password: userData.password || '',
            // **السطر الجديد لجلب حقل email**
            email: userData.email || '' 
        });
    });

    const visitorsSnapshot = await db.collection('visitors').get();
    visitorsSnapshot.forEach(doc => {
        const visitorData = doc.data();
        if (!onlineUsers.has(doc.id)) {
            onlineUsers.set(doc.id, {
                id: doc.id,
                name: visitorData.name,
                avatar: visitorData.avatar || 'https://i.imgur.com/Uo9V2Yx.png',
                innerImage: visitorData.innerImage || 'images/Interior.png', 
                rank: visitorData.rank || 'زائر',
                level: 1, 
                likes: [],
                gender: visitorData.gender || 'غير محدد',
                age: visitorData.age || '',
                statusText: visitorData.statusText || '',
                bio: visitorData.bio || '',
                password: visitorData.password || '',
                // **السطر الجديد لجلب حقل email**
                email: visitorData.email || ''
            });
        }
    });

    return Array.from(onlineUsers.values());
}

export { getAllUsersAndVisitors };

export async function getUserData(userId) {
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (userDoc.exists) {
            return { id: userDoc.id, ...userDoc.data() };
        } else {
            console.log("لم يتم العثور على المستخدم:", userId);
            const visitorDoc = await db.collection('visitors').doc(userId).get();
            if (visitorDoc.exists) {
                return { id: visitorDoc.id, ...visitorDoc.data() };
            }
            return null;
        }
    } catch (error) {
        console.error("خطأ في جلب بيانات المستخدم:", error);
        return null;
    }
}

export async function updateUserData(userId, dataToUpdate) {
    try {
        const userDocRef = db.collection('users').doc(userId);
        await userDocRef.update(dataToUpdate);
        console.log("User data updated successfully:", dataToUpdate);
        if (dataToUpdate.innerImage !== undefined) {
            if (dataToUpdate.innerImage === null || dataToUpdate.innerImage === firebase.firestore.FieldValue.delete()) {
                localStorage.removeItem('chatUserInnerImage');
            } else {
                localStorage.setItem('chatUserInnerImage', dataToUpdate.innerImage);
            }
        }
    } catch (error) {
        console.error("خطأ في تحديث بيانات المستخدم/الزائر:", error);
        return false;
    }
}

export async function manuallyUpdateUserLevel(userId, newLevel) {
    if (newLevel < 1) {
        console.error("المستوى الجديد يجب أن يكون أكبر من أو يساوي 1.");
        return;
    }

    const userRef = db.collection('users').doc(userId);
    try {
        await userRef.update({
            level: newLevel,
            currentExp: 0,
            expToNextLevel: 200 + (newLevel * 100)
        });
        console.log(`تم تحديث مستوى المستخدم ${userId} يدوياً إلى المستوى ${newLevel} بنجاح!`);
    } catch (error) {
        console.error("خطأ في تحديث المستوى يدوياً:", error);
    }
}

// **تم إضافة كلمة 'export' هنا**
export function getPrivateChatId(userId1, userId2) {
    return [userId1, userId2].sort().join('_');
}

export async function sendPrivateMessage(senderId, senderName, senderAvatar, receiverId, messageText, quotedData = null) {
    if (!messageText || messageText.trim() === '') {
        return;
    }

    const chatId = getPrivateChatId(senderId, receiverId);
    const privateChatRef = db.collection('privateChats').doc(chatId);

    const newMessage = {
        senderId: senderId,
        senderName: senderName,
        senderAvatar: senderAvatar,
        receiverId: receiverId,
        text: messageText.trim(),
        timestamp: serverTimestamp(),
        type: 'private',
    };

    if (quotedData) {
        newMessage.quoted = quotedData;
    }

    try {
        await privateChatRef.collection('messages').add(newMessage);

        const unreadCounterField = `unreadCount_${receiverId}`;
        await privateChatRef.set({
            senderId: senderId,
            receiverId: receiverId,
            lastMessageTimestamp: serverTimestamp(),
            [unreadCounterField]: firebase.firestore.FieldValue.increment(1)
        }, { merge: true });

        console.log(`تم إرسال رسالة خاصة في المحادثة ${chatId} بنجاح!`);
    } catch (e) {
        console.error('خطأ في إرسال الرسالة الخاصة: ', e);
        alert('فشل إرسال الرسالة الخاصة.');
    }
}

export function setupPrivateMessagesListener(currentUserId, targetUserId, messagesBoxElement, clearPrevious = true) {
    if (clearPrevious) {
        messagesBoxElement.innerHTML = '<div style="text-align: center; padding: 20px; color: #888;">جاري تحميل الرسائل الخاصة...</div>';
    }

    const chatId = getPrivateChatId(currentUserId, targetUserId);
    console.log(`جارٍ الاستماع إلى الرسائل الخاصة في المحادثة: ${chatId}`);

    if (messagesBoxElement._privateChatUnsubscribe) {
        messagesBoxElement._privateChatUnsubscribe();
        messagesBoxElement._privateChatUnsubscribe = null;
    }

    let isFirstPrivateSnapshot = true;

    const unsubscribe = db.collection('privateChats')
        .doc(chatId)
        .collection('messages')
        .orderBy('timestamp', 'asc')
        .onSnapshot(snapshot => {
            if (isFirstPrivateSnapshot) {
                messagesBoxElement.innerHTML = '';
                if (snapshot.empty) {
                    messagesBoxElement.innerHTML = '<div style="text-align: center; padding: 20px; color: #888;"></div>';
                }
                isFirstPrivateSnapshot = false;
            }

            snapshot.docChanges().forEach(change => {
                const messageData = change.doc.data();
                const isSentByMe = messageData.senderId === currentUserId;

                messageData.id = change.doc.id;

                if (change.type === 'added') {
                    const existingMessageElement = messagesBoxElement.querySelector(`.private-message-item[data-id="${messageData.id}"]`);
                    if (!existingMessageElement) {
                        const messageElement = document.createElement('div');
                        messageElement.classList.add('private-message-item');
                        messageElement.setAttribute('data-id', messageData.id);
                        if (isSentByMe) {
                            messageElement.classList.add('sent');
                        } else {
                            messageElement.classList.add('received');
                        }
                        messageElement.textContent = messageData.text;
                        messagesBoxElement.appendChild(messageElement);
                    }
                    
                    const senderId = messageData.senderId;
                    if (!isSentByMe) {
                        const senderData = {
                            id: senderId,
                            name: messageData.senderName,
                            avatar: messageData.senderAvatar
                        };
                        updatePrivateChatNotification(senderId, senderData);
                    }
                } else if (change.type === 'modified') {
                    const existingPrivateMessage = messagesBoxElement.querySelector(`.private-message-item[data-id="${messageData.id}"]`);
                    if (existingPrivateMessage) {
                        existingPrivateMessage.textContent = messageData.text;
                        console.log(`تم تحديث الرسالة الخاصة ID: ${messageData.id}`);
                    }
                } else if (change.type === 'removed') {
                    const existingPrivateMessage = messagesBoxElement.querySelector(`.private-message-item[data-id="${messageData.id}"]`);
                    if (existingPrivateMessage) {
                        existingPrivateMessage.remove();
                        console.log(`تم حذف الرسالة الخاصة ID: ${messageData.id}`);
                    }
                }
            });

            messagesBoxElement.scrollTop = messagesBoxElement.scrollHeight;
        }, error => {
            console.error("Error getting private messages: ", error);
            messagesBoxElement.innerHTML = '<div style="text-align: center; padding: 20px; color: red;">فشل تحميل الرسائل الخاصة.</div>';
        });

    messagesBoxElement._privateChatUnsubscribe = unsubscribe;
}

export async function getPrivateChatContacts(currentUserId) {
    const contacts = new Map();
    const chatDocs = [];

    const senderSnapshot = await db.collection('privateChats')
        .where('senderId', '==', currentUserId)
        .get();
    senderSnapshot.forEach(doc => chatDocs.push(doc));

    const receiverSnapshot = await db.collection('privateChats')
        .where('receiverId', '==', currentUserId)
        .get();
    receiverSnapshot.forEach(doc => chatDocs.push(doc));

    chatDocs.forEach(doc => {
        const data = doc.data();
        const targetUserId = data.senderId === currentUserId ? data.receiverId : data.senderId;
        const unreadCount = data[`unreadCount_${currentUserId}`] || 0;

        if (targetUserId) {
            contacts.set(targetUserId, {
                id: targetUserId,
                unreadCount: unreadCount
            });
        }
    });

    const contactDetailsPromises = Array.from(contacts.keys()).map(async (userId) => {
        let userDoc = await db.collection('users').doc(userId).get();
        if (userDoc.exists) {
            return { ...contacts.get(userId), name: userDoc.data().username, avatar: userDoc.data().avatar };
        } else {
            userDoc = await db.collection('visitors').doc(userId).get();
            if (userDoc.exists) {
                return { ...contacts.get(userId), name: userDoc.data().name, avatar: userDoc.data().avatar };
            }
        }
        return null;
    });

    const detailedContacts = await Promise.all(contactDetailsPromises);
    return detailedContacts.filter(contact => contact !== null);
}

export function setupPrivateMessageNotificationListener(currentUserId) {
    if (!currentUserId) {
        console.warn('Cannot set up private message notification listener: User ID is missing.');
        return;
    }

    db.collection('privateChats').onSnapshot(snapshot => {
        let totalUnreadCount = 0;
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.receiverId === currentUserId) {
                const unreadCount = data[`unreadCount_${currentUserId}`] || 0;
                totalUnreadCount += unreadCount;
            } else if (data.senderId === currentUserId) {
                const unreadCount = data[`unreadCount_${currentUserId}`] || 0;
                totalUnreadCount += unreadCount;
            }
        });
        
        if (totalUnreadCount > 0) {
            updatePrivateButtonNotification(true);
        } else {
            updatePrivateButtonNotification(false);
        }
        
    }, error => {
        console.error('Error listening to private chat updates:', error);
    });
}

export async function resetUnreadCount(currentUserId, targetUserId) {
    const chatId = getPrivateChatId(currentUserId, targetUserId);
    const privateChatRef = db.collection('privateChats').doc(chatId);
    const unreadCounterField = `unreadCount_${currentUserId}`;

    try {
        await privateChatRef.update({
            [unreadCounterField]: 0
        });
        console.log(`تم إعادة ضبط عداد الرسائل غير المقروءة للمستخدم ${currentUserId} في المحادثة ${chatId}.`);
    } catch (error) {
        console.error('خطأ في إعادة ضبط العداد:', error);
    }
}

export async function sendJoinMessage(roomId) {
    const currentUserName = localStorage.getItem('chatUserName');
    const currentUserId = localStorage.getItem('chatUserId');
    const currentUserAvatar = localStorage.getItem('chatUserAvatar');
    const currentUserRank = localStorage.getItem('chatUserRank') || 'زائر';

    if (!currentUserName || !currentUserId) {
        console.error('لا يوجد اسم مستخدم أو معرف مستخدم مخزن لإرسال رسالة الانضمام.');
        return;
    }

    const joinMessage = {
        user: currentUserName,
        senderId: currentUserId,
        avatar: currentUserAvatar,
        text: `انضم ${currentUserName} إلى الغرفة!`,
        type: 'join',
        timestamp: serverTimestamp(),
        senderRank: currentUserRank
    };

    try {
        await db.collection('rooms').doc(roomId).collection('messages').add(joinMessage);
        console.log('تم إرسال رسالة الانضمام بنجاح.');
    } catch (e) {
        console.error('خطأ في إرسال رسالة الانضمام: ', e);
    }
}

/**
 * دالة لحذف جميع رسائل الغرفة المحددة من قاعدة البيانات.
 * @param {string} roomId معرف الغرفة التي سيتم حذف رسائلها.
 */
export async function deleteChatRoomMessages(roomId) {
    if (!roomId) {
        console.error('خطأ: معرف الغرفة مفقود لحذف الرسائل.');
        return;
    }

    try {
        const chatRoomRef = db.collection('rooms').doc(roomId).collection('messages');
        const querySnapshot = await chatRoomRef.get();

        if (querySnapshot.empty) {
            console.log('لا توجد رسائل لحذفها في هذه الغرفة.');
            return;
        }

        const batch = db.batch();
        querySnapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });

        await batch.commit();
        console.log(`تم حذف جميع الرسائل من الغرفة: ${roomId}`);
    } catch (error) {
        console.error('فشل حذف رسائل الغرفة:', error);
        throw error;
    }
}

// في ملف js/chat-firestore.js// في ملف js/chat-firestore.js
// ... (بقية الكود الخاص بك)

/**
 * دالة لإضافة إعجاب من مستخدم لآخر.
 * @param {string} likerId معرف المستخدم الذي قام بالإعجاب.
 * @param {string} likedUserId معرف المستخدم الذي تم الإعجاب بملفه.
 */
export async function addLike(likerId, likedUserId) {
    if (likerId === likedUserId) {
        console.warn('لا يمكن للمستخدم الإعجاب بملفه الشخصي.');
        return false;
    }

    const userRef = db.collection('users').doc(likedUserId);

    try {
        await userRef.update({
            // arrayUnion يضيف العنصر إلى المصفوفة إذا لم يكن موجودًا بالفعل
            likes: firebase.firestore.FieldValue.arrayUnion(likerId)
        });
        console.log(`تم الإعجاب بملف المستخدم ${likedUserId} بنجاح.`);
        return true;
    } catch (error) {
        console.error('فشل إضافة الإعجاب:', error);
        return false;
    }
}

/**
 * دالة لإزالة إعجاب من مستخدم لآخر.
 * @param {string} likerId معرف المستخدم الذي قام بإلغاء الإعجاب.
 * @param {string} likedUserId معرف المستخدم الذي تم إلغاء الإعجاب بملفه.
 */
export async function removeLike(likerId, likedUserId) {
    const userRef = db.collection('users').doc(likedUserId);

    try {
        await userRef.update({
            // arrayRemove يزيل العنصر من المصفوفة إذا كان موجودًا
            likes: firebase.firestore.FieldValue.arrayRemove(likerId)
        });
        console.log(`تم إلغاء الإعجاب بملف المستخدم ${likedUserId} بنجاح.`);
        return true;
    } catch (error) {
        console.error('فشل إلغاء الإعجاب:', error);
        return false;
    }
}
