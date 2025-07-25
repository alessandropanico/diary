/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

// Queste righe sono necessarie per le Cloud Functions e l'SDK Admin di Firebase
const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Queste righe originali dello scheletro le puoi mantenere, sono utili
const {setGlobalOptions} = require("firebase-functions");
const {onRequest} = require("firebase-functions/https");
const logger = require("firebase-functions/logger");

// Per il controllo dei costi (opzionale, ma buona pratica)
setGlobalOptions({ maxInstances: 10 });


// Inizializza l'SDK di Firebase Admin.
// admin.initializeApp() non richiede argomenti se deployato su Cloud Functions.
admin.initializeApp();

const db = admin.firestore();

// --- INIZIO DELLA TUA FUNZIONE PER LE NOTIFICHE CHAT ---

// Questa funzione si attiva ogni volta che un nuovo documento (messaggio) viene creato
// nella sottocollezione 'messages' all'interno di una conversazione.
exports.sendChatNotification = functions.firestore
    .document('conversations/{conversationId}/messages/{messageId}')
    .onCreate(async (snapshot, context) => {
        const newMessage = snapshot.data();
        const conversationId = context.params.conversationId;
        const messageId = context.params.messageId;

        // Non inviare notifiche per i messaggi inviati dal sistema (es. messaggio di benvenuto)
        // o se il messaggio non ha un mittente valido.
        if (!newMessage || !newMessage.senderId || newMessage.senderId === 'system') {
            return null;
        }

        const senderId = newMessage.senderId;
        const messageText = newMessage.text || "Nuovo messaggio"; // Usa il testo del messaggio o un default
        const senderName = newMessage.senderName || "Un utente"; // Assumi che il mittente abbia un nome

        try {
            // 1. Recupera la conversazione per ottenere i partecipanti
            const conversationRef = db.collection('conversations').doc(conversationId);
            const conversationDoc = await conversationRef.get();

            if (!conversationDoc.exists) {
                return null;
            }

            const conversation = conversationDoc.data();
            if (!conversation || !Array.isArray(conversation.participants)) {
                return null;
            }

            // 2. Identifica i destinatari (tutti i partecipanti tranne il mittente)
            const recipientIds = conversation.participants.filter(id => id !== senderId);

            if (recipientIds.length === 0) {
                return null;
            }

            let tokensToSend = [];
            const tokensToRemove = [];

            for (const recipientId of recipientIds) {
                const userRef = db.collection('users').doc(recipientId);
                const userDoc = await userRef.get();

                if (userDoc.exists) {
                    const userData = userDoc.data();
                    if (userData && userData.fcmTokens) {
                        for (const token in userData.fcmTokens) {
                            if (userData.fcmTokens[token] === true) {
                                tokensToSend.push(token);
                            }
                        }
                    }
                } else {
                    console.warn(`User ${recipientId} not found. Cannot send notification.`);
                }
            }

            if (tokensToSend.length === 0) {
                return null;
            }

            // 4. Costruisci il payload della notifica
            const payload = {
                notification: {
                    title: `${senderName} ti ha inviato un messaggio!`,
                    body: messageText,
                    sound: 'default', // Riproduce il suono di notifica predefinito del dispositivo
                    badge: '1' // Mostra un badge con un numero (richiede gestione lato client per l'accuratezza)
                },
                data: {
                    chatId: conversationId,
                    senderId: senderId,
                    messageId: messageId,
                    click_action: 'FLUTTER_NOTIFICATION_CLICK' // Standard per Android per aprire l'app
                }
            };

            // 5. Invia la notifica a tutti i token validi
            const response = await admin.messaging().sendToDevice(tokensToSend, payload);

            // 6. Gestisci i token scaduti o non validi
            response.results.forEach((result, index) => {
                const token = tokensToSend[index];
                if (result.error) {
                    console.error('Failure sending notification to', token, result.error);
                    // Rimuovi i token non validi o non registrati per evitare di inviare ancora
                    if (result.error.code === 'messaging/invalid-registration-token' ||
                        result.error.code === 'messaging/registration-token-not-registered') {
                        tokensToRemove.push(token);
                    }
                } else {
                    console.log('Successfully sent notification to', token);
                }
            });

            // 7. Rimuovi i token non validi da Firestore
            if (tokensToRemove.length > 0) {
                const updatePromises = recipientIds.map(async (recipientId) => {
                    const userRef = db.collection('users').doc(recipientId);
                    const userDoc = await userRef.get();
                    if (userDoc.exists) {
                        const userData = userDoc.data();
                        if (userData && userData.fcmTokens) {
                            let changed = false;
                            for (const token of tokensToRemove) {
                                if (userData.fcmTokens[token]) {
                                    delete userData.fcmTokens[token];
                                    changed = true;
                                }
                            }
                            if (changed) {
                                await userRef.update({ fcmTokens: userData.fcmTokens });
                            }
                        }
                    }
                });
                await Promise.all(updatePromises);
            }

            return null;

        } catch (error) {
            console.error('Error sending chat notification:', error);
            return null;
        }
    });

// --- FINE DELLA TUA FUNZIONE PER LE NOTIFICHE CHAT ---

// Puoi lasciare o rimuovere l'esempio helloWorld se non ti serve.
// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
