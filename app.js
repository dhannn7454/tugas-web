/* SISPERU IDB Bali — demo interaktif (data disimpan di localStorage browser). */
(() => {
  "use strict";

  const VERSION = 3;
  const KEY = "sisperu-demo-v3";
  const SESSION_KEY = "sisperu-demo-session";
  const WITA_OFFSET = 8 * 60 * 60 * 1000;
  const PASS = "Demo#2026";
  const WELCOME_KEY = "sisperu-welcome-";

  const STATUS_LABEL = {
    PENDING: "Menunggu",
    APPROVED: "Disetujui",
    REJECTED: "Ditolak",
    CANCELLED: "Dibatalkan",
    EXPIRED: "Kedaluwarsa",
    COMPLETED: "Selesai",
    NO_SHOW: "Tidak hadir",
  };
  const STATUS_CLASS = {
    PENDING: "badge-pending",
    APPROVED: "badge-approved",
    REJECTED: "badge-rejected",
    CANCELLED: "badge-cancelled",
    EXPIRED: "badge-expired",
    COMPLETED: "badge-completed",
    NO_SHOW: "badge-noshow",
  };
  const ROLE_LABEL = { BORROWER: "Peminjam", STAFF: "Petugas", ADMIN: "Admin" };
  function roleLabel(role) {
    return ROLE_LABEL[role] || role;
  }

  /* ---------- helpers ---------- */
  const pad = (n) => String(n).padStart(2, "0");
  const esc = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[ch]);
  const uid = () =>
    (crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random()}`).slice(0, 12);

  function todayKey() {
    return new Date(Date.now() + WITA_OFFSET).toISOString().slice(0, 10);
  }
  function datePlus(days) {
    return new Date(Date.now() + WITA_OFFSET + days * 86400000).toISOString().slice(0, 10);
  }
  function weekday(dateKey) {
    return new Date(`${dateKey}T00:00:00Z`).getUTCDay();
  }
  function futureKey(minDays) {
    let offset = minDays;
    while (weekday(datePlus(offset)) === 0) offset += 1;
    return datePlus(offset);
  }
  function dayDiff(dateKey) {
    return Math.round(
      (Date.parse(`${dateKey}T00:00:00Z`) - Date.parse(`${todayKey()}T00:00:00Z`)) / 86400000,
    );
  }
  function at(dateKey, time) {
    return Date.parse(`${dateKey}T${time}:00+08:00`);
  }
  function minutes(start, end) {
    return Math.round((at("2000-01-01", end) - at("2000-01-01", start)) / 60000);
  }
  function overlap(aStart, aEnd, bStart, bEnd) {
    return at("2000-01-01", aStart) < at("2000-01-01", bEnd) &&
      at("2000-01-01", bStart) < at("2000-01-01", aEnd);
  }
  function fmtDate(dateKey) {
    return new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Makassar",
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(`${dateKey}T00:00:00+08:00`));
  }
  function fmtDateShort(dateKey) {
    return new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Makassar",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(`${dateKey}T00:00:00+08:00`));
  }
  function fmtStamp(iso) {
    return new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Makassar",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso));
  }
  function mondayOf(dateKey) {
    const day = weekday(dateKey);
    const shift = day === 0 ? -6 : 1 - day;
    return datePlusDiff(dateKey, shift);
  }
  function datePlusDiff(dateKey, days) {
    return new Date(Date.parse(`${dateKey}T00:00:00Z`) + days * 86400000)
      .toISOString()
      .slice(0, 10);
  }
  function refNumber(dateKey) {
    return `SIS-${dateKey.replaceAll("-", "")}-${Math.random().toString(16).slice(2, 8).toUpperCase()}`;
  }

  /* ---------- state ---------- */
  function defaultRules() {
    return {
      openHour: 7,
      closeHour: 21,
      minLeadDays: 2,
      maxAdvanceDays: 60,
      minDuration: 30,
      maxDuration: 480,
      cancelWindow: 6,
      maxPending: 5,
    };
  }

  function seed() {
    const d3 = futureKey(3);
    const d4 = futureKey(4);
    const d5 = futureKey(5);
    const d6 = futureKey(6);
    const d9 = futureKey(9);
    const past = datePlus(-7);
    const now = new Date().toISOString();

    const rooms = [
      { id: "r-a101", code: "A101", name: "Ruang Kelas A101", building: "Gedung A", floor: 1, capacity: 40, facilities: ["AC", "Proyektor", "Papan tulis", "Colokan listrik"], active: true, special: false, requiresNote: false, type: "Ruang kelas" },
      { id: "r-a102", code: "A102", name: "Ruang Kelas A102", building: "Gedung A", floor: 1, capacity: 40, facilities: ["AC", "Proyektor", "Papan tulis"], active: true, special: false, requiresNote: false, type: "Ruang kelas" },
      { id: "r-a201", code: "A201", name: "Laboratorium Komputer A201", building: "Gedung A", floor: 2, capacity: 30, facilities: ["AC", "Komputer", "Proyektor", "Jaringan kabel"], active: true, special: false, requiresNote: false, type: "Laboratorium" },
      { id: "r-b101", code: "B101", name: "Ruang Rapat B101", building: "Gedung B", floor: 1, capacity: 15, facilities: ["AC", "Smart TV", "Meja rapat", "Video conference"], active: true, special: false, requiresNote: false, type: "Ruang rapat" },
      { id: "r-b201", code: "B201", name: "Studio Multimedia B201", building: "Gedung B", floor: 2, capacity: 25, facilities: ["AC", "Kamera", "Lighting", "Green screen"], active: true, special: true, requiresNote: true, type: "Studio" },
      { id: "r-b202", code: "B202", name: "Ruang Seminar B202", building: "Gedung B", floor: 2, capacity: 80, facilities: ["AC", "Proyektor", "Sound system", "Panggung kecil"], active: true, special: false, requiresNote: false, type: "Ruang seminar" },
      { id: "r-c001", code: "C001", name: "Aula Utama IDB", building: "Gedung C", floor: 1, capacity: 200, facilities: ["AC", "Proyektor", "Sound system", "Kursi lipat"], active: true, special: false, requiresNote: false, type: "Aula" },
      { id: "r-a103", code: "A103", name: "Ruang Diskusi A103", building: "Gedung A", floor: 1, capacity: 12, facilities: ["AC", "TV", "Meja bundar"], active: false, special: false, requiresNote: false, type: "Ruang diskusi" },
    ];

    const users = [
      { id: "u-mhs", name: "I Dewa Gede Dhanika", email: "mahasiswa@idbbali.ac.id", password: PASS, roles: ["BORROWER"], unit: "Program Studi Sistem Informasi", active: true },
      { id: "u-dosen", name: "I Wayan Dosen", email: "dosen@idbbali.ac.id", password: PASS, roles: ["BORROWER"], unit: "Program Studi Manajemen", active: true },
      { id: "u-ptg", name: "Putu Petugas Sarana", email: "petugas@idbbali.ac.id", password: PASS, roles: ["STAFF"], unit: "Bagian Sarana dan Prasarana", active: true },
      { id: "u-adm", name: "Admin Sistem", email: "admin@idbbali.ac.id", password: PASS, roles: ["ADMIN"], unit: "Unit Teknologi Informasi", active: true },
    ];

    const bookings = [
      { id: "b-1", ref: "SIS-DEMO-0001", roomId: "r-a101", userId: "u-mhs", date: d3, start: "08:00", end: "10:00", purpose: "Rapat koordinasi tugas akhir", participants: 20, contact: "081234567890", unit: "Sistem Informasi", notes: "", status: "PENDING", createdAt: now, decidedBy: null, reason: null },
      { id: "b-2", ref: "SIS-DEMO-0002", roomId: "r-b101", userId: "u-mhs", date: d4, start: "13:00", end: "15:00", purpose: "Bimbingan kelompok proyek akhir", participants: 12, contact: "081234567890", unit: "Sistem Informasi", notes: "", status: "APPROVED", createdAt: now, decidedBy: "u-ptg", reason: "Jadwal tersedia." },
      { id: "b-3", ref: "SIS-DEMO-0003", roomId: "r-b202", userId: "u-dosen", date: d5, start: "09:00", end: "12:00", purpose: "Seminar kewirausahaan", participants: 60, contact: "081298765432", unit: "Manajemen", notes: "", status: "PENDING", createdAt: now, decidedBy: null, reason: null },
      { id: "b-4", ref: "SIS-DEMO-0004", roomId: "r-a201", userId: "u-dosen", date: d6, start: "10:00", end: "12:00", purpose: "Praktikum tambahan basis data", participants: 30, contact: "081377788899", unit: "Manajemen", notes: "", status: "REJECTED", createdAt: now, decidedBy: "u-ptg", reason: "Beririsan dengan kegiatan akademik resmi." },
      { id: "b-5", ref: "SIS-DEMO-0005", roomId: "r-a101", userId: "u-mhs", date: past, start: "08:00", end: "10:00", purpose: "Diskusi kelompok basis data", participants: 18, contact: "081234567890", unit: "Sistem Informasi", notes: "", status: "COMPLETED", createdAt: now, decidedBy: "u-ptg", reason: null },
    ];

    const closures = [
      { id: "c-1", roomId: "r-a102", date: d9, start: "07:00", end: "12:00", reason: "Perawatan AC dan pengecatan ulang", createdBy: "u-ptg" },
    ];

    const notifications = [
      { id: "n-1", userId: "u-mhs", type: "APPROVED", subject: "Pengajuan SIS-DEMO-0002 disetujui", text: "Pengajuan Anda di Ruang Rapat B101 telah disetujui. Slot ruangan sudah terkunci.", createdAt: now, read: false },
      { id: "n-2", userId: "u-ptg", type: "NEW", subject: "Pengajuan baru SIS-DEMO-0001", text: "Ada pengajuan baru yang menunggu persetujuan.", createdAt: now, read: false },
      { id: "n-3", userId: "u-ptg", type: "NEW", subject: "Pengajuan baru SIS-DEMO-0003", text: "Ada pengajuan baru yang menunggu persetujuan.", createdAt: now, read: false },
    ];

    const audit = [
      { id: "a-1", at: now, actor: "u-mhs", action: "CREATE", detail: "SIS-DEMO-0001 dibuat (Menunggu)." },
      { id: "a-2", at: now, actor: "u-ptg", action: "APPROVE", detail: "SIS-DEMO-0002 disetujui." },
      { id: "a-3", at: now, actor: "u-ptg", action: "REJECT", detail: "SIS-DEMO-0004 ditolak: beririsan kegiatan akademik." },
    ];

    return { version: VERSION, rules: defaultRules(), rooms, users, bookings, closures, notifications, audit };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.version === VERSION) return parsed;
      }
    } catch (error) {
      console.warn("state tidak dapat dibaca", error);
    }
    return seed();
  }

  let state = loadState();
  const ui = {
    search: { date: "", start: "08:00", end: "10:00", capacity: "", building: "", facility: "" },
    bookingErrors: [],
    loginError: "",
    modal: null,
    welcome: false,
    lastFocus: null,
    mobileNav: false,
    report: { from: "", to: "", status: "ALL" },
    week: "",
    calRoom: "",
  };
  let session = (() => {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    } catch {
      return null;
    }
  })();

  function save() {
    localStorage.setItem(KEY, JSON.stringify(state));
  }
  function currentUser() {
    if (!session || !session.userId) return null;
    const user = state.users.find((item) => item.id === session.userId);
    return user && user.active ? user : null;
  }
  function isStaff(user) {
    return Boolean(user && user.roles.includes("STAFF"));
  }
  function isAdmin(user) {
    return Boolean(user && user.roles.includes("ADMIN"));
  }
  function canApprove(user) {
    return isStaff(user) || isAdmin(user);
  }
  function roomById(id) {
    return state.rooms.find((room) => room.id === id);
  }
  function userById(id) {
    return state.users.find((user) => user.id === id);
  }
  function unreadCount(user) {
    return state.notifications.filter((n) => n.userId === user.id && !n.read).length;
  }
  function notify(userId, type, subject, text) {
    state.notifications.unshift({
      id: uid(),
      userId,
      type,
      subject,
      text,
      createdAt: new Date().toISOString(),
      read: false,
    });
  }
  function log(actorId, action, detail) {
    state.audit.unshift({
      id: uid(),
      at: new Date().toISOString(),
      actor: actorId,
      action,
      detail,
    });
  }
  function welcomeSeen(user) {
    try {
      return sessionStorage.getItem(`${WELCOME_KEY}${user.id}`) === "1";
    } catch {
      return true;
    }
  }
  function markWelcomeSeen(user) {
    try {
      sessionStorage.setItem(`${WELCOME_KEY}${user.id}`, "1");
    } catch {
      /* sessionStorage tidak tersedia */
    }
    ui.welcome = false;
  }

  /* ---------- business rules ---------- */
  function hasConflict(roomId, date, start, end, excludeId) {
    return state.bookings.some(
      (booking) =>
        booking.id !== excludeId &&
        booking.roomId === roomId &&
        booking.status === "APPROVED" &&
        booking.date === date &&
        overlap(start, end, booking.start, booking.end),
    ) || state.closures.some(
      (closure) =>
        closure.roomId === roomId &&
        closure.date === date &&
        overlap(start, end, closure.start, closure.end),
    );
  }

  function validateBooking(input, user, excludeId) {
    const rules = state.rules;
    const errors = [];
    const room = roomById(input.roomId);
    if (!room) errors.push("Ruangan wajib dipilih.");
    else if (!room.active) errors.push("Ruangan tidak aktif dan tidak dapat diajukan.");
    if (!input.date) errors.push("Tanggal wajib dipilih.");
    if (!input.start || !input.end) errors.push("Jam mulai dan selesai wajib diisi.");
    if (input.start && input.end) {
      const duration = minutes(input.start, input.end);
      if (duration <= 0) errors.push("Jam selesai harus lebih akhir daripada jam mulai.");
      else {
        if (duration < rules.minDuration) errors.push(`Durasi minimal ${rules.minDuration} menit.`);
        if (duration > rules.maxDuration) errors.push(`Durasi maksimal ${rules.maxDuration / 60} jam per hari.`);
      }
      if (minutes("00:00", input.start) < rules.openHour * 60) errors.push(`Peminjaman paling awal pukul ${pad(rules.openHour)}.00 WITA.`);
      if (minutes("00:00", input.end) > rules.closeHour * 60) errors.push(`Peminjaman paling lambat selesai pukul ${pad(rules.closeHour)}.00 WITA.`);
    }
    if (input.date) {
      if (weekday(input.date) === 0) errors.push("Hari Minggu bukan hari operasional.");
      const diff = dayDiff(input.date);
      if (diff < rules.minLeadDays) errors.push(`Pengajuan paling lambat H-${rules.minLeadDays}.`);
      if (diff > rules.maxAdvanceDays) errors.push(`Pemesanan maksimal ${rules.maxAdvanceDays} hari ke depan.`);
    }
    if (room && Number(input.participants) > room.capacity) errors.push(`Jumlah peserta melebihi kapasitas (${room.capacity} orang).`);
    if (Number(input.participants) < 1) errors.push("Jumlah peserta minimal 1.");
    if (!input.purpose || input.purpose.trim().length < 5) errors.push("Tujuan kegiatan minimal 5 karakter.");
    if (!input.contact || input.contact.trim().length < 8) errors.push("Nomor kontak minimal 8 karakter.");
    if (room && room.special && room.requiresNote && !input.notes.trim()) errors.push("Ruangan khusus ini mewajibkan keterangan tambahan.");
    if (
      room && input.date && input.start && input.end &&
      minutes(input.start, input.end) > 0 &&
      hasConflict(input.roomId, input.date, input.start, input.end, excludeId)
    ) {
      errors.push("Ruangan sudah terpakai pada waktu ini. Pilih waktu atau ruangan lain.");
    }
    const pending = state.bookings.filter(
      (booking) => booking.userId === user.id && booking.status === "PENDING" && at(booking.date, booking.end) > Date.now(),
    ).length;
    if (pending >= rules.maxPending) errors.push(`Anda masih memiliki ${pending} pengajuan menunggu (maksimal ${rules.maxPending}).`);
    return errors;
  }

  function canCancel(booking, user) {
    if (!["PENDING", "APPROVED"].includes(booking.status)) return false;
    if (isStaff(user)) return true;
    if (booking.userId !== user.id) return false;
    if (booking.status === "PENDING") return at(booking.date, booking.start) > Date.now();
    return at(booking.date, booking.start) - Date.now() >= state.rules.cancelWindow * 3600000;
  }

  /* ---------- UI helpers ---------- */
  function badge(status) {
    return `<span class="badge ${STATUS_CLASS[status] || ""}">${STATUS_LABEL[status] || status}</span>`;
  }
  function toast(title, description = "", kind = "ok") {
    const root = document.getElementById("toasts");
    while (root.children.length >= 3) root.firstElementChild.remove();
    const element = document.createElement("div");
    element.className = `toast ${kind}`;
    element.setAttribute("role", "status");
    element.innerHTML = `<b>${esc(title)}</b>${description ? `<span>${esc(description)}</span>` : ""}`;
    root.appendChild(element);
    setTimeout(() => element.remove(), 4500);
  }
  function icon(name) {
    const paths = {
      dashboard: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
      search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
      calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',
      list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
      bell: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
      user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
      building: '<path d="M4 21V5l8-3 8 3v16"/><path d="M9 21v-6h6v6"/>',
      settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
      chart: '<path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6"/><rect x="12" y="8" width="3" height="10"/><rect x="17" y="5" width="3" height="13"/>',
      check: '<path d="m5 12 4 4L19 6"/>',
      logout: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="m10 17 5-5-5-5M15 12H3"/>',
    };
    return `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ""}</svg>`;
  }

  function layout(content) {
    const user = currentUser();
    if (!user) return loginPage();
    const pendingApprovals = state.bookings.filter((booking) => booking.status === "PENDING").length;
    const nav = [
      { section: "Peminjam", items: [
        ["#/dashboard", "dashboard", "Dashboard"],
        ["#/rooms", "search", "Cari Ruangan"],
        ["#/calendar", "calendar", "Kalender"],
        ["#/bookings", "list", "Pengajuan Saya"],
      ]},
      ...(isStaff(user) ? [{ section: "Petugas", items: [
        ["#/staff", "dashboard", "Dashboard Petugas"],
        ["#/staff-rooms", "building", "Kelola Ruangan"],
        ["#/staff-closures", "calendar", "Jadwal Tutup"],
        ["#/staff-reports", "chart", "Laporan"],
      ]}] : []),
      ...(isAdmin(user) ? [{ section: "Administrasi", items: [
        ["#/approvals", "check", "Persetujuan", pendingApprovals],
        ["#/admin-users", "user", "Pengguna"],
        ["#/admin-settings", "settings", "Pengaturan"],
        ["#/admin-audit", "list", "Audit Log"],
      ]}] : []),
      { section: "Akun", items: [
        ["#/notifications", "bell", "Notifikasi"],
        ["#/profile", "user", "Profil"],
      ]},
    ];
    const route = routePath();
    const navHtml = nav.map((group) => `
      <div class="nav-title">${group.section}</div>
      ${group.items.map(([href, ic, label, count]) => `
        <a class="nav-link ${route === href.replace("#/", "") ? "active" : ""}" href="${href}">
          ${icon(ic)}<span>${label}</span>${count ? `<span class="nav-count">${count > 99 ? "99+" : count}</span>` : ""}
        </a>`).join("")}
    `).join("");
    const unread = unreadCount(user);
    return `
      <div class="shell">
        ${ui.mobileNav ? `<div class="scrim" data-action="close-nav"></div>` : ""}
        <aside class="sidebar ${ui.mobileNav ? "open" : ""}">
          <div class="sidebar-head">
            <img src="assets/logo.png" alt="" width="38" height="38" />
            <div><b>SISPERU</b><small>IDB Bali Room Booking</small></div>
          </div>
          <nav class="sidebar-nav">${navHtml}</nav>
          <div class="sidebar-foot">
            <p>${esc(user.name)}</p>
            <small>${esc(user.email)}</small>
            <div class="roles">${user.roles.map((role) => `<span class="role ${role === "STAFF" ? "role-staff" : role === "ADMIN" ? "role-admin" : ""}">${roleLabel(role)}</span>`).join("")}</div>
            <button class="btn btn-sm" style="margin-top:8px;width:100%;background:rgba(255,255,255,.1);color:#fff" data-action="logout">${icon("logout")} Keluar</button>
          </div>
        </aside>
        <div class="main">
          <header class="topbar">
            <button class="menu-btn" data-action="open-nav" aria-label="Buka menu">☰</button>
            <span class="title">Sistem Peminjaman Ruangan Kampus</span>
            <span class="spacer"></span>
            <a class="bell" href="#/notifications" aria-label="Notifikasi${unread ? `, ${unread} belum dibaca` : ""}">
              ${icon("bell")}${unread ? `<span class="count">${unread > 99 ? "99+" : unread}</span>` : ""}
            </a>
          </header>
          <main class="content" id="app">
            <div class="demo-note">
              <b>Demo interaktif</b>
              <span>Data disimpan di browser ini, bukan server kampus.</span>
              <span class="spacer"></span>
              <button class="link-btn" data-action="reset-demo">Reset data demo</button>
            </div>
            ${content}
          </main>
        </div>
      </div>`;
  }

  function loginPage() {
    const accounts = [
      ["Mahasiswa / peminjam", "mahasiswa@idbbali.ac.id", "BORROWER"],
      ["Dosen / peminjam", "dosen@idbbali.ac.id", "BORROWER"],
      ["Petugas sarana", "petugas@idbbali.ac.id", "STAFF"],
      ["Admin sistem", "admin@idbbali.ac.id", "ADMIN"],
    ];
    return `
      <div class="login-wrap">
        <section class="login-hero">
          <div class="login-brand">
            <img src="assets/logo.png" alt="" width="48" height="48" />
            <div><b>SISPERU IDB Bali</b><small>IDB Bali Room Booking</small></div>
          </div>
          <div>
            <figure class="login-photo">
              <img src="assets/gedung-idb-bali.jpg" alt="Gedung IDB Bali" width="1920" height="670" />
            </figure>
            <h1>Setiap ide besar butuh ruang. Temukan ruangnya di sini.</h1>
            <ul>
              <li>Pencarian ketersediaan dan pencegahan bentrok</li>
              <li>Alur persetujuan petugas dengan alasan</li>
              <li>Kalender, laporan, dan audit log</li>
            </ul>
          </div>
        </section>
        <section class="login-panel">
          <div class="login-box">
            <div class="login-mobile-photo">
              <img src="assets/gedung-idb-bali.jpg" alt="Gedung IDB Bali" width="1920" height="670" />
            </div>
            <div class="login-mobile-brand">
              <img src="assets/logo.png" alt="" width="40" height="40" />
              <div><b>SISPERU IDB Bali</b><small>IDB Bali Room Booking</small></div>
            </div>
            <div class="card">
              <div>
                <h2>Masuk ke SISPERU</h2>
              </div>
              ${ui.loginError ? `<div class="error-box" role="alert">${esc(ui.loginError)}</div>` : ""}
              <form data-form="login" class="stack" style="gap:10px">
                <div class="field">
                  <label for="login-email">Email</label>
                  <input class="input" id="login-email" name="email" type="email" autocomplete="username" value="mahasiswa@idbbali.ac.id" required />
                </div>
                <div class="field">
                  <label for="login-password">Password</label>
                  <input class="input" id="login-password" name="password" type="password" autocomplete="current-password" value="${PASS}" required />
                </div>
                <button class="btn btn-primary" type="submit" style="width:100%">Masuk</button>
              </form>
              <div>
                <p class="tiny muted" style="margin:0 0 6px">Akun demo (password <b>Demo#2026</b>)</p>
                <div class="demo-accounts">
                  ${accounts.map(([label, email, role]) => `
                    <button type="button" class="demo-account" data-action="fill-login" data-email="${email}">
                      <span><b>${label}</b><small>${email}</small></span>
                      <span class="badge ${role === "STAFF" ? "badge-pending" : role === "ADMIN" ? "badge-completed" : "badge-approved"}">${roleLabel(role)}</span>
                    </button>`).join("")}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>`;
  }

  /* ---------- pages ---------- */
  function pageHeader(eyebrow, title, description, actions = "") {
    return `<div class="page-head">
      <div><p class="eyebrow">${esc(eyebrow)}</p><h1 tabindex="-1">${esc(title)}</h1>${description ? `<p>${esc(description)}</p>` : ""}</div>
      ${actions ? `<div class="row">${actions}</div>` : ""}
    </div>`;
  }

  function bookingSuccessPage(user) {
    const id = routeQuery().get("id");
    const booking = state.bookings.find((item) => item.id === id && item.userId === user.id);
    if (!booking) {
      return `${pageHeader("Pengajuan", "Pengajuan tidak ditemukan", "Data pengajuan tidak tersedia atau bukan milik akun ini.")}
        <div class="empty"><b>Tidak ada data</b><a href="#/bookings">Kembali ke pengajuan saya</a></div>`;
    }
    const room = roomById(booking.roomId);
    return `<div class="success-wrap">
      <div class="card success-card"><div class="card-body">
        <div class="success-check" aria-hidden="true">
          <svg viewBox="0 0 64 64" width="84" height="84" role="presentation" focusable="false">
            <circle cx="32" cy="32" r="29" />
            <path d="M20 33.5 28.5 42 45 24" />
          </svg>
        </div>
        <p class="eyebrow">Pengajuan diterima</p>
        <h1 tabindex="-1">Peminjaman berhasil diajukan</h1>
        <p class="lead">Pengajuan Anda masuk antrean petugas sarana. Notifikasi akan muncul setelah diperiksa.</p>
        <dl class="success-details">
          <div><dt>Ruangan</dt><dd>${esc(room ? room.name : "-")}</dd></div>
          <div><dt>Waktu</dt><dd>${esc(fmtDate(booking.date))} · ${booking.start}–${booking.end} WITA</dd></div>
          <div><dt>Peserta</dt><dd>${booking.participants} orang</dd></div>
          <div><dt>Referensi</dt><dd>${esc(booking.ref)}</dd></div>
          <div><dt>Status</dt><dd>${badge(booking.status)}</dd></div>
        </dl>
        <div class="btn-row" style="justify-content:center">
          <a class="btn btn-primary" href="#/bookings">Lihat pengajuan saya</a>
          <a class="btn btn-outline" href="#/dashboard">Kembali ke dashboard</a>
        </div>
      </div></div>
    </div>`;
  }

  function dashboardPage(user) {
    const now = Date.now();
    const mine = state.bookings.filter((booking) => booking.userId === user.id);
    const upcoming = mine
      .filter((booking) => ["APPROVED", "PENDING"].includes(booking.status) && at(booking.date, booking.end) > now)
      .sort((a, b) => at(a.date, a.start) - at(b.date, b.start))
      .slice(0, 5);
    const notes = state.notifications.filter((n) => n.userId === user.id).slice(0, 3);
    return `${pageHeader(
      "Dashboard peminjam",
      `Selamat datang, ${user.name}`,
      "Ringkasan pengajuan dan jadwal mendatang. Waktu ditampilkan dalam WITA.",
      `<a class="btn btn-primary" href="#/book-new">+ Ajukan Peminjaman</a><a class="btn btn-outline" href="#/rooms">Cari Ruangan</a>`,
    )}
    <div class="grid grid-4" style="margin-bottom:16px">
      <div class="stat"><p>Total pengajuan</p><b>${mine.length}</b><small>Semua status</small></div>
      <div class="stat"><p>Menunggu</p><b>${mine.filter((b) => b.status === "PENDING").length}</b><small>Perlu keputusan</small></div>
      <div class="stat"><p>Disetujui</p><b>${mine.filter((b) => b.status === "APPROVED").length}</b><small>Slot terkunci</small></div>
      <div class="stat"><p>Akan datang</p><b>${upcoming.filter((b) => b.status === "APPROVED").length}</b><small>Belum berlangsung</small></div>
    </div>
    <div class="grid grid-main">
      <div class="card">
        <div class="card-head"><h2>Jadwal mendatang</h2><a class="small" href="#/bookings">Lihat semua</a></div>
        <div class="card-body">
          ${upcoming.length ? `<div class="stack">${upcoming.map((booking) => {
            const room = roomById(booking.roomId);
            return `<div class="row between" style="align-items:flex-start">
              <div><b>${esc(room ? room.name : "Ruangan")}</b>
                <div class="small muted">${esc(fmtDate(booking.date))} · ${booking.start}–${booking.end} WITA</div>
                <div class="tiny muted">${esc(booking.purpose)}</div>
              </div>${badge(booking.status)}
            </div>`;
          }).join("")}</div>` : `<div class="empty"><b>Belum ada jadwal</b>Cari ruangan lalu ajukan peminjaman.</div>`}
        </div>
      </div>
      <div class="card">
        <div class="card-head"><h2>Notifikasi</h2><a class="small" href="#/notifications">Semua</a></div>
        <div class="card-body">
          ${notes.length ? notes.map((n) => `<div class="notif ${n.read ? "" : "unread"}"><span class="dot"></span><div><b>${esc(n.subject)}</b><p>${esc(n.text)}</p><time>${fmtStamp(n.createdAt)} WITA</time></div></div>`).join("") : `<p class="small muted">Belum ada notifikasi.</p>`}
        </div>
      </div>
    </div>
    <div class="card" style="margin-top:16px">
      <div class="card-head"><h2>Ruangan di IDB Bali</h2><span class="small muted">3 foto</span></div>
      <div class="card-body">
        <div class="photo-grid">
          <figure class="photo-card">
            <img src="assets/perpustakaan.jpg" alt="Perpustakaan IDB Bali dengan rak buku dan meja baca" width="800" height="600" loading="lazy" />
            <figcaption><b>Perpustakaan</b><span>Ruang baca dan koleksi IDB Bali</span></figcaption>
          </figure>
          <figure class="photo-card">
            <img src="assets/lab-komputer.jpg" alt="Laboratorium komputer IDB Bali dengan deretan komputer" width="800" height="600" loading="lazy" />
            <figcaption><b>Laboratorium Komputer</b><span>Praktik mahasiswa IDB Bali</span></figcaption>
          </figure>
          <figure class="photo-card">
            <img src="assets/lab-imac.jpg" alt="Laboratorium iMac IDB Bali untuk praktik desain" width="800" height="600" loading="lazy" />
            <figcaption><b>Lab iMac</b><span>Fasilitas desain dan multimedia</span></figcaption>
          </figure>
        </div>
      </div>
    </div>`;
  }

  function roomsPage(user) {
    const search = ui.search;
    const buildings = [...new Set(state.rooms.filter((r) => r.active).map((r) => r.building))].sort();
    const facilities = [...new Set(state.rooms.flatMap((r) => r.facilities))].sort();
    const searched = Boolean(search.date);
    let results = [];
    if (searched) {
      results = state.rooms.filter((room) => {
        if (!room.active) return false;
        if (search.capacity && room.capacity < Number(search.capacity)) return false;
        if (search.building && room.building !== search.building) return false;
        if (search.facility && !room.facilities.includes(search.facility)) return false;
        if (hasConflict(room.id, search.date, search.start, search.end)) return false;
        return true;
      });
    }
    const listed = searched ? results : state.rooms.filter((room) => room.active);
    return `${pageHeader("Ketersediaan", "Cari ruangan kosong", "Hanya ruangan aktif dan benar-benar kosong pada rentang waktu yang dipilih.")}
      <div class="card" style="margin-bottom:16px"><div class="card-body">
        <form data-form="search" class="form-grid">
          <div class="field"><label for="s-date">Tanggal</label><input class="input" id="s-date" name="date" type="date" value="${search.date || futureKey(state.rules.minLeadDays)}" required /></div>
          <div class="field"><label for="s-start">Jam mulai</label><input class="input" id="s-start" name="start" type="time" step="1800" value="${search.start}" required /></div>
          <div class="field"><label for="s-end">Jam selesai</label><input class="input" id="s-end" name="end" type="time" step="1800" value="${search.end}" required /></div>
          <div class="field"><label for="s-cap">Kapasitas minimum</label><input class="input" id="s-cap" name="capacity" type="number" min="1" value="${search.capacity}" placeholder="Contoh: 30" /></div>
          <div class="field"><label for="s-building">Gedung</label><select class="select" id="s-building" name="building"><option value="">Semua gedung</option>${buildings.map((b) => `<option ${search.building === b ? "selected" : ""}>${esc(b)}</option>`).join("")}</select></div>
          <div class="field"><label for="s-facility">Fasilitas</label><select class="select" id="s-facility" name="facility"><option value="">Semua fasilitas</option>${facilities.map((f) => `<option ${search.facility === f ? "selected" : ""}>${esc(f)}</option>`).join("")}</select></div>
          <div class="full btn-row"><button class="btn btn-primary" type="submit">Cari ruangan</button><button class="btn btn-outline" type="button" data-action="clear-search">Reset</button></div>
        </form>
      </div></div>
      <div class="row between" style="margin-bottom:10px">
        <h2>${searched ? `Hasil ${fmtDate(search.date)}` : "Ruangan aktif"}</h2>
        <span class="small muted">${listed.length} ruangan</span>
      </div>
      ${listed.length === 0 ? `<div class="empty"><b>Tidak ada ruangan kosong pada waktu ini.</b>Coba ubah tanggal, jam, atau filter lain.</div>` : `
        <div class="room-grid">
          ${listed.map((room) => `
            <div class="card room-card">
              <div class="room-photo"><b>${esc(room.name)}</b><small>${esc(room.building)} · Lantai ${room.floor}${room.special ? " · Ruangan khusus" : ""}</small></div>
              <div class="room-body">
                <div class="meta"><span>${room.capacity} orang</span><span>${esc(room.type)}</span></div>
                <div class="chips">${room.facilities.slice(0, 4).map((f) => `<span class="chip">${esc(f)}</span>`).join("")}</div>
                <a class="btn btn-secondary btn-sm" href="#/book-new?room=${room.id}${search.date ? `&date=${search.date}` : ""}">Ajukan peminjaman</a>
              </div>
            </div>`).join("")}
        </div>`}`;
  }

  function newBookingPage(user) {
    const query = routeQuery();
    const rooms = state.rooms.filter((room) => room.active);
    const selectedRoom = query.get("room") || rooms[0]?.id || "";
    const date = query.get("date") || futureKey(state.rules.minLeadDays);
    return `${pageHeader("Pengajuan", "Ajukan peminjaman ruangan", `Paling lambat H-${state.rules.minLeadDays}, maksimal ${state.rules.maxAdvanceDays} hari ke depan.`)}
      <form data-form="booking" class="stack" novalidate>
        ${ui.bookingErrors.length ? `<div class="error-box" role="alert"><b>Periksa kembali pengajuan Anda:</b><ul>${ui.bookingErrors.map((e) => `<li>${esc(e)}</li>`).join("")}</ul></div>` : ""}
        <div class="card"><div class="card-head"><h2>Detail pemakaian</h2></div><div class="card-body">
          <div class="form-grid">
            <div class="field full"><label for="b-room">Ruangan</label><select class="select" id="b-room" name="roomId" required>${rooms.map((room) => `<option value="${room.id}" ${room.id === selectedRoom ? "selected" : ""}>${esc(room.name)} — ${esc(room.building)} (${room.capacity} orang)</option>`).join("")}</select></div>
            <div class="field"><label for="b-date">Tanggal</label><input class="input" id="b-date" name="date" type="date" value="${date}" required /></div>
            <div class="field"><label for="b-participants">Jumlah peserta</label><input class="input" id="b-participants" name="participants" type="number" min="1" value="10" required /></div>
            <div class="field"><label for="b-start">Jam mulai</label><input class="input" id="b-start" name="start" type="time" step="1800" value="08:00" required /></div>
            <div class="field"><label for="b-end">Jam selesai</label><input class="input" id="b-end" name="end" type="time" step="1800" value="10:00" required /></div>
            <div class="field full"><label for="b-purpose">Tujuan kegiatan</label><textarea class="textarea" id="b-purpose" name="purpose" rows="2" required placeholder="Contoh: Rapat koordinasi ormawa"></textarea></div>
            <div class="field"><label for="b-contact">Nomor kontak</label><input class="input" id="b-contact" name="contact" value="081234567890" required /></div>
            <div class="field"><label for="b-unit">Unit / organisasi</label><input class="input" id="b-unit" name="unit" value="${esc(user.unit || "")}" /></div>
            <div class="field full"><label for="b-notes">Keterangan tambahan</label><textarea class="textarea" id="b-notes" name="notes" rows="2" placeholder="Wajib untuk ruangan khusus."></textarea></div>
          </div>
        </div></div>
        <div class="card"><div class="card-body stack">
          <label class="check"><input type="checkbox" name="agree" required /> Saya menyetujui aturan penggunaan ruangan dan bertanggung jawab atas kebersihan serta ketertiban.</label>
          <div class="btn-row"><button class="btn btn-primary" type="submit">Kirim pengajuan</button><a class="btn btn-outline" href="#/rooms">Batal</a></div>
        </div></div>
      </form>`;
  }

  function bookingsPage(user) {
    const filter = routeQuery().get("status") || "ALL";
    const mine = state.bookings
      .filter((booking) => booking.userId === user.id)
      .filter((booking) => filter === "ALL" || booking.status === filter)
      .sort((a, b) => at(b.date, b.start) - at(a.date, a.start));
    const tabs = ["ALL", "PENDING", "APPROVED", "REJECTED", "CANCELLED", "COMPLETED"];
    return `${pageHeader("Pengajuan", "Pengajuan saya", "Pantau status dan batalkan pengajuan sesuai ketentuan.", `<a class="btn btn-primary" href="#/book-new">+ Ajukan</a>`)}
      <div class="tabs" style="margin-bottom:12px">
        ${tabs.map((tab) => `<a class="tab ${filter === tab ? "active" : ""}" href="#/bookings?status=${tab}">${tab === "ALL" ? "Semua" : STATUS_LABEL[tab]}</a>`).join("")}
      </div>
      <div class="card"><div class="table-wrap">
        <table><thead><tr><th>Nama Peminjam</th><th>Ruangan</th><th>Waktu</th><th>Status</th><th>Aksi</th></tr></thead><tbody>
        ${mine.length ? mine.map((booking) => {
          const room = roomById(booking.roomId);
          return `<tr>
            <td><b>${esc(userById(booking.userId)?.name || "-")}</b><span class="sub">${esc(booking.ref)}</span></td>
            <td>${esc(room ? room.name : "-")}<span class="sub">${esc(room ? room.building : "")}</span></td>
            <td>${fmtDateShort(booking.date)}<span class="sub">${booking.start}–${booking.end} WITA</span></td>
            <td>${badge(booking.status)}</td>
            <td><div class="btn-row">
              <button class="btn btn-sm btn-outline" data-action="detail" data-id="${booking.id}">Detail</button>
              ${canCancel(booking, user) ? `<button class="btn btn-sm btn-danger-outline" data-action="modal" data-kind="cancel" data-id="${booking.id}">Batalkan</button>` : ""}
            </div></td>
          </tr>`;
        }).join("") : `<tr><td colspan="5"><div class="empty"><b>Belum ada pengajuan</b>Buat pengajuan pertama Anda dari menu Cari Ruangan.</div></td></tr>`}
        </tbody></table>
      </div></div>`;
  }

  function calendarPage(user) {
    const query = routeQuery();
    const rooms = state.rooms.filter((room) => room.active || isStaff(user));
    const roomId = query.get("room") || ui.calRoom || rooms[0]?.id || "";
    ui.calRoom = roomId;
    const anchor = query.get("from") || ui.week || mondayOf(todayKey());
    ui.week = anchor;
    const days = Array.from({ length: 7 }, (_, index) => datePlusDiff(anchor, index));
    const room = roomById(roomId);
    const prev = datePlusDiff(anchor, -7);
    const next = datePlusDiff(anchor, 7);
    const build = (day) => {
      const slots = state.bookings.filter((b) => b.roomId === roomId && b.date === day && ["APPROVED", "PENDING"].includes(b.status));
      const closures = state.closures.filter((c) => c.roomId === roomId && c.date === day);
      if (!slots.length && !closures.length) return `<div class="cal-empty">Kosong</div>`;
      return [
        ...closures.map((c) => `<div class="slot slot-closure"><b>${c.start}–${c.end}</b>Tutup: ${esc(c.reason)}</div>`),
        ...slots.map((b) => `<div class="slot slot-${b.status.toLowerCase()}"><b>${b.start}–${b.end}</b>${STATUS_LABEL[b.status]}${isStaff(user) ? `<br>${esc(userById(b.userId)?.name || "")}` : ""}</div>`),
      ].join("");
    };
    return `${pageHeader("Kalender", "Ketersediaan ruangan", "Slot disetujui, menunggu, dan jadwal tutup. Peminjam tidak melihat identitas peminjam lain.")}
      <form data-form="calendar" class="card" style="margin-bottom:14px"><div class="card-body row">
        <div class="field" style="min-width:190px"><label for="c-room">Ruangan</label><select class="select" id="c-room" name="room">${rooms.map((r) => `<option value="${r.id}" ${r.id === roomId ? "selected" : ""}>${esc(r.name)} — ${esc(r.building)}</option>`).join("")}</select></div>
        <div class="field" style="min-width:170px"><label for="c-from">Mulai minggu</label><input class="input" id="c-from" name="from" type="date" value="${anchor}" /></div>
        <div class="row" style="align-items:flex-end"><button class="btn btn-secondary" type="submit">Tampilkan</button></div>
        <div class="row" style="align-items:flex-end;margin-left:auto">
          <a class="btn btn-sm btn-outline" href="#/calendar?room=${roomId}&from=${prev}">← Minggu lalu</a>
          <a class="btn btn-sm btn-outline" href="#/calendar?room=${roomId}">Minggu ini</a>
          <a class="btn btn-sm btn-outline" href="#/calendar?room=${roomId}&from=${next}">Minggu depan →</a>
        </div>
      </div></form>
      <div class="card"><div class="card-head"><h2>${esc(room ? room.name : "Ruangan")}</h2><span class="small muted">${fmtDate(days[0])} – ${fmtDate(days[6])}</span></div>
        <div class="card-body"><div class="cal">${days.map((day) => `<div class="cal-day"><header>${fmtDate(day).replace(/^\w+,\s/, "")}</header>${build(day)}</div>`).join("")}</div></div>
      </div>`;
  }

  function notificationsPage(user) {
    const notes = state.notifications.filter((n) => n.userId === user.id);
    return `${pageHeader("Notifikasi", "Notifikasi saya", "Pemberitahuan dalam demo ini disimpan di browser Anda.", notes.some((n) => !n.read) ? `<button class="btn btn-outline" data-action="mark-all-read">Tandai semua dibaca</button>` : "")}
      <div class="card"><div class="card-body">
        ${notes.length ? notes.map((n) => `<div class="notif ${n.read ? "" : "unread"}">
          <span class="dot"></span>
          <div style="flex:1"><b>${esc(n.subject)}</b><p>${esc(n.text)}</p><time>${fmtStamp(n.createdAt)} WITA</time></div>
          ${n.read ? "" : `<button class="btn btn-sm btn-outline" data-action="read" data-id="${n.id}">Tandai dibaca</button>`}
        </div>`).join("") : `<div class="empty"><b>Belum ada notifikasi</b>Perubahan status pengajuan akan muncul di sini.</div>`}
      </div></div>`;
  }

  function profilePage(user) {
    return `${pageHeader("Akun", "Profil saya", "Data akun demo. Perubahan tidak dikirim ke server.")}
      <div class="grid grid-2">
        <div class="card"><div class="card-head"><h2>Informasi akun</h2></div><div class="card-body stack">
          <div><div class="tiny muted">Nama</div><b>${esc(user.name)}</b></div>
          <div><div class="tiny muted">Email</div><b>${esc(user.email)}</b></div>
          <div><div class="tiny muted">Unit</div>${esc(user.unit || "-")}</div>
          <div><div class="tiny muted">Role</div><div class="roles">${user.roles.map((r) => `<span class="role ${r === "STAFF" ? "role-staff" : r === "ADMIN" ? "role-admin" : ""}" style="background:${r === "ADMIN" ? "#012f45" : "#e0ebf2"};color:${r === "ADMIN" ? "#fff" : "#023e5b"}">${roleLabel(r)}</span>`).join("")}</div></div>
        </div></div>
        <div class="card"><div class="card-head"><h2>Sesi demo</h2></div><div class="card-body stack">
          <p class="small muted" style="margin:0">Anda masuk sebagai <b>${esc(user.email)}</b>. Semua data demo tersimpan lokal di browser ini.</p>
          <div class="btn-row"><button class="btn btn-danger-outline" data-action="logout">Keluar</button><button class="btn btn-outline" data-action="reset-demo">Reset data demo</button></div>
        </div></div>
      </div>`;
  }

  function staffPage(user, adminMode = false) {
    const pending = state.bookings.filter((b) => b.status === "PENDING").sort((a, b) => at(a.date, a.start) - at(b.date, b.start));
    const today = todayKey();
    const stats = {
      today: state.bookings.filter((b) => b.date === today).length,
      pending: pending.length,
      approved: state.bookings.filter((b) => b.status === "APPROVED").length,
      rooms: state.rooms.filter((r) => r.active).length,
    };
    return `${pageHeader(
      adminMode ? "Administrasi" : "Petugas",
      adminMode ? "Persetujuan peminjaman" : "Dashboard operasional",
      adminMode ? "Tinjau dan setujui pengajuan ruangan yang masuk." : "Antrean persetujuan dan ringkasan pemakaian.",
    )}
      <div class="grid grid-4" style="margin-bottom:16px">
        <div class="stat"><p>Pengajuan hari ini</p><b>${stats.today}</b><small>Semua status</small></div>
        <div class="stat"><p>Menunggu</p><b>${stats.pending}</b><small>Perlu diperiksa</small></div>
        <div class="stat"><p>Disetujui</p><b>${stats.approved}</b><small>Slot terkunci</small></div>
        <div class="stat"><p>Ruangan aktif</p><b>${stats.rooms}</b><small>Dari ${state.rooms.length} ruangan</small></div>
      </div>
      <div class="card"><div class="card-head"><h2>Antrean persetujuan</h2><span class="small muted">${pending.length} pengajuan</span></div>
        <div class="table-wrap"><table><thead><tr><th>Nama Peminjam</th><th>Ruangan</th><th>Waktu</th><th class="col-queue-status">Status</th><th>Aksi</th></tr></thead><tbody>
        ${pending.length ? pending.map((booking) => {
          const room = roomById(booking.roomId);
          const borrower = userById(booking.userId);
          return `<tr><td><b>${esc(borrower ? borrower.name : "-")}</b><span class="sub">${esc(booking.ref)} · ${esc(borrower?.unit || "")}</span></td>
            <td>${esc(room ? room.name : "-")}<span class="sub">${esc(room ? room.building : "")}</span></td>
            <td>${fmtDateShort(booking.date)}<span class="sub">${booking.start}–${booking.end}</span></td>
            <td class="col-queue-status">${badge(booking.status)}</td>
            <td><div class="btn-row">
              <button class="btn btn-sm btn-primary" data-action="modal" data-kind="approve" data-id="${booking.id}">Setujui</button>
              <button class="btn btn-sm btn-danger-outline" data-action="modal" data-kind="reject" data-id="${booking.id}">Tolak</button>
              <button class="btn btn-sm btn-outline" data-action="detail" data-id="${booking.id}">Detail</button>
            </div></td></tr>`;
        }).join("") : `<tr><td colspan="5"><div class="empty"><b>Antrean bersih</b>Tidak ada pengajuan menunggu.</div></td></tr>`}
        </tbody></table></div>
      </div>`;
  }

  function staffRoomsPage() {
    return `${pageHeader("Petugas", "Kelola ruangan", "Aktifkan atau nonaktifkan ruangan. Ruangan nonaktif tidak muncul pada pencarian.")}
      <div class="card"><div class="table-wrap"><table><thead><tr><th>Ruangan</th><th>Lokasi</th><th>Kapasitas</th><th>Fasilitas</th><th>Status</th><th>Aksi</th></tr></thead><tbody>
      ${state.rooms.map((room) => `<tr>
        <td><b>${esc(room.name)}</b><span class="sub">${esc(room.code)}${room.special ? " · khusus" : ""}</span></td>
        <td>${esc(room.building)}<span class="sub">Lantai ${room.floor}</span></td>
        <td>${room.capacity}</td>
        <td>${esc(room.facilities.join(", "))}</td>
        <td><span class="badge ${room.active ? "badge-active" : "badge-inactive"}">${room.active ? "Aktif" : "Nonaktif"}</span></td>
        <td><button class="btn btn-sm ${room.active ? "btn-danger-outline" : "btn-secondary"}" data-action="toggle-room" data-id="${room.id}">${room.active ? "Nonaktifkan" : "Aktifkan"}</button></td>
      </tr>`).join("")}
      </tbody></table></div></div>`;
  }

  function closuresPage() {
    const closures = state.closures.slice().sort((a, b) => a.date.localeCompare(b.date));
    return `${pageHeader("Petugas", "Jadwal tutup ruangan", "Blokir ruangan untuk perawatan, ujian, atau kegiatan kampus.")}
      <div class="grid grid-2">
        <div class="card"><div class="card-head"><h2>Tambah jadwal tutup</h2></div><div class="card-body">
          <form data-form="closure" class="stack" style="gap:10px">
            <div class="field"><label for="cl-room">Ruangan</label><select class="select" id="cl-room" name="roomId" required>${state.rooms.filter((r) => r.active).map((r) => `<option value="${r.id}">${esc(r.name)} — ${esc(r.building)}</option>`).join("")}</select></div>
            <div class="field"><label for="cl-date">Tanggal</label><input class="input" id="cl-date" name="date" type="date" value="${futureKey(5)}" required /></div>
            <div class="form-grid">
              <div class="field"><label for="cl-start">Mulai</label><input class="input" id="cl-start" name="start" type="time" value="07:00" required /></div>
              <div class="field"><label for="cl-end">Selesai</label><input class="input" id="cl-end" name="end" type="time" value="12:00" required /></div>
            </div>
            <div class="field"><label for="cl-reason">Alasan</label><input class="input" id="cl-reason" name="reason" placeholder="Perawatan AC" required /></div>
            <button class="btn btn-primary" type="submit">Simpan jadwal tutup</button>
          </form>
        </div></div>
        <div class="card"><div class="card-head"><h2>Jadwal tutup</h2></div><div class="card-body">
          ${closures.length ? `<div class="stack">${closures.map((closure) => {
            const room = roomById(closure.roomId);
            return `<div class="row between" style="align-items:flex-start;border-bottom:1px solid var(--line);padding-bottom:8px">
              <div><b>${esc(room ? room.name : "-")}</b><div class="small muted">${fmtDate(closure.date)} · ${closure.start}–${closure.end}</div><div class="tiny muted">${esc(closure.reason)}</div></div>
              <button class="btn btn-sm btn-outline" data-action="delete-closure" data-id="${closure.id}">Hapus</button>
            </div>`;
          }).join("")}</div>` : `<div class="empty"><b>Belum ada jadwal tutup</b></div>`}
        </div></div>
      </div>`;
  }

  function reportRange() {
    const query = routeQuery();
    return {
      from: query.get("from") || ui.report.from || `${todayKey().slice(0, 7)}-01`,
      to: query.get("to") || ui.report.to || todayKey(),
      status: query.get("status") || ui.report.status || "ALL",
    };
  }

  function reportRows(range) {
    return state.bookings.filter((booking) => {
      if (booking.date < range.from || booking.date > range.to) return false;
      if (range.status !== "ALL" && booking.status !== range.status) return false;
      return true;
    });
  }

  function reportsPage() {
    const range = reportRange();
    ui.report = range;
    const rows = reportRows(range);
    const approvedLike = rows.filter((b) => ["APPROVED", "COMPLETED", "NO_SHOW"].includes(b.status));
    const used = rows.filter((b) => ["APPROVED", "COMPLETED"].includes(b.status));
    const usedHours = Math.round(used.reduce((total, b) => total + minutes(b.start, b.end), 0) / 6) / 10;
    const noShow = rows.filter((b) => b.status === "NO_SHOW").length;
    const rate = approvedLike.length ? Math.round((noShow / approvedLike.length) * 1000) / 10 : 0;
    const byRoom = state.rooms.map((room) => {
      const roomRows = rows.filter((b) => b.roomId === room.id);
      const hours = roomRows.filter((b) => ["APPROVED", "COMPLETED"].includes(b.status)).reduce((t, b) => t + minutes(b.start, b.end), 0);
      return { room, count: roomRows.length, hours: Math.round(hours / 6) / 10 };
    }).filter((item) => item.count > 0);
    const exportRows = rows;
    return `${pageHeader("Petugas", "Laporan penggunaan", "Statistik dihitung dari pengajuan pada rentang tanggal (WITA).", `<button class="btn btn-outline" data-action="export-csv">Ekspor CSV</button>`)}
      <form data-form="report" class="card" style="margin-bottom:14px"><div class="card-body row">
        <div class="field"><label for="r-from">Dari</label><input class="input" id="r-from" name="from" type="date" value="${range.from}" /></div>
        <div class="field"><label for="r-to">Sampai</label><input class="input" id="r-to" name="to" type="date" value="${range.to}" /></div>
        <div class="field"><label for="r-status">Status</label><select class="select" id="r-status" name="status"><option value="ALL">Semua status</option>${Object.keys(STATUS_LABEL).map((s) => `<option value="${s}" ${range.status === s ? "selected" : ""}>${STATUS_LABEL[s]}</option>`).join("")}</select></div>
        <div class="row" style="align-items:flex-end"><button class="btn btn-secondary" type="submit">Terapkan</button></div>
      </div></form>
      <div class="grid grid-4" style="margin-bottom:16px">
        <div class="stat"><p>Jumlah peminjaman</p><b>${rows.length}</b><small>${range.from} s.d. ${range.to}</small></div>
        <div class="stat"><p>Disetujui</p><b>${rows.filter((b) => b.status === "APPROVED").length}</b><small>Selesai: ${rows.filter((b) => b.status === "COMPLETED").length}</small></div>
        <div class="stat"><p>Total jam</p><b>${usedHours}</b><small>Disetujui + selesai</small></div>
        <div class="stat"><p>Tidak hadir</p><b>${rate}%</b><small>${noShow} dari ${approvedLike.length} disetujui</small></div>
      </div>
      <div class="grid grid-main">
        <div class="card"><div class="card-head"><h2>Daftar peminjaman</h2><span class="small muted">${exportRows.length} baris</span></div><div class="table-wrap">
          <table><thead><tr><th>Nama Peminjam</th><th>Ruangan</th><th>Tanggal</th><th>Jam</th><th>Status</th></tr></thead><tbody>
          ${rows.length ? rows.map((booking) => {
            const room = roomById(booking.roomId);
            const borrower = userById(booking.userId);
            return `<tr><td><b>${esc(borrower ? borrower.name : "-")}</b><span class="sub">${esc(booking.ref)}</span></td><td>${esc(room ? room.name : "-")}</td><td>${fmtDateShort(booking.date)}</td><td>${booking.start}–${booking.end}</td><td>${badge(booking.status)}</td></tr>`;
          }).join("") : `<tr><td colspan="5"><div class="empty"><b>Tidak ada data</b>Ubah filter laporan.</div></td></tr>`}
          </tbody></table>
        </div></div>
        <div class="card"><div class="card-head"><h2>Per ruangan</h2></div><div class="card-body">
          ${byRoom.length ? `<div class="stack">${byRoom.map((item) => `<div class="row between"><span>${esc(item.room.name)}</span><span class="small muted">${item.count} peminjaman · ${item.hours} jam</span></div>`).join("")}</div>` : `<p class="small muted">Belum ada pemakaian pada rentang ini.</p>`}
        </div></div>
      </div>`;
  }

  function adminUsersPage() {
    return `${pageHeader("Administrasi", "Kelola pengguna", "Aktifkan atau nonaktifkan akun demo. Admin tidak otomatis dapat menyetujui pengajuan.")}
      <div class="card"><div class="table-wrap"><table><thead><tr><th>Pengguna</th><th>Unit</th><th>Role</th><th>Status</th><th>Aksi</th></tr></thead><tbody>
      ${state.users.map((user) => `<tr>
        <td><b>${esc(user.name)}</b><span class="sub">${esc(user.email)}</span></td>
        <td>${esc(user.unit || "-")}</td>
        <td>${user.roles.join(" + ")}</td>
        <td><span class="badge ${user.active ? "badge-active" : "badge-inactive"}">${user.active ? "Aktif" : "Nonaktif"}</span></td>
        <td><button class="btn btn-sm ${user.active ? "btn-danger-outline" : "btn-secondary"}" data-action="toggle-user" data-id="${user.id}">${user.active ? "Nonaktifkan" : "Aktifkan"}</button></td>
      </tr>`).join("")}
      </tbody></table></div></div>`;
  }

  function adminSettingsPage() {
    const r = state.rules;
    return `${pageHeader("Administrasi", "Pengaturan sistem", "Nilai awal berupa asumsi; dapat diubah untuk demo ini.")}
      <form data-form="settings" class="card"><div class="card-head"><h2>Aturan peminjaman</h2></div><div class="card-body">
        <div class="form-grid">
          <div class="field"><label for="set-open">Jam buka</label><input class="input" id="set-open" name="openHour" type="number" min="0" max="23" value="${r.openHour}" /></div>
          <div class="field"><label for="set-close">Jam tutup</label><input class="input" id="set-close" name="closeHour" type="number" min="1" max="24" value="${r.closeHour}" /></div>
          <div class="field"><label for="set-lead">Batas pengajuan (H-…)</label><input class="input" id="set-lead" name="minLeadDays" type="number" min="0" max="30" value="${r.minLeadDays}" /></div>
          <div class="field"><label for="set-advance">Pemesanan terjauh (hari)</label><input class="input" id="set-advance" name="maxAdvanceDays" type="number" min="1" max="365" value="${r.maxAdvanceDays}" /></div>
          <div class="field"><label for="set-min">Durasi minimum (menit)</label><input class="input" id="set-min" name="minDuration" type="number" min="15" max="480" value="${r.minDuration}" /></div>
          <div class="field"><label for="set-max">Durasi maksimum (menit)</label><input class="input" id="set-max" name="maxDuration" type="number" min="30" max="1440" value="${r.maxDuration}" /></div>
          <div class="field"><label for="set-cancel">Batas pembatalan (jam)</label><input class="input" id="set-cancel" name="cancelWindow" type="number" min="0" max="72" value="${r.cancelWindow}" /></div>
          <div class="field"><label for="set-pending">Maks. pengajuan menunggu</label><input class="input" id="set-pending" name="maxPending" type="number" min="1" max="50" value="${r.maxPending}" /></div>
        </div>
        <div class="btn-row" style="margin-top:14px"><button class="btn btn-primary" type="submit">Simpan pengaturan</button></div>
      </div></form>`;
  }

  function adminAuditPage() {
    return `${pageHeader("Administrasi", "Audit log", "Jejak perubahan status pada demo ini.")}
      <div class="card"><div class="table-wrap"><table><thead><tr><th>Waktu</th><th>Aktor</th><th>Aksi</th><th>Detail</th></tr></thead><tbody>
      ${state.audit.slice(0, 60).map((entry) => `<tr><td>${fmtStamp(entry.at)}</td><td>${esc(userById(entry.actor)?.name || "Sistem")}</td><td><code>${esc(entry.action)}</code></td><td>${esc(entry.detail)}</td></tr>`).join("") || `<tr><td colspan="4"><div class="empty"><b>Belum ada aktivitas</b></div></td></tr>`}
      </tbody></table></div></div>`;
  }

  /* ---------- welcome popup ---------- */
  function welcomeHtml(user) {
    const greet = `<h2 id="welcome-title">Halo, ${esc(user.name)}</h2>`;
    if (isStaff(user)) {
      const pending = state.bookings.filter((booking) => booking.status === "PENDING").length;
      const headline = pending
        ? `${pending} pengajuan menunggu keputusan Anda.`
        : "Antrean persetujuan sedang bersih.";
      return `<div class="overlay" data-action="close-welcome-bg">
        <div class="modal welcome" role="dialog" aria-modal="true" aria-labelledby="welcome-title" tabindex="-1">
          <div class="welcome-hero">
            <p class="welcome-eyebrow">Dashboard petugas</p>
            ${greet}
            <p>${esc(headline)} Periksa bentrok jadwal sebelum menyetujui atau menolak.</p>
          </div>
          <footer>
            <button class="btn btn-outline" data-action="close-welcome">Tutup</button>
            <a class="btn btn-primary" href="#/staff" data-action="welcome-go">Buka antrean</a>
          </footer>
        </div>
      </div>`;
    }
    if (isAdmin(user)) {
      const pending = state.bookings.filter((booking) => booking.status === "PENDING").length;
      const headline = pending
        ? `${pending} pengajuan menunggu persetujuan.`
        : "Tidak ada pengajuan yang menunggu persetujuan.";
      return `<div class="overlay" data-action="close-welcome-bg">
        <div class="modal welcome" role="dialog" aria-modal="true" aria-labelledby="welcome-title" tabindex="-1">
          <div class="welcome-hero">
            <p class="welcome-eyebrow">Dashboard admin</p>
            ${greet}
            <p>${esc(headline)} Anda dapat menyetujui atau menolak pengajuan langsung dari akun admin.</p>
          </div>
          <footer>
            <button class="btn btn-outline" data-action="close-welcome">Tutup</button>
            <a class="btn btn-primary" href="#/approvals" data-action="welcome-go">Buka persetujuan</a>
          </footer>
        </div>
      </div>`;
    }
    const mine = state.bookings.filter((booking) => booking.userId === user.id);
    const pending = mine.filter((booking) => booking.status === "PENDING").length;
    const next = mine
      .filter((booking) => ["APPROVED", "PENDING"].includes(booking.status) && at(booking.date, booking.end) > Date.now())
      .sort((a, b) => at(a.date, a.start) - at(b.date, b.start))[0];
    const headline = pending
      ? `${pending} pengajuan menunggu keputusan petugas.`
      : "Tidak ada pengajuan yang menunggu.";
    const schedule = next
      ? `Jadwal terdekat: ${esc(roomById(next.roomId)?.name || "ruangan")} · ${esc(fmtDate(next.date))} · <span class="nowrap">${esc(`${next.start}–${next.end} WITA`)}</span>.`
      : "Belum ada jadwal mendatang. Cari ruangan kosong untuk memulai.";
    return `<div class="overlay" data-action="close-welcome-bg">
      <div class="modal welcome" role="dialog" aria-modal="true" aria-labelledby="welcome-title" tabindex="-1">
        <div class="welcome-hero">
          <p class="welcome-eyebrow">Dashboard peminjam</p>
          ${greet}
          <p>${esc(headline)} ${schedule}</p>
        </div>
        <footer>
          <button class="btn btn-outline" data-action="close-welcome">Tutup</button>
          <a class="btn btn-primary" href="#/bookings" data-action="welcome-go">Lihat pengajuan</a>
        </footer>
      </div>
    </div>`;
  }

  /* ---------- modal ---------- */
  function modalHtml() {
    if (!ui.modal) return "";
    const booking = state.bookings.find((item) => item.id === ui.modal.id);
    if (!booking) return "";
    const room = roomById(booking.roomId);
    const borrower = userById(booking.userId);
    if (ui.modal.type === "detail") {
      const timeline = state.audit.filter((entry) => entry.detail.includes(booking.ref));
      return `<div class="overlay ${ui.modal.error ? "no-anim" : ""}" data-action="close-modal-bg"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="-1">
        <header><h2 id="modal-title">${esc(booking.ref)}</h2><p>${esc(room ? room.name : "")} · ${fmtDate(booking.date)} · ${booking.start}–${booking.end} WITA</p></header>
        <div class="body">
          <div class="row between"><span>Status</span>${badge(booking.status)}</div>
          <div><div class="tiny muted">Peminjam</div>${esc(borrower ? `${borrower.name} (${borrower.unit || "-"})` : "-")}</div>
          <div><div class="tiny muted">Tujuan</div>${esc(booking.purpose)}</div>
          <div><div class="tiny muted">Peserta / kontak</div>${booking.participants} orang · ${esc(booking.contact)}</div>
          ${booking.notes ? `<div><div class="tiny muted">Keterangan</div>${esc(booking.notes)}</div>` : ""}
          ${booking.reason ? `<div class="error-box">Alasan keputusan: ${esc(booking.reason)}</div>` : ""}
          ${timeline.length ? `<div><div class="tiny muted">Linimasa</div>${timeline.map((entry) => `<div class="small">${fmtStamp(entry.at)} — ${esc(entry.action)}</div>`).join("")}</div>` : ""}
        </div>
        <footer><button class="btn btn-outline" data-action="close-modal">Tutup</button></footer>
      </div></div>`;
    }
    const config = {
      approve: { title: "Setujui pengajuan", desc: "Sistem memeriksa bentrok sebelum slot dikunci.", label: "Setujui", required: false, cls: "btn-primary" },
      reject: { title: "Tolak pengajuan", desc: "Alasan penolakan wajib diisi.", label: "Tolak", required: true, cls: "btn-danger" },
      cancel: { title: "Batalkan peminjaman", desc: hasOtherStaff() ? "Alasan wajib diisi untuk pembatalan oleh petugas." : "Slot ruangan akan dibebaskan.", label: "Batalkan", required: hasOtherStaff(), cls: "btn-danger" },
      complete: { title: "Tandai selesai", desc: "Tandai setelah jadwal berakhir.", label: "Tandai selesai", required: false, cls: "btn-primary" },
      noshow: { title: "Tandai tidak hadir", desc: "Tiga kali tidak hadir dapat membatasi akun.", label: "Tandai tidak hadir", required: false, cls: "btn-danger" },
    }[ui.modal.type] || { title: "Konfirmasi", desc: "", label: "Lanjutkan", required: false, cls: "btn-primary" };
    return `<div class="overlay ${ui.modal.error ? "no-anim" : ""}" data-action="close-modal-bg"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="-1">
      <header><h2 id="modal-title">${config.title}</h2><p>${config.desc}</p></header>
      <div class="body">
        <div class="small muted">${esc(booking.ref)} · ${esc(room ? room.name : "")} · ${fmtDate(booking.date)} ${booking.start}–${booking.end}</div>
        ${ui.modal.type !== "complete" && ui.modal.type !== "noshow" ? `<div class="field"><label for="modal-reason">Alasan ${config.required ? "(wajib)" : "(opsional)"}</label><textarea class="textarea" id="modal-reason" rows="3" placeholder="Tulis alasan...">${esc(ui.modal.reason || "")}</textarea></div>` : ""}
        ${ui.modal.error ? `<div class="error-box">${esc(ui.modal.error)}</div>` : ""}
      </div>
      <footer><button class="btn btn-outline" data-action="close-modal">Batal</button><button class="btn ${config.cls}" data-action="modal-confirm">${config.label}</button></footer>
    </div></div>`;
  }
  function hasOtherStaff() {
    return isStaff(currentUser());
  }

  /* ---------- routing/render ---------- */
  function routePath() {
    return (location.hash.replace(/^#\/?/, "").split("?")[0] || "dashboard");
  }
  function routeQuery() {
    const raw = location.hash.split("?")[1] || "";
    return new URLSearchParams(raw);
  }

  function render() {
    const app = document.getElementById("app");
    const user = currentUser();
    if (!user) {
      app.innerHTML = loginPage();
      document.getElementById("modal-root").innerHTML = "";
      return;
    }
    const path = routePath();
    const pages = {
      dashboard: () => dashboardPage(user),
      rooms: () => roomsPage(user),
      "book-new": () => newBookingPage(user),
      "booking-success": () => bookingSuccessPage(user),
      bookings: () => bookingsPage(user),
      calendar: () => calendarPage(user),
      notifications: () => notificationsPage(user),
      profile: () => profilePage(user),
      staff: () => (isStaff(user) ? staffPage(user) : unauthorized()),
      approvals: () => (canApprove(user) ? staffPage(user, true) : unauthorized()),
      "staff-rooms": () => (isStaff(user) ? staffRoomsPage() : unauthorized()),
      "staff-closures": () => (isStaff(user) ? closuresPage() : unauthorized()),
      "staff-reports": () => (isStaff(user) ? reportsPage() : unauthorized()),
      "admin-users": () => (isAdmin(user) ? adminUsersPage() : unauthorized()),
      "admin-settings": () => (isAdmin(user) ? adminSettingsPage() : unauthorized()),
      "admin-audit": () => (isAdmin(user) ? adminAuditPage() : unauthorized()),
    };
    const content = (pages[path] || (() => dashboardPage(user)))();
    const showWelcome = path === "dashboard" && !ui.modal && !welcomeSeen(user);
    app.innerHTML = layout(content);
    syncTableScroll();
    const modalRoot = document.getElementById("modal-root");
    modalRoot.innerHTML = modalHtml() + (showWelcome ? welcomeHtml(user) : "");
    ui.welcome = showWelcome;
    if (path === "booking-success") {
      requestAnimationFrame(() => app.querySelector(".success-card h1")?.focus());
    } else if (showWelcome) {
      requestAnimationFrame(() => modalRoot.querySelector(".welcome .btn")?.focus());
    } else if (ui.modal) {
      requestAnimationFrame(() => {
        const dialog = modalRoot.querySelector("[role='dialog']");
        if (!dialog) return;
        const field = dialog.querySelector("#modal-reason");
        if (field) {
          field.focus();
        } else {
          dialog.focus();
          dialog.scrollTop = 0;
        }
      });
    }
    document.title = `${path === "dashboard" ? "Dashboard" : path === "booking-success" ? "Pengajuan berhasil" : path} · SISPERU IDB Bali`;
    ui.mobileNav = false;
  }
  function unauthorized() {
    return `${pageHeader("Akses ditolak", "Anda tidak berwenang", "Halaman ini hanya untuk peran tertentu.")}<div class="empty"><b>Akses tidak diizinkan</b><a href="#/dashboard">Kembali ke dashboard</a></div>`;
  }
  function syncTableScroll() {
    document.querySelectorAll(".content .table-wrap").forEach((wrap) => {
      if (wrap.scrollWidth > wrap.clientWidth) {
        const caption = wrap.closest(".card")?.querySelector("h2")?.textContent.trim();
        wrap.tabIndex = 0;
        wrap.setAttribute("role", "region");
        wrap.setAttribute("aria-label", caption ? `Tabel: ${caption}` : "Tabel dapat digulir");
      } else {
        wrap.removeAttribute("tabindex");
        wrap.removeAttribute("role");
        wrap.removeAttribute("aria-label");
      }
    });
  }
  function focusPageHeading() {
    const heading = document.querySelector(".content .page-head h1");
    if (heading) heading.focus();
  }
  function closeModal() {
    const target = ui.lastFocus;
    const restore = target && target.dataset
      ? { action: target.dataset.action, id: target.dataset.id || "", kind: target.dataset.kind || "" }
      : null;
    ui.modal = null;
    ui.lastFocus = null;
    render();
    if (!restore || !restore.action) return;
    const selector = `[data-action="${restore.action}"]` +
      (restore.kind ? `[data-kind="${restore.kind}"]` : "") +
      (restore.id ? `[data-id="${restore.id}"]` : "");
    document.querySelector(selector)?.focus();
  }

  /* ---------- actions ---------- */
  function handleLogin(form) {
    const email = form.email.value.trim().toLowerCase();
    const password = form.password.value;
    const user = state.users.find((item) => item.email.toLowerCase() === email);
    if (!user || user.password !== password) {
      ui.loginError = "Email atau password salah.";
      render();
      return;
    }
    if (!user.active) {
      ui.loginError = "Akun ini nonaktif. Hubungi administrator.";
      render();
      return;
    }
    session = { userId: user.id };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    ui.loginError = "";
    try {
      sessionStorage.removeItem(`${WELCOME_KEY}${user.id}`);
    } catch {
      /* sessionStorage tidak tersedia */
    }
    location.hash = "#/dashboard";
    render();
    toast("Berhasil masuk", `Selamat datang, ${user.name}.`);
  }

  function handleBooking(form) {
    const user = currentUser();
    const data = {
      roomId: form.roomId.value,
      date: form.date.value,
      start: form.start.value,
      end: form.end.value,
      purpose: form.purpose.value.trim(),
      participants: Number(form.participants.value),
      contact: form.contact.value.trim(),
      unit: form.unit.value.trim(),
      notes: form.notes.value.trim(),
    };
    if (!form.agree.checked) {
      ui.bookingErrors = ["Anda harus menyetujui aturan penggunaan ruangan."];
      render();
      return;
    }
    const errors = validateBooking(data, user);
    if (errors.length) {
      ui.bookingErrors = errors;
      render();
      return;
    }
    const booking = {
      id: uid(),
      ref: refNumber(data.date),
      roomId: data.roomId,
      userId: user.id,
      date: data.date,
      start: data.start,
      end: data.end,
      purpose: data.purpose,
      participants: data.participants,
      contact: data.contact,
      unit: data.unit,
      notes: data.notes,
      status: "PENDING",
      createdAt: new Date().toISOString(),
      decidedBy: null,
      reason: null,
    };
    state.bookings.push(booking);
    log(user.id, "CREATE", `${booking.ref} dibuat (Menunggu).`);
    state.users.filter((u) => u.roles.includes("STAFF") && u.active).forEach((staff) => {
      notify(staff.id, "NEW", `Pengajuan baru ${booking.ref}`, `${user.name} mengajukan ${roomById(data.roomId)?.name}.`);
    });
    ui.bookingErrors = [];
    save();
    toast("Pengajuan berhasil dikirim", `Status Menunggu · ${booking.ref}`);
    location.hash = `#/booking-success?id=${booking.id}`;
    render();
  }

  function mutateBooking(kind, booking, user, reason) {
    if (kind === "approve") {
      if (hasConflict(booking.roomId, booking.date, booking.start, booking.end, booking.id)) {
        return "Ruangan sudah terpakai pada waktu ini. Pilih waktu atau ruangan lain.";
      }
      booking.status = "APPROVED";
      booking.decidedBy = user.id;
      booking.reason = reason || null;
      log(user.id, "APPROVE", `${booking.ref} disetujui.`);
      notify(booking.userId, "APPROVED", `Pengajuan ${booking.ref} disetujui`, "Slot ruangan sudah terkunci untuk Anda.");
      return null;
    }
    if (kind === "reject") {
      booking.status = "REJECTED";
      booking.decidedBy = user.id;
      booking.reason = reason;
      log(user.id, "REJECT", `${booking.ref} ditolak: ${reason}`);
      notify(booking.userId, "REJECTED", `Pengajuan ${booking.ref} ditolak`, reason);
      return null;
    }
    if (kind === "cancel") {
      booking.status = "CANCELLED";
      booking.reason = reason || "Dibatalkan.";
      log(user.id, "CANCEL", `${booking.ref} dibatalkan.`);
      notify(booking.userId, "CANCELLED", `Peminjaman ${booking.ref} dibatalkan`, booking.reason);
      return null;
    }
    if (kind === "complete") {
      booking.status = "COMPLETED";
      log(user.id, "COMPLETE", `${booking.ref} ditandai selesai.`);
      return null;
    }
    if (kind === "noshow") {
      booking.status = "NO_SHOW";
      log(user.id, "NO_SHOW", `${booking.ref} ditandai tidak hadir.`);
      notify(booking.userId, "NO_SHOW", `Peminjaman ${booking.ref} ditandai tidak hadir`, "Ruangan tidak digunakan.");
      return null;
    }
    return "Aksi tidak dikenal.";
  }

  function confirmModal() {
    const user = currentUser();
    const booking = state.bookings.find((item) => item.id === ui.modal.id);
    const reason = (document.getElementById("modal-reason")?.value || "").trim();
    const kind = ui.modal.type;
    if (kind === "reject" && reason.length < 5) {
      ui.modal.error = "Alasan penolakan wajib diisi minimal 5 karakter.";
      ui.modal.reason = reason;
      render();
      return;
    }
    if (kind === "cancel" && isStaff(user) && reason.length === 0) {
      ui.modal.error = "Petugas wajib mengisi alasan pembatalan.";
      ui.modal.reason = reason;
      render();
      return;
    }
    if (kind === "approve" || kind === "reject" || kind === "cancel" || kind === "complete" || kind === "noshow") {
      const error = mutateBooking(kind, booking, user, reason);
      if (error) {
        ui.modal.error = error;
        ui.modal.reason = reason;
        render();
        return;
      }
      save();
      toast("Berhasil", `${booking.ref} diperbarui.`);
      closeModal();
    }
  }

  function exportCsv() {
    const range = reportRange();
    const rows = reportRows(range);
    const header = ["Nama Peminjam", "Ruangan", "Gedung", "Referensi", "Tanggal", "Mulai", "Selesai", "Jam", "Status", "Tujuan"];
    const lines = rows.map((booking) => {
      const room = roomById(booking.roomId);
      const borrower = userById(booking.userId);
      return [
        borrower?.name || "",
        room?.name || "",
        room?.building || "",
        booking.ref,
        booking.date,
        booking.start,
        booking.end,
        Math.round((minutes(booking.start, booking.end) / 60) * 100) / 100,
        STATUS_LABEL[booking.status] || booking.status,
        booking.purpose,
      ];
    });
    const csv = [header, ...lines]
      .map((line) => line.map((cell) => {
        const text = String(cell ?? "");
        return /[",\r\n;]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
      }).join(","))
      .join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `laporan-sisperu-${range.from}-sd-${range.to}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast("CSV diunduh", `${rows.length} baris laporan.`);
  }

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-action]");
    if (!trigger) return;
    const action = trigger.dataset.action;
    const user = currentUser();
    if (action === "fill-login") {
      const email = document.getElementById("login-email");
      const password = document.getElementById("login-password");
      if (email) email.value = trigger.dataset.email;
      if (password) password.value = PASS;
      return;
    }
    if (action === "logout") {
      session = null;
      localStorage.removeItem(SESSION_KEY);
      ui.modal = null;
      location.hash = "#/login";
      render();
      return;
    }
    if (action === "open-nav") {
      ui.mobileNav = true;
      render();
      return;
    }
    if (action === "close-nav") {
      ui.mobileNav = false;
      render();
      return;
    }
    if (action === "modal") {
      ui.lastFocus = document.activeElement;
      ui.modal = { type: trigger.dataset.kind, id: trigger.dataset.id, error: "" };
      render();
      return;
    }
    if (action === "detail") {
      ui.lastFocus = document.activeElement;
      ui.modal = { type: "detail", id: trigger.dataset.id };
      render();
      return;
    }
    if (action === "close-modal") {
      closeModal();
      return;
    }
    if (action === "close-modal-bg") {
      if (event.target === trigger) closeModal();
      return;
    }
    if (action === "close-welcome" || action === "close-welcome-bg") {
      if (action === "close-welcome-bg" && event.target !== trigger) return;
      if (user) markWelcomeSeen(user);
      render();
      focusPageHeading();
      return;
    }
    if (action === "welcome-go") {
      if (user) markWelcomeSeen(user);
      return;
    }
    if (action === "modal-confirm") {
      confirmModal();
      return;
    }
    if (action === "read") {
      const note = state.notifications.find((item) => item.id === trigger.dataset.id);
      if (note) note.read = true;
      save();
      render();
      return;
    }
    if (action === "mark-all-read") {
      state.notifications.filter((n) => n.userId === user.id).forEach((n) => { n.read = true; });
      save();
      render();
      return;
    }
    if (action === "clear-search") {
      ui.search = { date: "", start: "08:00", end: "10:00", capacity: "", building: "", facility: "" };
      render();
      return;
    }
    if (action === "toggle-room") {
      const room = roomById(trigger.dataset.id);
      if (!room) return;
      room.active = !room.active;
      log(user.id, "ROOM", `${room.name} ${room.active ? "diaktifkan" : "dinonaktifkan"}.`);
      save();
      toast("Ruangan diperbarui", `${room.name} kini ${room.active ? "aktif" : "nonaktif"}.`);
      render();
      return;
    }
    if (action === "toggle-user") {
      const target = userById(trigger.dataset.id);
      if (!target) return;
      if (target.id === user.id) {
        toast("Tidak dapat menonaktifkan akun sendiri", "", "err");
        return;
      }
      target.active = !target.active;
      log(user.id, "USER", `${target.name} ${target.active ? "diaktifkan" : "dinonaktifkan"}.`);
      save();
      render();
      return;
    }
    if (action === "delete-closure") {
      state.closures = state.closures.filter((closure) => closure.id !== trigger.dataset.id);
      log(user.id, "CLOSURE", "Jadwal tutup dihapus.");
      save();
      toast("Jadwal tutup dihapus");
      render();
      return;
    }
    if (action === "export-csv") {
      exportCsv();
      return;
    }
    if (action === "reset-demo") {
      if (!window.confirm("Reset seluruh data demo di browser ini?")) return;
      localStorage.removeItem(KEY);
      state = seed();
      save();
      toast("Data demo direset");
      render();
      return;
    }
  });

  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (!form.dataset.form) return;
    event.preventDefault();
    const user = currentUser();
    if (form.dataset.form === "login") {
      handleLogin(form);
      return;
    }
    if (form.dataset.form === "booking") {
      handleBooking(form);
      return;
    }
    if (form.dataset.form === "search") {
      ui.search = {
        date: form.date.value,
        start: form.start.value,
        end: form.end.value,
        capacity: form.capacity.value,
        building: form.building.value,
        facility: form.facility.value,
      };
      render();
      return;
    }
    if (form.dataset.form === "calendar") {
      ui.calRoom = form.room.value;
      ui.week = form.from.value;
      location.hash = `#/calendar?room=${form.room.value}&from=${form.from.value}`;
      render();
      return;
    }
    if (form.dataset.form === "closure") {
      const date = form.date.value;
      const start = form.start.value;
      const end = form.end.value;
      const reason = form.reason.value.trim();
      if (minutes(start, end) <= 0) {
        toast("Jam selesai tidak valid", "Jam selesai harus lebih akhir.", "err");
        return;
      }
      if (state.closures.some((c) => c.roomId === form.roomId.value && c.date === date && overlap(start, end, c.start, c.end))) {
        toast("Jadwal tutup tumpang tindih", "Sudah ada jadwal tutup pada waktu itu.", "err");
        return;
      }
      state.closures.push({ id: uid(), roomId: form.roomId.value, date, start, end, reason, createdBy: user.id });
      log(user.id, "CLOSURE", `Jadwal tutup ${date} ${start}-${end}.`);
      save();
      toast("Jadwal tutup ditambahkan");
      render();
      return;
    }
    if (form.dataset.form === "settings") {
      const parsed = {};
      for (const key of ["openHour", "closeHour", "minLeadDays", "maxAdvanceDays", "minDuration", "maxDuration", "cancelWindow", "maxPending"]) {
        parsed[key] = Number(form[key].value);
      }
      if (parsed.closeHour <= parsed.openHour || parsed.maxDuration < parsed.minDuration) {
        toast("Pengaturan tidak valid", "Periksa jam operasional dan durasi.", "err");
        return;
      }
      state.rules = { ...state.rules, ...parsed };
      log(user.id, "SETTINGS", "Aturan peminjaman diperbarui.");
      save();
      toast("Pengaturan disimpan");
      render();
      return;
    }
    if (form.dataset.form === "report") {
      ui.report = { from: form.from.value, to: form.to.value, status: form.status.value };
      location.hash = `#/staff-reports?from=${form.from.value}&to=${form.to.value}&status=${form.status.value}`;
      render();
    }
  });

  document.addEventListener("keydown", (event) => {
    const dialog = document.querySelector("#modal-root [role='dialog']");
    if (!dialog) return;
    if (event.key === "Escape") {
      event.preventDefault();
      if (ui.modal) {
        closeModal();
      } else {
        const user = currentUser();
        if (user) markWelcomeSeen(user);
        render();
        focusPageHeading();
      }
      return;
    }
    if (event.key !== "Tab") return;
    const focusables = [...dialog.querySelectorAll(
      "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
    )].filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (document.activeElement === dialog) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(syncTableScroll, 120);
  });

  window.addEventListener("hashchange", () => {
    ui.modal = null;
    render();
  });

  if (!location.hash) location.hash = currentUser() ? "#/dashboard" : "#/login";
  render();
})();
