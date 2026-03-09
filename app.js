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
// Add deleteDoc to your import list
import {
    getFirestore, collection, addDoc, serverTimestamp, query, where,
    onSnapshot, doc, setDoc, updateDoc, deleteDoc, getDocs, orderBy
}
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
        snapshot.forEach((goalSnapshot) => {
            const goalData = goalSnapshot.data();
            const goalId = goalSnapshot.id;

            // NEW: Create the button as a real JavaScript element so we can listen for clicks
            // 1. Get today's date right away so we can use it for the UI and the database
            const today = new Date().toISOString().split('T')[0];

            // 2. THE STREAK BREAKER LOGIC
            // Check if they have a last check-in date, AND it's not today
            if (goalData.lastCheckInDate && goalData.lastCheckInDate !== today) {
                // Convert the string dates into real JavaScript Date objects to do math
                const todayDate = new Date(today);
                const lastCheckInDate = new Date(goalData.lastCheckInDate);

                // Calculate the difference in milliseconds, then convert to days
                const diffTime = todayDate - lastCheckInDate;
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

                // If they missed more than 1 day, AND their streak is greater than 0
                if (diffDays > 1 && goalData.currentStreak > 0) {
                    console.log(`Streak broken for goal: ${goalData.title}`);

                    // Reset the streak to 0 in the database
                    const goalRef = doc(db, "goals", goalId);
                    updateDoc(goalRef, {
                        currentStreak: 0
                    });

                    // We use 'return' here to stop drawing this specific card. 
                    // Why? Because updateDoc will instantly trigger onSnapshot again 
                    // with the new streak=0 data, and it will draw the correct card automatically!
                    return;
                }
            }

            const goalCard = document.createElement('div');
            goalCard.style.border = "1px solid #ccc";
            goalCard.style.borderRadius = "8px";
            goalCard.style.padding = "15px";
            goalCard.style.marginBottom = "15px";
            goalCard.style.backgroundColor = "#fff";

            let subtasksHTML = '';
            goalData.subtasks.forEach((task, index) => {
                subtasksHTML += `
                    <div style="margin-bottom: 5px;">
                        <input type="checkbox" id="${goalId}-task-${index}">
                        <label for="${goalId}-task-${index}">${task}</label>
                    </div>
                `;
            });

            // We are adding a Flexbox layout to the card title area so the delete button sits on the right
            goalCard.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <h4 style="margin-top: 0;">${goalData.title} (Streak: ${goalData.currentStreak} 🔥)</h4>
                    <button id="delete-${goalId}" style="background-color: #ff4c4c; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">Delete</button>
                </div>
                ${subtasksHTML}
            `;

            // --- ADD THIS NEW DELETE LOGIC ---
            const deleteBtn = goalCard.querySelector(`#delete-${goalId}`);
            deleteBtn.addEventListener('click', async () => {
                // Always ask for confirmation before deleting data!
                const confirmDelete = confirm(`Are you sure you want to delete the goal: "${goalData.title}"?`);

                if (confirmDelete) {
                    try {
                        // Point to the specific goal document and delete it
                        const goalRef = doc(db, "goals", goalId);
                        await deleteDoc(goalRef);

                        // Note: Because we are using onSnapshot, we don't need to manually 
                        // remove the HTML card. Firestore will notice it's gone and redraw the list!
                    } catch (error) {
                        console.error("Error deleting goal:", error);
                        alert("Failed to delete the goal.");
                    }
                }
            });
            // ---------------------------------

            // 2. Create the button
            const checkInBtn = document.createElement('button');
            checkInBtn.style.marginTop = "10px";

            // 3. THE LOCK: Check if they already checked in today!
            if (goalData.lastCheckInDate === today) {
                // They already did it! Lock the button.
                checkInBtn.textContent = 'Done for today! ✅';
                checkInBtn.disabled = true;
                checkInBtn.style.cursor = "not-allowed";
                checkInBtn.style.backgroundColor = "#d3d3d3";
                checkInBtn.style.border = "none";
                checkInBtn.style.padding = "8px 12px";

                // Optional: You can also visually disable the checkboxes here if you want
            } else {
                // They haven't checked in yet. Keep the button active.
                checkInBtn.textContent = 'Complete Daily Check-in';
                checkInBtn.style.cursor = "pointer";

                // The click event (Only active if they haven't checked in)
                checkInBtn.addEventListener('click', async () => {
                    const completedTasks = [];
                    goalData.subtasks.forEach((task, index) => {
                        const checkbox = document.getElementById(`${goalId}-task-${index}`);
                        if (checkbox && checkbox.checked) {
                            completedTasks.push(task);
                        }
                    });

                    // Define the path for the Daily Log
                    const dailyLogRef = doc(db, "goals", goalId, "daily_logs", today);

                    try {
                        // Save today's log to the sub-collection
                        await setDoc(dailyLogRef, {
                            date: today,
                            completed: completedTasks,
                            totalTasks: goalData.subtasks.length,
                            timestamp: serverTimestamp()
                        });

                        // UPDATE THE MAIN GOAL: Increase streak AND save today's date to lock the button!
                        const goalRef = doc(db, "goals", goalId);
                        await updateDoc(goalRef, {
                            currentStreak: goalData.currentStreak + 1,
                            lastCheckInDate: today // <--- THIS IS THE MAGIC LOCK
                        });

                        alert("Check-in successful! See you tomorrow. 🔥");

                    } catch (error) {
                        console.error("Error saving check-in:", error);
                        alert("Failed to check in.");
                    }
                });
            }

            // Add the button to the bottom of the card
            goalCard.appendChild(checkInBtn);

            // --- START HISTORY FEATURE ---

            // 1. Create the History Button
            const historyBtn = document.createElement('button');
            historyBtn.textContent = "📊 View History";
            historyBtn.style.marginTop = "10px";
            historyBtn.style.marginLeft = "10px";
            historyBtn.style.cursor = "pointer";

            // 2. Create a hidden box to hold the history list
            const historyContainer = document.createElement('div');
            historyContainer.style.display = "none"; // Hidden by default
            historyContainer.style.marginTop = "15px";
            historyContainer.style.padding = "10px";
            historyContainer.style.backgroundColor = "#f0f8ff"; // Light blue background
            historyContainer.style.borderRadius = "5px";

            // 3. Make the button toggle the history box
            historyBtn.addEventListener('click', async () => {
                // If the box is hidden, open it and fetch data
                if (historyContainer.style.display === "none") {
                    historyContainer.style.display = "block";
                    historyContainer.innerHTML = "<em>Loading your history...</em>";

                    try {
                        // Create a query to get the daily_logs, sorted by newest date first
                        const logsRef = collection(db, "goals", goalId, "daily_logs");
                        const qLogs = query(logsRef, orderBy("date", "desc"));

                        // Fetch the documents ONCE (no real-time listener needed here)
                        const logsSnapshot = await getDocs(qLogs);

                        if (logsSnapshot.empty) {
                            historyContainer.innerHTML = "<em>No check-ins yet. Complete one today!</em>";
                            return;
                        }

                        // Build an HTML list of past check-ins
                        let historyHTML = "<h5 style='margin-top:0; margin-bottom:5px;'>Past Check-ins:</h5><ul style='margin:0; padding-left: 20px; font-size: 14px;'>";

                        logsSnapshot.forEach((logDoc) => {
                            const logData = logDoc.data();
                            // Example output: "2026-03-08: 2/3 tasks completed"
                            historyHTML += `<li><strong>${logData.date}</strong>: ${logData.completed.length}/${logData.totalTasks} tasks completed</li>`;
                        });

                        historyHTML += "</ul>";

                        // Put the finished list onto the screen
                        historyContainer.innerHTML = historyHTML;

                    } catch (error) {
                        console.error("Error fetching history:", error);
                        historyContainer.innerHTML = "<em>Error loading history.</em>";
                    }
                } else {
                    // If the box is already open, click it again to hide it
                    historyContainer.style.display = "none";
                }
            });

            // 4. Add the button and the hidden container to the goal card
            goalCard.appendChild(historyBtn);
            goalCard.appendChild(historyContainer);

            // --- END HISTORY FEATURE ---

            // Add the fully built card to the screen
            goalsList.appendChild(goalCard);
        });
    });
}