import { useEffect, useMemo, useRef, useState } from "react";
import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
} from "html5-qrcode";
import "./App.css";

/* =========================
   IndexedDB (Photos)
========================= */
const DB_NAME = "RepairLogPhotoDB";
const DB_VERSION = 1;
const STORE = "photos";

function openDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };

    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

async function savePhoto(id, data) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(data, id);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

async function getPhoto(id) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const req = db.transaction(STORE).objectStore(STORE).get(id);
    req.onsuccess = () => res(req.result || "");
    req.onerror = () => rej(req.error);
  });
}

async function deletePhoto(id) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

/* =========================
   App
========================= */
export default function App() {
  const [repairs, setRepairs] = useState([]);
  const [photoMap, setPhotoMap] = useState({});
  const [barcode, setBarcode] = useState("");
  const [property, setProperty] = useState("");
  const [unit, setUnit] = useState("");
  const [machineType, setMachineType] = useState("Washer");
  const [notes, setNotes] = useState("");
  const [photoData, setPhotoData] = useState("");
  const [photoPreview, setPhotoPreview] = useState("");
  const [search, setSearch] = useState("");
  const [darkMode, setDarkMode] = useState(false);

  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState("");

  const [selectedRepair, setSelectedRepair] = useState(null);
  const [editingRepair, setEditingRepair] = useState(null);

  const [showBackupMenu, setShowBackupMenu] = useState(false);

  const scannerRef = useRef(null);
  const fileRef = useRef(null);
  const importRef = useRef(null);
  const fullRestoreRef = useRef(null);

  /* Load */
  useEffect(() => {
    const saved = localStorage.getItem("repairLogs");
    if (saved) setRepairs(JSON.parse(saved));
  }, []);

  /* Save */
  useEffect(() => {
    localStorage.setItem("repairLogs", JSON.stringify(repairs));
  }, [repairs]);

  /* Load Photos */
  useEffect(() => {
    (async () => {
      const map = {};
      for (const r of repairs) {
        if (r.photoId) {
          const p = await getPhoto(r.photoId);
          if (p) map[r.id] = p;
        }
      }
      setPhotoMap(map);
    })();
  }, [repairs]);

  /* Scanner */
  async function startScanner() {
    if (scanning) {
      await stopScanner();
      return;
    }

    setScanning(true);
    setScanMessage("Scanning...");

    const scanner = new Html5Qrcode("reader");
    scannerRef.current = scanner;

    await scanner.start(
      { facingMode: "environment" },
      {
        fps: 15,
        qrbox: { width: 300, height: 150 },
        formatsToSupport: [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.QR_CODE,
        ],
      },
      async (text) => {
        setBarcode(text);
        setScanMessage("Scanned!");

        if (navigator.vibrate) navigator.vibrate(100);

        await stopScanner();
      }
    );
  }

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

  /* Save Repair */
  async function saveRepair() {
    const id = crypto.randomUUID();
    const photoId = photoData ? "photo-" + id : "";

    if (photoData) await savePhoto(photoId, photoData);

    const entry = {
      id,
      barcode,
      property,
      unit,
      machineType,
      notes,
      photoId,
      date: new Date().toLocaleString(),
    };

    setRepairs([entry, ...repairs]);

    setBarcode("");
    setProperty("");
    setUnit("");
    setNotes("");
    setPhotoData("");
    setPhotoPreview("");
  }

  /* Delete */
  async function deleteRepair(r) {
    if (r.photoId) await deletePhoto(r.photoId);
    setRepairs(repairs.filter((x) => x.id !== r.id));
    setSelectedRepair(null);
  }

  /* Backup FULL */
  async function exportFullBackup() {
    const photos = {};

    for (const r of repairs) {
      if (r.photoId) {
        photos[r.photoId] = await getPhoto(r.photoId);
      }
    }

    const backup = { repairs, photos };

    const blob = new Blob([JSON.stringify(backup)], {
      type: "application/json",
    });

    download(blob, "full-backup.json");
  }

  /* Restore FULL */
  function restoreFullBackup(e) {
    const file = e.target.files[0];
    const reader = new FileReader();

    reader.onload = async () => {
      const data = JSON.parse(reader.result);

      for (const [id, photo] of Object.entries(data.photos)) {
        await savePhoto(id, photo);
      }

      setRepairs(data.repairs);
      alert("Restored!");
    };

    reader.readAsText(file);
  }

  function download(blob, name) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
  }

  /* UI */
  return (
    <main className={darkMode ? "app dark" : "app"}>
      <h1>Repair Log</h1>

      <button onClick={() => setDarkMode(!darkMode)}>
        Toggle Theme
      </button>

      <button onClick={startScanner}>
        {scanning ? "Stop" : "Scan"}
      </button>

      {scanning && <div id="reader"></div>}
      <p>{scanMessage}</p>

      <input value={barcode} onChange={(e) => setBarcode(e.target.value)} />
      <input value={property} onChange={(e) => setProperty(e.target.value)} />
      <input value={unit} onChange={(e) => setUnit(e.target.value)} />

      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />

      <input
        type="file"
        hidden
        ref={fileRef}
        onChange={(e) => {
          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onload = () => {
            setPhotoPreview(reader.result);
            setPhotoData(reader.result);
          };
          reader.readAsDataURL(file);
        }}
      />

      <button onClick={() => fileRef.current.click()}>Add Photo</button>

      {photoPreview && <img src={photoPreview} width="100%" />}

      <button onClick={saveRepair}>Save</button>

      <hr />

      <button onClick={exportFullBackup}>Export FULL Backup</button>

      <input
        type="file"
        hidden
        ref={fullRestoreRef}
        onChange={restoreFullBackup}
      />

      <button onClick={() => fullRestoreRef.current.click()}>
        Restore FULL Backup
      </button>

      {repairs.map((r) => (
        <div key={r.id}>
          <strong>{r.barcode}</strong>
          <p>{r.notes}</p>

          <button onClick={() => deleteRepair(r)}>Delete</button>
        </div>
      ))}
    </main>
  );
}