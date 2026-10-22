// Sitios de postulación (ATS) que suelen ir en un iframe dentro de la página de la empresa.
// La extensión sólo tiene acceso a la pestaña donde la persona la abre (activeTab). Para completar un
// formulario embebido de uno de estos sitios, pide permiso para ese dominio en el momento (optional_host_permissions).
(function (root) {
  const ATS_DOMAINS = [
    "greenhouse.io", "lever.co", "ashbyhq.com", "workable.com", "myworkdayjobs.com", "workday.com", "smartrecruiters.com",
    "teamtailor.com", "bamboohr.com", "recruitee.com", "jobvite.com", "icims.com", "successfactors.com", "successfactors.eu",
    "hiringroom.com", "breezy.hr", "personio.de", "personio.com", "gupy.io", "pinpointhq.com", "jazzhr.com", "applytojob.com",
    "bumeran.com.ar", "zonajobs.com.ar", "computrabajo.com",
  ];
  /** El dominio de ATS de un host ("boards.greenhouse.io" → "greenhouse.io"), o "" si no es uno conocido. */
  function atsDomain(host) {
    const h = String(host || "").toLowerCase();
    return ATS_DOMAINS.find((d) => h === d || h.endsWith(`.${d}`)) || "";
  }
  /** Patrón de permiso para un ATS: el mismo que figura en optional_host_permissions del manifest. */
  const atsPattern = (domain) => `https://*.${domain}/*`;
  root.MARU_ATS = { ATS_DOMAINS, atsDomain, atsPattern };
})(typeof self !== "undefined" ? self : globalThis);
