import { useEffect, useMemo, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import "./App.css";

const STORAGE_KEY = "repairLogs";
const DB_NAME = "RepairLogPhotoDB";
const DB_VERSION = 1;
const PHOTO_STORE = "photos";

// Everything else above App stays the same...

export default function App() {
  const [activeTab, setActiveTab] = useState("new");
  const [repairs, setRepairs] = useState([]);
  const [photoMap, setPhotoMap] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState("");

  const [form, setForm] = useState({
    barcode: "",
    property: "",
    unit: "",
    machineType: "Washer",
    notes: "",
  });

  const [photoPreview, setPhotoPreview] = useState("");
  const [photoFileData, setPhotoFileData] = useState("");
  const [search, setSearch] = useState("");

  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState("");

  const [selectedRepair, setSelectedRepair] = useState(null);
  const [editingRepair, setEditingRepair] = useState(null);

  // keep all your existing functions the same until NewRepairPage

  function NewRepairPage() {
    return (
      <>
        <header className="top-bar">
          <div>
            <h1>New Repair</h1>
            <p>Scan, document, and save service work.</p>
          </div>
        </header>

        {/* keep the rest of NewRepairPage exactly the same */}
      </>
    );
  }

  function SettingsPage() {
    return (
      <>
        <header className="top-bar">
          <div>
            <h1>Settings</h1>
            <p>Manage the app.</p>
          </div>
        </header>

        <section className="card">
          <h2>App Info</h2>
          <p className="helper-text">
            Repair Log saves repair text in local storage and photos in
            IndexedDB on this device.
          </p>
        </section>
      </>
    );
  }

  return (
    <main className="app">
      <div className="page-content">
        {activeTab === "new" && <NewRepairPage />}
        {activeTab === "history" && <HistoryPage />}
        {activeTab === "backup" && <BackupPage />}
        {activeTab === "settings" && <SettingsPage />}
      </div>

      <nav className="tab-bar">
        <button
          className={activeTab === "new" ? "tab active" : "tab"}
          onClick={() => setActiveTab("new")}
        >
          <span>＋</span>
          New
        </button>

        <button
          className={activeTab === "history" ? "tab active" : "tab"}
          onClick={() => setActiveTab("history")}
        >
          <span>⌕</span>
          History
        </button>

        <button
          className={activeTab === "backup" ? "tab active" : "tab"}
          onClick={() => setActiveTab("backup")}
        >
          <span>⇪</span>
          Backup
        </button>

        <button
          className={activeTab === "settings" ? "tab active" : "tab"}
          onClick={() => setActiveTab("settings")}
        >
          <span>⚙</span>
          Settings
        </button>
      </nav>

      <ActionSheets />
      <Toast />
    </main>
  );
}