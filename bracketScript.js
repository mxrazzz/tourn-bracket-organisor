import { db } from "./firebaseCNFG.js";
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  getDocs,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

let currentMatchFiles = []; // Temporary storage for files

//  fills the bracket with team names
async function populateBracket(tournamentName) {
  const tournamentRef = doc(db, "tournament", tournamentName);
  const teamsCollectionRef = collection(tournamentRef, "teams");

  try {
    for (let i = 1; i <= 16; i++) {
      const teamDocRef = doc(teamsCollectionRef, `team${i}`);
      const teamSnapshot = await getDoc(teamDocRef);

      if (teamSnapshot.exists()) {
        const teamData = teamSnapshot.data();
        if (teamData && teamData.name) {
          const matchIndex = Math.ceil(i / 2);
          const teamPosition = i % 2 === 0 ? "team2" : "team1";
          const matchElement = document.getElementById(
            `match${matchIndex}-${teamPosition}`
          );
          if (matchElement) {
            matchElement.textContent = teamData.name; // puts the team name in the bracket
          }
        }
      }
    }
  } catch (error) {
    console.error("Error fetching teams:", error);
  }
  updateMatchLockingStatus();
  attachEventListenersToMatches();
}

document.addEventListener("DOMContentLoaded", async function () {
  // Close modal event listener
  document.querySelector(".close").addEventListener("click", closeSettings);

  // Populate the bracket and update match locking status
  const tournamentName = localStorage.getItem("currentTournament");
  if (tournamentName) {
    document.getElementById("tournament-name").textContent = tournamentName;
    await populateBracket(tournamentName);
    updateMatchLockingStatus();
    attachEventListenersToMatches(); // call after populating the bracket
  }
});
document
  .getElementById("matchForm")
  .addEventListener("submit", async function (event) {
    event.preventDefault();

    const winnerInput = document.querySelector('input[name="winner"]:checked');
    if (!winnerInput) {
      alert("Please select a winner.");
      return; // stops form submission if winner is not selected
    }

    const matchId = this.dataset.matchId;
    const winner = winnerInput.value;
    const score = document.getElementById("score").value;
    const comment = document.getElementById("comment").value;
    const imageFiles = Array.from(document.getElementById("imageUpload").files);

    try {
      let imageUrls = [];
      if (imageFiles.length > 0) {
        imageUrls = await uploadImagesToFirebaseStorage(imageFiles);
      }

      const tournamentName = localStorage.getItem("currentTournament");
      await saveMatchDetailsToFirestore(tournamentName, matchId, {
        winner,
        score,
        comment,
        imageUrls,
      });
      updateEliminatedTeamStyle(matchId, winner);

      // Update the next round's match box with the winner
      const nextRoundBoxId = nextRoundMapping[matchId];
      if (nextRoundBoxId) {
        const nextRoundBox = document.getElementById(nextRoundBoxId);
        if (nextRoundBox) {
          nextRoundBox.textContent = winner;
        }
      }

      console.log("Match details saved successfully");

      // Update match locking status and reattach event listeners
      updateMatchLockingStatus();
      attachEventListenersToMatches();
    } catch (error) {
      console.error("Error saving match details:", error);
    }
    if (matchId === "finalMatch") {
      showWinnerModal(winner);
    }

    closeSettings();
  });

function updateEliminatedTeamStyle(matchId, winner) {
  const matchDiv = document.getElementById(matchId);
  const teams = matchDiv.querySelectorAll(".team");
  teams.forEach((teamDiv) => {
    if (teamDiv.textContent.trim() !== winner) {
      teamDiv.classList.add("eliminated"); // Highlight the team that didn't win
    } else {
      teamDiv.classList.remove("eliminated"); // Ensure the winning team is not highlighted
    }
  });
}

