// Option Page
import { db } from "./firebaseCNFG.js";

import {
  getFirestore,
  collection,
  getDocs,
  doc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", function () {
  // Set the default team size to 1
  const teamSizeSelector = document.getElementById("team-size");
  teamSizeSelector.value = "1";

  document.getElementById("single-day").addEventListener("change", function () {
    const endDateInput = document.getElementById("end-date");
    endDateInput.disabled = this.checked;
    if (this.checked) {
      endDateInput.value = ""; // Reset end date
    }
  });

  teamSizeSelector.addEventListener("change", function () {
    updateTeamMemberInputs(this.value);
  });

  document
    .getElementById("randomize")
    .addEventListener("click", randomizeTeams);
  document
    .getElementById("start-tournament")
    .addEventListener("click", startTournament);

  // Initialize teams with the default team size
  generateTeamNames();
  updateTeamMemberInputs(teamSizeSelector.value);
});

function generateTeamNames() {
  const container = document.getElementById("team-names-section");
  container.innerHTML = "";
  for (let i = 1; i <= 16; i++) {
    const teamDiv = document.createElement("div");
    teamDiv.classList.add("team-row");

    const teamNameInput = document.createElement("input");
    teamNameInput.type = "text";
    teamNameInput.placeholder = `Team ${i} Name`;
    teamDiv.appendChild(teamNameInput);

    for (let j = 1; j <= 5; j++) {
      const memberInput = document.createElement("input");
      memberInput.type = "text";
      memberInput.placeholder = `Member ${j} of Team ${i}`;
      memberInput.classList.add("team-member-input");
      memberInput.style.display = j === 1 ? "inline-block" : "none"; // First player input visible by default
      teamDiv.appendChild(memberInput);
    }

    container.appendChild(teamDiv);
  }
}

function updateTeamMemberInputs(size) {
  document.querySelectorAll(".team-row").forEach((row) => {
    Array.from(row.children)
      .slice(1)
      .forEach((input, index) => {
        input.style.display = index < size ? "inline-block" : "none";
      });
  });
}

function randomizeTeams() {
  const teams = document.querySelectorAll(".team-row");
  const teamNames = Array.from(teams).map((team) => {
    return {
      name: team.querySelector('input[type="text"]').value,
      players: Array.from(team.querySelectorAll(".team-member-input")).map(
        (input) => input.value
      ),
    };
  });

  shuffleArray(teamNames);

  teams.forEach((team, index) => {
    team.querySelector('input[type="text"]').value = teamNames[index].name;
    const playerInputs = team.querySelectorAll(".team-member-input");
    playerInputs.forEach((input, playerIndex) => {
      input.value = teamNames[index].players[playerIndex];
    });
  });
}

// Helper function to shuffle an array
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function addErrorMessage(inputElement, message) {
  inputElement.classList.add("input-error");
  let errorMessage = document.createElement("div");
  errorMessage.textContent = message;
  errorMessage.classList.add("error-message");
  inputElement.insertAdjacentElement("afterend", errorMessage);
}

// Tournament START

//when tournament button is pressed

document
  .getElementById("start-tournament")
  .addEventListener("click", startTournament);

function startTournament() {
  console.log("Validation passed");
  const tournamentName = document
    .getElementById("tournament-name")
    .value.trim();
  if (validateTournamentDetails() && validateTeamAndPlayerNames()) {
    const teamData = collectTeamData();
    const tournamentDetails = collectTournamentDetails();

    saveTournamentInfo(tournamentDetails)
      .then(() =>
        saveTeamsToFirestore(teamData, tournamentDetails.tournamentName)
      )
      .then(() => {
        // Save the tournament name to localStorage
        localStorage.setItem(
          "currentTournament",
          tournamentDetails.tournamentName
        );

        // This line will execute only after both saveTournamentInfo and saveTeamsToFirestore are resolved
        window.location.href = "bracket.html";
      })
      .catch((error) => {
        console.error("Error saving document: ", error);
      });
  }
}

