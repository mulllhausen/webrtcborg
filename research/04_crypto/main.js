// check the crypto api exists
const crypto = window.crypto || window.msCrypto; // ie11
if (crypto == null) {
    error.innerText = 'crypto api not supported in this browser';
    runNonExistentFunctionToStopExecution();
}
const btnInputPassword = document.querySelector('button#btnInputPassword');
const btnEncryptMessage = document.querySelector('button#btnEncryptMessage');
const btnDecryptMessage = document.querySelector('button#btnDecryptMessage');
// todo - incorporate ideas from gist.github.com/chrisveness/770ee96945ec12ac84f134bf538d89fb
window.onload = e => {
    btnInputPassword.disabled = false;
    inputFriendPubKey.disabled = false;
};
btnInputPassword.onclick = processKeyPair;
inputFriendPubKey.onchange = e => { deriveSharedSecret(null) };
btnEncryptMessage.onclick = e => { encryptMessage(inputMessage.value); }
btnDecryptMessage.onclick = e => { decryptMessage(inputMessage.value); }

// high level functions

// never allow these secret values out of the closure
var password = null;
var sharedSecretKey = null; // in production we will need 1 shared key per friend
var privKey = null;

async function processKeyPair() {
    // first get the password. it is not stored anywhere - once this function
    // goes out of scope then it is gone
    password = getPassword();

    let encryptedPrivKey = inputEncryptedPrivKey.value.trim();
    if (encryptedPrivKey == '') { // no private key has been entered by the user
        const saltUint8Array = generateRandomSalt();
        const keyFromPassword = await stretchKey(password, saltUint8Array);

        // generate a new keypair
        const keyPair = await newKeyPair();
        privKey = keyPair.privateKey;

        // encrypt it with the password for export
        const exportedPrivKey = await exportCryptoKey(keyPair.privateKey);
        const encryptedPrivkey = await encrypt(
            keyFromPassword, JSON.stringify(exportedPrivKey)
        );
        // output to user
        const exportedPubKey = await exportCryptoKey(keyPair.publicKey);
        inputEncryptedPrivKey.value = mergeUint8Arrays(saltUint8Array, encryptedPrivkey);
        inputPubKey.value = JSON.stringify(exportedPubKey);

        // enable the friend's pubkey textbox so it can be pasted in manually
        inputFriendPubKey.disabled = false;
    } else { // the user has already entered their private key
        decryptPrivKey(encryptedPrivKey);
    }
    let friendPubKey = null;
    if (inputFriendPubKey.value.trim() != '') {
        friendPubKey = await importPubKey(
            JSON.parse(inputFriendPubKey.value.trim())
        );
    }
    deriveSharedSecret(friendPubKey);
}

async function decryptPrivKey(encryptedPrivKey) {
    // convert from string to uint8array
    encryptedPrivKey = new Uint8Array(encryptedPrivKey.split(','));

    // remove the password salt from the start of the private key
    const saltUint8Array = encryptedPrivKey.slice(0, saltLen);
    const keyFromPassword = await stretchKey(password, saltUint8Array);
    encryptedPrivKey = encryptedPrivKey.slice(saltLen);

    // decrypt the private key using the password
    const plaintextPrivKey = JSON.parse(
        await decrypt(keyFromPassword, encryptedPrivKey)
    );
    privKey = await importPrivKey(plaintextPrivKey);

    if (inputPubKey.value.trim() == '') {
        // output pubkey to user (encrypted privkey is already there)
        inputPubKey.value = JSON.stringify(privKey2PubKey(plaintextPrivKey));
    }
}

async function deriveSharedSecret(friendPubKey) {
    // we need both our private key and our friend's pubkey to generate a shared
    // secret key
    if (inputEncryptedPrivKey.value.trim() == '') return;
    if (inputFriendPubKey.value.trim() == '') return;

    if (privKey == null) {
        password = getPassword();
        decryptPrivKey(inputEncryptedPrivKey.value.trim());
    }

    if (friendPubKey == null) {
        friendPubKey = await importPubKey(
            JSON.parse(inputFriendPubKey.value.trim())
        );
    }

    sharedSecretKey = await generateSharedSecretKey(privKey, friendPubKey);

    // output to user
    dhSecret.value = JSON.stringify(await exportCryptoKey(sharedSecretKey));

    btnEncryptMessage.disabled = false;
    btnDecryptMessage.disabled = false;
    inputMessage.disabled = false;
}

function getPassword(e) {
    const password = window.prompt('enter your password');
    return password;
}

async function encryptMessage(plaintext) {
    inputMessage.value = await encrypt(sharedSecretKey, plaintext);
}

async function decryptMessage(ciphertext) {
    inputMessage.value = await decrypt(
        sharedSecretKey, new Uint8Array(ciphertext.split(','))
    );
}

// crypto functions

