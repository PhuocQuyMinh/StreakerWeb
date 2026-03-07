// 1. Import core Firebase and Authentication functions
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// Update your import line to look exactly like this:
import { getFirestore, collection, addDoc, serverTimestamp, query, where, onSnapshot, doc, setDoc, updateDoc }
    from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";


// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyA4gn3yVUMcv4kpEu5-l7jMorMBY0ivztc",
    authDomain: "streaker-789fd.firebaseapp.com",
    projectId: "streaker-789fd",
    storageBucket: "streaker-789fd.firebasestorage.app",
    messagingSenderId: "322485438285",
    appId: "1:322485438285:web:7459d8bf455f9590551904",
    measurementId: "G-EF801SV1NX"
};
// 3. Initialize Firebase and Auth
const app = initializeApp(firebaseConfig);
const auth = getAuth(app); // Call the auth tool so we can use it
const db = getFirestore(app); // ADD THIS: Initialize the database
let currentUser = null; // ADD THIS: We will store the logged-in user here

// 4. Get HTML elements to interact with
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('login-btn');
const registerBtn = document.getElementById('register-btn');
const logoutBtn = document.getElementById('logout-btn');

const authSection = document.getElementById('auth-section');
const appSection = document.getElementById('app-section');
const userEmailSpan = document.getElementById('user-email');

// 5. Register Function
registerBtn.addEventListener('click', () => {
    const email = emailInput.value;
    const password = passwordInput.value;

    // Call Firebase's create user function
    createUserWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            alert("Registration successful!");
        })
        .catch((error) => {
            alert("Registration error: " + error.message);
        });
});

// 6. Login Function
loginBtn.addEventListener('click', () => {
    const email = emailInput.value;
    const password = passwordInput.value;

    // Call Firebase's sign in function
    signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            alert("Login successful!");
        })
        .catch((error) => {
            alert("Login error: " + error.message);
        });
});

// 7. Logout Function
logoutBtn.addEventListener('click', () => {
    signOut(auth).then(() => {
        alert("You have been logged out!");
    });
});

// 8. Monitor User State (This is the most important part!)
// This runs automatically when the page loads, or when you login/logout
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user; // SAVE THE USER HERE
        // User is logged in -> Hide login form, show main app
        authSection.style.display = 'none';
        appSection.style.display = 'block';
        userEmailSpan.textContent = user.email; // Show email on screen

        // START DOWNLOADING GOALS FOR THIS USER
        listenToUserGoals(user.uid);
    } else {
        currentUser = null; // CLEAR THE USER HERE
        // User is logged out -> Show login form, hide main app
        authSection.style.display = 'block';
        appSection.style.display = 'none';
        emailInput.value = '';
        passwordInput.value = '';

        // STOP DOWNLOADING GOALS (So the next person who logs in doesn't see them)
        if (unsubscribeGoals) {
            unsubscribeGoals();
        }
    }
});

// Get the HTML elements for the new form
const goalTitleInput = document.getElementById('goal-title');
const goalSubtasksInput = document.getElementById('goal-subtasks');
const saveGoalBtn = document.getElementById('save-goal-btn');

// Function to save the goal
saveGoalBtn.addEventListener('click', async () => {
    // 1. Make sure the user is logged in and typed something
    if (!currentUser) return alert("You must be logged in!");
    if (goalTitleInput.value.trim() === '') return alert("Please enter a goal title!");

    // 2. Convert the comma-separated sub-tasks into a proper JavaScript Array
    // Example: "Read, Drink Water" becomes ["Read", "Drink Water"]
    const subtasksArray = goalSubtasksInput.value.split(',').map(task => task.trim()).filter(task => task !== '');

    // 3. Save to Firestore
    try {
        // We are adding a new document to the "goals" collection
        await addDoc(collection(db, "goals"), {
            userId: currentUser.uid, // Crucial: Tie this goal to this specific user!
            title: goalTitleInput.value,
            subtasks: subtasksArray,
            currentStreak: 0,
            createdAt: serverTimestamp() // Saves the exact time it was created
        });

        alert("Goal saved successfully!");

        // Clear the form inputs
        goalTitleInput.value = '';
        goalSubtasksInput.value = '';

    } catch (error) {
        console.error("Error adding document: ", error);
        alert("Failed to save goal.");
    }
});

// Get the HTML element where we will put the goals
const goalsList = document.getElementById('goals-list');

// We use this variable to stop listening to the database when the user logs out
let unsubscribeGoals = null;

// Function to fetch and display goals in real-time
function listenToUserGoals(uid) {
    // 1. Create a query: "Look in the 'goals' collection WHERE the userId matches this user"
    const q = query(collection(db, "goals"), where("userId", "==", uid));

    // 2. Listen to that query in real-time
    unsubscribeGoals = onSnapshot(q, (snapshot) => {
        // Clear out the old list on the screen so we don't get duplicates
        goalsList.innerHTML = '';

        // If they have no goals yet
        if (snapshot.empty) {
            goalsList.innerHTML = '<p>You have no goals yet. Create one above!</p>';
            return;
        }

        // 3. Loop through every goal the database found
        snapshot.forEach((doc) => {
            const goalData = doc.data();
            const goalId = doc.id; // The unique ID of this specific document

            // 4. Create a visual "card" for this goal
            const goalCard = document.createElement('div');
            goalCard.style.border = "1px solid #ccc";
            goalCard.style.borderRadius = "8px";
            goalCard.style.padding = "15px";
            goalCard.style.marginBottom = "15px";
            goalCard.style.backgroundColor = "#fff";

            // 5. Convert the subtasks array into HTML list items
            // We are adding checkboxes here so we can use them in the next step!
            let subtasksHTML = '';
            goalData.subtasks.forEach((task, index) => {
                subtasksHTML += `
                    <div style="margin-bottom: 5px;">
                        <input type="checkbox" id="${goalId}-task-${index}">
                        <label for="${goalId}-task-${index}">${task}</label>
                    </div>
                `;
            });

            // 6. Put all the HTML together inside the card
            goalCard.innerHTML = `
                <h4 style="margin-top: 0;">${goalData.title} (Streak: ${goalData.currentStreak} 🔥)</h4>
                ${subtasksHTML}
                <button style="margin-top: 10px; cursor: pointer;">Complete Daily Check-in</button>
            `;

            // 7. Add the card to the screen
            goalsList.appendChild(goalCard);
        });
    });
}