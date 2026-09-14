const SUPABASE_URL = "https://dpujceghxgicemewqzip.supabase.co";
const SUPABASE_KEY = "sb_publishable_MYANBWkTW5omiy9e2HWNhA_Hio6sQ1_";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

let players = [];
let availability = {};

let currentDate = new Date();

const playerSelect = document.getElementById("player");
const calendarDays = document.getElementById("calendarDays");
const monthTitle = document.getElementById("monthTitle");
const message = document.getElementById("message");


// ===============================
// CARGAR JUGADORES
// ===============================

async function loadPlayers() {

    const { data, error } = await supabaseClient
        .from("players")
        .select("*")
        .order("name");

    if (error) {
        console.error(error);
        showMessage("Error cargando jugadores");
        return;
    }

    players = data;

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


// ===============================
// CARGAR DISPONIBILIDAD
// ===============================

async function loadAvailability() {

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const start =
        formatDate(firstDay);

    const end =
        formatDate(lastDay);

    const { data, error } = await supabaseClient
        .from("availability")
        .select("*")
        .gte("date", start)
        .lte("date", end);

    if (error) {
        console.error(error);
        showMessage("Error cargando disponibilidad");
        return;
    }

    availability = {};

    data.forEach(row => {

        if (!availability[row.date]) {
            availability[row.date] = {};
        }

        availability[row.date][row.player_id] =
            row.available;

    });

    renderCalendar();
}


// ===============================
// CREAR CALENDARIO
// ===============================

function renderCalendar() {

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const monthName =
        currentDate.toLocaleDateString("es-ES", {
            month: "long",
            year: "numeric"
        });

    monthTitle.textContent =
        monthName.charAt(0).toUpperCase() +
        monthName.slice(1);

    calendarDays.innerHTML = "";

    const firstDay =
        new Date(year, month, 1);

    const daysInMonth =
        new Date(year, month + 1, 0).getDate();

    // JavaScript empieza la semana en domingo.
    // Nosotros queremos empezar en lunes.
    let startingDay =
        firstDay.getDay();

    startingDay =
        startingDay === 0 ? 6 : startingDay - 1;


    // Espacios antes del día 1

    for (let i = 0; i < startingDay; i++) {

        const empty =
            document.createElement("div");

        empty.className = "day empty";

        calendarDays.appendChild(empty);
    }


    // Días del mes

    for (let day = 1; day <= daysInMonth; day++) {

        const date =
            new Date(year, month, day);

        const dateString =
            formatDate(date);

        const dayElement =
            document.createElement("div");

        dayElement.className = "day";


        const number =
            document.createElement("div");

        number.className = "day-number";

        number.textContent = day;

        dayElement.appendChild(number);


        const playersContainer =
            document.createElement("div");

        playersContainer.className = "players";


        let availableCount = 0;


        players.forEach(player => {

            const dot =
                document.createElement("div");

            dot.className = "player-dot";

            const playerAvailability =
                availability[dateString]?.[player.id];


            if (playerAvailability === true) {

                dot.style.background =
                    player.color;

                availableCount++;

            } else if (playerAvailability === false) {

                dot.style.background =
                    "#ef4444";

            } else {

                dot.style.background =
                    "#6b7280";

            }


            dot.title =
                player.name +
                ": " +
                (
                    playerAvailability === true
                        ? "Disponible"
                        : playerAvailability === false
                            ? "No disponible"
                            : "Sin responder"
                );


            playersContainer.appendChild(dot);

        });


        dayElement.appendChild(playersContainer);


        const count =
            document.createElement("div");

        count.className =
            "availability-count";

        count.textContent =
            `${availableCount}/${players.length} disponibles`;

        dayElement.appendChild(count);


        // Destacar si TODOS pueden

        if (
            players.length > 0 &&
            availableCount === players.length
        ) {
            dayElement.style.border =
                "2px solid #22c55e";
        }


        dayElement.addEventListener(
            "click",
            () => toggleAvailability(dateString)
        );


        calendarDays.appendChild(dayElement);

    }

}


// ===============================
// CAMBIAR DISPONIBILIDAD
// ===============================

async function toggleAvailability(date) {

    const playerId =
        playerSelect.value;

    if (!playerId) {

        showMessage(
            "Primero selecciona tu nombre."
        );

        return;
    }


    const current =
        availability[date]?.[playerId];


    // Si no está marcado o está en no disponible
    // → disponible

    // Si está disponible
    // → no disponible

    const newValue =
        current === true
            ? false
            : true;


    const { error } =
        await supabaseClient
            .from("availability")
            .upsert(
                {
                    player_id: playerId,
                    date: date,
                    available: newValue
                },
                {
                    onConflict:
                        "player_id,date"
                }
            );


    if (error) {

        console.error(error);

        showMessage(
            "No se ha podido guardar el cambio."
        );

        return;
    }


    if (!availability[date]) {
        availability[date] = {};
    }

    availability[date][playerId] =
        newValue;


    renderCalendar();

}


// ===============================
// CAMBIAR DE MES
// ===============================

document
    .getElementById("previousMonth")
    .addEventListener("click", async () => {

        currentDate.setMonth(
            currentDate.getMonth() - 1
        );

        await loadAvailability();

    });


document
    .getElementById("nextMonth")
    .addEventListener("click", async () => {

        currentDate.setMonth(
            currentDate.getMonth() + 1
        );

        await loadAvailability();

    });


// ===============================
// CAMBIAR JUGADOR
// ===============================

playerSelect.addEventListener(
    "change",
    () => {

        message.textContent = "";

        renderCalendar();

    }
);


// ===============================
// ACTUALIZAR AUTOMÁTICAMENTE
// ===============================

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


// ===============================
// FUNCIONES AUXILIARES
// ===============================

function formatDate(date) {

    const year =
        date.getFullYear();

    const month =
        String(
            date.getMonth() + 1
        ).padStart(2, "0");

    const day =
        String(
            date.getDate()
        ).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


function showMessage(text) {

    message.textContent = text;

    setTimeout(() => {

        message.textContent = "";

    }, 3000);

}


// ===============================
// INICIAR
// ===============================

loadPlayers();
loadAvailability();