async function openSettings(matchId) {
  const modal = document.getElementById("settingsModal");
  const form = document.getElementById("matchForm");
  const teamChoicesDiv = document.getElementById("teamChoices");
  const scoreInput = document.getElementById("score");
  const commentInput = document.getElementById("comment");
  const imageUploadInput = document.getElementById("imageUpload");

  // Reset form fields
  teamChoicesDiv.innerHTML = "";
  scoreInput.value = "";
  commentInput.value = "";
  imageUploadInput.value = "";
  currentMatchFiles = [];

  // Determine if it's a Quarterfinal, Semifinal, or Final match
  if (
    matchId.startsWith("quarter") ||
    matchId.startsWith("semi") ||
    matchId === "finalMatch"
  ) {
    const previousWinners = await fetchPreviousRoundWinners(matchId);
    console.log("Previous Winners for " + matchId + ": ", previousWinners); // Debug log
    previousWinners.forEach((team) => {
      const checkboxHtml = `<label><input type="radio" name="winner" value="${team}">${team}</label><br>`;
      teamChoicesDiv.innerHTML += checkboxHtml;
    });
  } else {
    // For Round 1 matches, use existing logic
    const matchNumber = parseInt(matchId.replace("match", ""));
    const teamIds = [`team${matchNumber * 2 - 1}`, `team${matchNumber * 2}`];

    const teams = await Promise.all(teamIds.map((id) => fetchTeamName(id)));
    teams.forEach((team) => {
      if (team) {
        const checkboxHtml = `<label><input type="radio" name="winner" value="${team}">${team}</label><br>`;
        teamChoicesDiv.innerHTML += checkboxHtml;
      }
    });
  }

  modal.style.display = "block";
  form.dataset.matchId = matchId;
}

function closeSettings() {
  document.getElementById("settingsModal").style.display = "none";
  const scoreInput = document.getElementById("score");
  const commentInput = document.getElementById("comment");
  const imageUploadInput = document.getElementById("imageUpload");
  const winnerInput = document.querySelector('input[name="winner"]:checked');

  // Reset form fields
  if (winnerInput) winnerInput.checked = false;
  scoreInput.value = "";
  commentInput.value = "";
  imageUploadInput.value = "";
  currentMatchFiles = [];

  document.getElementById("selectedImages").innerHTML = "";
}

//All functions for images (unable to make it work)
document.getElementById("imageUpload").addEventListener("change", function () {
  Array.from(this.files).forEach((file) => {
    currentMatchFiles.push(file);
    displaySelectedFiles();
  });

  this.value = "";
});

function displaySelectedFiles() {
  const selectedImagesDiv = document.getElementById("selectedImages");
  selectedImagesDiv.innerHTML = ""; // clears current list

  currentMatchFiles.forEach((file, index) => {
    const imageContainer = document.createElement("div");
    imageContainer.className = "image-container";
    imageContainer.innerHTML = `
      <span>${file.name}</span>
      <button type="button" onclick="removeImage(${index})">X</button>
    `;
    selectedImagesDiv.appendChild(imageContainer);
  });
}

window.removeImage = function (index) {
  currentMatchFiles.splice(index, 1); // Remove the file from the array
  displaySelectedFiles(); // Update the displayed files
};

document.getElementById("imageUpload").addEventListener("change", function (e) {
  const files = Array.from(e.target.files);
  const validFiles = files.filter(validateFileType);

  if (validFiles.length > 0) {
    // Proceed with uploading
    uploadImagesToFirebaseStorage(validFiles).then((urls) => {
      // Handle the URLs here
      console.log(urls);
    });
  }
});

// Helper function to upload a single file to Firebase Storage and return the URL
async function uploadImage(file, storageRef) {
  const uploadTask = storageRef.child(`images/${file.name}`).put(file);
  await uploadTask;
  return uploadTask.snapshot.ref.getDownloadURL();
}

