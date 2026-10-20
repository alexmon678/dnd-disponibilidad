const SUPABASE_URL = "https://dpujceghxgicemewqzip.supabase.co";
const SUPABASE_KEY = "sb_publishable_MYANBWkTW5omiy9e2HWNhA_Hio6sQ1_";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

let players = [];
let availability = {};
let currentDate = new Date();
let selectedDate = null;

const playerSelect = document.getElementById("player");
const calendarDays = document.getElementById("calendarDays");
const monthTitle = document.getElementById("monthTitle");
const message = document.getElementById("message");

const dialog = document.getElementById("availabilityDialog");
const statusInput = document.getElementById("availabilityStatus");
const noteInput = document.getElementById("availabilityNote");
const saveButton = document.getElementById("saveAvailability");
const cancelButton = document.getElementById("cancelAvailability");
const dialogDate = document.getElementById("dialogDate");

// Cargar jugadores
async function loadPlayers() {
    const { data, error } = await supabaseClient
        .from("players")
        .select("*")
        .order("name");

    if (error) {
        console.error("Error cargando jugadores:", error);
        showMessage("Error cargando jugadores. Comprueba la clave de Supabase.");
        return;
    }

    players = data || [];

    playerSelect.innerHTML =
        '<option value="">Selecciona tu nombre</option>';

    players.forEach(player => {
        const option = document.createElement("option");
        option.value = player.id;
        option.textContent = player.name;
        playerSelect.appendChild(option);
    });

    renderCalendar();
}

// Cargar disponibilidad y anotaciones del mes
async function loadAvailability() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const start = formatDate(new Date(year, month, 1));
    const end = formatDate(new Date(year, month + 1, 0));

    const { data, error } = await supabaseClient
        .from("availability")
        .select("*")
        .gte("date", start)
        .lte("date", end);

    if (error) {
        console.error("Error cargando disponibilidad:", error);
        showMessage("Error cargando disponibilidad.");
        return;
    }

    availability = {};

    (data || []).forEach(row => {
        if (!availability[row.date]) {
            availability[row.date] = {};
        }

        availability[row.date][row.player_id] = {
            available: row.available,
            note: row.note || ""
        };
    });

    renderCalendar();

    if (dialog && dialog.open && selectedDate) {
        renderOtherResponses(selectedDate);
    }
}

// Crear calendario
function renderCalendar() {
    if (!calendarDays || !monthTitle) {
        console.error("No se encuentran monthTitle o calendarDays en index.html.");
        return;
    }

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const monthName = currentDate.toLocaleDateString("es-ES", {
        month: "long",
        year: "numeric"
    });

    monthTitle.textContent =
        monthName.charAt(0).toUpperCase() + monthName.slice(1);

    calendarDays.innerHTML = "";

    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let startingDay = firstDay.getDay();
    startingDay = startingDay === 0 ? 6 : startingDay - 1;

    for (let i = 0; i < startingDay; i++) {
        const empty = document.createElement("div");
        empty.className = "day empty";
        calendarDays.appendChild(empty);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dateString = formatDate(date);

        const dayElement = document.createElement("div");
        dayElement.className = "day";

        const number = document.createElement("div");
        number.className = "day-number";
        number.textContent = day;
        dayElement.appendChild(number);

        const playersContainer = document.createElement("div");
        playersContainer.className = "players";

        let availableCount = 0;

        players.forEach(player => {
            const dot = document.createElement("div");
            dot.className = "player-dot";

            const playerData = availability[dateString]?.[player.id];
            const playerAvailability = playerData?.available;

            if (playerAvailability === true) {
                dot.style.background = player.color || "#22c55e";
                availableCount++;
            } else if (playerAvailability === false) {
                dot.style.background = "#ef4444";
            } else {
                dot.style.background = "#6b7280";
            }

            const statusText =
                playerAvailability === true ? "Disponible" :
                playerAvailability === false ? "No disponible" :
                "Sin responder";

            dot.title = player.name + ": " + statusText;

            if (playerData?.note) {
                dot.title += "\nAnotación: " + playerData.note;
                dot.classList.add("has-note");
            }

            playersContainer.appendChild(dot);
        });

        dayElement.appendChild(playersContainer);

        const count = document.createElement("div");
        count.className = "availability-count";
        count.textContent = `${availableCount}/${players.length} disponibles`;
        dayElement.appendChild(count);

        if (players.length > 0 && availableCount === players.length) {
            dayElement.style.border = "2px solid #22c55e";
        }

        dayElement.addEventListener("click", () => {
            openAvailability(dateString);
        });

        calendarDays.appendChild(dayElement);
    }
}

