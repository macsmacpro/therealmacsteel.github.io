/* capture.js — the ONE lead-capture handler for the whole site.

   Why this exists: on 2026-08-07 the site was posting leads to three different
   endpoints. Measured against the live worker:

     POST /api/lead    -> 400 on an empty body  (EXISTS, validates)
     POST /subscribe   -> 404                   (DEAD — 6 pages used it)
     POST /api/leads   -> 404                   (DEAD — 1 page used it)

   Every lead submitted through those six pages went nowhere, and the visitor was
   shown nothing to suggest it had failed. The worker also expects JSON, while a
   plain <form action> posts form-encoded — so those pages were wrong twice over.

   One handler, one endpoint, and it NEVER claims success it did not get: the
   confirmation only appears when the worker returns ok, and a failure tells the
   visitor how to reach a human instead of silently swallowing the lead. */

(function () {
  "use strict";
  var ENDPOINT = "https://swi-leads.macsmacpro.workers.dev/api/lead";
  var FALLBACK = "steelworksintelligence@gmail.com";

  function note(form, text, ok) {
    var el = form.querySelector(".capture-msg");
    if (!el) {
      el = document.createElement("p");
      el.className = "capture-msg fine";
      form.appendChild(el);
    }
    el.textContent = text;
    el.setAttribute("role", "status");
    el.dataset.state = ok ? "ok" : "error";
  }

  function wire(form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = form.querySelector('input[type="email"]');
      if (!email || !email.value) { return; }
      var btn = form.querySelector("button");
      if (btn) { btn.disabled = true; }
      note(form, "Sending…", true);

      fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "",
          email: email.value,
          company: "",
          source: "web:" + location.pathname
        })
      })
        .then(function (r) { return r.json().catch(function () { return { ok: false, error: "HTTP " + r.status }; }); })
        .then(function (d) {
          if (d && d.ok) {
            note(form, "Got it — check your inbox.", true);
            form.reset();
          } else {
            // Honest failure. A capture that fails must say so, not pretend.
            note(form, "That didn't go through (" + ((d && d.error) || "unknown") +
                       "). Email " + FALLBACK + " and I'll reply.", false);
          }
        })
        .catch(function () {
          note(form, "Couldn't reach the signup server. Email " + FALLBACK + " and I'll reply.", false);
        })
        .finally(function () { if (btn) { btn.disabled = false; } });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    Array.prototype.forEach.call(document.querySelectorAll("form.capture"), wire);
  });
})();
