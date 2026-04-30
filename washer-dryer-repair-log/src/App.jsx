import { useEffect, useMemo, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import "./App.css";

const DB_NAME = "RepairLogPhotoDB";
const DB_VERSION = 1;
const PHOTO_STORE = "photos";

function openPhotoDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(PHOTO_STORE)) {
        db.createObjectStore(PHOTO_STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function savePhotoToDB(id, photoData) {
  const db = await openPhotoDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PHOTO_STORE, "readwrite");
    const store = transaction.objectStore(PHOTO_STORE);

    store.put(photoData, id);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function getPhotoFromDB(id) {
  const db = await openPhotoDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PHOTO_STORE, "readonly");
    const store = transaction.objectStore(PHOTO_STORE);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result || "");
    request.onerror = () => reject(request.error);
  });
}

async function deletePhotoFromDB(id) {
  const db = await openPhotoDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PHOTO_STORE, "readwrite");
    const store = transaction.objectStore(PHOTO_STORE);

    store.delete(id);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export default function App() {
  const [repairs, setRepairs] = useState([]);
  const [photoMap, setPhotoMap] = useState({});
  const [loaded, setLoaded] = useState(false);

  const [barcode, setBarcode] = useState("");
  const [property, setProperty] = useState("");
  const [unit, setUnit] = useState("");
  const [machineType, setMachineType] = useState("Washer");
  const [notes, setNotes] = useState("");
  const [photoPreview, setPhotoPreview] = useState("");
  const [photoFileData, setPhotoFileData] = useState("");
  const [search, setSearch] = useState("");
  const [darkMode, setDarkMode] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [showBackupMenu, setShowBackupMenu] = useState(false);

  const fileInputRef = useRef(null);
  const importInputRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem("repairLogs");
    const savedDark = localStorage.getItem("darkMode");

    if (saved) {
      setRepairs(JSON.parse(saved));
    }

    if (savedDark) {
      setDarkMode(JSON.parse(savedDark));
    }

    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) {
      const repairsWithoutPhotos = repairs.map(({ photo, ...repair }) => repair);
      localStorage.setItem("repairLogs", JSON.stringify(repairsWithoutPhotos));
    }
  }, [repairs, loaded]);

  useEffect(() => {
    localStorage.setItem("darkMode", JSON.stringify(darkMode));
  }, [darkMode]);

  useEffect(() => {
    async function loadPhotos() {
      const nextPhotoMap = {};

      for (const repair of repairs) {
        if (repair.photoId) {
          const photo = await getPhotoFromDB(repair.photoId);

          if (photo) {
            nextPhotoMap[repair.id] = photo;
          }
        }
      }

      setPhotoMap(nextPhotoMap);
    }

    if (repairs.length > 0) {
      loadPhotos();
    } else {
      setPhotoMap({});
    }
  }, [repairs]);

  const previousRepairs = useMemo(() => {
    const currentBarcode = barcode.trim().toLowerCase();

    if (!currentBarcode) return [];

    return repairs.filter(
      (repair) => repair.barcode?.trim().toLowerCase() === currentBarcode
    );
  }, [barcode, repairs]);

  useEffect(() => {
    if (previousRepairs.length > 0 && barcode.trim()) {
      const lastRepair = previousRepairs[0];

      if (!property && lastRepair.property) {
        setProperty(lastRepair.property);
      }

      if (!unit && lastRepair.unit) {
        setUnit(lastRepair.unit);
      }

      if (lastRepair.machineType) {
        setMachineType(lastRepair.machineType);
      }
    }
  }, [barcode, previousRepairs, property, unit]);

  const filteredRepairs = useMemo(() => {
    const text = search.toLowerCase().trim();

    if (!text) return repairs;

    return repairs.filter((repair) =>
      [
        repair.barcode,
        repair.property,
        repair.unit,
        repair.machineType,
        repair.notes,
        repair.date,
      ]
        .join(" ")
        .toLowerCase()
        .includes(text)
    );
  }, [repairs, search]);

  async function startScanner() {
    setScanning(true);

    setTimeout(async () => {
      const scanner = new Html5Qrcode("reader");

      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 250 },
          async (decodedText) => {
            setBarcode(decodedText);

            try {
              await scanner.stop();
            } catch {
              // Ignore scanner stop errors
            }

            setScanning(false);
          }
        );
      } catch {
        alert("Camera error. Try manual entry instead.");
        setScanning(false);
      }
    }, 100);
  }

  async function saveRepair() {
    if (!barcode.trim()) {
      alert("Scan or enter a barcode first.");
      return;
    }

    const id = crypto.randomUUID();
    const photoId = photoFileData ? `photo-${id}` : "";

    if (photoFileData) {
      await savePhotoToDB(photoId, photoFileData);
    }

    const entry = {
      id,
      barcode: barcode.trim(),
      property: property.trim(),
      unit: unit.trim(),
      machineType,
      notes: notes.trim(),
      photoId,
      date: new Date().toLocaleString(),
    };

    setRepairs([entry, ...repairs]);

    if (photoFileData) {
      setPhotoMap({ ...photoMap, [id]: photoFileData });
    }

    setBarcode("");
    setProperty("");
    setUnit("");
    setMachineType("Washer");
    setNotes("");
    setPhotoPreview("");
    setPhotoFileData("");
  }

  async function deleteRepair(id, photoId) {
    if (photoId) {
      await deletePhotoFromDB(photoId);
    }

    setRepairs(repairs.filter((repair) => repair.id !== id));

    const updatedPhotoMap = { ...photoMap };
    delete updatedPhotoMap[id];
    setPhotoMap(updatedPhotoMap);
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(repairs, null, 2)], {
      type: "application/json",
    });

    downloadFile(blob, "repair-log-backup.json");
  }

  function exportCSV() {
    const headers = ["Date", "Barcode", "Type", "Property", "Unit", "Notes"];

    const rows = repairs.map((repair) =>
      [
        repair.date,
        repair.barcode,
        repair.machineType,
        repair.property,
        repair.unit,
        repair.notes,
      ]
        .map((item) => `"${String(item || "").replaceAll('"', '""')}"`)
        .join(",")
    );

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });

    downloadFile(blob, "repair-log.csv");
  }

  function downloadFile(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    link.click();

    URL.revokeObjectURL(url);
  }

  function importBackup(event) {
    const file = event.target.files[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result);

        if (!Array.isArray(imported)) {
          alert("Invalid backup file.");
          return;
        }

        const confirmImport = confirm(
          "Import this backup? This will add the backup entries to your current list."
        );

        if (confirmImport) {
          setRepairs([...imported, ...repairs]);
        }
      } catch {
        alert("Could not read backup file.");
      }
    };

    reader.readAsText(file);
  }

  function handlePhoto(event) {
    const file = event.target.files[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      setPhotoPreview(reader.result);
      setPhotoFileData(reader.result);
    };

    reader.readAsDataURL(file);
  }

  return (
    <main className={darkMode ? "app dark" : "app"}>
      <header className="top-bar">
        <div>
          <h1>Repair Log</h1>
          <p>Washer/Dryer service tracker</p>
        </div>

        <button className="small-btn" onClick={() => setDarkMode(!darkMode)}>
          {darkMode ? "Light" : "Dark"}
        </button>
      </header>

      <section className="card">
        <button className="scan-btn" onClick={startScanner} disabled={scanning}>
          {scanning ? "Scanning..." : "Scan Barcode"}
        </button>

        {scanning && <div id="reader"></div>}

        <label>
          Barcode
          <input
            value={barcode}
            onChange={(event) => setBarcode(event.target.value)}
            placeholder="Scan or type barcode"
          />
        </label>

        {previousRepairs.length > 0 && (
          <div className="previous-box">
            <h3>Previous Repairs Found</h3>

            <p>
              This machine has {previousRepairs.length} previous repair
              {previousRepairs.length === 1 ? "" : "s"}.
            </p>

            {previousRepairs.map((repair) => (
              <div className="previous-repair" key={repair.id}>
                <strong>{repair.date}</strong>

                <p>
                  {repair.machineType}
                  {repair.property && ` • ${repair.property}`}
                  {repair.unit && ` • Unit ${repair.unit}`}
                </p>

                {repair.notes && <p>{repair.notes}</p>}
              </div>
            ))}
          </div>
        )}

        <label>
          Property
          <input
            value={property}
            onChange={(event) => setProperty(event.target.value)}
            placeholder="Example: Oak Ridge Apartments"
          />
        </label>

        <label>
          Unit
          <input
            value={unit}
            onChange={(event) => setUnit(event.target.value)}
            placeholder="Example: 204B"
          />
        </label>

        <label>
          Machine Type
          <select
            value={machineType}
            onChange={(event) => setMachineType(event.target.value)}
          >
            <option>Washer</option>
            <option>Dryer</option>
          </select>
        </label>

        <label>
          Repair Notes
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Example: Replaced drain pump, cleaned lint chute, tested cycle..."
          />
        </label>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhoto}
          hidden
        />

        <button onClick={() => fileInputRef.current.click()}>Add Photo</button>

        {photoPreview && (
          <img className="preview" src={photoPreview} alt="Repair preview" />
        )}

        <button className="save-btn" onClick={saveRepair}>
          Save Repair
        </button>
      </section>

      <section className="card">
        <button
          className="menu-toggle"
          onClick={() => setShowBackupMenu(!showBackupMenu)}
        >
          Backup / Export {showBackupMenu ? "▲" : "▼"}
        </button>

        {showBackupMenu && (
          <div className="dropdown">
            <button onClick={exportCSV}>Export CSV</button>
            <button onClick={exportJSON}>Export Backup JSON</button>

            <input
              ref={importInputRef}
              type="file"
              accept="application/json"
              onChange={importBackup}
              hidden
            />

            <button onClick={() => importInputRef.current.click()}>
              Import Backup JSON
            </button>
          </div>
        )}
      </section>

      <section>
        <h2>History</h2>

        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search barcode, property, unit, notes..."
        />

        <p className="count">
          Showing {filteredRepairs.length} of {repairs.length} repairs
        </p>

        {filteredRepairs.length === 0 && <p>No matching repairs found.</p>}

        {filteredRepairs.map((repair) => (
          <div className="repair-card" key={repair.id}>
            <strong>{repair.barcode}</strong>

            <p>
              {repair.machineType}
              {repair.property && ` • ${repair.property}`}
              {repair.unit && ` • Unit ${repair.unit}`}
            </p>

            <p>{repair.date}</p>

            {repair.notes && <p>{repair.notes}</p>}

            {photoMap[repair.id] && (
              <img
                className="repair-photo"
                src={photoMap[repair.id]}
                alt="Repair"
              />
            )}

            <button
              className="delete"
              onClick={() => deleteRepair(repair.id, repair.photoId)}
            >
              Delete
            </button>
          </div>
        ))}
      </section>
    </main>
  );
}