async function saveTournamentInfo(tournamentDetails) {
  const tournamentDocRef = doc(
    db,
    "tournament",
    tournamentDetails.tournamentName
  );
  await setDoc(tournamentDocRef, { tournamentInfo: tournamentDetails });
}

// Save team data to Firestore
async function saveTeamsToFirestore(teamData, tournamentName) {
  const tournamentDocRef = doc(db, "tournament", tournamentName);
  const teamsCollectionRef = collection(tournamentDocRef, "teams");

  for (let i = 0; i < teamData.length; i++) {
    const teamDocName = `team${i + 1}`; // Naming as team1, team2, team3, etc. to database
    const teamInfo = teamData[i];

    await setDoc(doc(teamsCollectionRef, teamDocName), teamInfo);
  }
}

function collectTournamentDetails() {
  return {
    tournamentType: document.getElementById("tournament-type").value,
    tournamentName: document.getElementById("tournament-name").value.trim(),
    startDate: document.getElementById("start-date").value,
    endDate: document.getElementById("end-date").value,
    isSingleDay: document.getElementById("single-day").checked,
    teamSize: document.getElementById("team-size").value,
  };
}

// Collect team data from input fields
function collectTeamData() {
  const teams = document.querySelectorAll(".team-row");
  return Array.from(teams).map((team) => {
    const teamName = team.querySelector('input[type="text"]').value.trim();
    const playerInputs = team.querySelectorAll(".team-member-input");
    const players = Array.from(playerInputs)
      .filter((input) => input.style.display !== "none") // Filter only visible inputs
      .map((input) => input.value.trim());

    return { name: teamName, players: players };
  });
}

//Validation
function validateTournamentDetails() {
  const tournamentNameInput = document.getElementById("tournament-name");
  const startDateInput = document.getElementById("start-date");
  const endDateInput = document.getElementById("end-date");
  const isSingleDay = document.getElementById("single-day").checked;
  const startDate = new Date(startDateInput.value);
  const endDate = new Date(endDateInput.value);

  // Clear previous errors
  [tournamentNameInput, startDateInput, endDateInput].forEach((input) =>
    input.classList.remove("input-error")
  );

  let isValid = true;

  if (!tournamentNameInput.value.trim()) {
    tournamentNameInput.classList.add("input-error");
    isValid = false;
  }

  if (!startDateInput.value.trim()) {
    startDateInput.classList.add("input-error");
    isValid = false;
  }

  if (!isSingleDay && !endDateInput.value.trim()) {
    endDateInput.classList.add("input-error");
    isValid = false;
  }

  if (!isSingleDay && endDate <= startDate) {
    endDateInput.classList.add("input-error");
    isValid = false;
  }
  return isValid;
}

function validateTeamAndPlayerNames() {
  const teamRows = document.querySelectorAll(".team-row");
  let isValid = true;
  let teamNames = new Set();

  // Clear previous errors
  teamRows.forEach((row) => {
    row.querySelectorAll("input").forEach((input) => {
      input.classList.remove("input-error");
      let nextSibling = input.nextElementSibling;
      if (nextSibling && nextSibling.classList.contains("error-message")) {
        nextSibling.remove();
      }
    });
  });

  // Validation checks
  teamRows.forEach((row) => {
    const teamNameInput = row.querySelector('input[type="text"]');
    const teamName = teamNameInput.value.trim();

    if (!teamName) {
      addErrorMessage(teamNameInput, "Team name is required.");
      isValid = false;
    } else if (teamNames.has(teamName)) {
      addErrorMessage(teamNameInput, "This is a duplicate!");
      isValid = false;
    } else {
      teamNames.add(teamName);
    }

    row.querySelectorAll(".team-member-input").forEach((input) => {
      if (input.style.display !== "none" && !input.value.trim()) {
        addErrorMessage(input, "Player name is required.");
        isValid = false;
      }
    });
  });

  return isValid;
}
