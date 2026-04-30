import { useEffect, useMemo, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
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
    transaction.objectStore(PHOTO_STORE).put(photoData, id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function getPhotoFromDB(id) {
  const db = await openPhotoDB();

  return new Promise((resolve, reject) => {
    const request = db
      .transaction(PHOTO_STORE, "readonly")
      .objectStore(PHOTO_STORE)
      .get(id);

    request.onsuccess = () => resolve(request.result || "");
    request.onerror = () => reject(request.error);
  });
}

async function deletePhotoFromDB(id) {
  const db = await openPhotoDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PHOTO_STORE, "readwrite");
    transaction.objectStore(PHOTO_STORE).delete(id);
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
  const [darkMode, setDarkMode] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState("");
  const [showBackupMenu, setShowBackupMenu] = useState(false);
  const [showHistoryPage, setShowHistoryPage] = useState(false);

  const [selectedRepair, setSelectedRepair] = useState(null);
  const [editingRepair, setEditingRepair] = useState(null);
  const [editBarcode, setEditBarcode] = useState("");
  const [editProperty, setEditProperty] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [editMachineType, setEditMachineType] = useState("Washer");
  const [editNotes, setEditNotes] = useState("");

  const fileInputRef = useRef(null);
  const importInputRef = useRef(null);
  const fullRestoreInputRef = useRef(null);
  const scannerRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem("repairLogs");
    const savedDark = localStorage.getItem("darkMode");

    if (saved) setRepairs(JSON.parse(saved));
    if (savedDark) setDarkMode(JSON.parse(savedDark));

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
          if (photo) nextPhotoMap[repair.id] = photo;
        }
      }

      setPhotoMap(nextPhotoMap);
    }

    repairs.length > 0 ? loadPhotos() : setPhotoMap({});
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

      if (!property && lastRepair.property) setProperty(lastRepair.property);
      if (!unit && lastRepair.unit) setUnit(lastRepair.unit);
      if (lastRepair.machineType) setMachineType(lastRepair.machineType);
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

  async function stopScanner() {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      } catch {}

      scannerRef.current = null;
    }

    setScanning(false);
    setScanMessage("");
  }

  async function startScanner() {
    if (scanning) {
      await stopScanner();
      return;
    }

    setScanning(true);
    setScanMessage("Point camera at barcode...");

    setTimeout(async () => {
      const scanner = new Html5Qrcode("reader");
      scannerRef.current = scanner;

      try {
        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 15,
            qrbox: { width: 320, height: 160 },
            aspectRatio: 1.777,
            formatsToSupport: [
              Html5QrcodeSupportedFormats.CODE_128,
              Html5QrcodeSupportedFormats.CODE_39,
              Html5QrcodeSupportedFormats.EAN_13,
              Html5QrcodeSupportedFormats.EAN_8,
              Html5QrcodeSupportedFormats.UPC_A,
              Html5QrcodeSupportedFormats.UPC_E,
              Html5QrcodeSupportedFormats.ITF,
              Html5QrcodeSupportedFormats.QR_CODE,
              Html5QrcodeSupportedFormats.DATA_MATRIX,
            ],
          },
          async (decodedText) => {
            setBarcode(decodedText);
            setScanMessage("Scanned successfully!");

            if (navigator.vibrate) navigator.vibrate(150);

            try {
              await scanner.stop();
              await scanner.clear();
            } catch {}

            scannerRef.current = null;

            setTimeout(() => {
              setScanning(false);
              setScanMessage("");
            }, 700);
          }
        );
      } catch {
        alert("Camera error. Try manual entry instead.");
        setScanning(false);
        setScanMessage("");
        scannerRef.current = null;
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

    if (photoFileData) await savePhotoToDB(photoId, photoFileData);

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

  async function deleteRepair(repair) {
    if (repair.photoId) await deletePhotoFromDB(repair.photoId);

    setRepairs(repairs.filter((item) => item.id !== repair.id));

    const updatedPhotoMap = { ...photoMap };
    delete updatedPhotoMap[repair.id];
    setPhotoMap(updatedPhotoMap);

    setSelectedRepair(null);
  }

  function openEdit(repair) {
    setEditingRepair(repair);
    setEditBarcode(repair.barcode || "");
    setEditProperty(repair.property || "");
    setEditUnit(repair.unit || "");
    setEditMachineType(repair.machineType || "Washer");
    setEditNotes(repair.notes || "");
    setSelectedRepair(null);
  }

  function saveEdit() {
    if (!editBarcode.trim()) {
      alert("Barcode cannot be blank.");
      return;
    }

    setRepairs(
      repairs.map((repair) =>
        repair.id === editingRepair.id
          ? {
              ...repair,
              barcode: editBarcode.trim(),
              property: editProperty.trim(),
              unit: editUnit.trim(),
              machineType: editMachineType,
              notes: editNotes.trim(),
              editedDate: new Date().toLocaleString(),
            }
          : repair
      )
    );

    setEditingRepair(null);
  }

  function exportJSON() {
    downloadFile(
      new Blob([JSON.stringify(repairs, null, 2)], {
        type: "application/json",
      }),
      "repair-log-backup.json"
    );
  }

  async function exportFullBackup() {
    const photos = {};

    for (const repair of repairs) {
      if (repair.photoId) {
        const photo = await getPhotoFromDB(repair.photoId);
        if (photo) photos[repair.photoId] = photo;
      }
    }

    const backup = {
      version: 1,
      exportedAt: new Date().toLocaleString(),
      repairs,
      photos,
    };

    downloadFile(
      new Blob([JSON.stringify(backup, null, 2)], {
        type: "application/json",
      }),
      "repair-log-full-backup-with-photos.json"
    );
  }

  function restoreFullBackup(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = async () => {
      try {
        const backup = JSON.parse(reader.result);

        if (!Array.isArray(backup.repairs) || !backup.photos) {
          alert("Invalid full backup file.");
          return;
        }

        if (
          !confirm(
            "Restore full backup? This will replace all current repairs and photos."
          )
        ) {
          return;
        }

        for (const repair of repairs) {
          if (repair.photoId) await deletePhotoFromDB(repair.photoId);
        }

        for (const [photoId, photoData] of Object.entries(backup.photos)) {
          await savePhotoToDB(photoId, photoData);
        }

        setRepairs(backup.repairs);
        setPhotoMap({});
        alert("Full backup restored successfully.");
      } catch {
        alert("Could not restore full backup.");
      }
    };

    reader.readAsText(file);
    event.target.value = "";
  }

  function exportCSV() {
    const headers = [
      "Date",
      "Edited Date",
      "Barcode",
      "Type",
      "Property",
      "Unit",
      "Notes",
    ];

    const rows = repairs.map((repair) =>
      [
        repair.date,
        repair.editedDate,
        repair.barcode,
        repair.machineType,
        repair.property,
        repair.unit,
        repair.notes,
      ]
        .map((item) => `"${String(item || "").replaceAll('"', '""')}"`)
        .join(",")
    );

    downloadFile(
      new Blob([[headers.join(","), ...rows].join("\n")], {
        type: "text/csv",
      }),
      "repair-log.csv"
    );
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

        if (
          confirm(
            "Import this backup? This will add the backup entries to your current list."
          )
        ) {
          setRepairs([...imported, ...repairs]);
        }
      } catch {
        alert("Could not read backup file.");
      }
    };

    reader.readAsText(file);
    event.target.value = "";
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
    event.target.value = "";
  }

  function modals() {
    return (
      <>
        {selectedRepair && (
          <div className="modal-backdrop" onClick={() => setSelectedRepair(null)}>
            <div className="modal" onClick={(event) => event.stopPropagation()}>
              <h2>Repair Options</h2>

              <button onClick={() => openEdit(selectedRepair)}>Edit</button>

              <button className="delete" onClick={() => deleteRepair(selectedRepair)}>
                Delete
              </button>

              <button className="cancel-btn" onClick={() => setSelectedRepair(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {editingRepair && (
          <div className="modal-backdrop">
            <div className="modal edit-modal">
              <h2>Edit Repair</h2>

              <label>
                Barcode
                <input
                  value={editBarcode}
                  onChange={(event) => setEditBarcode(event.target.value)}
                />
              </label>

              <label>
                Property
                <input
                  value={editProperty}
                  onChange={(event) => setEditProperty(event.target.value)}
                />
              </label>

              <label>
                Unit
                <input
                  value={editUnit}
                  onChange={(event) => setEditUnit(event.target.value)}
                />
              </label>

              <label>
                Machine Type
                <select
                  value={editMachineType}
                  onChange={(event) => setEditMachineType(event.target.value)}
                >
                  <option>Washer</option>
                  <option>Dryer</option>
                </select>
              </label>

              <label>
                Repair Notes
                <textarea
                  value={editNotes}
                  onChange={(event) => setEditNotes(event.target.value)}
                />
              </label>

              <button className="save-btn" onClick={saveEdit}>
                Save Changes
              </button>

              <button className="cancel-btn" onClick={() => setEditingRepair(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  if (showHistoryPage) {
    return (
      <main className={darkMode ? "app dark" : "app"}>
        <section className="history-page">
          <button
            className="close-page-btn"
            onClick={() => setShowHistoryPage(false)}
          >
            ×
          </button>

          <h1>Service History</h1>

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
              <div className="repair-menu-row">
                <button
                  className="dots-btn"
                  onClick={() => setSelectedRepair(repair)}
                >
                  ⋯
                </button>

                <strong>{repair.barcode}</strong>
              </div>

              <p>
                {repair.machineType}
                {repair.property && ` • ${repair.property}`}
                {repair.unit && ` • Unit ${repair.unit}`}
              </p>

              <p>{repair.date}</p>

              {repair.editedDate && (
                <p className="edited">Edited: {repair.editedDate}</p>
              )}

              {repair.notes && <p>{repair.notes}</p>}

              {photoMap[repair.id] && (
                <img
                  className="repair-photo"
                  src={photoMap[repair.id]}
                  alt="Repair"
                />
              )}
            </div>
          ))}
        </section>

        {modals()}
      </main>
    );
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
        <button className="scan-btn" onClick={startScanner}>
          {scanning ? "Stop Scanning" : "Scan Barcode"}
        </button>

        {scanning && <div id="reader"></div>}
        {scanMessage && <p className="scan-message">{scanMessage}</p>}

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
        <button onClick={() => setShowHistoryPage(true)}>
          View Service History
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
            <button onClick={exportJSON}>Export Basic Backup JSON</button>
            <button onClick={exportFullBackup}>
              Export FULL Backup With Photos
            </button>

            <input
              ref={importInputRef}
              type="file"
              accept="application/json"
              onChange={importBackup}
              hidden
            />

            <button onClick={() => importInputRef.current.click()}>
              Import Basic Backup JSON
            </button>

            <input
              ref={fullRestoreInputRef}
              type="file"
              accept="application/json"
              onChange={restoreFullBackup}
              hidden
            />

            <button onClick={() => fullRestoreInputRef.current.click()}>
              Restore FULL Backup With Photos
            </button>
          </div>
        )}
      </section>

      {modals()}
    </main>
  );
}