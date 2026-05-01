import { useEffect, useMemo, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import "./App.css";

const STORAGE_KEY = "repairLogs";

/* ===== Helpers ===== */
function safeJSONParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function makeId() {
  return crypto.randomUUID();
}

function formatDate(value) {
  if (!value) return new Date().toLocaleString();
  const d = new Date(value);
  return isNaN(d) ? value : d.toLocaleString();
}

function formatNowISO() {
  return new Date().toISOString();
}

/* ===== APP ===== */
export default function App() {
  const [activeTab, setActiveTab] = useState("new");
  const [repairs, setRepairs] = useState([]);
  const [toast, setToast] = useState("");

  const [form, setForm] = useState({
    barcode: "",
    property: "",
    unit: "",
    machineType: "Washer",
    notes: "",
  });

  const [search, setSearch] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState("");

  const scannerRef = useRef(null);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 2000);
  }

  /* ===== Load data ===== */
  useEffect(() => {
    const stored = safeJSONParse(localStorage.getItem(STORAGE_KEY), []);
    setRepairs(stored);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(repairs));
  }, [repairs]);

  /* ===== Scanner ===== */
  async function startScanner() {
    if (scanning) return;

    setScanning(true);
    setScanMessage("Scanning...");

    setTimeout(async () => {
      const scanner = new Html5Qrcode("reader");
      scannerRef.current = scanner;

      try {
        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 15,
            qrbox: { width: 300, height: 150 },
            formatsToSupport: [
              Html5QrcodeSupportedFormats.CODE_128,
              Html5QrcodeSupportedFormats.QR_CODE,
            ],
          },
          async (text) => {
            setForm((f) => ({ ...f, barcode: text }));
            showToast("Scanned!");
            await scanner.stop();
            setScanning(false);
            setScanMessage("");
          }
        );
      } catch {
        showToast("Camera error");
        setScanning(false);
      }
    }, 100);
  }

  /* ===== Save ===== */
  function saveRepair() {
    if (!form.barcode.trim()) {
      showToast("Enter barcode");
      return;
    }

    const entry = {
      id: makeId(),
      ...form,
      date: formatDate(formatNowISO()),
    };

    setRepairs((r) => [entry, ...r]);

    setForm({
      barcode: "",
      property: "",
      unit: "",
      machineType: "Washer",
      notes: "",
    });

    showToast("Saved");
  }

  /* ===== Pages ===== */

  function NewRepairPage() {
    return (
      <>
        <header className="top-bar">
          <div>
            <h1>New Repair</h1>
            <p>Scan and log repairs</p>
          </div>
        </header>

        <section className="hero-card">
          <button className="scan-btn" onClick={startScanner}>
            {scanning ? "Scanning..." : "Scan Barcode"}
          </button>

          {scanning && <div id="reader"></div>}
          {scanMessage && <p>{scanMessage}</p>}
        </section>

        <section className="card">
          <input
            placeholder="Barcode"
            value={form.barcode}
            onChange={(e) =>
              setForm((f) => ({ ...f, barcode: e.target.value }))
            }
          />

          <input
            placeholder="Property"
            value={form.property}
            onChange={(e) =>
              setForm((f) => ({ ...f, property: e.target.value }))
            }
          />

          <input
            placeholder="Unit"
            value={form.unit}
            onChange={(e) =>
              setForm((f) => ({ ...f, unit: e.target.value }))
            }
          />

          <textarea
            placeholder="Notes"
            value={form.notes}
            onChange={(e) =>
              setForm((f) => ({ ...f, notes: e.target.value }))
            }
          />

          <button className="save-btn" onClick={saveRepair}>
            Save Repair
          </button>
        </section>
      </>
    );
  }

  function HistoryPage() {
    const filtered = repairs.filter((r) =>
      JSON.stringify(r).toLowerCase().includes(search.toLowerCase())
    );

    return (
      <>
        <header className="top-bar">
          <div>
            <h1>History</h1>
            <p>{repairs.length} repairs</p>
          </div>
        </header>

        <section className="card">
          <input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </section>

        {filtered.map((r) => (
          <div key={r.id} className="repair-card">
            <h3>{r.barcode}</h3>
            <p>{r.property} {r.unit}</p>
            <p>{r.notes}</p>
            <small>{r.date}</small>
          </div>
        ))}
      </>
    );
  }

  function SettingsPage() {
    return (
      <>
        <header className="top-bar">
          <div>
            <h1>Settings</h1>
            <p>App info</p>
          </div>
        </header>

        <section className="card">
          <p>This app stores data locally on your device.</p>
        </section>
      </>
    );
  }

  /* ===== UI ===== */
  return (
    <main className="app">
      <div className="page-content">
        {activeTab === "new" && <NewRepairPage />}
        {activeTab === "history" && <HistoryPage />}
        {activeTab === "settings" && <SettingsPage />}
      </div>

      <nav className="tab-bar">
        <button onClick={() => setActiveTab("new")}>New</button>
        <button onClick={() => setActiveTab("history")}>History</button>
        <button onClick={() => setActiveTab("settings")}>Settings</button>
      </nav>

      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}