const saltLen = 16;
const keyDerivationIterations = 100000;
const keyDerivationHash = 'SHA-256';
let encryptionAlgorithm = { // aes256
    name: 'AES-GCM',
    length: 256,
    iv: null
};
const keyPairAlgorithm = {
    name: 'ECDH', //'ECDSA',
    namedCurve: 'P-256'
};
const keyPairExtractable = true;

function generateRandomSalt() {
    const salt = crypto.getRandomValues(new Uint8Array(saltLen));
    return salt;
}

function getKeyMaterial(password) {
    // developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/importKey
    let enc = new TextEncoder();
    return crypto.subtle.importKey(
        'raw', // format
        enc.encode(password), // keyData

        // password-based key derivation function 2
        'PBKDF2', // algorithm

        false, // extractable
        ['deriveBits', 'deriveKey'] // keyUsages
    );
}
async function stretchKey(plaintext, saltUint8Array) {
    // developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveKey#pbkdf2_2
    let keyMaterial = await getKeyMaterial(plaintext);
    let key = await crypto.subtle.deriveKey(
        { // algorithm
            name: 'PBKDF2',
            salt: saltUint8Array,
            iterations: keyDerivationIterations,
            hash: keyDerivationHash
        },
        keyMaterial, // baseKey
        encryptionAlgorithm, // derivedKeyAlgorithm
        true, // extractable
        ['encrypt', 'decrypt'] // keyUsages
    );
    return key;
}

async function exportCryptoKey(key) {
    // works the same for both public and private keys
    // developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/exportKey
    const format = 'jwk'; // seems like only jwk works. raw and pkcs8 fail
    // github.com/PeculiarVentures/node-webcrypto-ossl/issues/89
    const exportedKey = await crypto.subtle.exportKey(format, key);
    return exportedKey;
}

async function importPrivKey(exportedKey) {
    const keyUsages = ['deriveKey'];//['sign'];
    return await importKey(exportedKey, keyUsages);
}

async function importPubKey(exportedKey) {
    const keyUsages = [];//['verify'];
    return await importKey(exportedKey, keyUsages);
}

async function importKey(exportedKey, keyUsages) {
    const key = await crypto.subtle.importKey(
        'jwk', exportedKey, keyPairAlgorithm, keyPairExtractable, keyUsages
    );
    return key;
}

function privKey2PubKey(exportedPrivKey) {
    // the public key is the same as the private key except for some elements
    return {
        crv: exportedPrivKey.crv,
        ext: exportedPrivKey.ext,
        key_ops: ['deriveKey'],//['verify'], // for private key this is ['sign']
        kty: exportedPrivKey.kty,
        x: exportedPrivKey.x,
        y: exportedPrivKey.y
    };
}

async function newKeyPair() {
    const keyPairUsages = ['deriveKey']; //['sign', 'verify'];
    const keyPair = await crypto.subtle.generateKey(
        keyPairAlgorithm, keyPairExtractable, keyPairUsages
    );
    return keyPair;
}

async function encrypt(key, message) {
    encryptionAlgorithm.iv = crypto.getRandomValues(new Uint8Array(12));
    let enc = new TextEncoder();
    const encodedMessage = enc.encode(message);
    let ciphertext = await crypto.subtle.encrypt(
        encryptionAlgorithm, key, encodedMessage
    );
    ciphertext = new Uint8Array(ciphertext); // use the 8bit version
    // stick iv on the front since we need it later
    return mergeUint8Arrays(encryptionAlgorithm.iv, ciphertext);
}

function mergeUint8Arrays() {
    let finalLength = 0; // init
    let thisUint8Array = null; // init
    for (var i = 0; i < arguments.length; i++) {
        thisUint8Array = arguments[i];
        finalLength += thisUint8Array.length;
    }
    let mergedUint8Array = new Uint8Array(finalLength);
    let previousUint8ArrayLength = 0;
    for (var i = 0; i < arguments.length; i++) {
        thisUint8Array = arguments[i];
        if (i == 0) mergedUint8Array.set(thisUint8Array);
        else mergedUint8Array.set(thisUint8Array, previousUint8ArrayLength);
        previousUint8ArrayLength = thisUint8Array.length;
    }
    return mergedUint8Array;
}

async function decrypt(key, ciphertext) {
    // extract iv from the start of the ciphertext
    encryptionAlgorithm.iv = ciphertext.slice(0, 12);
    ciphertext = ciphertext.slice(12);
    const encodedMessage = await crypto.subtle.decrypt(
        encryptionAlgorithm, key, ciphertext
    );
    let dec = new TextDecoder();
    const message = dec.decode(new Uint8Array(encodedMessage));
    return message;
}

async function generateSharedSecretKey(myPrivKey, theirPubKey) {
    // derive an AES key, given
    // - our ECDH private key
    // - their ECDH public key
    return await crypto.subtle.deriveKey(
        { // algorithm
            name: 'ECDH',
            public: theirPubKey
        },
        myPrivKey, // basekey
        { // derived key algorithm
            name: 'AES-GCM',
            length: 256
        },
        true, // extractable
        ['encrypt', 'decrypt'] // usages
    );
}