async function uploadImagesToFirebaseStorage(files) {
  // Get a reference to the storage service
  const storage = getStorage();

  // Create an array to hold all the upload promises
  let uploadPromises = [];

  // Iterate over each file and upload it
  files.forEach((file) => {
    const storageRef = ref(storage);
    const uploadPromise = uploadImage(file, storageRef);
    uploadPromises.push(uploadPromise);
  });

  //
  const imageUrls = await Promise.all(uploadPromises);
  return imageUrls;
}

//fetching teams from db

async function fetchTeamName(teamId) {
  const tournamentName = localStorage.getItem("currentTournament");
  const tournamentRef = doc(db, "tournament", tournamentName);
  const teamDocRef = doc(collection(tournamentRef, "teams"), teamId);
  const teamSnapshot = await getDoc(teamDocRef);

  if (teamSnapshot.exists()) {
    return teamSnapshot.data().name;
  } else {
    console.error("Team not found:", teamId);
    return null;
  }
}

const nextRoundMapping = {
  // Round 1 to Quarterfinals
  match1: "quarter1-team1",
  match2: "quarter1-team2",
  match3: "quarter2-team1",
  match4: "quarter2-team2",
  match5: "quarter3-team1",
  match6: "quarter3-team2",
  match7: "quarter4-team1",
  match8: "quarter4-team2",

  // Quarterfinals to Semifinals
  quarter1: "semi1-team1",
  quarter2: "semi1-team2",
  quarter3: "semi2-team1",
  quarter4: "semi2-team2",

  // Semifinals to Final
  semi1: "finalMatch-team1",
  semi2: "finalMatch-team2",
};

async function fetchPreviousRoundWinners(matchId) {
  // Define the mapping from current match to its immediate previous matches
  const immediatePreviousMatchesMapping = {
    quarter1: ["match1", "match2"],
    quarter2: ["match3", "match4"],
    quarter3: ["match5", "match6"],
    quarter4: ["match7", "match8"],
    semi1: ["quarter1", "quarter2"],
    semi2: ["quarter3", "quarter4"],
    finalMatch: ["semi1", "semi2"],
  };

  let previousMatchIds = immediatePreviousMatchesMapping[matchId] || [];

  // fetching winners from  previous matches
  const winners = [];
  for (const id of previousMatchIds) {
    const matchRef = doc(
      db,
      "tournament",
      localStorage.getItem("currentTournament"),
      "matches",
      id
    );
    const matchSnapshot = await getDoc(matchRef);

    if (matchSnapshot.exists()) {
      const matchData = matchSnapshot.data();
      winners.push(matchData.winner); // Assuming 'winner' field holds the winner's name
    } else {
      console.error("Previous match not found:", id);
    }
  }

  return winners.filter((winner) => winner != null); // Filter out any null entries
}

async function saveMatchDetailsToFirestore(tournamentName, matchId, matchData) {
  // Adjust the path to point inside the tournament collection, then to the specific tournament, and finally to the match
  const tournamentRef = doc(db, "tournament", tournamentName);
  const matchDocRef = doc(collection(tournamentRef, "matches"), matchId);
  await setDoc(matchDocRef, matchData);
}

//Functions to make matches unclickable until teams are populated
function updateMatchLockingStatus() {
  // Round 1 always unlocked
  unlockMatches("#round1 .match");

  // Unlock individual quarterfinal matches if both teams are present
  unlockIndividualMatches("#quarterfinals .match");

  // If all quarterfinal matches are populated, unlock semifinals
  if (allMatchesPopulated("#quarterfinals .match")) {
    unlockIndividualMatches("#semifinals .match");

    // If all semifinal matches are populated, unlock final
    if (allMatchesPopulated("#semifinals .match")) {
      unlockIndividualMatches("#final .match");
    } else {
      lockMatches("#final .match");
    }
  } else {
    lockMatches("#semifinals .match", "#final .match");
  }
}

