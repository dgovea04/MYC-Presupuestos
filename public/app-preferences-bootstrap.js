try {
  var isLandingPage = window.location.pathname === "/" || window.location.pathname === "/landing-v2";
  var mode = window.localStorage.getItem("app_view_mode");

  if (isLandingPage) {
    delete document.documentElement.dataset.viewMode;
  } else if (mode === "excel" || mode === "modern") {
    document.documentElement.dataset.viewMode = mode;
  }

  var sidebarMode = window.localStorage.getItem("myc:sidebar-mode");

  if (sidebarMode === "mini" || sidebarMode === "expanded") {
    document.documentElement.style.setProperty(
      "--app-sidebar-initial-width",
      sidebarMode === "mini" ? "80px" : "280px",
    );
  }
} catch {}