// Abrir ventana y mostrar las respuestas del grupo
function openAvailability(date) {
    const playerId = playerSelect.value;

    if (!playerId) {
        showMessage("Primero selecciona tu nombre.");
        return;
    }

    if (!dialog || !statusInput || !noteInput || !dialogDate) {
        showMessage("Falta la ventana de disponibilidad en index.html.");
        console.error("Comprueba los IDs del dialog en index.html.");
        return;
    }

    selectedDate = date;

    const playerData = availability[date]?.[playerId];

    dialogDate.textContent = "Disponibilidad: " + date;

    statusInput.value =
        playerData?.available === true ? "true" :
        playerData?.available === false ? "false" : "null";

    noteInput.value = playerData?.note || "";

    renderOtherResponses(date);

    dialog.showModal();
}

// Mostrar respuestas y anotaciones de todos los jugadores
function renderOtherResponses(date) {
    const container = document.getElementById("otherResponses");

    if (!container) {
        console.error(
            'No se encuentra el elemento id="otherResponses" en index.html.'
        );
        return;
    }

    container.innerHTML = "";

    if (players.length === 0) {
        container.textContent = "No hay jugadores registrados.";
        return;
    }

    players.forEach(player => {
        const data = availability[date]?.[player.id];
        const available = data?.available;

        const status =
            available === true ? "Disponible" :
            available === false ? "No disponible" :
            "Sin responder";

        const color =
            available === true ? "#22c55e" :
            available === false ? "#ef4444" :
            "#6b7280";

        const card = document.createElement("div");
        card.className = "response-card";

        const header = document.createElement("div");
        header.className = "response-header";

        const dot = document.createElement("span");
        dot.className = "response-dot";
        dot.style.backgroundColor = color;

        const name = document.createElement("strong");
        name.textContent = player.name;

        const statusText = document.createElement("span");
        statusText.className = "response-status";
        statusText.textContent = status;

        header.append(dot, name, statusText);
        card.appendChild(header);

        const note = document.createElement("p");
        note.className = "response-note";
        note.textContent = data?.note?.trim() || "Sin anotaciones.";

        card.appendChild(note);
        container.appendChild(card);
    });
}

// Guardar disponibilidad y anotación
async function saveAvailability() {
    const playerId = playerSelect.value;

    if (!playerId || !selectedDate) {
        showMessage("Selecciona tu nombre y un día.");
        return;
    }

    if (!saveButton || !statusInput || !noteInput) {
        showMessage("No se encuentran los controles para guardar.");
        return;
    }

    const available =
        statusInput.value === "null" ? null :
        statusInput.value === "true";

    const note = noteInput.value.trim();

    saveButton.disabled = true;

    const { error } = await supabaseClient
        .from("availability")
        .upsert({
            player_id: playerId,
            date: selectedDate,
            available: available,
            note: note
        }, {
            onConflict: "player_id,date"
        });

    saveButton.disabled = false;

    if (error) {
        console.error("Error guardando disponibilidad:", error);
        showMessage("No se ha podido guardar. Comprueba Supabase y sus permisos.");
        return;
    }

    if (!availability[selectedDate]) {
        availability[selectedDate] = {};
    }

    availability[selectedDate][playerId] = {
        available: available,
        note: note
    };

    dialog.close();
    renderCalendar();
    showMessage("Disponibilidad guardada.");
}

// Botones de la ventana
if (saveButton) {
    saveButton.addEventListener("click", saveAvailability);
}

if (cancelButton && dialog) {
    cancelButton.addEventListener("click", () => dialog.close());
}

// Cambiar de mes
const previousMonth = document.getElementById("previousMonth");
const nextMonth = document.getElementById("nextMonth");

if (previousMonth) {
    previousMonth.addEventListener("click", async () => {
        currentDate.setDate(1);
        currentDate.setMonth(currentDate.getMonth() - 1);
        await loadAvailability();
    });
}

if (nextMonth) {
    nextMonth.addEventListener("click", async () => {
        currentDate.setDate(1);
        currentDate.setMonth(currentDate.getMonth() + 1);
        await loadAvailability();
    });
}

// Cambiar jugador
if (playerSelect) {
    playerSelect.addEventListener("change", () => {
        if (message) {
            message.textContent = "";
        }

        renderCalendar();
    });
}

// Actualizar automáticamente cuando cambien respuestas
supabaseClient
    .channel("availability-changes")
    .on(
        "postgres_changes",
        {
            event: "*",
            schema: "public",
            table: "availability"
        },
        () => {
            loadAvailability();
        }
    )
    .subscribe();

// Funciones auxiliares
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function showMessage(text) {
    if (!message) {
        console.log(text);
        return;
    }

    message.textContent = text;
}

// Iniciar aplicación
loadPlayers();
loadAvailability();