function unlockIndividualMatches(selector) {
  document.querySelectorAll(selector).forEach((matchDiv) => {
    const teams = matchDiv.querySelectorAll(".team");
    const bothTeamsPresent =
      teams[0].textContent.trim() !== "" && teams[1].textContent.trim() !== "";

    if (bothTeamsPresent) {
      matchDiv.classList.remove("locked");
    } else {
      matchDiv.classList.add("locked");
    }
  });
}

function lockMatches(...selectors) {
  selectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((matchDiv) => {
      matchDiv.classList.add("locked");
    });
  });
}

function allMatchesPopulated(selector) {
  return [...document.querySelectorAll(selector)].every((matchDiv) => {
    const teams = matchDiv.querySelectorAll(".team");
    return (
      teams[0].textContent.trim() !== "" && teams[1].textContent.trim() !== ""
    );
  });
}

function unlockMatches(selector) {
  document.querySelectorAll(selector).forEach((matchDiv) => {
    matchDiv.classList.remove("locked");
  });
}

function attachEventListenersToMatches() {
  document.querySelectorAll(".match").forEach((matchDiv) => {
    matchDiv.removeEventListener("click", matchClickHandler); // Remove existing listener
    if (!matchDiv.classList.contains("locked")) {
      matchDiv.addEventListener("click", matchClickHandler); // Add listener if not locked
    }
  });
}

function matchClickHandler() {
  openSettings(this.id);
}

// tourn info popup

document
  .getElementById("show-tournament-info")
  .addEventListener("click", function () {
    const tournamentName = localStorage.getItem("currentTournament");
    if (tournamentName) {
      fetchTournamentDetails(tournamentName)
        .then((tournamentDetails) => {
          displayTournamentInfo(tournamentDetails);
          showModal();
        })
        .catch((error) => {
          console.error("Error fetching tournament details:", error);
        });
    } else {
      console.error("No tournament selected");
    }
  });

async function fetchTournamentDetails(tournamentName) {
  const tournamentDocRef = doc(db, "tournament", tournamentName);
  const tournamentSnapshot = await getDoc(tournamentDocRef);

  if (tournamentSnapshot.exists()) {
    return tournamentSnapshot.data().tournamentInfo;
  } else {
    throw new Error("Tournament details not found.");
  }
}

function displayTournamentInfo(tournamentDetails) {
  var detailsDiv = document.getElementById("detailedTournamentInfo");
  detailsDiv.innerHTML = `Tournament Name: ${tournamentDetails.tournamentName}<br>
                          Start Date: ${tournamentDetails.startDate}<br>
                          End Date: ${tournamentDetails.endDate}<br>
                          Type: ${tournamentDetails.tournamentType}<br>
                          Team Size: ${tournamentDetails.teamSize}`;
}

function showModal() {
  var modal = document.getElementById("tournamentDetailsModal");
  modal.style.display = "block";
}

function hideModal() {
  var modal = document.getElementById("tournamentDetailsModal");
  modal.style.display = "none";
}

// Closes on clicking X
document
  .querySelector(".tournament-close")
  .addEventListener("click", hideModal);

window.onclick = function (event) {
  var modal = document.getElementById("tournamentDetailsModal");
  if (event.target === modal) {
    hideModal();
  }
};

function showWinnerModal(winner) {
  document.getElementById(
    "winnerMessage"
  ).innerText = `Congratulations to ${winner} for winning the tournament!`;
  document.getElementById("winnerModal").style.display = "block";
}

// Close the winner modal and redirect to setup.html
document.getElementById("newTournament").addEventListener("click", function () {
  window.location.href = "setup.html";
});

// Close the winner modal
document.getElementById("closeModal").addEventListener("click", function () {
  document.getElementById("winnerModal").style.display = "none";
});

// Also closes if X is clicked
document
  .getElementById("closeWinnerModal")
  .addEventListener("click", function () {
    document.getElementById("winnerModal").style.display = "none";
  });
