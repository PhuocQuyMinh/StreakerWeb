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

const streakSummaryList = document.getElementById('streak-summary-list');
const dailyProgressText = document.getElementById('daily-progress');

// Add these with your other variables at the top
const historyModal = document.getElementById('history-modal');
const closeModal = document.getElementById('close-modal');
const modalTitle = document.getElementById('modal-title');
const modalContent = document.getElementById('modal-content');

// Logic to close the modal when the "X" is clicked
closeModal.addEventListener('click', () => {
    historyModal.style.display = "none";
});

// Logic to close the modal if they click outside the white box
window.addEventListener('click', (event) => {
    if (event.target === historyModal) {
        historyModal.style.display = "none";
    }
});

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
        streakSummaryList.innerHTML = '';
        dailyProgressText.textContent = '';

        // If they have no goals yet
        if (snapshot.empty) {
            goalsList.innerHTML = '<p>You have no goals yet. Create one above!</p>';
            streakSummaryList.innerHTML = '<li>No active streaks yet.</li>';
            dailyProgressText.textContent = 'Daily Progress: 0 / 0';
            return;
        }

        // NEW: Set up our counters
        const totalGoals = snapshot.size; // Firebase tells us exactly how many goals there are!
        let completedTodayCount = 0;

        // 3. Loop through every goal the database found
        snapshot.forEach((goalSnapshot) => {
            const goalData = goalSnapshot.data();
            const goalId = goalSnapshot.id;

            // NEW: Create the button as a real JavaScript element so we can listen for clicks
            // 1. Get today's date right away so we can use it for the UI and the database
            const today = new Date().toISOString().split('T')[0];

            // NEW: If they already checked in today, increase our counter!
            if (goalData.lastCheckInDate === today) {
                completedTodayCount++;
            }

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

            // 1. UPDATED: Create the summary item and make it a clickable link
            const summaryItem = document.createElement('li');
            summaryItem.style.marginBottom = "8px";
            summaryItem.innerHTML = `<span style="cursor: pointer; color: #0056b3; text-decoration: underline;"><strong>${goalData.title}</strong></span>: ${goalData.currentStreak}`;

            // 2. NEW: When they click this specific summary item, open the popup!
            summaryItem.addEventListener('click', async () => {
                // Show the modal and set the title
                historyModal.style.display = "block";
                modalTitle.textContent = `History: ${goalData.title}`;
                modalContent.innerHTML = "<em>Loading your history...</em>";

                try {
                    // Fetch the history from Firestore (Same logic as before!)
                    const logsRef = collection(db, "goals", goalId, "daily_logs");
                    const qLogs = query(logsRef, orderBy("date", "desc"));
                    const logsSnapshot = await getDocs(qLogs);

                    if (logsSnapshot.empty) {
                        modalContent.innerHTML = "<p><em>No check-ins yet. Complete one today!</em></p>";
                        return;
                    }

                    // Build the list
                    let historyHTML = "<ul style='margin:0; padding-left: 20px; font-size: 16px; line-height: 1.6;'>";
                    logsSnapshot.forEach((logDoc) => {
                        const logData = logDoc.data();
                        historyHTML += `<li><strong>${logData.date}</strong>: ${logData.completed.length}/${logData.totalTasks} tasks completed</li>`;
                    });
                    historyHTML += "</ul>";

                    // Inject it into the popup
                    modalContent.innerHTML = historyHTML;

                } catch (error) {
                    console.error("Error fetching history:", error);
                    modalContent.innerHTML = "<em>Error loading history.</em>";
                }
            });

            // Add it to the top dashboard
            streakSummaryList.appendChild(summaryItem);

            if (goalData.lastCheckInDate !== today) {
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
                    <h4 style="margin-top: 0;">${goalData.title}</h4>
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
                goalCard.appendChild(checkInBtn);
                // Add the fully built card to the screen
                goalsList.appendChild(goalCard);
            }
        });

        // NEW: Print the final fraction to the screen!
        dailyProgressText.textContent = `Daily Progress: ${completedTodayCount} / ${totalGoals} goals completed`;

        // --- NEW: CHECK IF ALL CAUGHT UP ---
        // Put this RIGHT AFTER the loop finishes
        if (goalsList.innerHTML === '') {
            goalsList.innerHTML = `
                <div style="text-align: center; padding: 30px; background-color: #e8f5e9; border-radius: 8px; color: #2e7d32;">
                    <h3>🎉 All caught up!</h3>
                    <p>You have completed all your active goals for today. Great job!</p>
                </div>
            `;
        }
    });
}